/**
 * Áp dụng Template JSON để cào dữ liệu từ HTML
 */
const cheerio = require('cheerio');

/**
 * Thực hiện fetch HTML từ URL (HTTP/HTTPS) hoặc đọc từ file khi prefix file://
 */
async function fetchHtml(url, fetchOpts = {}) {
  if (url.startsWith('file://')) {
    const fs = require('fs');
    const path = require('path');
    const p = url.replace('file://', '');
    return fs.readFileSync(path.resolve(p), 'utf8');
  }
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    ...(fetchOpts.headers || {}),
  };
  if (fetchOpts.dynamic) {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders(headers);
      const timeout = fetchOpts.timeoutMs || 20000;
      await page.goto(url, { waitUntil: 'networkidle2', timeout });
      if (fetchOpts.waitSelector) {
        try { await page.waitForSelector(fetchOpts.waitSelector, { timeout }); } catch (_) {}
      }
      const html = await page.content();
      await page.close();
      await browser.close();
      return html;
    } catch (e) {
      try { await browser.close(); } catch (_) {}
      throw e;
    }
  } else {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
    return await res.text();
  }
}

/**
 * Trích xuất một trường theo cấu hình { selector, type, name?, match? }
 */
function extractField($, scope, fieldCfg) {
  const sel = fieldCfg.selector;
  if (sel === 'closestCardHeader') {
    const header = scope.closest('.card').find('.card-header').first();
    const t = header.text().trim();
    return t;
  }
  if (fieldCfg.type === 'closestFind') {
    const anc = fieldCfg.closest ? scope.closest(fieldCfg.closest) : scope;
    const el = anc.find(fieldCfg.selector).first();
    if (!el || el.length === 0) return '';
    return fieldCfg.html ? (el.html() || '').trim() : (el.text() || '').trim();
  }
  if (fieldCfg.type === 'prevOfClosest') {
    const anc = fieldCfg.closest ? scope.closest(fieldCfg.closest) : scope;
    const prev = anc.prevAll(fieldCfg.selector).first();
    if (!prev || prev.length === 0) return '';
    return (prev.text() || '').trim();
  }
  const el = scope.find(sel).first();
  const type = fieldCfg.type || 'text';
  if (type === 'exists') {
    return el && el.length > 0;
  }
  if (!el || el.length === 0) return '';
  if (type === 'text') {
    let v = el.text().trim();
    if (fieldCfg.match) {
      const re = new RegExp(fieldCfg.match);
      const m = v.match(re);
      v = m ? m[1] || m[0] : v;
    }
    return v;
  }
  if (type === 'html') {
    return (el.html() || '').trim();
  }
  if (type === 'attr') {
    const name = fieldCfg.name || 'src';
    const v = el.attr(name);
    return v ? v.trim() : '';
  }
  return '';
}

/**
 * Áp dụng transform đơn giản theo cấu hình
 */
function applyTransform(obj, transformCfg = {}) {
  const out = { ...obj };
  if (transformCfg.kenhTv && typeof out.kenhTvRaw === 'string') {
    const rx = new RegExp(transformCfg.kenhTv.split || ',|;|/|\\|');
    const arr = out.kenhTvRaw.split(rx).map((s) => s.trim()).filter(Boolean);
    out.kenhTv = arr;
  }
  if (transformCfg.gio && typeof out.gio === 'string') {
    const replaces = transformCfg.gio.replace || [];
    let v = out.gio;
    for (const [a, b] of replaces) v = v.split(a).join(b);
    out.gio = v;
  }
  if (transformCfg.ketQua && transformCfg.ketQua.defaultIfEmpty) {
    const v = (out.ketQua || '').trim();
    out.ketQua = v.length ? v : transformCfg.ketQua.defaultIfEmpty;
  }
  return out;
}

/**
 * Parse HTML theo Template JSON và trả về mảng đối tượng theo schema
 */
function parseWithTemplate(html, template) {
  const $ = cheerio.load(html);
  const listSel = template.select?.list;
  if (!listSel) return [];
  const items = [];
  $(listSel).each((_, el) => {
    const scope = $(el);
    const fields = template.select?.fields || {};
    const row = {};
    for (const [key, cfg] of Object.entries(fields)) {
      row[key] = extractField($, scope, cfg);
    }
    const transformed = applyTransform(row, template.transform || {});
    const schema = template.output?.schema;
    if (Array.isArray(schema) && schema.length) {
      const shaped = {};
      for (const k of schema) shaped[k] = transformed[k];
      items.push(shaped);
    } else {
      items.push(transformed);
    }
  });
  return items;
}

/**
 * Chạy template theo chế độ thường hoặc động, trả về items
 */
async function runTemplate(url, template) {
  const fetchCfg = template.fetch || {};
  if (fetchCfg.dynamic) {
    const puppeteer = require('puppeteer');
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      ...(fetchCfg.headers || {}),
    };
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders(headers);
      const timeout = fetchCfg.timeoutMs || 20000;
      await page.goto(url, { waitUntil: 'networkidle2', timeout });
      const waitSelector = fetchCfg.waitSelector || (template.select && template.select.list);
      if (waitSelector) {
        try { await page.waitForSelector(waitSelector, { timeout }); } catch (_) {}
      }
      const tpl = template;
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
          // transform
          const tf = tpl.transform || {};
          if (tf.kenhTv && typeof row.kenhTvRaw === 'string') {
            const rx = new RegExp(tf.kenhTv.split || ',|;|/|\\|');
            row.kenhTv = row.kenhTvRaw.split(rx).map((s) => s.trim()).filter(Boolean);
          }
          if (tf.gio && typeof row.gio === 'string') {
            const replaces = tf.gio.replace || [];
            let v = row.gio;
            for (const pair of replaces) {
              v = v.split(pair[0]).join(pair[1]);
            }
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
      await page.close();
      await browser.close();
      return items;
    } catch (e) {
      try { await browser.close(); } catch (_) {}
      throw e;
    }
  } else {
    const html = await fetchHtml(url, fetchCfg);
    return parseWithTemplate(html, template);
  }
}

module.exports = { fetchHtml, parseWithTemplate, runTemplate };
