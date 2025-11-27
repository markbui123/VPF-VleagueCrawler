const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

function readHtml(filePath) {
  const abs = path.resolve(filePath);
  return fs.readFileSync(abs, 'utf8');
}

function textOf($el) {
  return ($el.text() || '').trim();
}

function attrOf($el, name) {
  const v = $el.attr(name);
  return v ? v.trim() : '';
}

function extractSeasonNameFromRound(roundText) {
  const m = roundText.replace(/^Vòng\s*\d+\s*/i, '').trim();
  return m;
}

function extractThoiGianToChuc(seasonName) {
  const m = seasonName.match(/(\d{4}\/?\d{2})/);
  return m ? m[1] : null;
}

function parseViDateTime(dateStr, timeStr) {
  const m = String(dateStr || '').match(/(\d{1,2})\s+Tháng\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  let h = 0;
  let min = 0;
  if (timeStr && /^(\d{1,2}):(\d{2})$/.test(timeStr)) {
    const tt = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    h = parseInt(tt[1], 10);
    min = parseInt(tt[2], 10);
  }
  return new Date(year, month - 1, day, h, min, 0);
}

function parseMatches(html) {
  const $ = cheerio.load(html);
  const results = [];
  const root = $('.table-responsive .jstable.jsMatchDivMain');
  if (!root.length) return { seasonName: '', matches: results };
  const firstRoundText = textOf(root.find('.jsrow-matchday-name').first());
  const seasonName = extractSeasonNameFromRound(firstRoundText);

  root.find('.js-mdname .jsrow-matchday-name').each((i, el) => {
    const $name = $(el);
    const round = textOf($name);
    const roundElementId = attrOf($name, 'id');
    const mdRow = $name.parent();
    let cur = mdRow.next();
    while (cur.length && !cur.hasClass('js-mdname')) {
      if (cur.hasClass('js-matchday-wrapper')) {
        const weekday = textOf(cur.find('.js-matchday-title .js-matchday-weekday').first());
        const date = textOf(cur.find('.js-matchday-title .js-matchday-date').first());
        cur.find('.js-matchday-matches .jstable-row').each((j, rowEl) => {
          const row = $(rowEl);
          const time = textOf(row.find('.jsMatchDivTime .jsDivLineEmbl').first());
          const maTranVal = textOf(row.find('.js-ma-tran .jsDivLineEmbl').first());
          const stadium = textOf(row.find('.jsMatchDivVenue').first());
          const homeTeamA = row.find('.jsMatchDivHome .js_div_particName a').first();
          const homeTeam = textOf(homeTeamA);
          const homeHref = attrOf(homeTeamA, 'href');
          const homeLogo = attrOf(row.find('.jsMatchDivHomeEmbl img').first(), 'src');
          const scoreLink = row.find('.jsMatchDivScore .jsScoreDiv a').first();
          let score = scoreLink.length ? textOf(scoreLink) : textOf(row.find('.jsMatchDivScore .jsScoreDiv').first());
          if (!/^\d+\s*-\s*\d+$/.test(score)) score = '';
          const matchUrl = attrOf(scoreLink, 'href');
          const awayLogo = attrOf(row.find('.jsMatchDivAwayEmbl img').first(), 'src');
          const awayTeamA = row.find('.jsMatchDivAway .js_div_particName a').first();
          const awayTeam = textOf(awayTeamA);
          const awayHref = attrOf(awayTeamA, 'href');
          const tvChannel = textOf(row.find('.jsChannelDiv').first());
          const audience = textOf(row.find('.js-audience .jsDivLineEmbl').first());
          const varDiv = row.find('.jo-match-var').first();
          const hasVar = varDiv.find('img[src*="var.png"]').length > 0;
          const varStatus = hasVar ? 'VAR' : '';

          const rawJson = {
            round,
            weekday,
            date,
            time,
            ma_tran: maTranVal,
            stadium,
            homeTeam,
            homeHref,
            homeLogo,
            score,
            matchUrl,
            awayTeam,
            awayHref,
            awayLogo,
            tvChannel,
            audience,
            varStatus,
            roundElementId,
          };
          const contentHash = crypto.createHash('sha1').update(JSON.stringify(rawJson)).digest('hex');
          const matchDateTime = parseViDateTime(date, time);
          results.push({
            seasonName,
            round,
            roundElementId,
            thu_ngay: `${weekday} - ${date}`.trim(),
            gio: time,
            matchDateTime,
            ma_tran: maTranVal,
            svd: stadium,
            doi_nha: homeTeam,
            logo_doi_nha: homeLogo,
            ket_qua: score,
            trang_thai_var: varStatus,
            hasVar,
            doi_khach: awayTeam,
            logo_doi_khach: awayLogo,
            kenh_tv: tvChannel,
            khan_gia: audience,
            matchUrl,
            homeHref,
            awayHref,
            contentHash,
            rawJson,
          });
        });
      }
      cur = cur.next();
    }
  });

  return { seasonName, matches: results };
}

async function main() {
  const fileArg = process.argv[2] || 'vleague-2026.html';
  const html = readHtml(fileArg);
  const { seasonName, matches } = parseMatches(html);
  const thoiGianToChuc = extractThoiGianToChuc(seasonName);
  const prisma = new PrismaClient();
  try {
    let season = await prisma.season.findFirst({ where: { name: seasonName } });
    if (!season) {
      season = await prisma.season.create({ data: { name: seasonName, thoiGianToChuc } });
    }
    const crawledAt = new Date();
    for (const m of matches) {
      const data = {
        seasonId: season.id,
        vong: m.round,
        thuNgay: m.thu_ngay,
        gio: m.gio || null,
        matchDateTime: m.matchDateTime || null,
        maTran: m.ma_tran || null,
        svd: m.svd || null,
        doiNha: m.doi_nha,
        logoDoiNha: m.logo_doi_nha || null,
        ketQua: m.ket_qua || null,
        trangThaiVar: m.trang_thai_var || null,
        hasVar: typeof m.hasVar === 'boolean' ? m.hasVar : (m.trang_thai_var ? true : null),
        doiKhach: m.doi_khach,
        logoDoiKhach: m.logo_doi_khach || null,
        kenhTv: m.kenh_tv || null,
        khanGia: m.khan_gia || null,
        roundElementId: m.roundElementId || null,
        matchUrl: m.matchUrl || null,
        homeHref: m.homeHref || null,
        awayHref: m.awayHref || null,
        dataSource: 'vpf.vn',
        crawledAt,
        contentHash: m.contentHash,
        rawJson: m.rawJson,
      };
      if (m.matchUrl) {
        const existing = await prisma.match.findFirst({ where: { seasonId: season.id, matchUrl: m.matchUrl } });
        if (existing) {
          await prisma.match.update({ where: { id: existing.id }, data });
        } else {
          await prisma.match.create({ data });
        }
      } else {
        await prisma.match.create({ data });
      }
    }
    console.log(`Inserted/updated ${matches.length} matches for season: ${seasonName}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}