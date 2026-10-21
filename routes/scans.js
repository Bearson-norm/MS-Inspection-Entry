const express = require('express');
const config = require('../config');
const { pool } = require('../database');
const { processScan } = require('../services/scan');
const { resolveCheckpointForScan } = require('../services/checkpoints');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const checkpointLocation = await resolveCheckpointForScan(
      pool,
      req.body?.checkpoint_location,
      config.checkpointLocation
    );
    if (!checkpointLocation) {
      return res.status(400).json({
        success: false,
        code: 'CHECKPOINT_REQUIRED',
        message: 'Pilih lokasi scan terlebih dahulu.',
        display_ms: 2000,
        checkpoint_location: null,
        employee: null,
        level: null
      });
    }
    const result = await processScan(pool, req.body || {}, undefined, { checkpointLocation });
    const status = result.code === 'EMPLOYEE_NOT_FOUND' ? 404
      : result.code === 'EMPLOYEE_INACTIVE' ? 403
        : result.code === 'INVALID_QR' ? 400 : 200;
    res.status(status).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
