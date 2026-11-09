import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import wllamaWasmUrl from '@wllama/wllama/esm/wasm/wllama.wasm?url';
import {
  MODEL_MANIFEST,
  createPdfSessionController,
  retrieveRelevantChunks,
  describeMissingEvidence,
  resolveModelUrl
} from './pdf-rag.mjs';
import { BrowserAiEngine, classifyEngineError } from './engine.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const urlParams = new URLSearchParams(window.location.search);
const isSmokeMode = urlParams.get('smoke') === '1';
const rawModelUrl = urlParams.get('modelUrl');
const initialSampleParam = urlParams.get('sample');
const resolvedModel = resolveModelUrl(rawModelUrl, { allowLoopbackOverride: isSmokeMode });
const activeModelUrl = resolvedModel.ok ? resolvedModel.url : MODEL_MANIFEST.downloadUrl;

const DEFAULT_SAMPLE_QUESTIONS = {
  VNM: 'Doanh thu và lợi nhuận thuần năm 2025 theo báo cáo kết quả hoạt động kinh doanh hợp nhất IFRS là bao nhiêu?',
  DGC: 'Doanh thu hợp nhất năm 2025 của Hóa chất Đức Giang là bao nhiêu?'
};

const engine = new BrowserAiEngine({
  wasmUrl: wllamaWasmUrl,
  allowLoopbackOverride: isSmokeMode
});

const state = {
  manifest: MODEL_MANIFEST,
  modelUrl: activeModelUrl,
  isLoopbackOverride: Boolean(resolvedModel.ok && resolvedModel.isOverride),
  configuredSha256: MODEL_MANIFEST.sha256,
  sha256Verified: false,
  verifiedSha256: null,
  crossOriginIsolated: Boolean(window.crossOriginIsolated),
  modelLoaded: false,
  cacheStatus: null,
  lastLoadStats: null,
  lastInferStats: null,
  lastPdfStats: null,
  docRevision: 0,
  sourceKind: null,
  sampleMeta: null,
  docName: null,
  pages: [],
  chunks: [],
  retrieved: [],
  retrievedPages: [],
  citations: [],
  highlightedPage: null,
  streamingText: '',
  streamingTokens: 0,
  isProvisionalStream: false,
  promptProgress: null,
  activeAbort: null,
  activeTaskType: null,
  lastRetryableAction: null,
  lastError: null
};

const els = {
  isolation: document.getElementById('metric-isolation'),
  cache: document.getElementById('metric-cache'),
  loadMs: document.getElementById('metric-load-ms'),
  inferMs: document.getElementById('metric-infer-ms'),
  tokensMetric: document.getElementById('metric-tokens'),
  revisionMetric: document.getElementById('metric-revision'),
  errorBanner: document.getElementById('error-banner'),
  sampleVnmBtn: document.getElementById('sample-vnm'),
  sampleDgcBtn: document.getElementById('sample-dgc'),
  sampleProvenance: document.getElementById('sample-provenance'),
  modelStatus: document.getElementById('model-status'),
  modelProgress: document.getElementById('model-progress'),
  modelProgressText: document.getElementById('model-progress-text'),
  loadModelBtn: document.getElementById('load-model'),
  cancelBtn: document.getElementById('cancel-action'),
  retryBtn: document.getElementById('retry-action'),
  clearCacheBtn: document.getElementById('clear-cache'),
  pdfInput: document.getElementById('pdf-input'),
  pdfStatus: document.getElementById('pdf-status'),
  resetPdfBtn: document.getElementById('reset-pdf'),
  questionInput: document.getElementById('question-input'),
  previewBtn: document.getElementById('preview-retrieval'),
  askBtn: document.getElementById('ask-button'),
  provisionalBanner: document.getElementById('provisional-banner'),
  aiAnswer: document.getElementById('ai-answer'),
  answerCitations: document.getElementById('answer-citations'),
  citationFeedback: document.getElementById('citation-feedback'),
  retrievedChunks: document.getElementById('retrieved-chunks')
};

