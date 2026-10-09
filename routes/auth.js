const express = require('express');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { pool } = require('../database');
const {
  parseCookies, COOKIE_NAME, createSession, destroySession, requireAdmin,
  requireSameOrigin, setSessionCookie, clearSessionCookie
} = require('../middleware/auth');

const router = express.Router();

router.post('/login', requireSameOrigin, async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
    if (username !== config.adminUsername) return res.status(401).json({ success: false, message: 'Username atau password salah.' });
    const found = await pool.query('SELECT username, password FROM users WHERE username = $1', [username]);
    const user = found.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ success: false, message: 'Username atau password salah.' });
    }
    const token = await createSession(username);
    setSessionCookie(res, token);
    res.json({ success: true, username });
  } catch (error) { next(error); }
});

router.post('/logout', requireSameOrigin, async (req, res, next) => {
  try {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    await destroySession(token);
    clearSessionCookie(res);
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.get('/session', requireAdmin, (req, res) => res.json({ success: true, username: req.admin.username }));

module.exports = router;
