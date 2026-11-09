// Real-model smoke test (no mocks): downloads & verifies SHA-256 of Qwen2.5-1.5B-Instruct-GGUF (Q4_K_M),
// loads it via @wllama/wllama in headless Chrome WITHOUT COOP/COEP headers, measures cold vs. warm load timing,
// extracts real Vinamilk 2025.pdf via PDF.js, verifies cancellation recovery, unsupported-question refusal,
// and strict financial oracle verification on real Vietnamese grounded Q&A inference.
import http from 'node:http';
import https from 'node:https';
import { createHash } from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, extname, join } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { MODEL_MANIFEST } from '../experiments/browser-ai/pdf-rag.mjs';

const ROOT_DIR = resolve(import.meta.dirname, '..');
const DIST_DIR = resolve(ROOT_DIR, 'dist');
const CACHE_DIR = resolve(ROOT_DIR, '.cache');
const LOCAL_GGUF_PATH = resolve(CACHE_DIR, MODEL_MANIFEST.filename);
const REAL_PDF_PATH = process.env.FIRMLENS_TEST_PDF_PATH || '';
const EVIDENCE_JSON_PATH = resolve(ROOT_DIR, process.env.FIRMLENS_EVIDENCE_PATH || 'docs/verification/repo-remediation-01-evidence.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.gguf': 'application/octet-stream'
};

function computeFileSha256(filePath) {
  return new Promise((res, rej) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => res(hash.digest('hex')));
    stream.on('error', rej);
  });
}

function downloadWithRedirect(url, destPath) {
  return new Promise((res, rej) => {
    const request = https.get(url, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        const nextUrl = new URL(response.headers.location, url).toString();
        downloadWithRedirect(nextUrl, destPath).then(res, rej);
        return;
      }
      if (response.statusCode !== 200) {
        rej(new Error(`HTTP ${response.statusCode} when downloading ${url}`));
        return;
      }
      const total = Number(response.headers['content-length'] || MODEL_MANIFEST.sizeBytes);
      let loaded = 0;
      let lastLoggedPct = -1;
      const out = createWriteStream(destPath);
      response.on('data', chunk => {
        loaded += chunk.length;
        const pct = Math.floor((loaded / total) * 20) * 5;
        if (pct !== lastLoggedPct && pct % 10 === 0) {
          lastLoggedPct = pct;
          process.stderr.write(`[smoke] Downloading ${MODEL_MANIFEST.filename}: ${pct}% (${(loaded / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB)\n`);
        }
      });
      response.pipe(out);
      out.on('finish', () => out.close(() => res({ loaded, total })));
      out.on('error', rej);
    });
    request.on('error', rej);
  });
}

async function ensureVerifiedModelFile() {
  mkdirSync(CACHE_DIR, { recursive: true });
  let downloadNetworkMs = null;
  if (existsSync(LOCAL_GGUF_PATH)) {
    const st = statSync(LOCAL_GGUF_PATH);
    if (st.size === MODEL_MANIFEST.sizeBytes) {
      const sha = await computeFileSha256(LOCAL_GGUF_PATH);
      if (sha === MODEL_MANIFEST.sha256) {
        process.stderr.write(`[smoke] Verified cached GGUF on disk: ${LOCAL_GGUF_PATH} (SHA-256 OK)\n`);
        return { filePath: LOCAL_GGUF_PATH, sha256: sha, sizeBytes: st.size, downloadNetworkMs: 0 };
      }
    }
    unlinkSync(LOCAL_GGUF_PATH);
  }

  const t0 = performance.now();
  await downloadWithRedirect(MODEL_MANIFEST.downloadUrl, LOCAL_GGUF_PATH);
  downloadNetworkMs = Math.round(performance.now() - t0);
  const st = statSync(LOCAL_GGUF_PATH);
  assert.equal(st.size, MODEL_MANIFEST.sizeBytes, `GGUF size mismatch: expected ${MODEL_MANIFEST.sizeBytes}, got ${st.size}`);
  const sha = await computeFileSha256(LOCAL_GGUF_PATH);
  assert.equal(sha, MODEL_MANIFEST.sha256, `GGUF SHA-256 mismatch: expected ${MODEL_MANIFEST.sha256}, got ${sha}`);
  return { filePath: LOCAL_GGUF_PATH, sha256: sha, sizeBytes: st.size, downloadNetworkMs };
}

