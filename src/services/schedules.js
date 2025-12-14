const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { startRun } = require('./runner');
const { getTemplateById } = require('./templates');

const storeFile = path.join(process.cwd(), 'data', 'schedules.json');
let schedules = [];
const jobs = new Map();

function loadStore() {
  try {
    const txt = fs.readFileSync(storeFile, 'utf8');
    schedules = JSON.parse(txt);
  } catch (_) {
    schedules = [];
  }
}
function persistStore() {
  fs.mkdirSync(path.dirname(storeFile), { recursive: true });
  fs.writeFileSync(storeFile, JSON.stringify(schedules, null, 2));
}
function scheduleKey(id) {
  return `schedule-${id}`;
}

function upsertSchedule(sch) {
  if (!sch.id) sch.id = Date.now();
  const idx = schedules.findIndex((s) => s.id === sch.id);
  if (idx >= 0) schedules[idx] = sch; else schedules.push(sch);
  persistStore();
  ensureJob(sch);
  return sch;
}
function listSchedules() {
  return schedules.slice();
}
function getScheduleById(id) {
  return schedules.find((s) => s.id === id);
}
function deleteSchedule(id) {
  const before = schedules.length;
  schedules = schedules.filter((s) => s.id !== id);
  persistStore();
  stopJob(id);
  return schedules.length < before;
}
function toggleSchedule(id, active) {
  const s = getScheduleById(id);
  if (!s) throw new Error('Not found');
  s.isActive = !!active;
  persistStore();
  ensureJob(s);
  return s;
}

async function runNow(id) {
  const s = getScheduleById(id);
  if (!s) throw new Error('Not found');
  const payload = {
    url: s.url,
    retainLimit: s.retainLimit ?? 5,
    outputKey: scheduleKey(s.id)
  };
  if (s.templateId) payload.templateId = s.templateId;
  else payload.template = s.template;
  return await startRun(payload);
}

function ensureJob(s) {
  stopJob(s.id);
  if (s.isActive && s.cron) {
    const task = cron.schedule(s.cron, () => {
      runNow(s.id).catch(() => {});
    }, { scheduled: true });
    jobs.set(s.id, task);
  }
}
function stopJob(id) {
  if (jobs.has(id)) {
    try { jobs.get(id).stop(); } catch (_) {}
    jobs.delete(id);
  }
}

function initJobs() {
  loadStore();
  for (const s of schedules) ensureJob(s);
}

function cronNextTime(cronStr, baseDate) {
  if (!cronStr) return null;
  const parts = String(cronStr).trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const now = baseDate ? new Date(baseDate) : new Date();
  const [mmS, hhS, ddS, moS, dwS] = parts;
  if (mmS.startsWith('*/') && hhS === '*' && ddS === '*' && moS === '*' && dwS === '*') {
    const n = parseInt(mmS.slice(2), 10); if (!n || n < 1) return null;
    const next = new Date(now); next.setSeconds(0, 0);
    const m = next.getMinutes(); const rem = m % n; const add = rem === 0 ? n : (n - rem);
    next.setMinutes(m + add); return next;
  }
  if (mmS === '0' && hhS.startsWith('*/') && ddS === '*' && moS === '*' && dwS === '*') {
    const n = parseInt(hhS.slice(2), 10); if (!n || n < 1) return null;
    const next = new Date(now); next.setSeconds(0, 0); next.setMinutes(0);
    const h = next.getHours(); const rem = h % n; const add = rem === 0 ? n : (n - rem);
    next.setHours(h + add); return next;
  }
  if (ddS === '*' && moS === '*' && dwS === '*' && /^\d+$/.test(mmS) && /^\d+$/.test(hhS)) {
    const mm = parseInt(mmS, 10), hh = parseInt(hhS, 10);
    const next = new Date(now); next.setSeconds(0, 0); next.setHours(hh, mm, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1); return next;
  }
  if (ddS === '*' && moS === '*' && dwS !== '*' && /^\d+$/.test(mmS) && /^\d+$/.test(hhS)) {
    const mm = parseInt(mmS, 10), hh = parseInt(hhS, 10);
    const days = dwS.split(',').map((s) => parseInt(s, 10)).filter((n) => !isNaN(n) && n >= 0 && n <= 6);
    if (!days.length) return null;
    function dayAhead(date, targetDow) {
      const d = new Date(date); const cur = d.getDay(); let diff = targetDow - cur;
      if (diff < 0 || (diff === 0 && d <= date)) diff += 7; d.setDate(d.getDate() + diff); return d;
    }
    let best = null;
    for (const dw of days) {
      const cand = dayAhead(now, dw);
      cand.setHours(hh, mm, 0, 0);
      if (!best || cand < best) best = cand;
    }
    return best;
  }
  if (ddS !== '*' && moS === '*' && dwS === '*' && /^\d+$/.test(mmS) && /^\d+$/.test(hhS)) {
    const mm = parseInt(mmS, 10), hh = parseInt(hhS, 10);
    const days = ddS.split(',').map((s) => parseInt(s, 10)).filter((n) => !isNaN(n) && n >= 1 && n <= 31).sort((a, b) => a - b);
    if (!days.length) return null;
    const base = new Date(now); base.setSeconds(0, 0); base.setHours(hh, mm, 0, 0);
    for (const dnum of days) {
      const cand = new Date(base); cand.setDate(dnum);
      if (cand > now) return cand;
    }
    const nextMonth = new Date(base); nextMonth.setMonth(nextMonth.getMonth() + 1); nextMonth.setDate(days[0]); return nextMonth;
  }
  return null;
}

function getNextRunInfo(id) {
  const s = getScheduleById(id);
  if (!s) return null;
  const isActive = !!s.isActive;
  const cronStr = s.cron || '';
  if (!isActive || !cronStr) return { isActive, cron: cronStr, nextAtISO: null, remainingSeconds: null };
  const next = cronNextTime(cronStr, new Date());
  if (!next) return { isActive, cron: cronStr, nextAtISO: null, remainingSeconds: null };
  const now = Date.now();
  const remainingSeconds = Math.max(0, Math.floor((next.getTime() - now) / 1000));
  return { isActive, cron: cronStr, nextAtISO: next.toISOString(), remainingSeconds };
}

module.exports = {
  initJobs,
  upsertSchedule,
  listSchedules,
  getScheduleById,
  deleteSchedule,
  toggleSchedule,
  runNow,
  getNextRunInfo,
};
