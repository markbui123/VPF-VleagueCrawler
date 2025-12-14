const fs = require('fs');
const path = require('path');
const storeFile = path.join(process.cwd(), 'data', 'templates.json');
let templatesArr = [];
try {
  const txt = fs.readFileSync(storeFile, 'utf8');
  templatesArr = JSON.parse(txt);
} catch (_) {
  templatesArr = [];
}
function persist() {
  fs.mkdirSync(path.dirname(storeFile), { recursive: true });
  fs.writeFileSync(storeFile, JSON.stringify(templatesArr, null, 2));
}

/**
 * Tạo hoặc cập nhật template
 */
function upsertTemplate(tpl) {
  if (!tpl.id) tpl.id = Date.now();
  const idx = templatesArr.findIndex((t) => t.id === tpl.id);
  if (idx >= 0) templatesArr[idx] = tpl; else templatesArr.push(tpl);
  persist();
  return tpl;
}

/**
 * Lấy template theo id
 */
function getTemplateById(id) {
  return templatesArr.find((t) => t.id === id);
}

/**
 * Liệt kê template
 */
function listTemplates() {
  return templatesArr.slice();
}

/**
 * Xoá template
 */
function deleteTemplate(id) {
  const before = templatesArr.length;
  templatesArr = templatesArr.filter((t) => t.id !== id);
  persist();
  return templatesArr.length < before;
}

module.exports = { upsertTemplate, getTemplateById, listTemplates, deleteTemplate };
