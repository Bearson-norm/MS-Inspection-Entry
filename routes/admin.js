const express = require('express');
const ExcelJS = require('exceljs');
const { pool } = require('../database');
const { requireAdmin, requireSameOrigin } = require('../middleware/auth');
const { parseFilters, buildLogWhere, clampPage, clampLimit } = require('../services/report-query');
const { formatResultDisplay } = require('../utils/result-label');
const { getBusinessDate } = require('../utils/business-date');

const router = express.Router();
router.use(requireAdmin);

router.get('/employees', async (req, res, next) => {
  try {
    const page = clampPage(req.query.page);
    const limit = clampLimit(req.query.limit);
    const search = String(req.query.search || '').trim().slice(0, 255);
    const level = ['green', 'red'].includes(req.query.level) ? req.query.level : '';
    const values = [];
    const clauses = [];
    if (search) {
      values.push(`%${search}%`);
      clauses.push(`(e.employee_id ILIKE $${values.length} OR e.name ILIKE $${values.length} OR e.department ILIKE $${values.length} OR e.location ILIKE $${values.length})`);
    }
    if (level) { values.push(level); clauses.push(`COALESCE(l.level, 'green') = $${values.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const count = await pool.query(`SELECT COUNT(*) FROM employee_data e LEFT JOIN inspection_employee_levels l ON l.employee_id=e.employee_id ${where}`, values);
    const params = [...values, limit, (page - 1) * limit];
    const data = await pool.query(
      `SELECT e.employee_id, e.name, e.department, COALESCE(e.location, 'Belum diisi') AS location,
              COALESCE(e.is_active, true) AS is_active,
              COALESCE(l.level, 'green') AS level, l.updated_by, l.updated_at
       FROM employee_data e LEFT JOIN inspection_employee_levels l ON l.employee_id=e.employee_id
       ${where} ORDER BY e.department, e.employee_id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, params
    );
    res.json({ success: true, data: data.rows, pagination: { page, limit, total: Number(count.rows[0].count) } });
  } catch (error) { next(error); }
});

router.get('/checkpoints', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, is_active, sort_order, created_at
       FROM inspection_checkpoints
       ORDER BY sort_order ASC, name ASC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
});

router.post('/checkpoints', requireSameOrigin, async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? '').trim().slice(0, 255);
    if (!name) return res.status(400).json({ success: false, message: 'Nama lokasi wajib diisi.' });
    const sortOrder = Number.parseInt(req.body?.sort_order, 10);
    const result = await pool.query(
      `INSERT INTO inspection_checkpoints (name, is_active, sort_order)
       VALUES ($1, true, COALESCE($2, 0))
       RETURNING id, name, is_active, sort_order, created_at`,
      [name, Number.isInteger(sortOrder) ? sortOrder : 0]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'Nama lokasi sudah ada.' });
    next(error);
  }
});

router.patch('/checkpoints/:id', requireSameOrigin, async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'ID tidak valid.' });
    const updates = [];
    const values = [];
    if (typeof req.body?.name === 'string') {
      const name = req.body.name.trim().slice(0, 255);
      if (!name) return res.status(400).json({ success: false, message: 'Nama lokasi wajib diisi.' });
      values.push(name);
      updates.push(`name = $${values.length}`);
    }
    if (typeof req.body?.is_active === 'boolean') {
      values.push(req.body.is_active);
      updates.push(`is_active = $${values.length}`);
    }
    if (req.body?.sort_order !== undefined) {
      const sortOrder = Number.parseInt(req.body.sort_order, 10);
      if (!Number.isInteger(sortOrder)) return res.status(400).json({ success: false, message: 'Urutan tidak valid.' });
      values.push(sortOrder);
      updates.push(`sort_order = $${values.length}`);
    }
    if (!updates.length) return res.status(400).json({ success: false, message: 'Tidak ada perubahan.' });
    values.push(id);
    const result = await pool.query(
      `UPDATE inspection_checkpoints SET ${updates.join(', ')} WHERE id = $${values.length}
       RETURNING id, name, is_active, sort_order, created_at`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Lokasi tidak ditemukan.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'Nama lokasi sudah ada.' });
    next(error);
  }
});

