const config = require('../config');

function zonedParts(date = new Date(), timeZone = config.timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

function addDays(ymd, amount) {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function getBusinessDate(date = new Date(), options = {}) {
  const timeZone = options.timeZone || config.timezone;
  const resetHour = options.resetHour ?? config.resetHour;
  const parts = zonedParts(date, timeZone);
  const ymd = `${parts.year}-${parts.month}-${parts.day}`;
  return Number(parts.hour) < resetHour ? addDays(ymd, -1) : ymd;
}

function isYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

module.exports = { getBusinessDate, isYmd, addDays };
