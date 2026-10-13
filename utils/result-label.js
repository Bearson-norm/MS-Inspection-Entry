const OK_RESULT_CODES = new Set(['GREEN', 'RED']);

function isOkScanResult(code) {
  return OK_RESULT_CODES.has(code);
}

function formatResultDisplay(code) {
  return isOkScanResult(code) ? 'PASS' : (code || '-');
}

module.exports = { isOkScanResult, formatResultDisplay, OK_RESULT_CODES };