function showError(errObj, retryAction = null) {
  state.lastError = errObj;
  state.lastRetryableAction = retryAction;
  els.errorBanner.hidden = false;
  els.errorBanner.textContent = `[${errObj.code}] ${errObj.message}`;
  els.retryBtn.hidden = !retryAction;
  syncButtons();
}

function clearError() {
  state.lastError = null;
  state.lastRetryableAction = null;
  els.errorBanner.hidden = true;
  els.errorBanner.textContent = '';
  els.retryBtn.hidden = true;
}

function setProgress(percent) {
  const clamped = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  els.modelProgress.value = clamped;
  els.modelProgress.textContent = `${clamped}%`;
  if (els.modelProgressText) {
    els.modelProgressText.textContent = `${clamped}%`;
  }
}

function setProvisionalStreaming(active) {
  state.isProvisionalStream = Boolean(active);
  if (els.provisionalBanner) {
    els.provisionalBanner.hidden = !active;
  }
  if (active) {
    els.aiAnswer.dataset.provisional = 'true';
  } else {
    delete els.aiAnswer.dataset.provisional;
  }
}

function syncSampleButtons() {
  const activeTicker = state.sourceKind === 'curated-sample' ? state.sampleMeta?.ticker : null;
  els.sampleVnmBtn.setAttribute('aria-pressed', String(activeTicker === 'VNM'));
  els.sampleDgcBtn.setAttribute('aria-pressed', String(activeTicker === 'DGC'));
}

function renderSampleProvenance(sample) {
  if (!sample) {
    els.sampleProvenance.hidden = true;
    els.sampleProvenance.innerHTML = '';
    return;
  }
  els.sampleProvenance.hidden = false;
  els.sampleProvenance.innerHTML = '';

  const badge = document.createElement('strong');
  badge.textContent = `Bản trích chọn biên soạn từ data.mjs (${sample.ticker} — ${sample.version}) · Không phải tệp PDF đầy đủ mới phân tích.`;

  const note = document.createElement('span');
  note.textContent = `${sample.sourceNote} Phạm vi: ${sample.scope}; cơ sở: ${sample.standard}; đơn vị: ${sample.unit}.`;

  els.sampleProvenance.append(badge, note);

  if (sample.missingMetricLabels?.length > 0) {
    const missing = document.createElement('span');
    missing.textContent = `Giới hạn dữ liệu: Chưa nhập ${sample.missingMetricLabels.join(', ')} (giữ trạng thái thiếu dữ liệu null, không thay bằng số 0).`;
    els.sampleProvenance.appendChild(missing);
  }

  const linksRow = document.createElement('span');
  const mainLink = document.createElement('a');
  mainLink.href = sample.sourceUrl;
  mainLink.target = '_blank';
  mainLink.rel = 'noopener noreferrer';
  mainLink.textContent = 'Mở trang công bố báo cáo gốc';
  linksRow.appendChild(mainLink);

  if (sample.updatedUrl) {
    linksRow.append(' · ');
    const updLink = document.createElement('a');
    updLink.href = sample.updatedUrl;
    updLink.target = '_blank';
    updLink.rel = 'noopener noreferrer';
    updLink.textContent = 'Đối chiếu thông báo cập nhật BCTC kiểm toán 25/06/2026';
    linksRow.appendChild(updLink);
  }
  els.sampleProvenance.appendChild(linksRow);
}

function syncSessionMirror() {
  state.docRevision = sessionController.state.docRevision;
  state.sourceKind = sessionController.state.sourceKind;
  state.sampleMeta = sessionController.state.sampleMeta;
  state.docName = sessionController.state.docName;
  state.pages = sessionController.state.pages;
  state.chunks = sessionController.state.chunks;
  state.lastPdfStats = sessionController.state.lastPdfStats;
  if (els.revisionMetric) {
    els.revisionMetric.textContent = String(state.docRevision);
  }
  syncSampleButtons();
  renderSampleProvenance(state.sampleMeta);
}