function startSmokeServer(distDir, ggufPath) {
  const server = http.createServer((req, res) => {
    // Deliberately NO Cross-Origin-Opener-Policy or Cross-Origin-Embedder-Policy
    const url = new URL(req.url, 'http://127.0.0.1');
    let relPath = decodeURIComponent(url.pathname);

    if (relPath === `/models/${MODEL_MANIFEST.filename}`) {
      const st = statSync(ggufPath);
      const range = req.headers.range;
      if (range) {
        const match = /bytes=(\d+)-(\d*)/.exec(range);
        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : st.size - 1;
        res.writeHead(206, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${st.size}`,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        });
        createReadStream(ggufPath, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': st.size,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      createReadStream(ggufPath).pipe(res);
      return;
    }

    if (relPath.startsWith('/firm-lens/')) {
      relPath = relPath.slice('/firm-lens/'.length);
    }
    if (!relPath || relPath.endsWith('/')) relPath += 'index.html';

    const filePath = join(distDir, relPath);
    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(readFileSync(filePath));
  });

  return new Promise(resolvePromise => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolvePromise({
        server,
        baseUrl: `http://127.0.0.1:${port}/firm-lens`,
        localModelUrl: `http://127.0.0.1:${port}/models/${MODEL_MANIFEST.filename}`
      });
    });
  });
}

function assertFinancialFigurePresent(answerText, expectedDigits, label) {
  const digitsOnly = String(answerText ?? '').replace(/[^\d]/g, '');
  assert.ok(
    digitsOnly.includes(expectedDigits),
    `Expected answer to contain ${label} figure (${expectedDigits}), got: "${answerText}"`
  );
}

