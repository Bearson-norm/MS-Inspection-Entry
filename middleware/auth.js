const crypto = require('crypto');
const config = require('../config');
const { pool } = require('../database');

const COOKIE_NAME = 'inspection_session';
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function cookieOptions(maxAge) {
  const secure = config.secureCookies ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

async function createSession(username) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + config.sessionTtlHours * 3600000);
  await pool.query('DELETE FROM inspection_admin_sessions WHERE expires_at <= NOW()');
  await pool.query(
    'INSERT INTO inspection_admin_sessions (token_hash, username, expires_at) VALUES ($1, $2, $3)',
    [hashToken(token), username, expiresAt]
  );
  return token;
}

async function destroySession(token) {
  if (token) await pool.query('DELETE FROM inspection_admin_sessions WHERE token_hash = $1', [hashToken(token)]);
}

async function requireAdmin(req, res, next) {
  try {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, message: 'Silakan login.' });
    const result = await pool.query(
      `SELECT username FROM inspection_admin_sessions
       WHERE token_hash = $1 AND expires_at > NOW()`, [hashToken(token)]
    );
    if (!result.rows[0] || result.rows[0].username !== config.adminUsername) {
      return res.status(401).json({ success: false, message: 'Sesi tidak valid atau kedaluwarsa.' });
    }
    req.admin = result.rows[0];
    req.sessionToken = token;
    next();
  } catch (error) { next(error); }
}

function requireSameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin && origin !== config.appOrigin) {
    return res.status(403).json({ success: false, message: 'Origin tidak diizinkan.' });
  }
  next();
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieOptions(config.sessionTtlHours * 3600)}`);
}
function clearSessionCookie(res) { res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${cookieOptions(0)}`); }

module.exports = { COOKIE_NAME, parseCookies, hashToken, createSession, destroySession, requireAdmin, requireSameOrigin, setSessionCookie, clearSessionCookie };
