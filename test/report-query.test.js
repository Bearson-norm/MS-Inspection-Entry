const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFilters, buildLogWhere, clampPage, clampLimit } = require('../services/report-query');

test('report filters validate date range and parameterize user values', () => {
  const filters=parseFilters({start_date:'2026-10-01',end_date:'2026-10-08',department:"QC' OR 1=1",level:'red'});
  const built=buildLogWhere(filters);assert.match(built.where,/l\.inspection_level = \$3/);assert.match(built.where,/e\.department = \$4/);assert.equal(built.values[3],"QC' OR 1=1");
});
test('report rejects reversed and oversized ranges', () => {
  assert.throws(()=>parseFilters({start_date:'2026-10-09',end_date:'2026-10-08'}),/tidak valid/);
  assert.throws(()=>parseFilters({start_date:'2024-01-01',end_date:'2026-01-01'}),/maksimal/);
});
test('pagination is constrained', () => {
  assert.equal(clampPage('-2'),1);assert.equal(clampPage('3'),3);assert.equal(clampLimit('999'),25);assert.equal(clampLimit('50'),50);
});
