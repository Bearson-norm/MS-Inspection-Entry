const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCookies, hashToken } = require('../middleware/auth');

test('cookie parser and token hashing are deterministic', () => {
  assert.deepEqual(parseCookies('a=one; inspection_session=two%20words'),{a:'one',inspection_session:'two words'});
  assert.equal(hashToken('secret').length,64);assert.equal(hashToken('secret'),hashToken('secret'));assert.notEqual(hashToken('secret'),hashToken('other'));
});
