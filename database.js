const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.db);
pool.on('error', (error) => console.error('PostgreSQL idle client error:', error));

const migrations = [
  `CREATE TABLE IF NOT EXISTS inspection_employee_levels (
    employee_id VARCHAR(255) PRIMARY KEY REFERENCES employee_data(employee_id) ON UPDATE CASCADE ON DELETE CASCADE,
    level VARCHAR(10) NOT NULL CHECK (level IN ('green', 'red')),
    updated_by VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS inspection_scan_logs (
    id BIGSERIAL PRIMARY KEY,
    employee_id VARCHAR(255) NULL REFERENCES employee_data(employee_id) ON UPDATE CASCADE ON DELETE SET NULL,
    scanned_value VARCHAR(2048) NOT NULL,
    inspection_level VARCHAR(10) NULL CHECK (inspection_level IN ('green', 'red')),
    result_code VARCHAR(40) NOT NULL CHECK (result_code IN ('GREEN', 'RED', 'EMPLOYEE_NOT_FOUND', 'EMPLOYEE_INACTIVE', 'INVALID_QR')),
    source VARCHAR(10) NOT NULL CHECK (source IN ('camera', 'manual')),
    business_date DATE NOT NULL,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS inspection_admin_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_inspection_logs_business_date ON inspection_scan_logs(business_date)',
  'CREATE INDEX IF NOT EXISTS idx_inspection_logs_employee ON inspection_scan_logs(employee_id)',
  'CREATE INDEX IF NOT EXISTS idx_inspection_logs_level ON inspection_scan_logs(inspection_level)',
  'CREATE INDEX IF NOT EXISTS idx_inspection_logs_result ON inspection_scan_logs(result_code)',
  'CREATE INDEX IF NOT EXISTS idx_inspection_logs_scanned_at ON inspection_scan_logs(scanned_at)',
  'CREATE INDEX IF NOT EXISTS idx_inspection_sessions_expiry ON inspection_admin_sessions(expires_at)'
];

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const statement of migrations) await client.query(statement);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function close() { await pool.end(); }

module.exports = { pool, migrate, close };
