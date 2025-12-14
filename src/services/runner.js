const fs = require('fs');
const path = require('path');
const { runTemplate } = require('./templateEngine');
const { getTemplateById } = require('./templates');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

const jobs = new Map();

function enforceRetentionByKey(key, retainLimit = 5) {
  const dir = path.join(process.cwd(), 'data', 'run-results', String(key));
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse();
  const keep = Math.max(0, retainLimit);
  const toDelete = files.slice(keep);
  for (const name of toDelete) {
    try { fs.unlinkSync(path.join(dir, name)); } catch (_) {}
  }
}

async function runOnce({ url, templateId, template, retainLimit = 5, outputKey }) {
  const tplObj = templateId ? getTemplateById(parseInt(templateId, 10)) : null;
  const tpl = tplObj ? tplObj.config : template;
  if (!tpl) throw new Error('Template not found');
  const key = outputKey || (templateId ? `tpl-${templateId}` : `custom-${Buffer.from(JSON.stringify(tpl)).toString('hex').slice(0, 8)}`);
  const finalUrl = url.endsWith('#') ? url : `${url}#`;
  const items = await runTemplate(finalUrl, {
    ...tpl,
    fetch: {
      ...(tpl.fetch || {}),
      dynamic: true,
      waitSelector: (tpl.fetch && tpl.fetch.waitSelector) || (tpl.select && tpl.select.list) || '.jstable-row',
      timeoutMs: (tpl.fetch && tpl.fetch.timeoutMs) || 60000
    }
  });
  const outDir = path.join(process.cwd(), 'data', 'run-results', key);
  ensureDir(outDir);
  const file = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify({ items, meta: { count: items.length, url, templateKey: key, finishedAt: new Date().toISOString() } }, null, 2));
  enforceRetentionByKey(key, retainLimit);
  return { ok: true, count: items.length, file };
}

function listRunResults(key, limit = 10) {
  const dir = path.join(process.cwd(), 'data', 'run-results', String(key));
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort(); // asc
  const sliced = files.slice(0, limit);
  return sliced.map((name) => {
    const fp = path.join(dir, name);
    let meta = {};
    try {
      const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
      meta = data.meta || {};
    } catch (_) {}
    let mtimeMs = 0;
    try { mtimeMs = fs.statSync(fp).mtimeMs; } catch (_) {}
    return { name, meta, mtimeMs };
  });
}

