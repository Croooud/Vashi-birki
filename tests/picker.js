// Запуск: npm i puppeteer && node tests/picker.js  (сайт: ../index.html или SITE_URL; Chrome: CHROME_PATH, по умолчанию браузер puppeteer)
require('fs').mkdirSync(require('path').join(__dirname, 'shots'), { recursive: true });
const puppeteer = require('puppeteer'); const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = []; const ok = (n, c, i = '') => out.push([c ? 'OK  ' : 'FAIL', n, i]);
(async () => { const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
 for (const [w, h] of [[360, 740], [390, 844], [430, 932], [1280, 860]]) {
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: w, height: h, isMobile: w < 700, hasTouch: w < 700 });
  await p.goto((process.env.SITE_URL || 'file://' + path.resolve(__dirname, '..', 'index.html'))); await sleep(400);
  for (const [prod, k] of [['ribbon', 'base'], ['ribbon', 'print'], ['vinyl', 'base']]) {
    await p.evaluate(id => document.querySelector(`[data-open="${id}"]`).click(), prod); await sleep(450);
    const card = await p.evaluate(() => { const f = [...document.querySelectorAll('#pColors .cf')]; return { over: f.some(x => x.scrollWidth > x.clientWidth + 1), clip: [...document.querySelectorAll('#pColors .cf-btn')].some(x => x.scrollWidth > x.clientWidth + 1) }; });
    await p.evaluate(k => document.querySelector(`[data-pick="${k}"]`).scrollIntoView({ block: 'center' }), k);
    if (w < 700) await p.tap(`[data-pick="${k}"]`); else await p.click(`[data-pick="${k}"]`);
    await sleep(320);
    const r = await p.evaluate(() => {
      const pk = document.querySelector('#picker'), pr = pk.getBoundingClientRect(), grid = document.querySelector('#pkGrid'), tiles = [...grid.querySelectorAll('.pk-tile')];
      const names = tiles.map(t => t.querySelector('.pk-name'));
      const close = document.querySelector('#pkClose').getBoundingClientRect(), ok = document.querySelector('#pkOk').getBoundingClientRect();
      return { vis: !pk.hidden, full: Math.round(pr.width), vw: innerWidth, hOver: grid.scrollWidth > grid.clientWidth + 1 || document.querySelector('#pkBody').scrollWidth > document.querySelector('#pkBody').clientWidth + 1,
        clipped: names.filter(n => n.scrollWidth > n.clientWidth + 1).map(n => n.textContent), minName: Math.min(...names.map(n => parseFloat(getComputedStyle(n).fontSize))),
        tileW: Math.round(tiles[0].getBoundingClientRect().width), closeSz: Math.round(Math.min(close.width, close.height)), okIn: ok.bottom <= innerHeight + 1 && ok.top >= 0,
        pageSW: document.documentElement.scrollWidth, focusIn: pk.contains(document.activeElement), n: tiles.length };
    });
    ok(`${w} ${prod}/${k}: окно открыто, без горизонтального скролла, подписи не обрезаны (≥13px)`, r.vis && !r.hOver && !r.clipped.length && r.minName >= 13 && r.pageSW <= w && !card.over && !card.clip, JSON.stringify(r));
    ok(`${w} ${prod}/${k}: крупные миниатюры, заметное закрытие (≥44px), «Готово» на экране, фокус внутри`, r.tileW >= 88 && r.closeSz >= 44 && r.okIn && r.focusIn, `tile ${r.tileW}, close ${r.closeSz}, ok ${r.okIn}, focus ${r.focusIn}`);
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
    ok(`${w} ${prod}/${k}: Tab не уходит из окна цвета`, await p.evaluate(() => document.querySelector('#picker').contains(document.activeElement)));
    if (w === 390 && k === 'base' && prod === 'ribbon') { await p.screenshot({ path: path.join(__dirname, 'shots', 'pk_390.png') }); }
    await p.click('#pkClose'); await sleep(150);
    ok(`${w} ${prod}/${k}: после закрытия фокус на поле цвета`, await p.evaluate(k => document.activeElement === document.querySelector(`[data-pick="${k}"]`), k));
    if (w === 390 && k === 'base' && prod === 'vinyl') { await p.evaluate(() => document.querySelector('#pColors').scrollIntoView({ block: 'start' })); await sleep(100); await p.screenshot({ path: path.join(__dirname, 'shots', 'card_vinyl_390.png') }); }
    if (w === 1280 && k === 'base' && prod === 'ribbon') { await p.click('[data-pick="base"]'); await sleep(300); await p.screenshot({ path: path.join(__dirname, 'shots', 'pk_1280.png') }); await p.click('#pkClose'); await sleep(120); }
    await p.keyboard.press('Escape'); await sleep(250);
  }
  ok(`${w}: нет ошибок JS`, errs.length === 0, errs.join(' | '));
  await p.close();
 }
 await b.close();
 out.forEach(r => console.log(r[0], r[1], r[2] ? '— ' + r[2] : '')); console.log(`\nИтого: ${out.filter(r => r[0] === 'OK  ').length} из ${out.length}`);
})();
