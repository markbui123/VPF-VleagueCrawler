const { escapeHtml } = require('../utils/html');

/**
 * Đăng ký route /listing
 */
function registerListingRoute(app, prisma) {
  app.get('/listing', async (req, res) => {
    try {
      const seasons = await prisma.season.findMany({ orderBy: { id: 'desc' } });
      const seasonId = req.query.seasonId ? parseInt(String(req.query.seasonId), 10) : seasons.length ? seasons[0].id : undefined;
      const page = 1;
      const pageSize = undefined;
      const vongFilter = req.query.vong ? String(req.query.vong) : undefined;
      const teamFilter = req.query.team ? String(req.query.team).trim() : undefined;
      const resultFilter = req.query.result ? String(req.query.result) : undefined;
      const varFilter = req.query.var ? String(req.query.var) : undefined;

      let matches = [];
      let total = 0;
      let distinctRounds = [];
      if (seasonId) {
        const andConds = [];
        if (vongFilter) andConds.push({ vong: vongFilter });
        if (teamFilter) andConds.push({ OR: [{ doiNha: { contains: teamFilter } }, { doiKhach: { contains: teamFilter } }] });
        if (resultFilter === 'has') { andConds.push({ ketQua: { not: null } }); andConds.push({ ketQua: { not: '' } }); }
        if (resultFilter === 'none') { andConds.push({ OR: [{ ketQua: null }, { ketQua: '' }] }); }
        if (varFilter === 'has') { andConds.push({ hasVar: true }); }
        if (varFilter === 'none') { andConds.push({ OR: [{ hasVar: false }, { hasVar: null }] }); }

        const where = andConds.length ? { seasonId, AND: andConds } : { seasonId };
        total = await prisma.match.count({ where });
        matches = await prisma.match.findMany({ where, orderBy: [{ matchDateTime: 'asc' }, { id: 'asc' }] });
        distinctRounds = await prisma.match.findMany({ where: { seasonId }, select: { vong: true }, distinct: ['vong'], orderBy: { vong: 'asc' } });
      }

      const groups = {};
      for (const m of matches) {
        const key = m.vong || 'Khác';
        if (!groups[key]) groups[key] = [];
        groups[key].push(m);
      }
      res.render('pages/listing', {
        seasons,
        selectedSeasonId: seasonId,
        matches,
        page,
        pageSize,
        total,
        vongFilter,
        teamFilter,
        resultFilter,
        varFilter,
        rounds: distinctRounds.map((r) => r.vong),
        groups,
      });
    } catch (e) {
      res.status(500).send(`<pre>${String(e.stack || e)}</pre>`);
    }
  });
}

module.exports = { registerListingRoute };
