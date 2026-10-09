const test = require('node:test');
const assert = require('node:assert/strict');
const { getBusinessDate, isYmd } = require('../utils/business-date');

test('business date remains previous day before 06:00 WIB', () => {
  assert.equal(getBusinessDate(new Date('2026-10-07T22:59:00.000Z'), { timeZone:'Asia/Jakarta', resetHour:6 }), '2026-10-07');
});
test('business date changes exactly at 06:00 WIB', () => {
  assert.equal(getBusinessDate(new Date('2026-10-07T23:00:00.000Z'), { timeZone:'Asia/Jakarta', resetHour:6 }), '2026-10-08');
});
test('validates real calendar dates', () => {
  assert.equal(isYmd('2026-02-28'), true);
  assert.equal(isYmd('2026-02-30'), false);
});
