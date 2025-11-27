const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

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

function parseMatches(html) {
  const $ = cheerio.load(html);
  const results = [];
  const root = $('.table-responsive .jstable.jsMatchDivMain');
  if (!root.length) return results;

  root.find('.jsrow-matchday-name').each((_, nameEl) => {
    const $name = $(nameEl);
    const round = textOf($name);
    const mdRow = $name.parent();
    const wrappers = mdRow.nextUntil('.js-mdname', '.js-matchday-wrapper');
    wrappers.each((___, wrapEl) => {
      const wrapper = $(wrapEl);
      const weekday = textOf(wrapper.find('.js-matchday-title .js-matchday-weekday').first());
      const date = textOf(wrapper.find('.js-matchday-title .js-matchday-date').first());

      wrapper.find('.js-matchday-matches .jstable-row').each((__, rowEl) => {
        const row = $(rowEl);
        const time = textOf(row.find('.jsMatchDivTime .jsDivLineEmbl').first());
        const stt = textOf(row.find('.js-ma-tran .jsDivLineEmbl').first());
        const stadium = textOf(row.find('.jsMatchDivVenue').first());

        const homeTeam = textOf(row.find('.jsMatchDivHome .js_div_particName a').first());
        const homeLogo = attrOf(row.find('.jsMatchDivHomeEmbl img').first(), 'src');

        const scoreLink = row.find('.jsMatchDivScore .jsScoreDiv a').first();
        let score = scoreLink.length ? textOf(scoreLink) : textOf(row.find('.jsMatchDivScore .jsScoreDiv').first());
        if (!/^\d+\s*-\s*\d+$/.test(score)) score = '';

        const awayLogo = attrOf(row.find('.jsMatchDivAwayEmbl img').first(), 'src');
        const awayTeam = textOf(row.find('.jsMatchDivAway .js_div_particName a').first());

        const tvChannel = textOf(row.find('.jsChannelDiv').first());
        const audience = textOf(row.find('.js-audience .jsDivLineEmbl').first());
        const varDiv = row.find('.jo-match-var').first();
        const hasVar = varDiv.find('img[src*="var.png"]').length > 0;
        const varStatus = hasVar ? 'VAR' : '';

        results.push({
          vong: round,
          thu_ngay: `${weekday} - ${date}`.trim(),
          gio: time,
          stt,
          svd: stadium,
          doi_nha: homeTeam,
          logo_doi_nha: homeLogo,
          ket_qua: score,
          trang_thai_var: varStatus,
          doi_khach: awayTeam,
          logo_doi_khach: awayLogo,
          kenh_tv: tvChannel,
          khan_gia: audience,
        });
      });
    });
  });

  return results;
}

function main() {
  const fileArg = process.argv[2] || 'vpf2026.html';
  const html = readHtml(fileArg);
  const data = parseMatches(html);
  console.log(JSON.stringify(data, null, 2));
}

if (require.main === module) {
  main();
}