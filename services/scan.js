const { parseQrValue } = require('./qr');
const { getBusinessDate } = require('../utils/business-date');

const RESPONSES = Object.freeze({
  GREEN: { success: true, message: 'Scan berhasil. Silakan melanjutkan.', display_ms: 1000 },
  RED: { success: true, message: 'Perlu dilakukan pemeriksaan pada karyawan ini.', display_ms: 2000 },
  EMPLOYEE_NOT_FOUND: { success: false, message: 'Karyawan tidak ditemukan.', display_ms: 2000 },
  EMPLOYEE_INACTIVE: { success: false, message: 'Karyawan tidak aktif.', display_ms: 2000 },
  INVALID_QR: { success: false, message: 'QR tidak valid atau tidak berisi kode karyawan.', display_ms: 2000 }
});

function resultResponse(code, employee = null, level = null) {
  return { ...RESPONSES[code], code, level, employee };
}

async function processScan(db, input, now = new Date()) {
  const source = input.source === 'camera' ? 'camera' : input.source === 'manual' ? 'manual' : null;
  const raw = typeof input.value === 'string' ? input.value.trim() : '';
  const employeeId = parseQrValue(input.value);
  let code = 'INVALID_QR';
  let level = null;
  let employee = null;

  if (source && employeeId) {
    const found = await db.query(
      `SELECT e.employee_id, e.name, e.department, COALESCE(e.is_active, true) AS is_active,
              COALESCE(l.level, 'green') AS inspection_level
       FROM employee_data e
       LEFT JOIN inspection_employee_levels l ON l.employee_id = e.employee_id
       WHERE e.employee_id = $1`, [employeeId]
    );
    employee = found.rows[0] || null;
    if (!employee) code = 'EMPLOYEE_NOT_FOUND';
    else if (!employee.is_active) code = 'EMPLOYEE_INACTIVE';
    else {
      level = employee.inspection_level;
      code = level === 'red' ? 'RED' : 'GREEN';
    }
  }

  await db.query(
    `INSERT INTO inspection_scan_logs
       (employee_id, scanned_value, inspection_level, result_code, source, business_date, scanned_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [employee ? employee.employee_id : null, raw.slice(0, 2048), level, code, source || 'manual', getBusinessDate(now), now]
  );

  return resultResponse(code, employee ? {
    employee_id: employee.employee_id, name: employee.name, department: employee.department
  } : null, level);
}

module.exports = { RESPONSES, resultResponse, processScan };