function syncButtons() {
  const hasSource = state.chunks.length > 0;
  const pdfBusy = Boolean(sessionController.state.activeAbort);
  const busy = Boolean(state.activeAbort) || pdfBusy;
  els.loadModelBtn.disabled = busy;
  els.cancelBtn.disabled = !busy;
  els.retryBtn.disabled = busy;
  els.clearCacheBtn.disabled = busy;
  els.sampleVnmBtn.disabled = busy && state.activeTaskType === 'model';
  els.sampleDgcBtn.disabled = busy && state.activeTaskType === 'model';
  els.pdfInput.disabled = busy && state.activeTaskType === 'model';
  const hasResettableState = hasSource || pdfBusy || Boolean(state.lastError);
  els.resetPdfBtn.disabled = !hasResettableState || (busy && state.activeTaskType === 'model');
  els.previewBtn.disabled = !hasSource || busy;
  els.askBtn.disabled = !hasSource || !state.modelLoaded || busy;
}

function clearAnswerAndEvidenceUI() {
  state.lastInferStats = null;
  state.retrieved = [];
  state.retrievedPages = [];
  state.citations = [];
  state.highlightedPage = null;
  state.streamingText = '';
  state.streamingTokens = 0;
  state.promptProgress = null;
  setProvisionalStreaming(false);
  els.aiAnswer.textContent =
    'Câu trả lời của AI sẽ hiển thị tại đây sau khi bạn nạp mô hình (bước 2) và bấm "Hỏi mô hình AI cục bộ".';
  els.answerCitations.innerHTML = '';
  els.citationFeedback.textContent =
    'Nhãn nguồn chỉ xác nhận trang thuộc ngữ cảnh đã truy xuất, không tự chứng minh độ chính xác số học — bấm vào nhãn trang để cuộn tới và đối chiếu nguyên văn đoạn trích.';
  els.retrievedChunks.innerHTML =
    '<li class="chunk-item">Chưa có đoạn trích. Hãy chọn mẫu VNM / DGC hoặc tải tệp PDF ở bước 1.</li>';
  if (els.tokensMetric) {
    els.tokensMetric.textContent = 'Đầu vào ≤256 token; ngữ cảnh 1024';
  }
}

function renderRetrievedChunks(list, { emptyReason = null } = {}) {
  els.retrievedChunks.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'chunk-item';
    li.textContent =
      emptyReason ||
      'Không tìm thấy đoạn trích khớp với năm, chuẩn mực kế toán, phạm vi hợp nhất/riêng hoặc từ khóa được hỏi.';
    els.retrievedChunks.appendChild(li);
    return;
  }
  for (const item of list) {
    const li = document.createElement('li');
    li.className = 'chunk-item';
    li.id = `evidence-page-${item.pageNumber}`;
    li.dataset.page = String(item.pageNumber);
    li.tabIndex = -1;
    if (state.highlightedPage === item.pageNumber) {
      li.dataset.highlighted = 'true';
    }

    const cite = document.createElement('span');
    cite.className = 'chunk-cite';
    const sourceBadge = item.isCuratedSample
      ? `[Trang PDF ${item.pageNumber} · Trích lục mẫu ${item.ticker}]`
      : `[Trang PDF ${item.pageNumber}]`;
    cite.textContent = `${sourceBadge} (điểm khớp: ${item.score ?? 0})`;
    li.appendChild(cite);

    if (item.locatorLabel) {
      const loc = document.createElement('span');
      loc.className = 'chunk-locator';
      loc.textContent = `Vị trí đối chiếu: ${item.locatorLabel}`;
      li.appendChild(loc);
    }

    const text = document.createElement('div');
    text.className = 'chunk-text';
    text.textContent = item.text;
    li.appendChild(text);
    els.retrievedChunks.appendChild(li);
  }
}

