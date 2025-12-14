/**
 * Đăng ký route giao diện quản trị crawler (/crawler)
 */
const { listTasks } = require('../services/scheduler');
const { listTemplates, getTemplateById } = require('../services/templates');

function registerCrawlerRoute(app) {
  app.get('/crawler', async (req, res) => {
    res.redirect('/crawler/schedules');
  });
  app.get('/crawler/templates', async (req, res) => {
    const templates = listTemplates();
    res.render('pages/templates_list', { templates });
  });
  app.get('/crawler/schedules', async (req, res) => {
    const templates = listTemplates();
    res.render('pages/schedules', { templates });
  });
  app.get('/crawler/schedules/:id', async (req, res) => {
    const templates = listTemplates();
    res.render('pages/schedule_detail', { templates, scheduleId: parseInt(req.params.id, 10) });
  });
  app.get('/crawler/templates/new', async (req, res) => {
    res.render('pages/template_new', {});
  });
  app.get('/crawler/templates/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const template = getTemplateById(id);
    if (!template) return res.status(404).send('Template not found');
    res.render('pages/template_edit', { template });
  });
}

module.exports = { registerCrawlerRoute };