function readRunResult(key, name) {
  const file = path.join(process.cwd(), 'data', 'run-results', String(key), name);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function startRun({ url, templateId, template, retainLimit = 5, outputKey }) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  jobs.set(id, { id, progress: 0, stage: 'init', done: false });
  (async () => {
    try {
      const tplObj = templateId ? getTemplateById(parseInt(templateId, 10)) : null;
      const tpl = tplObj ? tplObj.config : template;
      const key = outputKey || (templateId ? `tpl-${templateId}` : `custom-${Buffer.from(JSON.stringify(tpl)).toString('hex').slice(0, 8)}`);
      const finalUrl = url.endsWith('#') ? url : `${url}#`;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        ...((tpl.fetch && tpl.fetch.headers) || {}),
      };
      const timeout = (tpl.fetch && tpl.fetch.timeoutMs) || 60000;
      jobs.set(id, { id, progress: 10, stage: 'launch', done: false });
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
      try {
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders(headers);
        jobs.set(id, { id, progress: 30, stage: 'goto', done: false });
        await page.goto(finalUrl, { waitUntil: 'networkidle2', timeout });
        const waitSelector = (tpl.fetch && tpl.fetch.waitSelector) || (tpl.select && tpl.select.list) || '.jstable-row';
        if (waitSelector) {
          jobs.set(id, { id, progress: 45, stage: 'waitSelector', done: false });
          try { await page.waitForSelector(waitSelector, { timeout }); } catch (_) {}
        }
        jobs.set(id, { id, progress: 60, stage: 'extract', done: false });
        const items = await page.evaluate((tpl) => {
          function getText(el) { return (el ? (el.textContent || '').trim() : '').trim(); }
          function getHtml(el) { return el ? el.innerHTML.trim() : ''; }
          function getAttr(el, name) { return el ? (el.getAttribute(name) || '').trim() : ''; }
          function exists(el) { return !!el; }
          function prevOfClosest(scopeEl, closestSel, prevSel) {
            let anc = scopeEl.closest(closestSel);
            if (!anc) return '';
            let prev = anc.previousElementSibling;
            while (prev) {
              if (prev.matches(prevSel)) return getText(prev);
              prev = prev.previousElementSibling;
            }
            return '';
          }
          function closestFind(scopeEl, closestSel, sel, asHtml) {
            let anc = scopeEl.closest(closestSel);
            if (!anc) anc = scopeEl;
            const el = anc.querySelector(sel);
            return asHtml ? getHtml(el) : getText(el);
          }
          const listSel = tpl.select && tpl.select.list;
          const fields = (tpl.select && tpl.select.fields) || {};
          const schema = tpl.output && tpl.output.schema;
          const rows = Array.from(document.querySelectorAll(listSel || '') || []);
          const out = [];
          for (const scope of rows) {
            const row = {};
            for (const key in fields) {
              const cfg = fields[key];
              if (!cfg) continue;
              if (cfg.selector === 'closestCardHeader') {
                const card = scope.closest('.card');
                const header = card ? card.querySelector('.card-header') : null;
                row[key] = getText(header);
              } else if (cfg.type === 'prevOfClosest') {
                row[key] = prevOfClosest(scope, cfg.closest || 'body', cfg.selector);
              } else if (cfg.type === 'closestFind') {
                row[key] = closestFind(scope, cfg.closest || 'body', cfg.selector, !!cfg.html);
              } else {
                const el = scope.querySelector(cfg.selector);
                if (cfg.type === 'exists') {
                  row[key] = exists(el);
                } else if (cfg.type === 'text' || !cfg.type) {
                  let v = getText(el);
                  if (cfg.match) {
                    try {
                      const re = new RegExp(cfg.match);
                      const m = v.match(re);
                      v = m ? (m[1] || m[0]) : v;
                    } catch (_) {}
                  }
                  row[key] = v;
                } else if (cfg.type === 'html') {
                  row[key] = getHtml(el);
                } else if (cfg.type === 'attr') {
                  row[key] = getAttr(el, cfg.name || 'src');
                } else {
                  row[key] = getText(el);
                }
              }
            }
            const tf = tpl.transform || {};
            if (tf.kenhTv && typeof row.kenhTvRaw === 'string') {
              const rx = new RegExp(tf.kenhTv.split || ',|;|/|\\|');
              row.kenhTv = row.kenhTvRaw.split(rx).map((s) => s.trim()).filter(Boolean);
            }
            if (tf.gio && typeof row.gio === 'string') {
              const replaces = tf.gio.replace || [];
              let v = row.gio;
              for (const pair of replaces) v = v.split(pair[0]).join(pair[1]);
              row.gio = v;
            }
            if (tf.ketQua && tf.ketQua.defaultIfEmpty) {
              const v = (row.ketQua || '').trim();
              row.ketQua = v.length ? v : tf.ketQua.defaultIfEmpty;
            }
            if (Array.isArray(schema) && schema.length) {
              const shaped = {};
              for (const k of schema) shaped[k] = row[k];
              out.push(shaped);
            } else {
              out.push(row);
            }
          }
          return out;
        }, tpl);
        jobs.set(id, { id, progress: 80, stage: 'write', done: false });
        const outDir = path.join(process.cwd(), 'data', 'run-results', key);
        ensureDir(outDir);
        const file = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        fs.writeFileSync(file, JSON.stringify({ items, meta: { count: items.length, url, templateKey: key, finishedAt: new Date().toISOString() } }, null, 2));
        enforceRetentionByKey(key, retainLimit);
        jobs.set(id, { id, progress: 100, stage: 'done', done: true, ok: true, count: items.length, file });
        await page.close();
        await browser.close();
      } catch (e) {
        try { await browser.close(); } catch (_) {}
        jobs.set(id, { id, progress: 100, stage: 'error', done: true, ok: false, error: String(e.message || e) });
      }
    } catch (e) {
      jobs.set(id, { id, progress: 100, stage: 'error', done: true, ok: false, error: String(e.message || e) });
    }
  })();
  return { jobId: id };
}

function getRunStatus(jobId) {
  return jobs.get(jobId) || null;
}

function deleteRunResult(key, name) {
  const file = path.join(process.cwd(), 'data', 'run-results', String(key), name);
  if (!fs.existsSync(file)) return false;
  try { fs.unlinkSync(file); return true; } catch (_) { return false; }
}

module.exports = { runOnce, listRunResults, readRunResult, startRun, getRunStatus, deleteRunResult };