function focusCitationPage(pageNumber) {
  const targetPage = Number(pageNumber);
  const items = [...els.retrievedChunks.querySelectorAll('.chunk-item[data-page]')];
  let matchedEl = null;
  for (const el of items) {
    const isMatch = Number(el.dataset.page) === targetPage;
    if (isMatch) {
      el.dataset.highlighted = 'true';
      matchedEl = el;
    } else {
      delete el.dataset.highlighted;
    }
  }

  if (!matchedEl) {
    state.highlightedPage = null;
    els.citationFeedback.textContent = `Giới hạn hiển thị: không tìm thấy thẻ đoạn trích cho [Trang PDF ${targetPage}] trong danh sách hiện tại.`;
    return false;
  }

  state.highlightedPage = targetPage;
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  matchedEl.scrollIntoView?.({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'nearest' });
  matchedEl.focus?.({ preventScroll: true });
  els.citationFeedback.textContent = `Đã mở và tô sáng đoạn trích [Trang PDF ${targetPage}] để bạn đối chiếu nguyên văn.`;
  return true;
}

function renderCitations(pages) {
  els.answerCitations.innerHTML = '';
  for (const p of pages) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'citation-tag';
    btn.dataset.citePage = String(p);
    btn.textContent = `[Trang PDF ${p}] · Mở đoạn trích`;
    btn.addEventListener('click', () => {
      focusCitationPage(p);
    });
    els.answerCitations.appendChild(btn);
  }
}

const sessionController = createPdfSessionController({
  pdfjsLib,
  onSessionCleared: () => {
    // Synchronously invalidate any active inference and wipe stale answers/citations/chunks at selection time!
    if (state.activeAbort && state.activeTaskType === 'infer') {
      state.activeAbort.abort();
      engine.abortActiveInference().catch(() => {});
      state.modelLoaded = false;
      state.activeAbort = null;
      state.activeTaskType = null;
    }
    clearError();
    clearAnswerAndEvidenceUI();
    syncSessionMirror();
    syncButtons();
  },
  onProgress: ({ currentPage, totalPages }) => {
    els.pdfStatus.textContent = `Đang trích xuất văn bản trang ${currentPage}/${totalPages}…`;
  }
});

async function refreshCacheStatus() {
  const status = await engine.checkCacheStatus(activeModelUrl);
  state.cacheStatus = status;
  state.sha256Verified = Boolean(status.sha256Verified);
  state.verifiedSha256 = status.verifiedSha256 ?? null;
  els.cache.textContent = status.isCached
    ? `Đã lưu đệm (${(status.cachedBytes / (1024 * 1024)).toFixed(0)} MB${status.sha256Verified ? ', SHA-256 đã xác minh' : ''})`
    : 'Chưa có trong bộ nhớ đệm (Cold)';
  return status;
}

async function handleLoadModel({ verifiedSha256 = null } = {}) {
  clearError();
  if (!resolvedModel.ok) {
    showError(resolvedModel);
    throw resolvedModel;
  }
  const abortController = new AbortController();
  state.activeAbort = abortController;
  state.activeTaskType = 'model';
  syncButtons();
  setProgress(0);
  els.modelStatus.textContent = 'Đang khởi tạo WebAssembly và tải mô hình Qwen2.5-1.5B-Instruct (1.12 GB)…';

  try {
    const stats = await engine.loadModel({
      modelUrl: activeModelUrl,
      verifiedSha256,
      signal: abortController.signal,
      onProgress: ({ loaded, total, percent }) => {
        setProgress(percent);
        const mbLoaded = (loaded / (1024 * 1024)).toFixed(1);
        const mbTotal = (total / (1024 * 1024)).toFixed(1);
        els.modelStatus.textContent = `Đang nạp mô hình: ${percent}% (${mbLoaded} / ${mbTotal} MB)`;
      }
    });
    state.modelLoaded = true;
    state.lastLoadStats = stats;
    state.sha256Verified = Boolean(stats.sha256Verified);
    state.verifiedSha256 = stats.verifiedSha256 ?? null;
    setProgress(100);
    els.loadMs.textContent = `${stats.loadMs} ms (${stats.cacheMode === 'warm' ? 'Warm cache' : 'Cold load'})`;
    els.modelStatus.textContent = `Sẵn sàng: Qwen2.5-1.5B-Instruct (${stats.numThreads} luồng WASM, chế độ ${stats.cacheMode}, từ vựng ${stats.tokenizerVocabSize} token, ${stats.loadMs} ms).`;
    await refreshCacheStatus();
    return stats;
  } catch (err) {
    state.modelLoaded = false;
    setProgress(0);
    const classified = classifyEngineError(err);
    els.modelStatus.textContent = `${classified.message} Bạn có thể bấm "Thử lại" hoặc "Nạp mô hình AI" để thử lại.`;
    showError(classified, () => handleLoadModel({ verifiedSha256 }));
    throw classified;
  } finally {
    if (state.activeAbort === abortController) {
      state.activeAbort = null;
      state.activeTaskType = null;
    }
    syncButtons();
  }
}

