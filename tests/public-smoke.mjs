// Opt-in post-deployment check; never downloads the GGUF model.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = 'https://hazymoon873373-droid.github.io/firm-lens/';
const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [], failed = [], modelRequests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failed.push({ url: response.url(), status: response.status() }); });
page.on('request', request => { if (request.url().includes('.gguf')) modelRequests.push(request.url()); });

try {
  const response = await page.goto(base, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  assert.match(await page.locator('#tong-quan h1').innerText(), /Đọc sâu con số/);
  const fonts = await page.evaluate(async () => {
    const loaded = await document.fonts.load('400 32px "FirmLens Serif"', 'Đọc sâu con số. Nhìn rõ doanh nghiệp. ĂÂÊÔƠƯ ấềữ');
    return loaded.map(face => face.status);
  });
  assert.ok(fonts.length >= 2 && fonts.every(status => status === 'loaded'));
  await page.screenshot({ path: 'docs/verification/screenshots/public-ledger-desktop.png' });
  await page.locator('[data-company="DGC"]').click();
  assert.equal(await page.locator('.ratio-missing').count(), 2);
  assert.equal(new URL(page.url()).searchParams.get('company'), 'DGC');
  await page.locator('[data-view="du-lieu"]').click();
  assert.equal(await page.locator('.document').count(), 7);
  await page.locator('[data-view="tong-quan"]').click();
  await page.locator('[data-company="VNM"]').click();
  await page.locator('#open-ai-sample').click();
  await page.waitForFunction(() => window.__FIRMLENS_BROWSER_AI__?.state?.chunks?.length > 0);
  assert.equal(await page.locator('#sample-vnm').getAttribute('aria-pressed'), 'true');
  await page.locator('#preview-retrieval').click();
  assert.match(await page.locator('#retrieved-chunks').innerText(), /54.248.830/);
  assert.equal(modelRequests.length, 0);
  assert.equal(await page.locator('#ask-button').isDisabled(), true);
  await page.setViewportSize({ width: 375, height: 900 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: 'docs/verification/screenshots/public-ai-mobile.png' });
  const reports = ['competition-readiness.md', 'toolkit-sources.md', 'co-so-khoa-hoc.md', 'repo-remediation-01.md', 'ai-verification-evidence.json'];
  for (const file of reports) assert.equal((await fetch(base + file)).status, 200, file);
  const evidence = await (await fetch(base + 'ai-verification-evidence.json')).json();
  assert.equal(evidence.ok, true);
  assert.equal(evidence.supportedInference.promptTokens, 236);
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  const result = { ok: true, verifiedAt: new Date().toISOString(), url: base, releaseCommit: 'c1cab4064dfc23c0c11942f70d78322cdfc21cc7', fonts, rootAndAi: true, ledgerCompanyAndMissingValues: true, sourceDocuments: 7, mobileWidth: 375, automaticModelRequests: modelRequests.length, reports, errors, failed };
  writeFileSync('docs/verification/public-smoke-evidence.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
