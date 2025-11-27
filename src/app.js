const express = require('express');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const { registerListingRoute } = require('./routes/listing');

/**
 * Tạo và cấu hình Express app
 */
function createApp() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.static('public'));
  try {
    const bootstrapDist = path.join(path.dirname(require.resolve('bootstrap/package.json')), 'dist');
    app.use('/vendor/bootstrap', express.static(bootstrapDist));
  } catch (_) {
    app.use('/vendor/bootstrap', express.static(path.join(__dirname, '..', '..', 'node_modules', 'bootstrap', 'dist')));
  }
  const prisma = new PrismaClient();

  registerListingRoute(app, prisma);

  process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
  return app;
}

/**
 * Khởi động HTTP server
 */
function start() {
  const app = createApp();
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const server = app.listen(port, () => { console.log(`Server listening on http://localhost:${port}/listing`); });
  return { app, server, port };
}

if (require.main === module) {
  start();
}

module.exports = { createApp, start };
