import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('visitor-facing Vietnamese is valid UTF-8 without replacement characters or common mojibake', () => {
  for (const path of ['index.html', 'app.mjs', 'data.mjs', 'de-xuat.md', 'experiments/browser-ai/index.html', 'experiments/browser-ai/app.mjs', 'experiments/browser-ai/pdf-rag.mjs']) {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(new URL(`../${path}`, import.meta.url)));
    assert.doesNotMatch(text, /\uFFFD|Ã[\u00A0-\u00BF]|áº|á»/, path);
    assert.equal(text, text.normalize('NFC'), `${path}: normalize Vietnamese accents to NFC`);
  }
});
