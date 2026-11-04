// Запуск: npm i puppeteer && node tests/works.js  (сайт: ../index.html или SITE_URL; Chrome: CHROME_PATH, по умолчанию браузер puppeteer)
require('fs').mkdirSync(require('path').join(__dirname, 'shots'), { recursive: true });
const puppeteer = require('puppeteer');
const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = []; const ok = (n, c, i = '') => out.push([c ? 'OK  ' : 'FAIL', n, i]);
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: 'new', args: ['--no-sandbox'] });
  for (const [w, h] of [[360, 780], [390, 844], [430, 932], [1024, 768], [1280, 860], [1440, 900]]) {
    const p = await b.newPage(); await p.setViewport({ width: w, height: h, isMobile: w < 700, hasTouch: w < 700 });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto((process.env.SITE_URL || 'file://' + path.resolve(__dirname, '..', 'index.html'))); await p.waitForFunction(() => getComputedStyle(document.querySelector('#catalogGrid')).display === 'grid'); await sleep(300);
    const lazy0 = await p.evaluate(() => [...document.querySelectorAll('#rail img')].filter(i => i.getAttribute('src')).length);
    await p.evaluate(() => document.querySelector('#works').scrollIntoView()); await sleep(800);
    const st = () => p.evaluate(() => ({ count: document.querySelector('#railCount').textContent, dot: [...document.querySelectorAll('[data-dot]')].findIndex(d => d.getAttribute('aria-current') === 'true'), prev: document.querySelector('#railPrev').disabled, next: document.querySelector('#railNext').disabled, sl: Math.round(document.querySelector('#rail').scrollLeft) }));
    let s0 = await st();
    const ui = await p.evaluate(() => ({ nav: !document.querySelector('#railNav').hidden, dots: document.querySelectorAll('[data-dot]').length, hint: document.querySelector('#railHint').textContent, sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
    const fitM = await p.evaluate(() => { const r = document.querySelector('#rail'), imgs = [...r.querySelectorAll('img')]; return { fit: r.classList.contains('is-fit'), over: r.scrollWidth > r.clientWidth + 1, h: Math.round(imgs[0].getBoundingClientRect().height), allIn: imgs.every(i => i.getBoundingClientRect().right <= r.getBoundingClientRect().right + 1), loaded: imgs.every(i => i.complete && i.naturalWidth > 0), hint: document.querySelector('#railHint').textContent }; });
    if (w >= 1280) ok(`${w}: все 5 фото помещаются — ряд без листания, без стрелок и точек`, fitM.fit && !ui.nav && !fitM.over && fitM.allIn && fitM.h >= 300 && fitM.loaded && fitM.hint === 'Нажмите на фото, чтобы открыть крупнее.', JSON.stringify(fitM));
    if (fitM.fit) {
      await p.click('[data-work="2"]'); await sleep(250);
      const lbf = await p.evaluate(() => document.querySelector('#lbCount').textContent); await p.keyboard.press('ArrowRight'); await sleep(150);
      const lbf2 = await p.evaluate(() => document.querySelector('#lbCount').textContent); await p.keyboard.press('Escape'); await sleep(150);
      ok(`${w}: в ряду фото открывается крупнее и листается в просмотре`, lbf === '3 из 5' && lbf2 === '4 из 5' && (await p.$eval('#lightbox', e => e.hidden)), lbf + ' → ' + lbf2);
      ok(`${w}: нет ошибок JS`, errs.length === 0, errs.join(' | ')); await p.close(); continue;
    }
    ok(`${w}: 5 фото — стрелки, счётчик 1 / 5, 5 точек, «назад» неактивна`, ui.nav && ui.dots === 5 && s0.count === '1 / 5' && s0.dot === 0 && s0.prev && !s0.next, JSON.stringify({ ...ui, ...s0 }));
    ok(`${w}: страница без горизонтальной прокрутки, фото ниже экрана грузятся отложенно`, ui.sw <= ui.vw && lazy0 === 0, `${ui.sw}/${ui.vw}, до прокрутки загружено ${lazy0}`);
    await p.click('#railNext'); await sleep(700); let s1 = await st();
    ok(`${w}: «вперёд» — ровно к следующему фото (2 / 5)`, s1.count === '2 / 5' && s1.dot === 1 && !s1.prev, JSON.stringify(s1));
    await p.click('[data-dot="4"]'); await sleep(800); let s2 = await st();
    ok(`${w}: точка переносит к нужному фото`, s2.dot === 4 || (s2.next && s2.dot >= 3), JSON.stringify(s2));
    await p.click('[data-dot="4"]'); await sleep(800); let s3 = await st();
    ok(`${w}: последнее фото — 5 / 5, «вперёд» неактивна`, s3.count === '5 / 5' && s3.next, JSON.stringify(s3));
    await p.focus('#rail'); await p.keyboard.press('Home'); await sleep(800);
    ok(`${w}: клавиши Home / стрелки работают`, (await st()).count === '1 / 5');
    await p.keyboard.press('ArrowRight'); await sleep(800);
    ok(`${w}: стрелка вправо — 2 / 5`, (await st()).count === '2 / 5');
    if (w < 700) {
      await p.evaluate(() => document.querySelector('#rail').scrollTo({ left: 0, behavior: 'instant' })); await sleep(300);
      const r = await p.$eval('#rail', el => { const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
      await p.touchscreen.touchStart(r.x + 100, r.y); for (let k = 1; k <= 8; k++) await p.touchscreen.touchMove(r.x + 100 - k * 25, r.y); await p.touchscreen.touchEnd(); await sleep(900);
      const sw = await st();
      ok(`${w}: свайп листает и докручивает до фото (snap)`, sw.sl > 0 && sw.dot >= 1, JSON.stringify(sw));
    } else {
      await p.evaluate(() => document.querySelector('#rail').scrollTo({ left: 0, behavior: 'instant' })); await sleep(300);
      const r = await p.$eval('#rail', el => { const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
      await p.mouse.move(r.x, r.y); await p.mouse.down(); for (let k = 1; k <= 10; k++) await p.mouse.move(r.x - k * 30, r.y); await p.mouse.up(); await sleep(900);
      const dr = await st(); const lbOpen = await p.$eval('#lightbox', e => !e.hidden);
      ok(`${w}: перетаскивание мышью листает, после отпускания — ровно на фото, просмотр не открылся случайно`, dr.sl > 0 && dr.dot >= 1 && !lbOpen, JSON.stringify(dr));
    }
    await p.evaluate(() => document.querySelector('#rail').scrollTo({ left: 0, behavior: 'instant' })); await sleep(300);
    await p.click('[data-work="0"]'); await sleep(250);
    const lb = await p.evaluate(() => ({ count: document.querySelector('#lbCount').textContent, vis: document.querySelector('#lbNext').style.visibility }));
    await p.click('#lbNext'); await sleep(100);
    const lb2 = await p.$eval('#lbCount', e => e.textContent);
    await p.keyboard.press('Escape'); await sleep(150);
    ok(`${w}: просмотр крупнее листает 5 фото и закрывается`, lb.count === '1 из 5' && lb.vis === '' && lb2 === '2 из 5' && (await p.$eval('#lightbox', e => e.hidden)), JSON.stringify({ lb, lb2 }));
    ok(`${w}: нет ошибок JS`, errs.length === 0, errs.join(' | '));
    if (w === 390 || w === 1280) { await p.evaluate(() => document.querySelector('#works').scrollIntoView()); await sleep(300); await p.evaluate(() => document.querySelector('#rail').scrollTo({ left: 0, behavior: 'instant' })); await p.click('#railNext'); await sleep(700); await p.screenshot({ path: require('path').join(__dirname, 'shots', `multi_${w}.png`) }); }
    await p.close();
  }
  await b.close(); out.forEach(r => console.log(r[0], r[1], r[2] ? '— ' + r[2] : '')); console.log('\nИтого:', out.filter(r => r[0].trim() === 'OK').length, 'из', out.length);
})();