async function handleClearCache() {
  clearError();
  await engine.clearCache();
  state.modelLoaded = false;
  state.lastLoadStats = null;
  state.sha256Verified = false;
  state.verifiedSha256 = null;
  setProgress(0);
  els.loadMs.textContent = 'Chưa đo';
  els.modelStatus.textContent = 'Đã xóa bộ nhớ đệm GGUF trong trình duyệt.';
  await refreshCacheStatus();
  syncButtons();
}

async function cancelActiveWork() {
  if (sessionController.state.activeAbort) {
    sessionController.reset();
    syncSessionMirror();
    els.pdfStatus.textContent = 'Đã hủy đọc tệp PDF và dọn tài nguyên phiên cũ.';
    syncButtons();
    return;
  }
  if (state.activeAbort) {
    const wasInfer = state.activeTaskType === 'infer';
    state.activeAbort.abort();
    if (wasInfer) {
      await engine.abortActiveInference();
      state.modelLoaded = false;
    }
  }
}

async function selectPdfFile(file) {
  if (!file) return null;
  els.pdfStatus.textContent = `Đang kiểm tra tệp ${file.name || 'PDF'}…`;
  syncButtons();

  const pending = sessionController.selectFile(file);
  syncButtons();
  const res = await pending;
  if (res.code === 'SUPERSEDED') {
    return res;
  }

  syncSessionMirror();
  syncButtons();

  if (!res.ok) {
    els.pdfInput.value = '';
    els.pdfStatus.textContent = res.message;
    showError({ code: res.code, message: res.message });
    return res;
  }

  const stats = res.stats;
  els.pdfStatus.textContent = `Đã đọc tệp ${stats.fileName}: ${stats.numPages} trang PDF, ${stats.chunkCount} đoạn trích (${stats.extractMs} ms).`;
  els.inferMs.textContent = `PDF: ${stats.extractMs} ms`;
  runRetrievalPreview();
  return stats;
}

async function loadPdfBuffer(arrayBuffer, fileName = 'document.pdf') {
  els.pdfStatus.textContent = `Đang đọc tệp ${fileName} bằng PDF.js…`;
  syncButtons();

  const pending = sessionController.loadBuffer(arrayBuffer, fileName);
  syncButtons();
  const res = await pending;
  if (res.code === 'SUPERSEDED') {
    return res;
  }

  syncSessionMirror();
  syncButtons();

  if (!res.ok) {
    els.pdfStatus.textContent = res.message;
    showError({ code: res.code, message: res.message });
    return res;
  }

  const stats = res.stats;
  els.pdfStatus.textContent = `Đã đọc ${stats.fileName}: ${stats.numPages} trang PDF, ${stats.chunkCount} đoạn trích (${stats.extractMs} ms).`;
  els.inferMs.textContent = `PDF: ${stats.extractMs} ms`;
  runRetrievalPreview();
  return stats;
}

function selectCuratedSample(ticker, { updateQuestion = true } = {}) {
  els.pdfInput.value = '';
  const res = sessionController.loadCuratedSample(ticker);
  syncSessionMirror();

  if (!res.ok) {
    els.pdfStatus.textContent = res.message;
    showError({ code: res.code, message: res.message });
    syncButtons();
    return res;
  }

  const sample = res.sample;
  if (updateQuestion && DEFAULT_SAMPLE_QUESTIONS[sample.ticker]) {
    els.questionInput.value = DEFAULT_SAMPLE_QUESTIONS[sample.ticker];
  }
  els.pdfStatus.textContent = `Đang mở bản trích chọn biên soạn từ data.mjs: ${sample.name} (${sample.ticker} · ${sample.version}, ${sample.chunks.length} thẻ nguồn).`;
  runRetrievalPreview();
  syncButtons();
  return res;
}

