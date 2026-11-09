// Portable end-to-end Playwright browser suite for main ledger views, AI navigation, curated VNM/DGC samples,
// synthetic text-PDF extraction, interactive citations, C1/C4 guardrails, keyboard navigation, and 320-1920px layout checks.
import http from 'node:http';
import { mkdirSync, readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createSyntheticPdfBuffer, createSyntheticQwen2GgufBuffer } from './helpers/synthetic-pdf.mjs';
import { parseGgufTokenizerFromBuffer, createQwen2GgufTokenizer } from '../experiments/browser-ai/gguf-tokenizer.mjs';
import { companies, ratio } from '../data.mjs';

const ROOT_DIR = resolve(import.meta.dirname, '..');
const DIST_DIR = resolve(ROOT_DIR, 'dist');
const SCREENSHOT_DIR = resolve(ROOT_DIR, 'docs/verification/screenshots');
const OPTIONAL_REAL_PDF_PATH = process.env.FIRMLENS_TEST_PDF_PATH || '';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf'
};

function startStaticServer(distDir) {
  const server = http.createServer((req, res) => {
    // Deliberately DO NOT set Cross-Origin-Opener-Policy or Cross-Origin-Embedder-Policy
    const url = new URL(req.url, 'http://127.0.0.1');
    let relPath = decodeURIComponent(url.pathname);
    if (relPath.startsWith('/firm-lens/')) {
      relPath = relPath.slice('/firm-lens/'.length);
    } else if (relPath === '/firm-lens' || relPath === '/') {
      relPath = 'index.html';
    } else {
      // Anything outside /firm-lens/ should 404 to prove base /firm-lens/ path correctness!
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found outside /firm-lens/');
      return;
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
      resolvePromise({ server, baseUrl: `http://127.0.0.1:${port}/firm-lens` });
    });
  });
}

async function fetchStatus(url) {
  const resp = await fetch(url);
  return resp.status;
}

async function measureViewportMetrics(page, width, height = 840) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(80);
  return await page.evaluate(() => {
    const docEl = document.documentElement;
    const container = document.querySelector('main.container') || document.querySelector('.container');
    const style = container ? getComputedStyle(container) : null;
    const padL = style ? parseFloat(style.paddingLeft) : 0;
    const padR = style ? parseFloat(style.paddingRight) : 0;
    const rectW = container ? Math.round(container.getBoundingClientRect().width) : 0;
    return {
      viewportWidth: window.innerWidth,
      scrollWidth: docEl.scrollWidth,
      hasHorizontalOverflow: docEl.scrollWidth > window.innerWidth,
      containerWidth: rectW,
      gutterLeft: padL,
      gutterRight: padR,
      contentWidth: Math.round(rectW - padL - padR)
    };
  });
}

