// Типографика: висячие предлоги, тире в начале строки, одинокие слова, «лесенки» — на 7 ширинах
// Запуск: npm i puppeteer && node tests/typo.js  (сайт: ../index.html или SITE_URL; Chrome: CHROME_PATH, по умолчанию браузер puppeteer)
require('fs').mkdirSync(require('path').join(__dirname, 'shots'), { recursive: true });
const puppeteer = require('puppeteer'); const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => { const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
 const all = [];
 for (const w of [360, 390, 430, 768, 1024, 1280, 1440]) {
  const p = await b.newPage(); await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.setViewport({ width: w, height: 900 }); await p.goto((process.env.SITE_URL || 'file://' + path.resolve(__dirname, '..', 'index.html'))); await p.evaluate(() => document.fonts.ready); await sleep(500);
  const scan = async (scope) => p.evaluate((scope) => {
    const SHORT = /^(в|и|с|к|о|у|а|я|на|по|за|из|от|до|не|ни|но|да|со|во|об|для|без|под|над|при|про|или|как|что)$/i;
    const res = [];
    const els = [...document.querySelectorAll(scope + ' h1,' + scope + ' h2,' + scope + ' h3,' + scope + ' p,' + scope + ' li,' + scope + ' figcaption,' + scope + ' summary,' + scope + ' .card-title,' + scope + ' .ct-val,' + scope + ' .pk-name,' + scope + ' .cf-hint,' + scope + ' .cf-value')]
      .filter(el => el.offsetParent !== null && el.textContent.trim().length > 3 && !el.closest('.rb') && !el.querySelector('li,p'));
    for (const el of els) {
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const words = [];
      while (tw.nextNode()) { const n = tw.currentNode; const re = /[^ \t\n\r\u00a0\u202f]+/g; let m; while ((m = re.exec(n.nodeValue))) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); const rects = [...r.getClientRects()].filter(x => x.width > 0); if (!rects.length) continue; words.push({ t: m[0], top: Math.round(rects[0].top), right: rects[rects.length - 1].right, left: rects[0].left, multi: rects.length > 1 }); } }
      if (!words.length) continue;
      // слова, разорванные неразрывным пробелом, — одна «группа», нас интересует начало строк
      const lines = []; words.forEach(wd => { const L = lines.find(l => Math.abs(l.top - wd.top) < 4); if (L) L.w.push(wd); else lines.push({ top: wd.top, w: [wd] }); });
      lines.sort((a, b) => a.top - b.top);
      if (lines.length < 2) continue;
      const name = (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')) + ' «' + el.textContent.trim().replace(/\s+/g, ' ').slice(0, 50) + '»';
      lines.slice(0, -1).forEach(l => { const last = l.w[l.w.length - 1].t.replace(/[«»"(),.:;!?]/g, ''); if (SHORT.test(last)) res.push(['висит в конце строки', last, name]); });
      lines.slice(1).forEach(l => { if (/^[—–]$/.test(l.w[0].t)) res.push(['тире в начале строки', '—', name]); });
      const nWords = el.textContent.trim().split(/\s+/).length;
      const lastLine = lines[lines.length - 1];
      const lastText = lastLine.w.map(x => x.t).join(' ');
      if (nWords >= 3 && lastLine.w.length === 1 && lastText.replace(/[^\wа-яё]/gi, '').length <= 5 && lines.length >= 2) res.push(['одно короткое слово в последней строке', lastText, name]);
      if ((/^(H1|H2|H3)$/.test(el.tagName) || el.classList.contains('card-title')) && nWords >= 3) {
        const widths = lines.map(l => l.w[l.w.length - 1].right - l.w[0].left); const mx = Math.max(...widths), mn = Math.min(...widths);
        if (mn < mx * 0.42) res.push(['лесенка в заголовке', widths.map(Math.round).join('/'), name]);
      }
    }
    return res;
  }, scope);
  let r = await scan('body');
  // экран товара, окно цвета и заявка
  await p.evaluate(() => document.querySelector('[data-open="ribbon"]').click()); await sleep(400); r = r.concat((await scan('#product')).map(x => [...x.slice(0, 2), 'экран товара: ' + x[2]]));
  await p.evaluate(() => document.querySelector('[data-pick="base"]').click()); await sleep(400); r = r.concat((await scan('#picker')).map(x => [...x.slice(0, 2), 'окно цвета: ' + x[2]]));
  r.forEach(x => all.push([w, ...x]));
  await p.close();
 }
 const key = x => x.slice(1).join(' | ');
 const grouped = {}; all.forEach(x => { (grouped[key(x)] = grouped[key(x)] || []).push(x[0]); });
 Object.entries(grouped).forEach(([k, ws]) => console.log(ws.join(',').padEnd(22), k));
 console.log('\nВсего:', Object.keys(grouped).length);
 await b.close(); })();