async function resetPdfSession() {
  // Invalidate first; the session callback cancels inference without delaying the reset.
  sessionController.reset();
  syncSessionMirror();
  els.pdfInput.value = '';
  els.pdfStatus.textContent = 'Đã đặt lại nguồn tài liệu. Toàn bộ câu trả lời và đoạn trích cũ đã được xóa.';
  syncButtons();
}

function runRetrievalPreview() {
  state.highlightedPage = null;
  if (!state.chunks.length) {
    state.retrieved = [];
    state.retrievedPages = [];
    renderRetrievedChunks([]);
    return [];
  }
  const q = els.questionInput.value.trim();
  const top = retrieveRelevantChunks(state.chunks, q, { topK: MODEL_MANIFEST.limits.topKChunks });
  state.retrieved = top;
  state.retrievedPages = [...new Set(top.map(c => c.pageNumber))];
  const emptyReason = top.length === 0 ? describeMissingEvidence(q, state.chunks) : null;
  renderRetrievedChunks(top, { emptyReason });
  return top;
}

async function handleAskQuestion() {
  clearError();
  if (!state.chunks.length) {
    const err = { code: 'NO_PDF', message: 'Vui lòng chọn mẫu VNM/DGC hoặc tải báo cáo PDF trước khi đặt câu hỏi.' };
    showError(err);
    return err;
  }
  if (!state.modelLoaded) {
    const err = { code: 'MODEL_NOT_LOADED', message: 'Mô hình AI chưa được nạp. Vui lòng bấm "Nạp mô hình AI" ở bước 2.' };
    showError(err, () => handleLoadModel());
    return err;
  }

  const startRevision = state.docRevision;
  const question = els.questionInput.value.trim();
  const top = runRetrievalPreview();
  const abortController = new AbortController();
  state.activeAbort = abortController;
  state.activeTaskType = 'infer';
  state.lastInferStats = null;
  state.citations = [];
  state.streamingText = '';
  state.streamingTokens = 0;
  state.promptProgress = null;
  setProvisionalStreaming(true);
  syncButtons();

  els.aiAnswer.textContent = 'Đang đo token GGUF BPE và suy luận trên trình duyệt (CPU WASM 1 luồng)…';
  renderCitations([]);

  try {
    const res = await engine.ask({
      question,
      chunks: top,
      allChunks: state.chunks,
      docName: state.docName || 'Báo cáo PDF',
      maxTokens: 72,
      temperature: 0.0,
      signal: abortController.signal,
      onPromptProgress: prog => {
        if (startRevision !== state.docRevision || state.activeAbort !== abortController) return;
        state.promptProgress = prog;
        els.inferMs.textContent = `Prefill: ${prog.processed}/${prog.total} tok (${prog.elapsedMs} ms)`;
      },
      onToken: ({ text, tokensGenerated, firstTokenMs }) => {
        if (startRevision !== state.docRevision || state.activeAbort !== abortController) return;
        state.streamingText = text;
        state.streamingTokens = tokensGenerated;
        els.aiAnswer.textContent = text;
        els.inferMs.textContent = `TTFT: ${firstTokenMs} ms · ${tokensGenerated} tok (bản nháp)`;
      }
    });

    if (startRevision !== state.docRevision) {
      return { ok: false, code: 'SUPERSEDED', message: 'Phiên tài liệu đã thay đổi trong lúc suy luận.' };
    }

    setProvisionalStreaming(false);
    state.lastInferStats = res;
    state.citations = res.citations;
    state.retrievedPages = res.retrievedPages;
    state.retrieved = res.fittedChunks;
    renderRetrievedChunks(res.fittedChunks);
    els.aiAnswer.textContent = res.answer;
    els.inferMs.textContent = `TTFT: ${res.firstTokenMs} ms · Tổng: ${res.inferMs} ms (${res.tokensGenerated} tok)`;
    if (els.tokensMetric) {
      const llamaPart = res.llamaCppPromptTokens ? `, llama.cpp=${res.llamaCppPromptTokens}` : '';
      els.tokensMetric.textContent = `Prompt=${res.promptTokens} tok${llamaPart}, Tổng dự phòng=${res.totalBudgetTokens}/${MODEL_MANIFEST.limits.nCtx}`;
    }
    renderCitations(res.citations);
    return res;
  } catch (err) {
    if (startRevision !== state.docRevision) {
      return { ok: false, code: 'SUPERSEDED', message: 'Phiên tài liệu đã thay đổi trong lúc suy luận.' };
    }
    setProvisionalStreaming(false);
    const classified = classifyEngineError(err);
    const workerStopped = !engine.wllama;
    if (workerStopped) {
      state.modelLoaded = false;
      els.modelStatus.textContent =
        classified.code === 'INFERENCE_TIMEOUT'
          ? 'Đã dừng worker do vượt quá thời hạn 270 giây. Bấm "Thử lại" hoặc "Nạp mô hình AI" để khởi tạo lại từ bộ nhớ đệm.'
          : 'Đã dừng worker suy luận theo yêu cầu hủy. Bấm "Thử lại" hoặc "Nạp mô hình AI" để khởi tạo lại từ bộ nhớ đệm.';
    }
    state.citations = [];
    els.aiAnswer.textContent = '';
    renderCitations([]);
    const retryFn = !state.modelLoaded
      ? async () => {
          await handleLoadModel({ verifiedSha256: state.verifiedSha256 });
        }
      : () => handleAskQuestion();
    showError(classified, retryFn);
    throw classified;
  } finally {
    if (state.activeAbort === abortController) {
      state.activeAbort = null;
      state.activeTaskType = null;
    }
    syncButtons();
  }
}

