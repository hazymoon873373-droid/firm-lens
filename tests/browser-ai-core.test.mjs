import test from 'node:test';
import assert from 'node:assert/strict';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { BrowserAiEngine } from '../experiments/browser-ai/engine.mjs';
import { createQwen2GgufTokenizer, parseGgufTokenizerFromBuffer } from '../experiments/browser-ai/gguf-tokenizer.mjs';
import {
  analyzeQueryConstraints, buildCuratedSampleChunks, chunkPdfPages, compactChunkForQuestion,
  createPdfSessionController, extractPdfPagesWithPdfjs, parseAndVerifyCitations, retrieveRelevantChunks
} from '../experiments/browser-ai/pdf-rag.mjs';
import { createSyntheticPdfBuffer, createSyntheticQwen2GgufBuffer } from './helpers/synthetic-pdf.mjs';

function tokenizerMeta() { return parseGgufTokenizerFromBuffer(createSyntheticQwen2GgufBuffer()); }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('short financial tables are narrowed by question without rewriting prose', () => {
  const text = 'Báo cáo kết quả hợp nhất\n2025 | 2024\nĐơn vị: Triệu VND | Triệu VND\nDoanh thu | 2025 (Triệu VND): 120 | 2024 (Triệu VND): 100\nLợi nhuận | 2025 (Triệu VND): 20 | 2024 (Triệu VND): 10\nTài sản | 2025 (Triệu VND): 200 | 2024 (Triệu VND): 180';
  const result = compactChunkForQuestion({ text }, 'Doanh thu năm 2025?');
  assert.ok(result.text.includes('Doanh thu | 2025'));
  assert.ok(!result.text.includes('Tài sản |'));
  const prose = { text: 'Báo cáo nêu nhiều yếu tố cần xem xét.\nCác rủi ro nằm trong phần thuyết minh.' };
  assert.deepEqual(compactChunkForQuestion(prose, 'Các rủi ro?'), prose);
});

test('PDF.js year values follow year-column coordinates, never account/note numbers or shifted missing cells', async () => {
  const bytes = createSyntheticPdfBuffer({ pages: [{ cells: [
    { x: 40, y: 780, text: 'DỮ LIỆU KIỂM THỬ TỔNG HỢP' },
    { x: 40, y: 750, text: 'Báo cáo kết quả hoạt động kinh doanh hợp nhất IFRS' },
    { x: 40, y: 710, text: 'Chỉ tiêu' }, { x: 230, y: 710, text: 'Mã' },
    { x: 270, y: 710, text: 'TM' }, { x: 360, y: 710, text: '2025' }, { x: 470, y: 710, text: '2024' },
    { x: 360, y: 690, text: 'Triệu VND' }, { x: 470, y: 690, text: 'Triệu VND' },
    { x: 40, y: 660, text: 'Doanh thu thuần' }, { x: 230, y: 660, text: '10' },
    { x: 270, y: 660, text: '6.1' }, { x: 350, y: 660, text: '123.000' }, { x: 460, y: 660, text: '100.000' },
    { x: 40, y: 630, text: 'Chi phí' }, { x: 230, y: 630, text: '11' },
    { x: 270, y: 630, text: '6.2' }, { x: 460, y: 630, text: '90.000' }
  ] }] });
  const result = await extractPdfPagesWithPdfjs(bytes.slice().buffer, pdfjsLib);
  assert.equal(result.ok, true);
  const text = result.pages[0].text;
  const revenue = text.split('\n').find(line => line.startsWith('Doanh thu thuần'));
  assert.match(revenue, /2025 \(Triệu VND\): 123\.000/);
  assert.match(revenue, /2024 \(Triệu VND\): 100\.000/);
  assert.match(revenue, /10.*6\.1/);
  assert.doesNotMatch(revenue, /2025[^:]*: 10\b|2024[^:]*: 6\.1\b/);
  const cost = text.split('\n').find(line => line.startsWith('Chi phí'));
  assert.match(cost, /2024 \(Triệu VND\): 90\.000/);
  assert.doesNotMatch(cost, /2025[^:]*: (?:11|6\.2|90\.000)/);
});

test('a refusal phrase cannot exempt uncited financial figures from citation checks', () => {
  for (const answer of [
    'Doanh thu năm 2025 là 999 triệu VND. Không đủ thông tin về lợi nhuận.',
    'Không đủ thông tin về lợi nhuận. Doanh thu năm 2025 là 999 triệu VND.',
    'Không đủ thông tin về lợi nhuận. Doanh thu tăng mạnh.'
  ]) assert.equal(parseAndVerifyCitations(answer, []).valid, false);
  assert.equal(parseAndVerifyCitations('Không đủ thông tin trong đoạn trích báo cáo về năm 2019.', []).valid, true);
});

