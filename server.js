const express = require('express');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

/**
 * Khởi tạo ứng dụng Express và PrismaClient
 */
function createApp() {
  const app = express();
  const prisma = new PrismaClient();
  app.use(express.static('public'));

  /**
   * Route /listing: liệt kê danh sách trận đấu theo mùa
   */
  app.get('/listing', async (req, res) => {
    try {
      const seasons = await prisma.season.findMany({
        orderBy: { id: 'desc' },
      });

      const seasonId = req.query.seasonId
        ? parseInt(String(req.query.seasonId), 10)
        : seasons.length ? seasons[0].id : undefined;

      const page = req.query.page ? Math.max(1, parseInt(String(req.query.page), 10)) : 1;
      const pageSize = req.query.pageSize ? Math.max(1, parseInt(String(req.query.pageSize), 10)) : 20;
      const skip = (page - 1) * pageSize;
      const vongFilter = req.query.vong ? String(req.query.vong) : undefined;
      const teamFilter = req.query.team ? String(req.query.team).trim() : undefined;
      const resultFilter = req.query.result ? String(req.query.result) : undefined; // 'has' | 'none'
      const varFilter = req.query.var ? String(req.query.var) : undefined; // 'has' | 'none'

      let matches = [];
      let total = 0;
      let distinctRounds = [];
      if (seasonId) {
        const andConds = [];
        if (vongFilter) andConds.push({ vong: vongFilter });
        if (teamFilter) andConds.push({ OR: [
          { doiNha: { contains: teamFilter } },
          { doiKhach: { contains: teamFilter } },
        ] });
        if (resultFilter === 'has') {
          andConds.push({ ketQua: { not: null } });
          andConds.push({ ketQua: { not: '' } });
        }
        if (resultFilter === 'none') {
          andConds.push({ OR: [{ ketQua: null }, { ketQua: '' }] });
        }
        if (varFilter === 'has') {
          andConds.push({ hasVar: true });
        }
        if (varFilter === 'none') {
          andConds.push({ OR: [{ hasVar: false }, { hasVar: null }] });
        }

        const where = andConds.length ? { seasonId, AND: andConds } : { seasonId };

        total = await prisma.match.count({ where });
        matches = await prisma.match.findMany({
          where,
          orderBy: [{ matchDateTime: 'asc' }, { id: 'asc' }],
          skip,
          take: pageSize,
        });

        distinctRounds = await prisma.match.findMany({
          where: { seasonId },
          select: { vong: true },
          distinct: ['vong'],
          orderBy: { vong: 'asc' },
        });
      }

      const html = renderListingPage(seasons, seasonId, matches, {
        page, pageSize, total, vongFilter, teamFilter, resultFilter, varFilter,
        rounds: distinctRounds.map((r) => r.vong),
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (e) {
      res.status(500).send(`<pre>${escapeHtml(String(e.stack || e))}</pre>`);
    }
  });

  /**
   * Cleanup Prisma khi process thoát
   */
  process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  return app;
}

/**
 * Render HTML danh sách trận đấu
 */
function renderListingPage(seasons, selectedSeasonId, matches, opts) {
  const { page, pageSize, total, vongFilter, teamFilter, resultFilter, varFilter, rounds } = opts || {};
  const options = seasons
    .map((s) => `<option value="${s.id}" ${s.id === selectedSeasonId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`) 
    .join('');

  const roundOptions = (rounds || []).map((r) => `<option value="${escapeHtml(r)}" ${r === vongFilter ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('');

  const rows = matches.map((m) => {
    return `
      <tr>
        <td>${escapeHtml(m.vong)}</td>
        <td>${escapeHtml(m.thuNgay)}</td>
        <td>${escapeHtml(m.gio || '')}</td>
        <td>${escapeHtml(m.maTran || '')}</td>
        <td>${escapeHtml(m.svd || '')}</td>
        <td>${escapeHtml(m.doiNha)}</td>
        <td>${m.logoDoiNha ? `<img src="${escapeHtml(m.logoDoiNha)}" alt="logo" width="28"/>` : ''}</td>
        <td>${escapeHtml(m.ketQua || '')}</td>
        <td>${escapeHtml(m.trangThaiVar || '')}</td>
        <td>${escapeHtml(m.doiKhach)}</td>
        <td>${m.logoDoiKhach ? `<img src="${escapeHtml(m.logoDoiKhach)}" alt="logo" width="28"/>` : ''}</td>
        <td>${escapeHtml(m.kenhTv || '')}</td>
        <td>${escapeHtml(m.khanGia || '')}</td>
      </tr>
    `;
  }).join('');

  const totalPages = total ? Math.max(1, Math.ceil(total / (pageSize || 20))) : 1;
  const makeLink = (p) => {
    const params = new URLSearchParams();
    params.set('seasonId', String(selectedSeasonId || ''));
    params.set('page', String(p));
    params.set('pageSize', String(pageSize || 20));
    if (vongFilter) params.set('vong', vongFilter);
    if (teamFilter) params.set('team', teamFilter);
    if (resultFilter) params.set('result', resultFilter);
    if (varFilter) params.set('var', varFilter);
    return `/listing?${params.toString()}`;
  };

  return `
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Listing Matches</title>
    <link rel="stylesheet" href="/styles/listing.css" />
    <script>
      function onSeasonChange(sel){
        const id = sel.value;
        const url = new URL(window.location.href);
        url.searchParams.set('seasonId', id);
        window.location.href = url.toString();
      }
    </script>
  </head>
  <body>
    <div class="toolbar">
      <label for="season-picker">Giải đấu:</label>
      <select id="season-picker" onchange="onSeasonChange(this)">
        ${options}
      </select>
      <label for="round-picker">Vòng:</label>
      <select id="round-picker" onchange="location.href='${makeLink(1)}'.replace('page='+encodeURIComponent('${page}'),'page=1').replace(/(&|\?)vong=[^&]*/,'') + '&vong=' + encodeURIComponent(this.value)">
        <option value="">Tất cả</option>
        ${roundOptions}
      </select>
      <label for="team-input">Đội:</label>
      <input id="team-input" type="text" value="${escapeHtml(teamFilter || '')}" />
      <button onclick="location.href='${makeLink(1)}'.replace(/(&|\?)team=[^&]*/,'') + '&team=' + encodeURIComponent(document.getElementById('team-input').value)">Lọc</button>
      <label for="result-picker">Kết quả:</label>
      <select id="result-picker" onchange="location.href='${makeLink(1)}'.replace(/(&|\?)result=[^&]*/,'') + (this.value ? '&result=' + encodeURIComponent(this.value) : '')">
        <option value="">Tất cả</option>
        <option value="has" ${resultFilter==='has'?'selected':''}>Đã có</option>
        <option value="none" ${resultFilter==='none'?'selected':''}>Chưa có</option>
      </select>
      <label for="var-picker">VAR:</label>
      <select id="var-picker" onchange="location.href='${makeLink(1)}'.replace(/(&|\?)var=[^&]*/,'') + (this.value ? '&var=' + encodeURIComponent(this.value) : '')">
        <option value="">Tất cả</option>
        <option value="has" ${varFilter==='has'?'selected':''}>Có</option>
        <option value="none" ${varFilter==='none'?'selected':''}>Không</option>
      </select>
      <a href="/listing">Reset</a>
    </div>
    <table>
      <thead>
        <tr>
          <th>Vòng</th>
          <th>Thứ - Ngày tháng</th>
          <th>Giờ</th>
          <th>Mã trận</th>
          <th>SVĐ</th>
          <th>Đội nhà</th>
          <th>Logo đội nhà</th>
          <th>Kết quả</th>
          <th>Trạng thái Var</th>
          <th>Đội khách</th>
          <th>Logo đội khách</th>
          <th>Kênh TV</th>
          <th>Khán giả</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <div style="margin-top:12px; display:flex; gap:8px; align-items:center;">
      <span>Trang ${page} / ${totalPages} (tổng ${total} trận)</span>
      ${page>1?`<a href="${makeLink(page-1)}">« Trước</a>`:''}
      ${page<totalPages?`<a href="${makeLink(page+1)}">Sau »</a>`:''}
    </div>
  </body>
</html>
  `;
}

/**
 * Escape HTML để tránh XSS
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Khởi động server trên PORT
 */
function start() {
  const app = createApp();
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const server = app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}/listing`);
  });
  return { app, server, port };
}

if (require.main === module) {
  start();
}