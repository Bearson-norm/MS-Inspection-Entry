require('dotenv').config();

function intEnv(name, fallback, min, max) {
  const value = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';

function normalizeBasePath(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed === '/') return '';
  let path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

const basePath = normalizeBasePath(process.env.BASE_PATH);

function stringEnv(name, fallback, maxLength = 255) {
  const trimmed = String(process.env[name] || '').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

module.exports = Object.freeze({
  port: intEnv('PORT', 3100, 1, 65535),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv,
  basePath,
  cookiePath: basePath || '/',
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:3100',
  timezone: process.env.TIMEZONE || 'Asia/Jakarta',
  resetHour: intEnv('BUSINESS_DAY_RESET_HOUR', 6, 0, 23),
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  sessionTtlHours: intEnv('SESSION_TTL_HOURS', 8, 1, 168),
  scanValueMaxLength: intEnv('SCAN_VALUE_MAX_LENGTH', 2048, 32, 10000),
  checkpointLocation: stringEnv('CHECKPOINT_LOCATION', 'Belum diatur', 255),
  secureCookies: nodeEnv === 'production',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: intEnv('DB_PORT', 5433, 1, 65535),
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'admin123',
    database: process.env.DB_NAME || 'iot_qr_consumer',
    max: intEnv('DB_MAX_CONNECTIONS', 20, 1, 100),
    idleTimeoutMillis: intEnv('DB_IDLE_TIMEOUT', 30000, 1000, 300000),
    connectionTimeoutMillis: intEnv('DB_CONNECTION_TIMEOUT', 2000, 100, 60000)
  }
});
