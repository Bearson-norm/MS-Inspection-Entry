const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveCheckpointForScan } = require('../services/checkpoints');

function fakeDb(rows) {
  return {
    async query(sql) {
      if (sql.includes('FROM inspection_checkpoints')) return { rows };
      return { rows: [] };
    }
  };
}

test('uses env default when no admin checkpoints exist', async () => {
  const db = fakeDb([]);
  assert.equal(await resolveCheckpointForScan(db, '', 'Gate Env'), 'Gate Env');
  assert.equal(await resolveCheckpointForScan(db, 'Custom', 'Gate Env'), 'Custom');
});

test('requires valid selection when multiple active checkpoints exist', async () => {
  const db = fakeDb([{ id: 1, name: 'Gate A' }, { id: 2, name: 'Gate B' }]);
  assert.equal(await resolveCheckpointForScan(db, 'Gate B', 'Env'), 'Gate B');
  assert.equal(await resolveCheckpointForScan(db, '', 'Env'), null);
  assert.equal(await resolveCheckpointForScan(db, 'Unknown', 'Env'), null);
});

test('auto-selects the only active checkpoint', async () => {
  const db = fakeDb([{ id: 1, name: 'Lobby' }]);
  assert.equal(await resolveCheckpointForScan(db, '', 'Env'), 'Lobby');
});
