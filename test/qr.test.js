const test = require('node:test');
const assert = require('node:assert/strict');
const { parseQrValue } = require('../services/qr');

test('parses plain employee ID', () => assert.equal(parseQrValue(' EMP001 '), 'EMP001'));
test('parses supported JSON keys', () => {
  assert.equal(parseQrValue('{"employee_id":"EMP002"}'), 'EMP002');
  assert.equal(parseQrValue('{"employeeId":"EMP003"}'), 'EMP003');
  assert.equal(parseQrValue('{"id":42}'), '42');
});
test('parses URL query and final path segment', () => {
  assert.equal(parseQrValue('https://internal/scan?employee_id=EMP004'), 'EMP004');
  assert.equal(parseQrValue('https://internal/employees/EMP005'), 'EMP005');
});
test('rejects empty, malformed JSON, controls, and oversized values', () => {
  assert.equal(parseQrValue(''), null);
  assert.equal(parseQrValue('{not-json}'), null);
  assert.equal(parseQrValue('EMP\n001'), null);
  assert.equal(parseQrValue('x'.repeat(2050)), null);
});
