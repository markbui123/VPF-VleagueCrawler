/**
 * Scheduler node-cron cho CrawlerTask trong bộ nhớ, lưu kết quả ra filesystem
 */
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { fetchHtml, parseWithTemplate } = require('./templateEngine');
const { getTemplateById } = require('./templates');

const tasks = new Map();
const jobs = new Map();

/**
 * Đảm bảo thư mục kết quả tồn tại
 */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Tạo mới hoặc cập nhật một task trong bộ nhớ và lập lịch cron
 */
function upsertTask(task) {
  tasks.set(task.id, task);
  if (jobs.has(task.id)) {
    jobs.get(task.id).stop();
    jobs.delete(task.id);
  }
  if (task.isActive && task.cron) {
    const job = cron.schedule(task.cron, () => runTask(task.id), { scheduled: true });
    jobs.set(task.id, job);
  }
}

/**
 * Chạy một task theo id và ghi kết quả JSON vào data/results/{taskId}/timestamp.json
 */
async function runTask(taskId) {
  const task = tasks.get(taskId);
  if (!task) throw new Error('Task not found');
  const startedAt = Date.now();
  try {
    const tplObj = task.templateId ? getTemplateById(task.templateId) : null;
    const tpl = tplObj ? tplObj.config : task.template;
    if (!tpl) throw new Error('Template not found');
    const baseUrl = task.url.endsWith('#') ? task.url : `${task.url}#`;
    const { fetchHtml, parseWithTemplate, runTemplate } = require('./templateEngine');
    const enforcedTpl = {
      ...tpl,
      fetch: {
        ...(tpl.fetch || {}),
        dynamic: true,
        waitSelector: (tpl.fetch && tpl.fetch.waitSelector) || (tpl.select && tpl.select.list) || '.jstable-row'
      }
    };
    let data = await runTemplate(baseUrl, enforcedTpl);
    if (!data || data.length === 0) {
      const waitSelector = (tpl.fetch && tpl.fetch.waitSelector) || (tpl.select && tpl.select.list) || '.jstable-row';
      const htmlDyn = await fetchHtml(baseUrl, { ...(tpl.fetch || {}), dynamic: true, waitSelector });
      // debug snapshot
      const debugDir = path.join(process.cwd(), 'data', 'debug');
      ensureDir(debugDir);
      const dbgFile = path.join(debugDir, `${String(taskId)}-last.html`);
      try { fs.writeFileSync(dbgFile, htmlDyn); } catch (_) {}
      data = parseWithTemplate(htmlDyn, tpl);
    }
    const outDir = path.join(process.cwd(), 'data', 'results', String(taskId));
    ensureDir(outDir);
    const file = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify({ items: data, meta: { count: data.length, url: task.url, startedAt, finishedAt: Date.now() } }, null, 2));
    enforceRetention(taskId, task.retainLimit || 5);
    return { ok: true, count: data.length, file };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/**
 * Lấy file kết quả mới nhất của task
 */
function getLatestResultFile(taskId) {
  const dir = path.join(process.cwd(), 'data', 'results', String(taskId));
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse();
  return files.length ? path.join(dir, files[0]) : null;
}

/**
 * Đọc kết quả JSON từ file
 */
function readResultFile(filePath) {
  const txt = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(txt);
}

function listResults(taskId, limit = 10) {
  const dir = path.join(process.cwd(), 'data', 'results', String(taskId));
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse().slice(0, limit);
  const out = [];
  for (const name of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      out.push({ name, meta: data.meta || { count: (data.items || []).length } });
    } catch (_) {
      out.push({ name, meta: null });
    }
  }
  return out;
}

function readResultByName(taskId, name) {
  const dir = path.join(process.cwd(), 'data', 'results', String(taskId));
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) return null;
  const txt = fs.readFileSync(file, 'utf8');
  return JSON.parse(txt);
}
/**
 * Bật/Tắt task
 */
function toggleTask(taskId, active) {
  const t = tasks.get(taskId);
  if (!t) throw new Error('Task not found');
  t.isActive = !!active;
  upsertTask(t);
  return t;
}

/**
 * Liệt kê task
 */
function listTasks() {
  return Array.from(tasks.values());
}

/**
 * Xoá task và dừng cron nếu đang chạy
 */
function deleteTask(taskId) {
  if (jobs.has(taskId)) {
    try { jobs.get(taskId).stop(); } catch (_) {}
    jobs.delete(taskId);
  }
  return tasks.delete(taskId);
}

/**
 * Xoá bớt kết quả cũ, giữ lại N bản gần nhất (mặc định 5)
 */
function enforceRetention(taskId, retainLimit = 5) {
  const dir = path.join(process.cwd(), 'data', 'results', String(taskId));
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse();
  const keep = Math.max(0, retainLimit);
  const toDelete = files.slice(keep);
  for (const name of toDelete) {
    try { fs.unlinkSync(path.join(dir, name)); } catch (_) {}
  }
}

module.exports = { upsertTask, runTask, getLatestResultFile, readResultFile, toggleTask, listTasks, deleteTask, listResults, readResultByName, enforceRetention };
