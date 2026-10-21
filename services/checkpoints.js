async function listActiveCheckpoints(db) {
  const result = await db.query(
    `SELECT id, name FROM inspection_checkpoints
     WHERE is_active = true
     ORDER BY sort_order ASC, name ASC`
  );
  return result.rows;
}

async function listActiveCheckpointNames(db) {
  const rows = await listActiveCheckpoints(db);
  return rows.map((row) => row.name);
}

/**
 * Resolves checkpoint for a scan. Returns null when admin-defined checkpoints exist
 * but the client value is missing or not in the active list (and there is more than one).
 */
async function resolveCheckpointForScan(db, clientValue, envDefault) {
  const active = await listActiveCheckpoints(db);
  const trimmed = String(clientValue ?? '').trim().slice(0, 255);

  if (active.length === 0) {
    if (trimmed) return trimmed;
    const fallback = String(envDefault ?? '').trim().slice(0, 255);
    return fallback || 'Belum diatur';
  }

  const names = new Set(active.map((row) => row.name));
  if (trimmed && names.has(trimmed)) return trimmed;
  if (active.length === 1) return active[0].name;
  return null;
}

module.exports = {
  listActiveCheckpoints,
  listActiveCheckpointNames,
  resolveCheckpointForScan
};