test('the tokenizer refuses a runtime chat-template mismatch instead of counting a different template', async () => {
  const meta = tokenizerMeta();
  meta['tokenizer.chat_template'] = 'synthetic-test-template';
  const tokenizer = createQwen2GgufTokenizer(meta);
  await assert.rejects(() => tokenizer.assertRuntimeCompatible({
    getChatTemplate: () => 'different-template', mustAddBosToken: () => false, mustAddEosToken: () => false
  }), e => e.code === 'TOKENIZER_MISMATCH');
  await assert.rejects(() => tokenizer.assertRuntimeCompatible({
    getChatTemplate: () => 'synthetic-test-template', mustAddBosToken: () => false, mustAddEosToken: () => false
  }), e => e.code === 'TOKENIZER_MISMATCH');
});

test('Qwen counts every GGUF control token, including tool-call tokens, and rejects unsupported tokenizer configurations', () => {
  const meta = tokenizerMeta();
  meta['tokenizer.ggml.tokens'].push('<tool_call>');
  meta['tokenizer.ggml.token_type'].push(4);
  assert.equal(createQwen2GgufTokenizer(meta).encodeText('<tool_call>').length, 1);
  assert.throws(() => createQwen2GgufTokenizer({ ...meta, 'tokenizer.ggml.pre': 'llama3' }), /unsupported/i);
  assert.throws(() => createQwen2GgufTokenizer({ ...meta, 'tokenizer.ggml.add_bos_token': true }), /unsupported/i);
});

test('scope conflicts, missing comparison years, and separate report sections fail closed', () => {
  const vnm = buildCuratedSampleChunks('VNM').chunks;
  assert.deepEqual(retrieveRelevantChunks(vnm, 'So sánh doanh thu hợp nhất IFRS năm 2025 và 2023?'), []);
  assert.equal(retrieveRelevantChunks(vnm, 'So sánh doanh thu hợp nhất IFRS năm 2025 và 2024?')[0].pageNumber, 109);
  assert.deepEqual(retrieveRelevantChunks(vnm, 'So sánh doanh thu IFRS và VAS năm 2025?'), []);
  assert.deepEqual(retrieveRelevantChunks(vnm, 'Doanh thu hợp nhất và riêng năm 2025?'), []);
  const mixed = chunkPdfPages([{ pageNumber: 1, text: 'Báo cáo hợp nhất IFRS 2025\nBáo cáo riêng VAS 2025\nDoanh thu 123' }]);
  assert.deepEqual(retrieveRelevantChunks(mixed, 'Doanh thu hợp nhất IFRS năm 2025?'), []);
  const sections = ['Báo cáo tài chính hợp nhất IFRS 2025\nDoanh thu 123', 'Báo cáo tài chính riêng VAS 2025\nDoanh thu 456'];
  const split = chunkPdfPages([{ pageNumber: 1, text: sections.join('\n'), sections }]);
  assert.equal(retrieveRelevantChunks(split, 'Doanh thu hợp nhất IFRS 2025?')[0]?.standard, 'IFRS');
  assert.equal(retrieveRelevantChunks(split, 'Doanh thu riêng VAS 2025?')[0]?.standard, 'VAS');
});

test('nonfinancial Vietnamese questions do not imply IFRS or parent-company scope', () => {
  assert.equal(analyzeQueryConstraints('Rủi ro thị trường quốc tế của doanh nghiệp là gì?').standard, null);
  assert.equal(analyzeQueryConstraints('Nói riêng về rủi ro chuỗi cung ứng?').scope, null);
  const sample = buildCuratedSampleChunks('VNM').chunks;
  assert.equal(retrieveRelevantChunks(sample, 'Nói riêng về rủi ro thị trường quốc tế và chuỗi cung ứng?')[0]?.pageNumber, 95);
  assert.deepEqual(retrieveRelevantChunks(buildCuratedSampleChunks('DGC').chunks, 'Dòng tiền kinh doanh năm 2025?'), []);
});

test('compacting a table retains every header needed to bind units and years', () => {
  const text = [
    '[Chuẩn mực: IFRS Hợp nhất]', '[Nguồn mẫu biên soạn — thử nghiệm]',
    'Báo cáo kết quả hoạt động kinh doanh hợp nhất IFRS', 'Chỉ tiêu | 2025 | 2024',
    'Đơn vị: Triệu VND | Triệu VND', 'Doanh thu | 100 | 90',
    'Lợi nhuận | 10 | 9', 'Chi phí | 90 | 81', 'Tài sản | 200 | 190'
  ].join('\n');
  const result = compactChunkForQuestion({ text, pageNumber: 1 }, 'Doanh thu năm 2025?', { maxRows: 1 });
  assert.match(result.text, /Đơn vị: Triệu VND/);
  assert.match(result.text, /2025 \| 2024/);
  assert.match(result.text, /Doanh thu \| 100 \| 90/);
});

