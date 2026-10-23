#!/usr/bin/env node
/**
 * Verifies Node.js meets the minimum patched version for Oct 2026 security releases.
 * Run on dev and production before/after upgrade: node scripts/verify-node-runtime.js
 */
const MIN_PATCHED = {
  22: { major: 22, minor: 23, patch: 4, label: '22.23.4' },
  24: { major: 24, minor: 22, patch: 1, label: '24.22.1' },
  26: { major: 26, minor: 12, patch: 1, label: '26.12.1' }
};

function parseNodeVersion(raw) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(raw || process.version));
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

function isPatched(v) {
  const rule = MIN_PATCHED[v.major];
  if (!rule) return false;
  if (v.major > rule.major) return true;
  if (v.minor > rule.minor) return true;
  if (v.minor < rule.minor) return false;
  return v.patch >= rule.patch;
}

const v = parseNodeVersion(process.version);
if (!v) {
  console.error(`Cannot parse Node version: ${process.version}`);
  process.exit(1);
}

const ok = isPatched(v);
const expected = MIN_PATCHED[v.major]?.label || '22.23.4, 24.22.1, or 26.12.1';

console.log(`Node ${process.version} (${process.execPath})`);
if (ok) {
  console.log('OK: runtime meets patched minimum for Oct 2026 Node.js security releases.');
  process.exit(0);
}

console.error(
  `FAIL: upgrade required. For ${v.major}.x use at least v${expected}. See https://nodejs.org/en/blog/vulnerability/october-2026-security-releases`
);
process.exit(1);
