const { getBusinessDate, isYmd, addDays } = require('../utils/business-date');

const RESULT_CODES = new Set(['GREEN', 'RED', 'PASS', 'EMPLOYEE_NOT_FOUND', 'EMPLOYEE_INACTIVE', 'INVALID_QR']);

function parseFilters(query = {}) {
  const endDate = query.end_date || getBusinessDate();
  const startDate = query.start_date || addDays(endDate, -6);
  if (!isYmd(startDate) || !isYmd(endDate) || startDate > endDate) {
    const error = new Error('Rentang tanggal tidak valid.'); error.status = 400; throw error;
  }
  const days = Math.floor((new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) / 86400000) + 1;
  if (days > 366) { const error = new Error('Rentang laporan maksimal 366 hari.'); error.status = 400; throw error; }
  const level = ['green', 'red'].includes(query.level) ? query.level : '';
  const resultCode = RESULT_CODES.has(query.result_code) ? query.result_code : '';
  return {
    startDate, endDate, level, resultCode,
    department: String(query.department || '').trim().slice(0, 255),
    checkpointLocation: String(query.checkpoint_location || '').trim().slice(0, 255),
    employeeId: String(query.employee_id || '').trim().slice(0, 255),
    search: String(query.search || '').trim().slice(0, 255)
  };
}

function buildLogWhere(filters) {
  const values = [filters.startDate, filters.endDate];
  const clauses = ['l.business_date BETWEEN $1 AND $2'];
  const add = (sql, value) => { values.push(value); clauses.push(sql.replace('?', `$${values.length}`)); };
  if (filters.level) add('l.inspection_level = ?', filters.level);
  if (filters.resultCode === 'PASS') {
    clauses.push(`l.result_code IN ($${values.length + 1}, $${values.length + 2})`);
    values.push('GREEN', 'RED');
  } else if (filters.resultCode) add('l.result_code = ?', filters.resultCode);
  if (filters.department) add('e.department = ?', filters.department);
  if (filters.checkpointLocation) add('l.checkpoint_location = ?', filters.checkpointLocation);
  if (filters.employeeId) add('l.employee_id ILIKE ?', `%${filters.employeeId}%`);
  if (filters.search) {
    values.push(`%${filters.search}%`);
    clauses.push(`(l.employee_id ILIKE $${values.length} OR e.name ILIKE $${values.length})`);
  }
  return { where: clauses.join(' AND '), values };
}

function clampPage(value) { const parsed = Number.parseInt(value || '1', 10); return Number.isInteger(parsed) && parsed > 0 ? parsed : 1; }
function clampLimit(value) { const parsed = Number.parseInt(value || '25', 10); return [10, 25, 50, 100].includes(parsed) ? parsed : 25; }

module.exports = { parseFilters, buildLogWhere, clampPage, clampLimit };