async function handleRetry() {
  const fn = state.lastRetryableAction;
  if (typeof fn === 'function') {
    return await fn();
  }
  if (!state.modelLoaded) {
    return await handleLoadModel({ verifiedSha256: state.verifiedSha256 });
  }
  if (state.chunks.length > 0) {
    return await handleAskQuestion();
  }
  return null;
}

els.isolation.textContent = state.crossOriginIsolated
  ? 'Bật (crossOriginIsolated = true)'
  : 'Tắt (crossOriginIsolated = false, 1 luồng)';

if (!resolvedModel.ok) {
  showError(resolvedModel);
}

els.sampleVnmBtn.addEventListener('click', () => {
  selectCuratedSample('VNM');
});
els.sampleDgcBtn.addEventListener('click', () => {
  selectCuratedSample('DGC');
});
els.loadModelBtn.addEventListener('click', () => {
  handleLoadModel().catch(() => {});
});
els.cancelBtn.addEventListener('click', () => {
  cancelActiveWork().catch(() => {});
});
els.retryBtn.addEventListener('click', () => {
  handleRetry().catch(() => {});
});
els.clearCacheBtn.addEventListener('click', () => {
  handleClearCache().catch(() => {});
});
els.pdfInput.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  selectPdfFile(file).catch(() => {});
});
els.resetPdfBtn.addEventListener('click', () => {
  resetPdfSession().catch(() => {});
});
els.previewBtn.addEventListener('click', () => {
  runRetrievalPreview();
});
els.askBtn.addEventListener('click', () => {
  handleAskQuestion().catch(() => {});
});
document.querySelector('.skip-link')?.addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('main')?.focus();
});

if (initialSampleParam && ['VNM', 'DGC'].includes(initialSampleParam.toUpperCase())) {
  selectCuratedSample(initialSampleParam.toUpperCase());
}

refreshCacheStatus();
syncButtons();

window.__FIRMLENS_BROWSER_AI__ = {
  state,
  engine,
  sessionController,
  selectPdfFile,
  loadPdfBuffer,
  selectCuratedSample,
  resetPdfSession,
  runRetrievalPreview,
  focusCitationPage,
  handleLoadModel,
  handleClearCache,
  handleAskQuestion,
  handleRetry,
  cancelActiveWork
};