test('deadline settles even when the runtime ignores AbortSignal and exit never resolves', async () => {
  const engine = new BrowserAiEngine({ wasmUrl: 'unused' });
  engine.tokenizer = { countChatTokens: () => 100 };
  let exitCalled = false;
  engine.wllama = {
    isModelLoaded: () => true,
    createChatCompletion: () => new Promise(() => {}),
    exit: () => { exitCalled = true; return new Promise(() => {}); }
  };
  const result = await Promise.race([
    engine.ask({ question: 'Doanh thu?', chunks: [{ pageNumber: 1, text: 'Doanh thu 100' }], deadlineMs: 15 }).catch(e => e.code),
    wait(100).then(() => 'HUNG')
  ]);
  assert.equal(result, 'INFERENCE_TIMEOUT');
  assert.equal(exitCalled, true);
  assert.equal(engine.wllama, null);
});

test('native prompt-count disagreement stops generation before publishing tokens', async () => {
  const engine = new BrowserAiEngine({ wasmUrl: 'unused' });
  engine.tokenizer = { countChatTokens: () => 100 };
  let published = false;
  engine.wllama = {
    isModelLoaded: () => true, exit: async () => {},
    createChatCompletion: async () => (async function* () {
      yield { prompt_progress: { total: 999, processed: 0 } };
      yield { choices: [{ delta: { content: '[Trang PDF 1] Doanh thu 100.' } }] };
    })()
  };
  await assert.rejects(() => engine.ask({ question: 'Doanh thu?', chunks: [{ pageNumber: 1, text: 'Doanh thu 100' }], onToken: () => { published = true; } }), e => e.code === 'TOKENIZER_MISMATCH');
  assert.equal(published, false);
  assert.equal(engine.wllama, null);
});

test('cancel during initial PDF parse destroys loading task and settles even without a parser rejection', async () => {
  let destroyed = 0;
  const parser = { getDocument: () => ({ promise: new Promise(() => {}), destroy: async () => { destroyed++; } }) };
  const abort = new AbortController();
  const pending = extractPdfPagesWithPdfjs(new Uint8Array([1]).buffer, parser, { signal: abort.signal });
  abort.abort();
  const result = await Promise.race([pending, wait(100).then(() => ({ code: 'HUNG' }))]);
  assert.equal(result.code, 'ABORTED');
  assert.ok(destroyed >= 1);
});

test('a canceled initial File read releases the session without waiting for arrayBuffer', async () => {
  const controller = createPdfSessionController({ pdfjsLib: { getDocument() { throw new Error('must not parse'); } } });
  const pending = controller.selectFile({ name: 'slow.pdf', type: 'application/pdf', size: 10, arrayBuffer: () => new Promise(() => {}) });
  controller.reset();
  const result = await Promise.race([pending, wait(100).then(() => ({ code: 'HUNG' }))]);
  assert.equal(result.code, 'SUPERSEDED');
});

test('an already-canceled model load does not create a WASM runtime', async () => {
  const engine = new BrowserAiEngine({ wasmUrl: 'unused' });
  engine.checkCacheStatus = async () => ({ isCached: false });
  engine._ensureTokenizerFromCache = async () => ({ vocabSize: 256, preTokenizer: 'qwen2' });
  let created = false;
  engine._createWllama = () => {
    created = true;
    return { loadModelFromUrl: async () => {}, exit: async () => {}, getNumThreads: () => 1, getModelMetadata: () => ({}) };
  };
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(() => engine.loadModel({ signal: abort.signal }), e => e.name === 'AbortError');
  assert.equal(created, false);
});

test('encrypted and corrupt PDF parser errors destroy resources and return actionable codes', async () => {
  for (const [name, code] of [['PasswordException', 'ENCRYPTED_PDF'], ['InvalidPDFException', 'UNREADABLE_PDF']]) {
    let destroyed = 0;
    const result = await extractPdfPagesWithPdfjs(new Uint8Array([1]).buffer, {
      getDocument: () => ({ promise: Promise.reject(Object.assign(new Error('test parser error'), { name })), destroy: async () => { destroyed++; } })
    });
    assert.equal(result.code, code);
    assert.equal(destroyed, 1);
  }
});

test('File read failures clear prior evidence and leave a retryable empty session', async () => {
  const controller = createPdfSessionController();
  controller.loadCuratedSample('VNM');
  const result = await controller.selectFile({ name: 'unavailable.pdf', size: 10, type: 'application/pdf', arrayBuffer: async () => { throw new Error('File is no longer available'); } });
  assert.equal(result.code, 'FILE_READ_ERROR');
  assert.equal(controller.state.chunks.length, 0);
  assert.equal(controller.state.activeAbort, null);
});
