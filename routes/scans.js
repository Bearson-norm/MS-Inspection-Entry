const express = require('express');
const { pool } = require('../database');
const { processScan } = require('../services/scan');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const result = await processScan(pool, req.body || {});
    const status = result.code === 'EMPLOYEE_NOT_FOUND' ? 404
      : result.code === 'EMPLOYEE_INACTIVE' ? 403
        : result.code === 'INVALID_QR' ? 400 : 200;
    res.status(status).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
