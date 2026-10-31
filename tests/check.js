// Проверка сайта в headless Chrome: npm i puppeteer && node tests/check.js
const puppeteer = require('puppeteer');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const ok = (name, cond, info = '') => results.push([cond ? 'OK  ' : 'FAIL', name, info]);
const clean = s => (s || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();

async function newPage(browser, width, height = 800) {
  const p = await browser.newPage();
  await p.setViewport({ width, height, isMobile: width < 700, hasTouch: width < 700 });
  p._errors = [];
  p.on('pageerror', e => p._errors.push(e.message));
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction(() => getComputedStyle(document.querySelector('#catalogGrid')).display === 'grid', { timeout: 15000 });
  await sleep(300);
  return p;
}
const hOverflow = p => p.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const clipped = el => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (/(hidden|auto|scroll|clip)/.test(getComputedStyle(a).overflowX)) return true; return false; };
  const bad = [];
  document.querySelectorAll('body *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && (r.right > vw + .5 || r.left < -.5) && !clipped(el) && !el.closest('[hidden]') && !el.closest('dialog:not([open])')) bad.push(el.tagName + '#' + el.id + ' ' + Math.round(r.right)); });
  return { sw: document.documentElement.scrollWidth, vw, bad: bad.slice(0, 5) };
});
const dlgInfo = p => p.evaluate(() => {
  const d = document.querySelector('#product .sheet-panel'), b = document.querySelector('#pBody'), f = d.querySelector('.dlg-foot');
  const dr = d.getBoundingClientRect(), br = b.getBoundingClientRect(), fr = f.getBoundingClientRect();
  return { open: !document.querySelector('#product').hidden, locked: document.body.style.position === 'fixed', w: dr.width, h: dr.height, top: dr.top, bodyBottom: br.bottom, footTop: fr.top, footBottom: fr.bottom, ih: innerHeight, iw: innerWidth,
    bodyOverflowX: b.scrollWidth - b.clientWidth, dlgOverflowX: d.scrollWidth - d.clientWidth, focus: document.activeElement && document.activeElement.id,
    scrollAreas: [...d.querySelectorAll('*')].filter(el => { const s = getComputedStyle(el); return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1; }).map(el => el.id || el.className.slice(0, 20)) };
});
const total = async p => { await sleep(450); return clean(await p.$eval('#sumTotal', el => el.textContent)).replace(/\s/g, ''); };
async function open(p, id) { await p.evaluate(i => document.querySelector(`[data-open="${i}"]`).scrollIntoView({ block: 'center' }), id); await sleep(80); await p.click(`[data-open="${id}"]`); await sleep(450); }
async function close(p) { await p.click('#pClose'); await sleep(350); }
async function chip(p, dim, v) { await p.click(`[data-dim="${dim}"][data-v="${v}"]`); await sleep(60); }
async function run(p, v) { await p.select('#runSelect', v); await sleep(60); }

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });

  for (const w of [360, 390, 430, 1280]) {
    const p = await newPage(browser, w, w < 700 ? 800 : 900);
    const o = await hOverflow(p);
    ok(`${w}: главная без горизонтальной прокрутки`, o.sw <= o.vw, `${o.sw}/${o.vw} ${o.bad.join(', ')}`);
    const cat = await p.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-open]')];
      return { n: cards.length, cols: new Set(cards.map(c => Math.round(c.getBoundingClientRect().left))).size,
        parts: cards.map(c => c.children.length), heights: new Set(cards.map(c => Math.round(c.querySelector('.card-img').getBoundingClientRect().height))).size,
        clipped: cards.filter(c => [...c.children].some(s => s.scrollWidth > s.clientWidth + 1)).length };
    });
    ok(`${w}: каталог — 8 карточек, ${w < 1024 ? 2 : 4} колонки, одинаковый масштаб изображений, только фото + название + цена`, cat.n === 8 && cat.cols === (w < 1024 ? 2 : 4) && cat.heights === 1 && cat.parts.every(n => n === 3) && cat.clipped === 0, JSON.stringify(cat));
    const home = await p.evaluate(() => document.body.innerText);
    ok(`${w}: на главной нет калькулятора, галереи и мини-характеристик`, !/Соберите заказ|Готовая продукция|84 × 50|15–25 мм/.test(home.replace(/ /g, ' ')) && !(await p.evaluate(() => !!document.querySelector('#calc, #works'))));
    await p.screenshot({ path: path.join(__dirname, `v3_home_${w}.png`), fullPage: true });

    // каждый товар: открыть, проверить, закрыть
    const ids = await p.evaluate(() => [...document.querySelectorAll('[data-open]')].map(b => b.dataset.open));
    const issues = [];
    for (const id of ids) {
      await open(p, id);
      const before = await p.evaluate(() => -parseInt(document.body.style.top || '0'));
      let d = await dlgInfo(p);
      if (!d.open || !d.locked) issues.push(id + ': не открылся или страница не заблокирована');
      if (w < 768 && (Math.abs(d.w - d.iw) > 1 || Math.abs(d.h - d.ih) > 1)) issues.push(`${id}: не на весь экран ${d.w}x${d.h}`);
      if (w >= 768 && d.w > 620) issues.push(`${id}: ширина диалога ${d.w}`);
      if (d.bodyOverflowX > 0 || d.dlgOverflowX > 0) issues.push(id + ': горизонтальное переполнение в товаре');
      if (d.footBottom > d.ih + 1 || d.bodyBottom > d.footTop + 1) issues.push(id + ': итог перекрывает содержимое');
      if (d.focus !== 'pTitle') issues.push(id + ': фокус не на заголовке');
      const hid = await p.evaluate(() => ['#metersBox', '#copyFallback', '#designsBox', '#priceList'].filter(s => { const el = document.querySelector(s); return el.hidden && getComputedStyle(el).display !== 'none'; }));
      if (hid.length) issues.push(id + ': видны скрытые блоки ' + hid.join(','));
      // все поля «Оформление» и прайс
      await p.click('#pMore summary'); await sleep(80);
      await p.click('#priceToggle'); await sleep(80);
      d = await dlgInfo(p);
      if (d.bodyOverflowX > 0) issues.push(id + ': переполнение при раскрытии');
      if (d.scrollAreas.filter(x => x !== 'pBody').length) issues.push(id + ': вложенная прокрутка ' + d.scrollAreas.join(','));
      const optOk = await p.evaluate(() => [...document.querySelectorAll('#runSelect option')].every(o => o.textContent.includes('—')));
      if (!optOk) issues.push(id + ': список тиража без цен');
      if (w < 768) await p.screenshot({ path: path.join(__dirname, `v3_dlg_${id}_${w}.png`) });
      await close(p);
      const after = await p.evaluate(() => ({ y: window.scrollY, open: !document.querySelector('#product').hidden, locked: document.body.style.position === 'fixed', focus: document.activeElement && document.activeElement.dataset.open }));
      if (after.open || after.locked || after.y !== before || after.focus !== id) issues.push(`${id}: закрытие ${JSON.stringify(after)} было ${before}`);
    }
    ok(`${w}: все 8 товаров открываются ${w < 768 ? 'на весь экран' : 'в диалоге'}, итог не перекрывает поля, закрытие возвращает на место и фокус на карточку`, issues.length === 0, issues.slice(0, 5).join(' | '));
    const o2 = await hOverflow(p);
    ok(`${w}: после открытий нет горизонтальной прокрутки`, o2.sw <= o2.vw);

    // экранная клавиатура: видимая область уменьшается до ~45% высоты
    if (w < 768) {
      await open(p, 'ribbon');
      await p.click('#pMore summary'); await sleep(80);
      await p.focus('#comment');
      await p.setViewport({ width: w, height: 380, isMobile: true, hasTouch: true }); await sleep(450);
      const k = await p.evaluate(() => {
        const d = document.querySelector('#product .sheet-panel').getBoundingClientRect(), c = document.querySelector('#comment').getBoundingClientRect(),
          b = document.querySelector('#pBody').getBoundingClientRect(), f = document.querySelector('.dlg-foot').getBoundingClientRect();
        return { dh: Math.round(d.height), ih: innerHeight, cTop: Math.round(c.top), cBottom: Math.round(c.bottom), bTop: Math.round(b.top), bBottom: Math.round(b.bottom), fTop: Math.round(f.top), fBottom: Math.round(f.bottom), focus: document.activeElement.id };
      });
      await p.keyboard.type('Логотип в два цвета'); await sleep(60);
      const typed = await p.$eval('#comment', el => el.value);
      ok(`${w}: при открытой клавиатуре поле комментария видно, итог над клавиатурой и не закрывает поле`, k.dh <= k.ih && k.fBottom <= k.ih && k.cTop >= k.bTop && k.cBottom <= k.fTop && k.focus === 'comment' && typed === 'Логотип в два цвета', JSON.stringify(k));
      await p.screenshot({ path: path.join(__dirname, `v3_keyboard_${w}.png`) });
      await p.setViewport({ width: w, height: 800, isMobile: true, hasTouch: true }); await sleep(200);
      await p.keyboard.press('Escape'); await sleep(350);
      ok(`${w}: Escape закрывает экран товара`, !(await p.$eval('#product', d => !d.hidden)));
    }
    ok(`${w}: нет ошибок JS`, p._errors.length === 0, p._errors.join(' | '));
    await p.close();
  }

  // ---------- расчёты и согласованность (390) ----------
  const p = await newPage(browser, 390, 800);
  const cases = [
    ['ribbon', async () => { await chip(p, 'width', '20'); await run(p, '100'); }, '2500₽', 'лента 20 мм × 100 м'],
    ['silicone', async () => { await chip(p, 'width', '25'); await run(p, '50'); }, '2750₽', 'силикон 25 мм × 50 м'],
    ['tape', async () => { await chip(p, 'width', '40'); await run(p, '200'); }, '6400₽', 'скотч 40 мм × 200 м'],
    ['phone', async () => { await run(p, '100'); }, '3700₽', 'стикеры 100 шт.'],
    ['choco', async () => { await run(p, '300'); }, '6600₽', 'шоколад 300 шт.'],
    ['tissue', async () => { await run(p, '50'); }, '4500₽', 'тишью 50 листов']
  ];
  for (const [id, act, exp, name] of cases) {
    await open(p, id); await act();
    const t = await total(p);
    const opt = clean(await p.$eval('#runSelect', s => s.options[s.selectedIndex].textContent));
    ok(`Расчёт: ${name} = ${exp}`, t === exp && opt.replace(/\s/g, '').includes(exp), `итог ${t}; в списке «${opt}»`);
    await close(p);
  }
  // выбор сохраняется для товара
  await open(p, 'ribbon');
  ok('Повторное открытие ленты сохраняет выбор 20 мм × 100 м', (await total(p)) === '2500₽' && await p.$eval('[data-dim="width"][aria-pressed="true"]', b => b.dataset.v) === '20');
  // макет отдельной строкой, сумма не меняется
  await p.click('#pMore summary'); await sleep(60);
  await p.click('[data-layout="need"]'); await sleep(60);
  const ex1 = clean(await p.$eval('#sumExtra', el => el.textContent));
  ok('«Нужна разработка»: макет 400 ₽ показан отдельно, сумма продукции не меняется', (await total(p)) === '2500₽' && /\+ макет 400 ₽/.test(ex1) && /предварительно/i.test(ex1), ex1);
  await p.click('#x-matte'); await sleep(60);
  const ex2 = clean(await p.$eval('#sumExtra', el => el.textContent));
  ok('Сатин +10% не прибавлен, показан как «уточним»', (await total(p)) === '2500₽' && /сатин \+10%, сумму уточним/.test(ex2), ex2);
  // текст заявки — по нажатию, совпадает с выбором
  await p.type('#color', 'золото');
  await p.evaluate(() => { window.__c = null; navigator.clipboard.writeText = t => { window.__c = t; return Promise.resolve(); }; });
  await p.click('#copyBtn'); await sleep(120);
  const txt = await p.evaluate(() => window.__c); const t1 = clean(await p.$eval('#toast', el => el.textContent));
  const need = ['Продукция: Брендированные ленты', 'Ширина: 20 мм', 'Тираж: 100 м', 'Цвет печати: золото', 'Матовый шёлк-сатин: да', 'Разработка макета: нужна', 'Стоимость продукции по прайсу: 2 500 ₽', 'Разработка макета: 400 ₽'];
  ok('Копирование: текст заявки совпадает с выбранными параметрами', t1 === 'Текст заявки скопирован' && txt && need.every(s => txt.includes(s)), (txt || '').split('\n').join(' / '));
  ok('Длинного текста заявки на экране нет до нажатия', await p.$eval('#copyFallback', el => el.hidden));
  await p.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('x')); document.execCommand = () => false; });
  await p.click('#copyBtn'); await sleep(150);
  const fb = await p.evaluate(() => { const t = document.querySelector('#fallbackText'); return { shown: !document.querySelector('#copyFallback').hidden, sel: t.selectionEnd - t.selectionStart === t.value.length && t.value.length > 50, toast: document.querySelector('#toast').textContent }; });
  ok('Ошибка копирования: честное сообщение и выделенный текст для ручного копирования', fb.shown && fb.sel && /Не удалось скопировать/.test(fb.toast), JSON.stringify(fb));
  // пожелания сохраняются при сворачивании
  await p.click('#pMore summary'); await sleep(60); await p.click('#pMore summary'); await sleep(60);
  ok('Сворачивание «Оформление и пожелания» сохраняет значения', (await p.$eval('#color', el => el.value)) === 'золото' && (await p.$eval('#x-matte', el => el.checked)));
  const hint = clean(await p.$eval('#pMoreHint', el => el.textContent));
  ok('Свёрнутый раздел показывает выбранное', /золото/.test(hint) && /нужна/.test(hint), hint);
  await close(p);
  // запрет цвета у бумаги и поля по товару
  await open(p, 'tissue');
  const fields = await p.evaluate(() => ({ dims: document.querySelectorAll('[data-dim]').length, extras: document.querySelectorAll('[data-x]').length, designs: !document.querySelector('#designsBox').hidden, color: !!document.querySelector('#color') }));
  ok('Тишью: только относящиеся поля (без ширины, опций, дизайнов)', fields.dims === 0 && fields.extras === 0 && !fields.designs && fields.color, JSON.stringify(fields));
  ok('Тишью: цвет из ленты не перенесён', (await p.$eval('#color', el => el.value)) === '');
  await close(p);
  await open(p, 'vinyl'); await chip(p, 'format', 'big');
  ok('Наклейки 75 × 120 мм: «По запросу», цена не выдумана', clean(await p.$eval('#sumTotal', el => el.textContent)) === 'По запросу' && /30 ₽ за штуку/.test(clean(await p.$eval('#sumExtra', el => el.textContent))));
  await close(p);
  await open(p, 'silicone'); await chip(p, 'width', '15'); await run(p, 'r'); await p.$eval('#meters', el => { el.value = '300'; el.dispatchEvent(new Event('input')); });
  ok('Силикон 15 мм × 300 м по тарифу 100–500 м = 12 000 ₽', (await total(p)) === '12000₽');
  await run(p, 'mid');
  ok('Силикон 501–999 м: «По запросу»', clean(await p.$eval('#sumTotal', el => el.textContent)) === 'По запросу');
  await close(p);
  await open(p, 'phone'); await run(p, '200'); await p.click('#pMore summary'); await p.click('[data-layout="need"]');
  await p.$eval('#designs', el => { el.value = '3'; el.dispatchEvent(new Event('input')); });
  ok('Стикеры: макет 150 ₽ × 3 = 450 ₽ отдельно, подложка не начислена', (await total(p)) === '6800₽' && /\+ макет 450 ₽/.test(clean(await p.$eval('#sumExtra', el => el.textContent))));
  await close(p);
  const body = await p.evaluate(() => document.body.innerText);
  ok('Нет ложных уведомлений об отправке и заметок разработчика', !/отправлен|оформлен[ао]|Контакты добавим|В прайсе не указан|Фото готовится|Обсудить заказ/i.test(body));
  ok('Раздел «Контакты» скрыт, пока нет контактов', await p.$eval('#contacts', el => el.hidden));
  ok('390: нет ошибок JS', p._errors.length === 0, p._errors.join(' | '));
  await p.close();

  // ---------- десктоп: клавиатура ----------
  const d = await newPage(browser, 1280, 900);
  await d.focus('[data-open="tape"]'); await d.keyboard.press('Enter'); await sleep(450);
  const dd = await dlgInfo(d);
  await d.keyboard.press('Tab'); const f1 = await d.evaluate(() => document.activeElement.id || document.activeElement.dataset.v || document.activeElement.tagName);
  await d.screenshot({ path: path.join(__dirname, 'v3_dialog_1280.png') });
  await d.keyboard.press('Escape'); await sleep(350);
  const back = await d.evaluate(() => document.activeElement.dataset.open);
  ok('1280: Enter на карточке открывает диалог, Tab остаётся внутри, Escape возвращает фокус на карточку', dd.open && dd.w <= 620 && f1 !== 'BODY' && back === 'tape', `ширина ${dd.w}, фокус после Tab: ${f1}`);
  await d.close();

  await browser.close();
  results.forEach(r => console.log(r[0], r[1], r[2] ? '— ' + r[2] : ''));
  console.log('\nИтого:', results.filter(r => r[0].trim() === 'OK').length, 'из', results.length);
})().catch(e => { results.forEach(r => console.log(r[0], r[1], r[2] ? '— ' + r[2] : '')); console.error(e); process.exit(1); });