async function run() {
  if (!existsSync(resolve(DIST_DIR, 'index.html'))) {
    throw new Error('dist/index.html not found. Run `npm run build` before `npm run test:browser`.');
  }
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const { server, baseUrl } = await startStaticServer(DIST_DIR);
  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));

  try {
    // 0. Verify built static assets, WASM binary, PDF worker and proposal markdown under /firm-lens/ base URL
    const assetDir = resolve(DIST_DIR, 'assets');
    const assetFiles = existsSync(assetDir) ? readdirSync(assetDir) : [];
    const wasmAsset = assetFiles.find(f => f.endsWith('.wasm'));
    const pdfWorkerAsset = assetFiles.find(f => f.includes('pdf.worker') && f.endsWith('.mjs'));
    assert.ok(wasmAsset, 'Expected bundled wllama .wasm asset in dist/assets/');
    assert.ok(pdfWorkerAsset, 'Expected bundled pdf.worker .mjs asset in dist/assets/');
    assert.equal(await fetchStatus(`${baseUrl}/index.html`), 200);
    assert.equal(await fetchStatus(`${baseUrl}/de-xuat.md`), 200);
    assert.equal(await fetchStatus(`${baseUrl}/favicon.svg`), 200);
    assert.equal(await fetchStatus(`${baseUrl}/experiments/browser-ai/index.html`), 200);
    assert.equal(await fetchStatus(`${baseUrl}/assets/${wasmAsset}`), 200);
    assert.equal(await fetchStatus(`${baseUrl}/assets/${pdfWorkerAsset}`), 200);

    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const pageErrors = [];
    const failedLocalResponses = [];
    const outboundRequests = [];

    page.on('pageerror', err => pageErrors.push(String(err)));
    page.on('response', resp => {
      const u = resp.url();
      if (u.startsWith('http://127.0.0.1') && resp.status() >= 400) {
        failedLocalResponses.push(`${resp.status()} ${u}`);
      }
    });
    page.on('request', req => {
      const u = req.url();
      if (!u.startsWith('http://127.0.0.1') && !u.startsWith('blob:') && !u.startsWith('data:')) {
        outboundRequests.push(u);
      }
    });

    // 1. Main Ledger: verify all 4 hash views, company switching, CSV download, source dialog, and approved net margin copy
    await page.setViewportSize({ width: 1280, height: 840 });
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
    const vietnameseFonts = await page.evaluate(async () => {
      const loaded = await document.fonts.load('400 32px "FirmLens Serif"', 'Đọc sâu con số. Nhìn rõ doanh nghiệp. ĂÂÊÔƠƯăâêôơư ẮẰẲẴẶấầẩẫậếềểễệốồổỗộớờởỡợứừửữự');
      return loaded.map(face => face.status);
    });
    assert.ok(vietnameseFonts.length >= 2 && vietnameseFonts.every(status => status === 'loaded'), 'Vietnamese and Latin self-hosted font subsets must load');
    for (const report of ['competition-readiness.md', 'toolkit-sources.md', 'co-so-khoa-hoc.md']) assert.equal(await fetchStatus(`${baseUrl}/${report}`), 200);
    assert.ok((await page.title()).includes('FirmLens'));
    assert.ok((await page.locator('#company-name').textContent()).includes('Vinamilk'));

    const current = companies.VNM.years[2025];
    const percent = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
    const precise = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
    assert.ok((await page.locator('.ratio-value').nth(0).innerText()).includes(percent.format(ratio(current.profit, current.revenue))));
    assert.ok((await page.locator('.ratio-value').nth(1).innerText()).includes(precise.format(current.currentAssets / current.currentLiabilities)));
    assert.ok((await page.locator('.ratio-value').nth(2).innerText()).includes(precise.format(current.cashflow / current.profit)));
    await page.locator('.ratio-item [data-source]').first().click();
    assert.equal(await page.locator('#source-dialog').evaluate(dialog => dialog.open), true);
    assert.match(await page.locator('#source-content').innerText(), /Trang in 216/);
    await page.keyboard.press('Escape');

    // Open & close source evidence dialog
    await page.click('#insight-list .source-button >> nth=0');
    assert.equal(await page.locator('#source-dialog').evaluate(d => d.open), true);
    await page.click('#close-dialog');
    assert.equal(await page.locator('#source-dialog').evaluate(d => d.open), false);

    // Switch to DGC and verify CSV download + missing cashflow chart message
    await page.click('button[data-company="DGC"]');
    assert.equal(new URL(page.url()).searchParams.get('company'), 'DGC');
    assert.equal(await page.locator('.ratio-missing').count(), 2);
    assert.ok((await page.locator('#company-name').textContent()).includes('Đức Giang'));
    await page.click('button[data-chart="cashflow"]');
    assert.match(await page.locator('#chart').textContent(), /Chưa nhập dòng tiền hợp nhất/);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#tong-quan .export-csv')
    ]);
    assert.equal(download.suggestedFilename(), 'FirmLens_DGC_2024_2025.csv');

    // Navigate across the other 3 hash views (#du-lieu, #phuong-phap, #de-xuat)
    await page.click('a[data-view="du-lieu"]');
    assert.equal(await page.locator('#du-lieu').isVisible(), true);
    await page.fill('#source-search', 'không-tồn-tại-xyz');
    assert.match(await page.locator('#documents').textContent(), /Không tìm thấy tài liệu phù hợp/);
    await page.fill('#source-search', '');

    await page.click('a[data-view="phuong-phap"]');
    assert.equal(await page.locator('#phuong-phap').isVisible(), true);
    assert.match(
      await page.locator('#phuong-phap').textContent(),
      /biên lợi nhuận ròng năm tài chính kế tiếp/,
      'Methodology view must state approved next-fiscal-year net profit margin target'
    );

    await page.click('a[data-view="de-xuat"]');
    assert.equal(await page.locator('#de-xuat').isVisible(), true);
    await page.click('a[data-view="tong-quan"]');
    assert.equal(await page.locator('#tong-quan').isVisible(), true);

    // Capture desktop & mobile screenshots of main ledger and verify responsive widths across 320..1920
    await page.click('button[data-company="VNM"]');
    await page.click('button[data-chart="revenue"]');
    const ledgerViewports = {};
    for (const vw of [320, 375, 768, 1280, 1920]) {
      await page.setViewportSize({ width: vw, height: 840 });
      for (const route of ['du-lieu', 'phuong-phap', 'de-xuat', 'tong-quan']) {
        await page.click(`a[data-view="${route}"]`);
        assert.equal(await page.locator(`#${route}`).isVisible(), true);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route}: overflow at ${vw}px`);
      }
      const m = await measureViewportMetrics(page, vw);
      ledgerViewports[vw] = m;
      assert.equal(m.hasHorizontalOverflow, false, `Ledger overflow at ${vw}px: ${JSON.stringify(m)}`);
      if (vw === 375) {
        assert.equal(m.gutterLeft, 16);
        assert.equal(m.contentWidth, 343);
        await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'ledger-mobile-375.png'), fullPage: false });
      }
      if (vw === 1280) {
        await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'ledger-desktop-1280.png'), fullPage: false });
      }
    }

    // 2. U1 + U3: Follow AI entry link from main ledger (?sample=VNM), verify 0 automatic model downloads, then return link
    await page.setViewportSize({ width: 1280, height: 840 });
    await Promise.all([
      page.waitForURL(/\/experiments\/browser-ai\/index\.html\?sample=VNM/),
      page.click('#open-ai-sample')
    ]);
    assert.equal(outboundRequests.length, 0, 'Opening AI page must NEVER auto-download the 1.12GB model');
    const crossOriginIsolated = await page.evaluate(() => window.crossOriginIsolated);
    assert.equal(crossOriginIsolated, false);

    // Curated VNM sample is active immediately before model load; source preview works right away
    const vnmSampleState = await page.evaluate(() => ({
      sourceKind: window.__FIRMLENS_BROWSER_AI__.state.sourceKind,
      ticker: window.__FIRMLENS_BROWSER_AI__.state.sampleMeta?.ticker,
      modelLoaded: window.__FIRMLENS_BROWSER_AI__.state.modelLoaded,
      retrievedCount: window.__FIRMLENS_BROWSER_AI__.state.retrieved.length,
      topPage: window.__FIRMLENS_BROWSER_AI__.state.retrieved[0]?.pageNumber
    }));
    assert.equal(vnmSampleState.sourceKind, 'curated-sample');
    assert.equal(vnmSampleState.ticker, 'VNM');
    assert.equal(vnmSampleState.modelLoaded, false);
    assert.equal(vnmSampleState.retrievedCount, 1);
    assert.equal(vnmSampleState.topPage, 109);
    assert.match(await page.locator('#sample-provenance').textContent(), /data\.mjs/);

    // Switch to DGC curated sample: verify provisional April 2026 & 25/06/2026 audit warning + missing null fields note
    await page.click('#sample-dgc');
    const dgcProvenanceText = await page.locator('#sample-provenance').textContent();
    assert.match(dgcProvenanceText, /07\/04\/2026/);
    assert.match(dgcProvenanceText, /25\/06\/2026/);
    assert.match(dgcProvenanceText, /Dòng tiền kinh doanh/);

    // Return link navigates cleanly back to main ledger
    await Promise.all([
      page.waitForURL(/\/firm-lens\/index\.html/),
      page.click('#back-to-ledger')
    ]);
    assert.equal(await page.locator('#tong-quan').isVisible(), true);

    // 3. F5 public modelUrl override rejected when not in smoke mode
    await page.goto(
      `${baseUrl}/experiments/browser-ai/index.html?modelUrl=${encodeURIComponent('https://evil.example.com/fake.gguf')}`,
      { waitUntil: 'networkidle' }
    );
    const overrideErr = await page.evaluate(() => window.__FIRMLENS_BROWSER_AI__.state.lastError);
    assert.equal(overrideErr?.code, 'OVERRIDE_DISABLED');

    // 4. T1 + C2: Portable synthetic PDF upload, coordinate extraction, bidirectional scope/standard/year preview & interactive citations
    await page.goto(`${baseUrl}/experiments/browser-ai/index.html`, { waitUntil: 'networkidle' });
    const synthPdfBuffer = Buffer.from(createSyntheticPdfBuffer());
    await page.setInputFiles('#pdf-input', {
      name: 'synthetic-financial-test.pdf',
      mimeType: 'application/pdf',
      buffer: synthPdfBuffer
    });
    await page.waitForFunction(
      () => window.__FIRMLENS_BROWSER_AI__?.state?.lastPdfStats?.numPages === 2,
      null,
      { timeout: 15000 }
    );
    const synthRetrieved = await page.evaluate(() => window.__FIRMLENS_BROWSER_AI__.state.retrieved);
    assert.equal(synthRetrieved.length, 1);
    assert.equal(synthRetrieved[0].pageNumber, 1);
    assert.ok(synthRetrieved[0].text.includes('12.345.000'));

    // Query VAS separate (parent company) -> retrieves Page 2 (6.789.000), NOT Page 1
    await page.fill(
      '#question-input',
      'Doanh thu năm 2025 theo báo cáo riêng công ty mẹ chuẩn mực VAS là bao nhiêu?'
    );
    await page.click('#preview-retrieval');
    const sepRetrieved = await page.evaluate(() => window.__FIRMLENS_BROWSER_AI__.state.retrieved);
    assert.equal(sepRetrieved.length, 1);
    assert.equal(sepRetrieved[0].pageNumber, 2);
    assert.ok(sepRetrieved[0].text.includes('6.789.000'));

    // Query unavailable year 2019 -> empty retrieved + honest missing-evidence message
    await page.fill('#question-input', 'Doanh thu hợp nhất IFRS năm 2019 là bao nhiêu?');
    await page.click('#preview-retrieval');
    assert.match(await page.locator('#retrieved-chunks').textContent(), /Không đủ bằng chứng/i);

    // Restore Page 1 preview for layout & citation checks
    await page.fill(
      '#question-input',
      'Doanh thu và lợi nhuận thuần năm 2025 theo báo cáo hợp nhất IFRS là bao nhiêu?'
    );
    await page.click('#preview-retrieval');

    // Verify AI workspace responsive layout at 320, 375, 768, 1280, 1920 + mobile/desktop screenshots
    const aiViewports = {};
    const detailsOpenDefault = await page.locator('#diagnostics-details').evaluate(d => d.open);
    assert.equal(detailsOpenDefault, false, 'Diagnostics details must be collapsed by default');

    for (const vw of [320, 375, 768, 1280, 1920]) {
      const m = await measureViewportMetrics(page, vw);
      aiViewports[vw] = m;
      assert.equal(m.hasHorizontalOverflow, false, `AI page overflow at ${vw}px: ${JSON.stringify(m)}`);
      if (vw === 320) {
        assert.equal(m.gutterLeft, 16);
        assert.equal(m.contentWidth, 288);
      }
      if (vw === 375) {
        assert.equal(m.gutterLeft, 16, 'Mobile 375px gutter must be 16px (not 64px)');
        assert.equal(m.contentWidth, 343, 'Mobile 375px content width must be 343px (not 247px)');
        await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'browser-ai-mobile-375.png'), fullPage: false });
      }
      if (vw === 768) {
        assert.equal(m.gutterLeft, 24, 'Tablet 768px gutter must be 24px');
        assert.equal(m.contentWidth, 720);
      }
      if (vw === 1280) {
        await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'browser-ai-desktop-1280.png'), fullPage: false });
      }
    }

    // 5. Keyboard-only operation + Interactive Citation Scroll/Highlight + C1 UI fail-closed check
    await page.setViewportSize({ width: 1280, height: 840 });
    await page.keyboard.press('Tab'); // skip-link
    const skipOutline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth);
    assert.notEqual(skipOutline, '0px', 'Focused element must have visible focus outline');

    // Focus #sample-vnm via keyboard and press Enter
    await page.locator('#sample-vnm').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.__FIRMLENS_BROWSER_AI__.state.sampleMeta?.ticker), 'VNM');

    // Inject synthetic GGUF tokenizer + isolated stream stub ONLY to test UI provisional streaming,
    // C1 uncited rejection clearing, and U3 interactive citation button keyboard activation
    const synthGgufArray = Array.from(createSyntheticQwen2GgufBuffer());
    const c1AndCitationUi = await page.evaluate(async ggufBytes => {
      const app = window.__FIRMLENS_BROWSER_AI__;
      // Build tokenizer in browser via page's bundled engine helper? Let's pass a minimal countChatTokens stub for UI-only test
      app.engine.tokenizer = { countChatTokens: () => 250 };
      app.state.modelLoaded = true;

      // Case A: Stream provisional text WITHOUT citation -> must show provisional banner during stream, then reject & clear!
      let sawProvisionalDuringStream = false;
      app.engine.wllama = {
        isModelLoaded: () => true,
        createChatCompletion: async () =>
          (async function* () {
            yield { prompt_progress: { processed: 250, total: 250 } };
            yield { choices: [{ delta: { content: 'Doanh thu năm 2025 là 999 triệu VND.' } }] };
            sawProvisionalDuringStream =
              !document.getElementById('provisional-banner').hidden &&
              document.getElementById('ai-answer').dataset.provisional === 'true';
          })(),
        exit: async () => {}
      };

      let rejectedCode = null;
      try {
        await app.handleAskQuestion();
      } catch (e) {
        rejectedCode = e?.code ?? null;
      }
      const afterUncited = {
        sawProvisionalDuringStream,
        rejectedCode,
        answerText: document.getElementById('ai-answer').textContent,
        provisionalHidden: document.getElementById('provisional-banner').hidden,
        citationsCount: document.querySelectorAll('#answer-citations .citation-tag').length,
        retryVisible: !document.getElementById('retry-action').hidden
      };

      // Case B: Grounded answer WITH [Trang PDF 109] -> renders interactive citation button
      app.engine.wllama = {
        isModelLoaded: () => true,
        createChatCompletion: async () =>
          (async function* () {
            yield { prompt_progress: { processed: 250, total: 250 } };
            yield {
              choices: [
                { delta: { content: '[Trang PDF 109] Doanh thu năm 2025 đạt 54.248.830 triệu VND.' } }
              ]
            };
          })(),
        exit: async () => {}
      };
      await app.handleAskQuestion();
      return { afterUncited, citedButtons: document.querySelectorAll('#answer-citations .citation-tag').length };
    }, synthGgufArray);

    assert.equal(c1AndCitationUi.afterUncited.sawProvisionalDuringStream, true);
    assert.equal(c1AndCitationUi.afterUncited.rejectedCode, 'MISSING_CITATION');
    assert.equal(c1AndCitationUi.afterUncited.answerText, '', 'Rejected uncited answer must be cleared from UI');
    assert.equal(c1AndCitationUi.afterUncited.provisionalHidden, true);
    assert.equal(c1AndCitationUi.afterUncited.citationsCount, 0);
    assert.equal(c1AndCitationUi.afterUncited.retryVisible, true);
    assert.equal(c1AndCitationUi.citedButtons, 1);

    // Activate citation button via keyboard Enter -> scrolls to and highlights #evidence-page-109
    await page.locator('#answer-citations .citation-tag').first().focus();
    await page.keyboard.press('Enter');
    const highlightState = await page.evaluate(() => ({
      highlightedAttr: document.getElementById('evidence-page-109')?.dataset?.highlighted ?? null,
      activeId: document.activeElement?.id ?? null,
      feedback: document.getElementById('citation-feedback')?.textContent ?? ''
    }));
    assert.equal(highlightState.highlightedAttr, 'true');
    assert.equal(highlightState.activeId, 'evidence-page-109');
    assert.match(highlightState.feedback, /Trang PDF 109/);

    // Missing source page fallback shows honest limitation
    const missingCiteOk = await page.evaluate(() => window.__FIRMLENS_BROWSER_AI__.focusCitationPage(999));
    assert.equal(missingCiteOk, false);
    assert.match(await page.locator('#citation-feedback').textContent(), /Giới hạn hiển thị/);

    // 6. C4 Browser UI checks: >50MB pre-allocation block, delayed A/B file-read race, corrupt & scanned PDF error states
    const c4BrowserCheck = await page.evaluate(async validBytesArr => {
      const app = window.__FIRMLENS_BROWSER_AI__;
      let hugeAllocated = false;
      const hugeFile = {
        name: 'oversized-60mb.pdf',
        type: 'application/pdf',
        size: 60 * 1024 * 1024,
        async arrayBuffer() {
          hugeAllocated = true;
          return new ArrayBuffer(16);
        }
      };
      const hugeRes = await app.selectPdfFile(hugeFile);
      const afterHuge = {
        code: hugeRes.code,
        hugeAllocated,
        chunksCount: app.state.chunks.length,
        answerCitationsHtml: document.getElementById('answer-citations').innerHTML
      };

      // Delayed A vs fast B race in browser UI
      const validBytes = new Uint8Array(validBytesArr);
      let resolveSlowA;
      const slowA = {
        name: 'slow-A.pdf',
        type: 'application/pdf',
        size: validBytes.byteLength,
        arrayBuffer: () =>
          new Promise(r => {
            resolveSlowA = () => r(validBytes.slice().buffer);
          })
      };
      const fastB = {
        name: 'fast-B.pdf',
        type: 'application/pdf',
        size: validBytes.byteLength,
        arrayBuffer: async () => validBytes.slice().buffer
      };
      const pA = app.selectPdfFile(slowA);
      const busyDuringRead = document.getElementById('load-model').disabled && !document.getElementById('cancel-action').disabled;
      const pB = app.selectPdfFile(fastB);
      const rB = await pB;
      resolveSlowA();
      const rA = await pA;

      return {
        afterHuge,
        race: {
          busyDuringRead,
          rACode: rA.code,
          rBFileName: rB.fileName,
          finalDocName: app.state.docName
        }
      };
    }, Array.from(synthPdfBuffer));

    assert.equal(c4BrowserCheck.afterHuge.code, 'OVERSIZED_PDF');
    assert.equal(c4BrowserCheck.afterHuge.hugeAllocated, false);
    assert.equal(c4BrowserCheck.afterHuge.chunksCount, 0);
    assert.equal(c4BrowserCheck.afterHuge.answerCitationsHtml, '');
    assert.equal(c4BrowserCheck.race.rACode, 'SUPERSEDED');
    assert.equal(c4BrowserCheck.race.busyDuringRead, true, 'File read must immediately expose busy/cancel UI');
    assert.equal(c4BrowserCheck.race.finalDocName, 'fast-B.pdf');

    // An old inference rejection must not clear the newly selected sample or publish its stale error.
    const supersededInfer = await page.evaluate(async () => {
      const app = window.__FIRMLENS_BROWSER_AI__;
      app.selectCuratedSample('VNM');
      app.state.modelLoaded = true;
      let rejectOld;
      const originalAsk = app.engine.ask;
      app.engine.ask = () => new Promise((_, reject) => { rejectOld = reject; });
      const old = app.handleAskQuestion().catch(e => ({ code: e.code }));
      app.selectCuratedSample('DGC');
      rejectOld({ code: 'ABORTED', message: 'old document inference stopped' });
      const result = await old;
      app.engine.ask = originalAsk;
      return { code: result.code, error: app.state.lastError, ticker: app.state.sampleMeta.ticker,
        evidence: document.getElementById('retrieved-chunks').textContent,
        answer: document.getElementById('ai-answer').textContent };
    });
    assert.equal(supersededInfer.code, 'SUPERSEDED');
    assert.equal(supersededInfer.error, null);
    assert.equal(supersededInfer.ticker, 'DGC');
    assert.match(supersededInfer.evidence, /DGC/);
    assert.notEqual(supersededInfer.answer, '');

    // Scanned / empty-text PDF error state
    const emptyTextPdf = Buffer.from(createSyntheticPdfBuffer({ pages: [{ cells: [] }] }));
    await page.setInputFiles('#pdf-input', {
      name: 'scanned-empty.pdf',
      mimeType: 'application/pdf',
      buffer: emptyTextPdf
    });
    await page.waitForFunction(
      () => window.__FIRMLENS_BROWSER_AI__?.state?.lastError?.code === 'SCANNED_OR_EMPTY_PDF',
      null,
      { timeout: 10000 }
    );
    assert.match(await page.locator('#error-banner').textContent(), /SCANNED_OR_EMPTY_PDF/);

    // Reset restores clean empty state
    await page.click('#reset-pdf');
    assert.equal(await page.evaluate(() => window.__FIRMLENS_BROWSER_AI__.state.docName), null);

    // Optional real PDF check if FIRMLENS_TEST_PDF_PATH is set
    let optionalRealPdfPages = null;
    if (OPTIONAL_REAL_PDF_PATH && existsSync(OPTIONAL_REAL_PDF_PATH)) {
      await page.setInputFiles('#pdf-input', OPTIONAL_REAL_PDF_PATH);
      await page.waitForFunction(
        () => window.__FIRMLENS_BROWSER_AI__?.state?.lastPdfStats?.numPages === 112,
        null,
        { timeout: 30000 }
      );
      optionalRealPdfPages = 112;
    }

    assert.equal(
      outboundRequests.length,
      0,
      `Expected zero external network calls during E2E tests, got: ${outboundRequests.join(', ')}`
    );
    assert.equal(
      failedLocalResponses.length,
      0,
      `Unexpected 4xx/5xx local asset responses: ${failedLocalResponses.join('; ')}`
    );
    assert.equal(pageErrors.length, 0, `Unexpected page errors: ${pageErrors.join('; ')}`);

    console.log(
      JSON.stringify({
        ok: true,
        browserVersion: browser.version(),
        crossOriginIsolated,
        outboundRequests: outboundRequests.length,
        verifiedAssets: { wasmAsset, pdfWorkerAsset },
        ledgerViewports,
        aiViewports,
        optionalRealPdfPages
      })
    );
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
