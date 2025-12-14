/**
 * Đăng ký nhóm API: templates, tasks, runs/results
 */
const express = require('express');
const { fetchHtml, parseWithTemplate, runTemplate } = require('../services/templateEngine');
const { runOnce, listRunResults, readRunResult, startRun, getRunStatus } = require('../services/runner');
const { upsertSchedule, listSchedules, getScheduleById, deleteSchedule, toggleSchedule, runNow } = require('../services/schedules');
const { upsertTask, runTask, getLatestResultFile, readResultFile, toggleTask, listTasks, deleteTask, listResults, readResultByName } = require('../services/scheduler');
const { upsertTemplate, listTemplates, getTemplateById, deleteTemplate } = require('../services/templates');

/**
 * Đăng ký các route API vào app
 */
function registerApiRoutes(app, prisma) {
  const router = express.Router();

  router.post('/templates/test', async (req, res) => {
    try {
      const { url, template } = req.body || {};
      if (!url || !template) return res.status(400).json({ error: 'Missing url or template' });
      const items = await runTemplate(url, template);
      return res.json({ items, count: items.length });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  });

  // Runner based on template
  router.post('/run', async (req, res) => {
    try {
      const { url, templateId, template, retainLimit } = req.body || {};
      if (!url || (!templateId && !template)) return res.status(400).json({ error: 'Missing url|templateId|template' });
      const result = await runOnce({ url, templateId, template, retainLimit: retainLimit ?? 5 });
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  });
  router.post('/run/start', async (req, res) => {
    try {
      const { url, templateId, template, retainLimit } = req.body || {};
      if (!url || (!templateId && !template)) return res.status(400).json({ error: 'Missing url|templateId|template' });
      const r = await startRun({ url, templateId, template, retainLimit: retainLimit ?? 5 });
      return res.json(r);
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  });
  router.get('/run/status/:id', (req, res) => {
    const id = req.params.id;
    const s = getRunStatus(id);
    if (!s) return res.status(404).json({ error: 'Not found' });
    return res.json(s);
  });
  router.get('/run/results/:key', (req, res) => {
    const key = req.params.key;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const items = listRunResults(key, limit);
    return res.json({ items, count: items.length });
  });
  router.get('/run/results/:key/:name', (req, res) => {
    const key = req.params.key;
    const name = req.params.name;
    const data = readRunResult(key, name);
    if (!data) return res.status(404).json({ error: 'Not found' });
    return res.json(data);
  });
  router.delete('/run/results/:key/:name', (req, res) => {
    const key = req.params.key;
    const name = req.params.name;
    const { deleteRunResult } = require('../services/runner');
    const ok = deleteRunResult(key, name);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true });
  });

  // Schedules (cron tasks)
  router.get('/schedules', (req, res) => {
    const items = listSchedules();
    return res.json({ items, count: items.length });
  });
  router.get('/schedules/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const item = getScheduleById(id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    return res.json({ schedule: item });
  });
  router.post('/schedules', (req, res) => {
    const { name, url, templateId, template, cron, retainLimit, isActive } = req.body || {};
    if (!name || !url || (!templateId && !template)) return res.status(400).json({ error: 'Missing name|url|templateId|template' });
    const sch = { id: Date.now(), name, url, templateId: templateId ? parseInt(templateId, 10) : undefined, template, cron: cron || null, retainLimit: retainLimit ?? 5, isActive: !!isActive };
    upsertSchedule(sch);
    return res.json({ ok: true, schedule: sch });
  });
  router.patch('/schedules/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const sch = getScheduleById(id);
    if (!sch) return res.status(404).json({ error: 'Not found' });
    const { name, url, templateId, template, cron, retainLimit, isActive } = req.body || {};
    if (name !== undefined) sch.name = name;
    if (url !== undefined) sch.url = url;
    if (retainLimit !== undefined) sch.retainLimit = retainLimit;
    if (cron !== undefined) sch.cron = cron;
    if (isActive !== undefined) sch.isActive = !!isActive;
    if (templateId !== undefined) { sch.templateId = templateId ? parseInt(templateId, 10) : undefined; sch.template = undefined; }
    if (template !== undefined) { sch.template = template || undefined; if (sch.template) sch.templateId = undefined; }
    upsertSchedule(sch);
    return res.json({ ok: true, schedule: sch });
  });
  router.delete('/schedules/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const ok = deleteSchedule(id);
    return res.json({ ok });
  });
  router.post('/schedules/:id/toggle', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { active } = req.body || {};
    try {
      const sch = toggleSchedule(id, !!active);
      return res.json({ ok: true, schedule: sch });
    } catch (e) {
      return res.status(400).json({ error: String(e.message || e) });
    }
  });
  router.post('/schedules/:id/run', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    try {
      const r = await runNow(id);
      return res.json(r);
    } catch (e) {
      return res.status(400).json({ error: String(e.message || e) });
    }
  });
  router.get('/schedules/:id/next-run', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { getNextRunInfo } = require('../services/schedules');
    const info = getNextRunInfo(id);
    if (!info) return res.status(404).json({ error: 'Not found' });
    return res.json(info);
  });

  router.get('/templates', (req, res) => {
    const items = listTemplates();
    return res.json({ items, count: items.length });
  });
  router.post('/templates', (req, res) => {
    const { name, description, config } = req.body || {};
    if (!name || !config) return res.status(400).json({ error: 'Missing name|config' });
    let parsed = config;
    if (typeof config === 'string') {
      try { parsed = JSON.parse(config); } catch (e) { return res.status(400).json({ error: 'config must be JSON' }); }
    }
    const tpl = upsertTemplate({ id: Date.now(), name, description: description || '', config: parsed, isActive: true, createdAt: new Date().toISOString() });
    return res.json({ ok: true, template: tpl });
  });
  router.get('/templates/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const tpl = getTemplateById(id);
    if (!tpl) return res.status(404).json({ error: 'Not found' });
    return res.json({ template: tpl });
  });
  router.patch('/templates/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const tpl = getTemplateById(id);
    if (!tpl) return res.status(404).json({ error: 'Not found' });
    const { name, description, config, isActive } = req.body || {};
    if (name !== undefined) tpl.name = name;
    if (description !== undefined) tpl.description = description;
    if (isActive !== undefined) tpl.isActive = !!isActive;
    if (config !== undefined) {
      let parsed = config;
      if (typeof config === 'string') {
        try { parsed = JSON.parse(config); } catch (e) { return res.status(400).json({ error: 'config must be JSON' }); }
      }
      tpl.config = parsed;
    }
    upsertTemplate(tpl);
    return res.json({ ok: true, template: tpl });
  });
  router.delete('/templates/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const ok = deleteTemplate(id);
    return res.json({ ok });
  });

  router.get('/tasks', (req, res) => {
    return res.json({ items: listTasks(), count: listTasks().length });
  });
  router.get('/tasks/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const item = listTasks().find((t) => t.id === id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    return res.json({ task: item });
  });

  router.post('/tasks', (req, res) => {
    const { name, url, template, templateId, cron, retainLimit, visibility, isActive } = req.body || {};
    if (!name || !url || (!template && !templateId)) return res.status(400).json({ error: 'Missing name|url|template|templateId' });
    const id = Date.now();
    const task = { id, name, url, cron: cron || null, retainLimit: retainLimit ?? 5, visibility: visibility || 'private', isActive: !!isActive };
    if (templateId) {
      const tpl = getTemplateById(parseInt(templateId, 10));
      if (!tpl) return res.status(400).json({ error: 'templateId not found' });
      task.templateId = parseInt(templateId, 10);
    } else {
      task.template = template;
    }
    upsertTask(task);
    return res.json({ ok: true, task });
  });
  router.patch('/tasks/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const items = listTasks();
    const task = items.find((t) => t.id === id);
    if (!task) return res.status(404).json({ error: 'Not found' });
    const { name, url, cron, retainLimit, visibility, isActive, templateId, template } = req.body || {};
    if (name !== undefined) task.name = name;
    if (url !== undefined) task.url = url;
    if (cron !== undefined) task.cron = cron;
    if (retainLimit !== undefined) task.retainLimit = retainLimit;
    if (visibility !== undefined) task.visibility = visibility;
    if (isActive !== undefined) task.isActive = !!isActive;
    if (templateId !== undefined) {
      task.templateId = templateId ? parseInt(templateId, 10) : undefined;
      task.template = undefined;
    }
    if (template !== undefined) {
      task.template = template || undefined;
      if (task.template) task.templateId = undefined;
    }
    upsertTask(task);
    return res.json({ ok: true, task });
  });
  router.delete('/tasks/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const ok = deleteTask(id);
    return res.json({ ok });
  });

  router.post('/tasks/:id/toggle', (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { active } = req.body || {};
      const t = toggleTask(id, !!active);
      return res.json({ ok: true, task: t });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  });

  router.post('/tasks/:id/run', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const result = await runTask(id);
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  });

  router.get('/tasks/:id/results/latest', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const file = getLatestResultFile(id);
    if (!file) return res.status(404).json({ error: 'No result' });
    const data = readResultFile(file);
    return res.json(data);
  });
  router.get('/tasks/:id/results', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const items = listResults(id, limit);
    return res.json({ items, count: items.length });
  });
  router.get('/tasks/:id/results/:name', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const name = req.params.name;
    const data = readResultByName(id, name);
    if (!data) return res.status(404).json({ error: 'Not found' });
    return res.json(data);
  });

  router.get('/public/tasks/:id/results/latest', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const file = getLatestResultFile(id);
    if (!file) return res.status(404).json({ error: 'No result' });
    const data = readResultFile(file);
    return res.json(data);
  });

  app.use('/api', router);
}

module.exports = { registerApiRoutes };
