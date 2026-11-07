import test from 'node:test';
import assert from 'node:assert/strict';
import { companies, metrics, ratio, change, toCsv } from '../data.mjs';

test('ratios and changes use real denominators and preserve unavailable values', () => {
  assert.equal(ratio(25, 100), 25);
  assert.equal(ratio(null, 100), null);
  assert.equal(ratio(10, 0), null);
  assert.equal(change(110, 100), 10);
  assert.equal(change(null, 100), null);
  assert.equal(change(10, 0), null);
});

test('sample data retains accounting scope, exact units, missing values and sources', () => {
  assert.deepEqual(Object.keys(companies), ['VNM', 'DGC']);
  assert.equal(companies.VNM.years[2025].revenue, 54248830);
  assert.equal(companies.VNM.standard, 'IFRS');
  assert.equal(companies.DGC.years[2025].revenue, 11262000);
  assert.equal(companies.DGC.years[2025].cashflow, null);
  assert.equal(companies.DGC.provisional, true);
  for (const company of Object.values(companies)) {
    assert.equal(company.unit, 'triệu VND');
    assert.equal(company.scope, 'Hợp nhất');
    assert.ok(company.sourceUrl.startsWith('https://'));
    assert.ok(company.locators.revenue);
    for (const year of [2024, 2025]) {
      const row = company.years[year];
      assert.equal(row.assets, row.liabilities + row.equity);
    }
  }
});

test('CSV exports both years, traceability and empty missing fields instead of zero', () => {
  assert.ok(metrics.length >= 8);
  const csv = toCsv(companies.DGC);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('2024'));
  assert.ok(csv.includes('2025'));
  assert.ok(csv.includes('triệu VND'));
  assert.ok(csv.includes('"cashflow","Dòng tiền kinh doanh","",""'));
  assert.ok(csv.includes('07/04/2026'));
});