router.patch('/employees/:employeeId/location', requireSameOrigin, async (req, res, next) => {
  try {
    const employeeId = String(req.params.employeeId || '').trim();
    const location = String(req.body?.location ?? '').trim().slice(0, 255);
    if (!location) return res.status(400).json({ success: false, message: 'Lokasi wajib diisi.' });
    const exists = await pool.query('SELECT employee_id FROM employee_data WHERE employee_id = $1', [employeeId]);
    if (!exists.rows[0]) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
    const result = await pool.query(
      'UPDATE employee_data SET location = $2 WHERE employee_id = $1 RETURNING employee_id, location',
      [employeeId, location]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
});

router.patch('/employees/:employeeId/level', requireSameOrigin, async (req, res, next) => {
  try {
    const employeeId = String(req.params.employeeId || '').trim();
    const level = req.body?.level;
    if (!['green', 'red'].includes(level)) return res.status(400).json({ success: false, message: 'Level harus green atau red.' });
    const exists = await pool.query('SELECT employee_id FROM employee_data WHERE employee_id = $1', [employeeId]);
    if (!exists.rows[0]) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
    const result = await pool.query(
      `INSERT INTO inspection_employee_levels (employee_id, level, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (employee_id) DO UPDATE SET level=EXCLUDED.level, updated_by=EXCLUDED.updated_by, updated_at=NOW()
       RETURNING employee_id, level, updated_by, updated_at`, [employeeId, level, req.admin.username]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
});

router.get('/reports/summary', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const { where, values } = buildLogWhere(filters);
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE l.result_code='GREEN')::int AS green,
              COUNT(*) FILTER (WHERE l.result_code='RED')::int AS red,
              COUNT(*) FILTER (WHERE l.result_code NOT IN ('GREEN','RED'))::int AS errors
       FROM inspection_scan_logs l LEFT JOIN employee_data e ON e.employee_id=l.employee_id WHERE ${where}`, values
    );
    res.json({ success: true, filters, data: result.rows[0] });
  } catch (error) { next(error); }
});

async function queryLogs(query, paginated = true) {
  const filters = parseFilters(query);
  const { where, values } = buildLogWhere(filters);
  const select = `SELECT l.id, l.employee_id, e.name, e.department,
                          COALESCE(e.location, 'Belum diisi') AS employee_location,
                          l.checkpoint_location, l.scanned_value,
                          l.inspection_level, l.result_code, l.source, l.business_date, l.scanned_at
                   FROM inspection_scan_logs l LEFT JOIN employee_data e ON e.employee_id=l.employee_id
                   WHERE ${where} ORDER BY l.scanned_at DESC`;
  if (!paginated) return { filters, rows: (await pool.query(select, values)).rows };
  const page = clampPage(query.page); const limit = clampLimit(query.limit);
  const count = await pool.query(`SELECT COUNT(*) FROM inspection_scan_logs l LEFT JOIN employee_data e ON e.employee_id=l.employee_id WHERE ${where}`, values);
  const rows = await pool.query(`${select} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, (page - 1) * limit]);
  return { filters, rows: rows.rows, pagination: { page, limit, total: Number(count.rows[0].count) } };
}

router.get('/reports/logs', async (req, res, next) => {
  try { const result = await queryLogs(req.query); res.json({ success: true, data: result.rows, pagination: result.pagination, filters: result.filters }); }
  catch (error) { next(error); }
});

router.get('/reports/departments', async (_req, res, next) => {
  try {
    const result = await pool.query(`SELECT DISTINCT department FROM employee_data WHERE department IS NOT NULL AND department <> '' ORDER BY department`);
    res.json({ success: true, data: result.rows.map((row) => row.department) });
  } catch (error) { next(error); }
});

router.get('/reports/checkpoints', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT name AS checkpoint_location FROM inspection_checkpoints WHERE is_active = true
       UNION
       SELECT DISTINCT checkpoint_location FROM inspection_scan_logs
       WHERE checkpoint_location IS NOT NULL AND TRIM(checkpoint_location) <> ''
       ORDER BY checkpoint_location`
    );
    res.json({ success: true, data: result.rows.map((row) => row.checkpoint_location) });
  } catch (error) { next(error); }
});

router.get('/reports/export', async (req, res, next) => {
  try {
    const result = await queryLogs(req.query, false);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MS Inspection Entry';
    const sheet = workbook.addWorksheet('Inspection Logs', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      { header:'Waktu Scan', key:'scanTime', width:22 }, { header:'Hari Operasional', key:'businessDate', width:18 },
      { header:'Employee ID', key:'employeeId', width:18 }, { header:'Nama', key:'name', width:28 },
      { header:'Departemen', key:'department', width:24 },
      { header:'Lokasi karyawan', key:'employeeLocation', width:24 },
      { header:'Lokasi checkpoint', key:'checkpointLocation', width:24 },
      { header:'Level', key:'level', width:12 },
      { header:'Hasil', key:'result', width:24 }, { header:'Sumber', key:'source', width:12 },
      { header:'Nilai Scan', key:'scannedValue', width:36 }
    ];
    result.rows.forEach((row) => sheet.addRow({
      scanTime: new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(row.scanned_at)),
      businessDate: row.business_date instanceof Date ? row.business_date.toLocaleDateString('en-CA') : String(row.business_date).slice(0, 10),
      employeeId: row.employee_id || '-', name: row.name || '-', department: row.department || '-',
      employeeLocation: row.employee_location || '-', checkpointLocation: row.checkpoint_location || '-',
      level: row.inspection_level || '-', result: formatResultDisplay(row.result_code), source: row.source, scannedValue: row.scanned_value
    }));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF176B46' } };
    sheet.autoFilter = { from:'A1', to:'K1' };
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="inspection_${result.filters.startDate}_${result.filters.endDate}.xlsx"`);
    res.send(buffer);
  } catch (error) { next(error); }
});

router.get('/today', (_req, res) => res.json({ success: true, business_date: getBusinessDate() }));

module.exports = router;