async function run() {
  assert.ok(REAL_PDF_PATH && existsSync(REAL_PDF_PATH), 'Set FIRMLENS_TEST_PDF_PATH to the real public Vinamilk 2025 PDF before running this opt-in model smoke.');
  const modelInfo = await ensureVerifiedModelFile();
  const { server, baseUrl, localModelUrl } = await startSmokeServer(DIST_DIR, modelInfo.filePath);
  const userDataDir = mkdtempSync(join(tmpdir(), 'firmlens-smoke-profile-'));
  const context = await chromium
    .launchPersistentContext(userDataDir, { headless: true, channel: 'chrome' })
    .catch(() => chromium.launchPersistentContext(userDataDir, { headless: true }));
  let page;
  try {
    page = context.pages()[0] || (await context.newPage());
    page.on('pageerror', error => process.stderr.write(`[smoke] Browser error: ${error.message}\n`));
    const browserVersion = context.browser()?.version() ?? 'chromium-persistent';

    // Explicit ?smoke=1 flag enables loopback modelUrl override (public mode blocks all overrides)
    const targetUrl = `${baseUrl}/experiments/browser-ai/index.html?smoke=1&modelUrl=${encodeURIComponent(localModelUrl)}`;
    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    const crossOriginIsolated = await page.evaluate(() => window.crossOriginIsolated);
    assert.equal(crossOriginIsolated, false, 'Expected crossOriginIsolated === false');

    // Clear browser model cache first to guarantee a true COLD browser load
    await page.evaluate(() => window.__FIRMLENS_BROWSER_AI__.handleClearCache());

    // 1. Cold load into browser cache (OPFS / IDB) + WASM initialization
    process.stderr.write('[smoke] Starting COLD browser model load into @wllama/wllama...\n');
    await page
      .evaluate(sha => window.__FIRMLENS_BROWSER_AI__.handleLoadModel({ verifiedSha256: sha }), modelInfo.sha256)
      .catch(() => {});
    const coldError = await page.evaluate(() => window.__FIRMLENS_BROWSER_AI__.state.lastError);
    assert.equal(coldError, null, `Cold load failed: ${JSON.stringify(coldError)}`);
    const coldStats = await page.evaluate(() => window.__FIRMLENS_BROWSER_AI__.state.lastLoadStats);
    process.stderr.write(`[smoke] COLD load complete: ${coldStats.loadMs} ms (threads=${coldStats.numThreads}, cacheMode=${coldStats.cacheMode}, sha256Verified=${coldStats.sha256Verified})\n`);
    assert.equal(coldStats.cacheMode, 'cold');
    assert.equal(coldStats.numThreads, 1);
    assert.equal(coldStats.sha256Verified, true);

    // 2. Reload page in the SAME browser context to measure WARM load from wllama browser cache
    process.stderr.write('[smoke] Reloading page to measure WARM cached model load...\n');
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(sha => window.__FIRMLENS_BROWSER_AI__.handleLoadModel({ verifiedSha256: sha }), modelInfo.sha256);
    const warmStats = await page.evaluate(() => window.__FIRMLENS_BROWSER_AI__.state.lastLoadStats);
    process.stderr.write(`[smoke] WARM load complete: ${warmStats.loadMs} ms (threads=${warmStats.numThreads}, cacheMode=${warmStats.cacheMode}, sha256Verified=${warmStats.sha256Verified})\n`);
    assert.equal(warmStats.cacheMode, 'warm');
    assert.equal(warmStats.numThreads, 1);
    assert.equal(warmStats.sha256Verified, true);

    // 3. Upload real Vinamilk 2025.pdf and extract text + table coordinates
    assert.equal(existsSync(REAL_PDF_PATH), true, `Missing real test PDF at ${REAL_PDF_PATH}`);
    await page.setInputFiles('#pdf-input', REAL_PDF_PATH);
    await page.waitForFunction(
      () => window.__FIRMLENS_BROWSER_AI__?.state?.lastPdfStats?.numPages === 112,
      null,
      { timeout: 60000 }
    );
    const pdfStats = await page.evaluate(() => window.__FIRMLENS_BROWSER_AI__.state.lastPdfStats);
    process.stderr.write(`[smoke] PDF extracted: ${pdfStats.numPages} pages, ${pdfStats.chunkCount} chunks in ${pdfStats.extractMs} ms\n`);

    // 4. Cancellation & UI recovery check (F6 / F3)
    process.stderr.write('[smoke] Testing active inference cancellation and worker recovery...\n');
    await page.fill(
      '#question-input',
      'Doanh thu và lợi nhuận thuần năm 2025 theo báo cáo kết quả hoạt động kinh doanh hợp nhất IFRS là bao nhiêu?'
    );
    await page.click('#ask-button');
    await page.waitForFunction(() => Boolean(window.__FIRMLENS_BROWSER_AI__?.state?.activeAbort), null, { timeout: 10000 });
    await page.waitForTimeout(800);
    await page.click('#cancel-action');
    await page.waitForFunction(() => !window.__FIRMLENS_BROWSER_AI__?.state?.activeAbort, null, { timeout: 15000 });
    const cancelCheck = await page.evaluate(() => ({
      lastErrorCode: window.__FIRMLENS_BROWSER_AI__.state.lastError?.code ?? null,
      loadBtnDisabled: document.querySelector('#load-model').disabled,
      cancelBtnDisabled: document.querySelector('#cancel-action').disabled,
      citationsCount: window.__FIRMLENS_BROWSER_AI__.state.citations.length
    }));
    assert.equal(cancelCheck.lastErrorCode, 'ABORTED', `Expected ABORTED after cancel, got ${JSON.stringify(cancelCheck)}`);
    assert.equal(cancelCheck.loadBtnDisabled, false);
    assert.equal(cancelCheck.cancelBtnDisabled, true);
    assert.equal(cancelCheck.citationsCount, 0);
    process.stderr.write('[smoke] Cancellation recovery verified; reloading warm model worker...\n');
    await page.evaluate(sha => window.__FIRMLENS_BROWSER_AI__.handleLoadModel({ verifiedSha256: sha }), modelInfo.sha256);

    // 5. Unsupported question refusal check (F2 / F4)
    process.stderr.write('[smoke] Testing unsupported fiscal year question (must refuse without fabricating figures)...\n');
    const unsupportedQuestion = 'Doanh thu hợp nhất IFRS năm 2019 của Vinamilk là bao nhiêu?';
    await page.fill('#question-input', unsupportedQuestion);
    await page.click('#ask-button');
    await page.waitForFunction(
      () => Boolean(window.__FIRMLENS_BROWSER_AI__?.state?.lastInferStats),
      null,
      { timeout: 30000 }
    );
    const refusalStats = await page.evaluate(() => window.__FIRMLENS_BROWSER_AI__.state.lastInferStats);
    assert.equal(refusalStats.isRefusal, true, `Expected refusal for unsupported year 2019, got: ${JSON.stringify(refusalStats)}`);
    assert.deepEqual(refusalStats.citations, [], 'Refusal must not claim verified citations');
    assert.deepEqual(refusalStats.retrievedPages, [], 'Unsupported year 2019 must retrieve 0 matching chunks');
    process.stderr.write(`[smoke] Refusal verified: "${refusalStats.answer}"\n`);

    // 6. Real supported Vietnamese financial question + strict oracle check (F1 / F2 / F6)
    const supportedQuestion =
      'Doanh thu và lợi nhuận thuần năm 2025 theo báo cáo kết quả hoạt động kinh doanh hợp nhất IFRS là bao nhiêu?';
    process.stderr.write('[smoke] Running real Vietnamese Q&A inference on Vinamilk 2025.pdf (IFRS 2025)...\n');
    await page.fill('#question-input', supportedQuestion);
    await page.click('#ask-button');
    process.stderr.write(`[smoke] Inference start state: ${JSON.stringify(await page.evaluate(() => ({ active: Boolean(window.__FIRMLENS_BROWSER_AI__.state.activeAbort), modelLoaded: window.__FIRMLENS_BROWSER_AI__.state.modelLoaded, error: window.__FIRMLENS_BROWSER_AI__.state.lastError }))) }\n`);
    const progressTimer = setInterval(async () => {
      try {
        const st = await page.evaluate(() => ({
          prog: window.__FIRMLENS_BROWSER_AI__?.state?.promptProgress,
          tokens: window.__FIRMLENS_BROWSER_AI__?.state?.streamingTokens ?? 0,
          text: (window.__FIRMLENS_BROWSER_AI__?.state?.streamingText ?? '').slice(-70),
          active: Boolean(window.__FIRMLENS_BROWSER_AI__?.state?.activeAbort)
        }));
        if (st.tokens > 0) {
          process.stderr.write(`[smoke] Streaming tokens: ${st.tokens} ("...${st.text.replace(/\s+/g, ' ')}")\n`);
        } else if (st.prog) {
          process.stderr.write(`[smoke] Prefill progress: ${st.prog.processed}/${st.prog.total} tokens (${st.prog.elapsedMs} ms)\n`);
        } else {
          process.stderr.write(`[smoke] Awaiting prompt progress; browser responsive, active=${st.active}.\n`);
        }
      } catch {}
    }, 5000);
    try {
      await page.waitForFunction(
        () =>
          Boolean(window.__FIRMLENS_BROWSER_AI__?.state?.lastInferStats?.answer) ||
          Boolean(window.__FIRMLENS_BROWSER_AI__?.state?.lastError),
        null,
        { timeout: 300000, polling: 250 }
      );
    } finally {
      clearInterval(progressTimer);
    }

    const inferErr = await page.evaluate(() => window.__FIRMLENS_BROWSER_AI__.state.lastError);
    assert.equal(inferErr, null, `Inference failed: ${JSON.stringify(inferErr)}`);

    const inferStats = await page.evaluate(() => window.__FIRMLENS_BROWSER_AI__.state.lastInferStats);
    const memoryStats = await page.evaluate(() => {
      const m = performance.memory;
      return m
        ? {
            usedJSHeapMB: Number((m.usedJSHeapSize / (1024 * 1024)).toFixed(1)),
            totalJSHeapMB: Number((m.totalJSHeapSize / (1024 * 1024)).toFixed(1)),
            jsHeapLimitMB: Number((m.jsHeapSizeLimit / (1024 * 1024)).toFixed(1))
          }
        : null;
    });

    // Strict financial oracle assertions (F1 + F2)
    assert.equal(inferStats.isRefusal, false, `Expected grounded financial answer, got refusal: ${inferStats.answer}`);
    assert.equal(inferStats.citationValid, true, `Expected valid citation in answer: ${inferStats.answer}`);
    assert.ok(inferStats.citations.includes(109), `Expected citation [Trang PDF 109] in answer, got: ${JSON.stringify(inferStats.citations)}`);
    assert.deepEqual(inferStats.invalidCitations, [], `Expected 0 invalid citations, got: ${JSON.stringify(inferStats.invalidCitations)}`);
    assert.equal(inferStats.tokenCountMethod, 'gguf-bpe-exact');
    assert.equal(inferStats.promptTokens, inferStats.llamaCppPromptTokens, 'GGUF tokenizer must match native llama.cpp prompt count');
    assertFinancialFigurePresent(inferStats.answer, '54248830', 'IFRS 2025 consolidated revenue (54.248.830)');
    assertFinancialFigurePresent(inferStats.answer, '8505216', 'IFRS 2025 consolidated net profit (8.505.216)');
    assert.match(inferStats.answer, /2025/, 'Expected answer to mention fiscal year 2025');
    assert.match(inferStats.answer, /triệu\s*(vnd|đồng)/i, 'Expected answer to state unit (Triệu VND / triệu đồng)');
    assert.ok(inferStats.inferMs < 275000, `Expected total inference time < 275,000 ms (well inside 300,000 ms budget), got ${inferStats.inferMs} ms`);

    // A second real question exercises prompt-cache accounting and the other financial year.
    const secondQuestion = 'Doanh thu hợp nhất IFRS năm 2024 là bao nhiêu?';
    process.stderr.write('[smoke] Testing a second real question for fiscal 2024 and cached-prompt parity...\n');
    await page.fill('#question-input', secondQuestion);
    await page.click('#ask-button');
    await page.waitForFunction(() => Boolean(window.__FIRMLENS_BROWSER_AI__.state.lastInferStats?.answer) || Boolean(window.__FIRMLENS_BROWSER_AI__.state.lastError), null, { timeout: 300000, polling: 250 });
    const second = await page.evaluate(() => ({ result: window.__FIRMLENS_BROWSER_AI__.state.lastInferStats, error: window.__FIRMLENS_BROWSER_AI__.state.lastError }));
    assert.equal(second.error, null, `Second inference failed: ${JSON.stringify(second.error)}`);
    assertFinancialFigurePresent(second.result.answer, '52576991', 'IFRS 2024 revenue');
    assert.match(second.result.answer, /2024/);
    assert.match(second.result.answer, /triệu\s*(vnd|đồng)/i);
    assert.ok(second.result.citations.includes(109));
    assert.equal(second.result.promptTokens, second.result.llamaCppPromptTokens);

    const summary = {
      ok: true,
      verifiedAt: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        browserVersion,
        crossOriginIsolated
      },
      model: {
        repo: MODEL_MANIFEST.repo,
        filename: MODEL_MANIFEST.filename,
        revision: MODEL_MANIFEST.revision,
        configuredSha256: MODEL_MANIFEST.sha256,
        verifiedSha256: modelInfo.sha256,
        sha256Verified: true,
        sizeBytes: modelInfo.sizeBytes,
        downloadNetworkMs: modelInfo.downloadNetworkMs
      },
      coldLoad: {
        cacheMode: coldStats.cacheMode,
        loadMs: coldStats.loadMs,
        numThreads: coldStats.numThreads,
        sha256Verified: coldStats.sha256Verified
      },
      warmLoad: {
        cacheMode: warmStats.cacheMode,
        loadMs: warmStats.loadMs,
        numThreads: warmStats.numThreads,
        sha256Verified: warmStats.sha256Verified
      },
      pdf: pdfStats,
      cancellationCheck: cancelCheck,
      unsupportedRefusalCheck: {
        question: unsupportedQuestion,
        answer: refusalStats.answer,
        isRefusal: refusalStats.isRefusal,
        retrievedPages: refusalStats.retrievedPages,
        citations: refusalStats.citations
      },
      supportedInference: {
        question: supportedQuestion,
        retrievedPages: inferStats.retrievedPages,
        citations: inferStats.citations,
        invalidCitations: inferStats.invalidCitations,
        citationValid: inferStats.citationValid,
        isRefusal: inferStats.isRefusal,
        promptTokens: inferStats.promptTokens,
        llamaCppPromptTokens: inferStats.llamaCppPromptTokens,
        tokenCountMethod: inferStats.tokenCountMethod,
        estimatedPromptTokens: inferStats.estimatedPromptTokens,
        totalBudgetTokens: inferStats.totalBudgetTokens,
        prefillMs: inferStats.prefillMs,
        firstTokenMs: inferStats.firstTokenMs,
        inferMs: inferStats.inferMs,
        tokensGenerated: inferStats.tokensGenerated,
        fittedChunks: inferStats.fittedChunks,
        messages: inferStats.messages,
        rawAnswer: inferStats.rawAnswer
      },
      secondInference: { question: secondQuestion, ...second.result },
      memory: memoryStats
    };

    writeFileSync(EVIDENCE_JSON_PATH, JSON.stringify(summary, null, 2) + '\n', 'utf8');
    process.stderr.write(`[smoke] Wrote raw verification evidence to ${EVIDENCE_JSON_PATH}\n`);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    let timer;
    const state = await Promise.race([
      page?.evaluate(() => {
        const s = window.__FIRMLENS_BROWSER_AI__?.state;
        return s ? { modelLoaded: s.modelLoaded, active: Boolean(s.activeAbort), task: s.activeTaskType, error: s.lastError, progress: s.promptProgress, tokens: s.streamingTokens, visibility: document.visibilityState } : null;
      }).catch(() => null),
      new Promise(resolve => { timer = setTimeout(() => resolve('browser unresponsive'), 3000); })
    ]);
    clearTimeout(timer);
    const failure = { ok: false, verifiedAt: new Date().toISOString(), error: error.message, state };
    writeFileSync(EVIDENCE_JSON_PATH.replace(/\.json$/, '-failure.json'), JSON.stringify(failure, null, 2) + '\n');
    process.stderr.write(`[smoke] Failure diagnostics: ${JSON.stringify(failure)}\n`);
    throw error;
  } finally {
    await context.close();
    server.close();
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
