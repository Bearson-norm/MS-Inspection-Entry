const config = require('../config');

function parseQrValue(raw, maxLength = config.scanValueMaxLength) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || value.length > maxLength) return null;

  if (value.startsWith('{')) {
    try {
      const parsed = JSON.parse(value);
      const candidate = parsed && (parsed.employee_id || parsed.employeeId || parsed.id);
      return normalizeEmployeeId(candidate);
    } catch (_) {
      return null;
    }
  }

  try {
    const url = new URL(value);
    const fromQuery = url.searchParams.get('employee_id') || url.searchParams.get('employeeId') || url.searchParams.get('id');
    if (fromQuery) return normalizeEmployeeId(fromQuery);
    const parts = url.pathname.split('/').filter(Boolean);
    return normalizeEmployeeId(parts.length ? decodeURIComponent(parts.at(-1)) : null);
  } catch (_) {
    return normalizeEmployeeId(value);
  }
}

function normalizeEmployeeId(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const result = String(value).trim();
  if (!result || result.length > 255 || /[\x00-\x1F\x7F]/.test(result)) return null;
  return result;
}

module.exports = { parseQrValue, normalizeEmployeeId };
