// Запуск: npm i puppeteer && node tests/features.js  (сайт: ../index.html или SITE_URL; Chrome: CHROME_PATH, по умолчанию браузер puppeteer)
require('fs').mkdirSync(require('path').join(__dirname, 'shots'), { recursive: true });
const puppeteer = require('puppeteer'); const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = []; const ok = (n, c, i = '') => out.push([c ? 'OK  ' : 'FAIL', n, i]);
const URL = (process.env.SITE_URL || 'file://' + path.resolve(__dirname, '..', 'index.html'));
(async () => { const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  for (const [w, h] of [[360, 780], [390, 844], [430, 932], [768, 1024], [1280, 860]]) {
    const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.setViewport({ width: w, height: h, isMobile: w < 700, hasTouch: w < 700 });
    await p.goto(URL); await sleep(700); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    const g = await p.evaluate(() => {
      const order = ['catalog', 'works', 'how', 'faq', 'contacts'].map(id => document.getElementById(id));
      const seq = order.every((el, i) => i === 0 || (order[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
      const rb = document.querySelector('.rb'), hp = document.querySelector('.how-panel');
      return { seq, sw: document.documentElement.scrollWidth, rbH: rb.getBoundingClientRect().height, rbAria: rb.getAttribute('aria-hidden'), anim: getComputedStyle(document.querySelector('.rb-track')).animationName,
        howBg: getComputedStyle(hp).backgroundImage.slice(0, 15), howColor: getComputedStyle(document.querySelector('#howTitle')).color, cta: document.querySelectorAll('#catalogGrid .card-cta').length,
        faq: document.querySelectorAll('#faqList details.faq').length, foot: [...document.querySelectorAll('#footLinks a')].map(a => a.getAttribute('href')),
        og: !!document.querySelector('meta[property="og:image"]'), icon: !!document.querySelector('link[rel="icon"]') }; });
    ok(`${w}: «Наши работы» сразу после каталога, затем «Как заказать», вопросы, контакты`, g.seq, JSON.stringify(g.seq));
    ok(`${w}: бегущие ленты под первым экраном, декоративные (aria-hidden), без горизонтального скролла`, g.rbH > 100 && g.rbAria === 'true' && g.anim === 'rbMove' && g.sw <= w, `h ${g.rbH}, sw ${g.sw}, ${g.anim}`);
    ok(`${w}: «Как заказать» — бордовая панель со светлым текстом`, g.howBg.startsWith('radial-gradient') && g.howColor === 'rgb(255, 252, 247)', g.howBg + ' ' + g.howColor);
    ok(`${w}: на карточках «Рассчитать», 6 частых вопросов, ссылки в подвале, превью ссылки и иконка`, g.cta === 8 && g.faq === 6 && g.foot.includes('https://wa.me/79180536881') && g.foot.includes('#top') && g.og && g.icon, JSON.stringify({ cta: g.cta, faq: g.faq, foot: g.foot }));
    // FAQ: ответы из прайса
    await p.evaluate(() => document.querySelector('#faq').scrollIntoView()); await sleep(200);
    await p.click('#faqList details.faq summary'); await sleep(150);
    const fq = await p.evaluate(() => { const d = document.querySelector('#faqList details.faq'); return { open: d.open, txt: d.textContent.replace(/[ \s]+/g, ' ') }; });
    ok(`${w}: вопрос раскрывается, минимальные тиражи взяты из прайса`, fq.open && /Брендированные ленты — от 50 м \(1 250 ₽\)/.test(fq.txt) && /Виниловые наклейки — от 100 шт\./.test(fq.txt), fq.txt.slice(0, 140));
    // нижняя панель (телефон) / кнопка заявки (компьютер)
    await p.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
    const bar0 = await p.evaluate(() => { const m = document.querySelector('#mbar'); return { shown: m.classList.contains('is-shown'), disp: getComputedStyle(m).display, pill: getComputedStyle(document.querySelector('#cartPill')).display }; });
    await p.evaluate(() => document.querySelector('#catalog').scrollIntoView()); await sleep(600);
    const bar1 = await p.evaluate(() => { const m = document.querySelector('#mbar'), r = m.getBoundingClientRect(); return { shown: m.classList.contains('is-shown'), inView: r.bottom <= innerHeight + 1 && r.top < innerHeight, main: document.querySelector('#mbarMain').textContent.trim() }; });
    if (w < 768) ok(`${w}: нижняя панель скрыта на первом экране и появляется после него («Рассчитать заказ» + WhatsApp)`, !bar0.shown && bar1.shown && bar1.inView && bar1.main === 'Рассчитать заказ', JSON.stringify({ bar0, bar1 }));
    else ok(`${w}: на компьютере нижней панели нет, кнопка заявки скрыта, пока заявка пустая`, bar0.disp === 'none' && bar0.pill === 'none', JSON.stringify(bar0));
    // карточка ленты: метка «по умолчанию», примерка
    await p.evaluate(() => document.querySelector('[data-open="ribbon"]').click()); await sleep(500);
    const lockedBar = await p.evaluate(() => getComputedStyle(document.querySelector('#mbar')).visibility);
    const d0 = await p.evaluate(() => ({ badges: document.querySelectorAll('#pColors .cf-badge').length, tryon: !document.querySelector('#tryon').hidden, strip: getComputedStyle(document.querySelector('#tryStrip')).backgroundColor, metal: document.querySelector('#tryText2').classList.contains('is-metal'), txt: document.querySelector('#tryText2').textContent }));
    ok(`${w}: в экране товара панель скрыта; метки «по умолчанию» у двух цветов; примерка видна (белая лента, золото)`, (w >= 768 || lockedBar === 'hidden') && d0.badges === 2 && d0.tryon && d0.strip === 'rgb(246, 244, 238)' && d0.metal && /Ваш логотип/.test(d0.txt), JSON.stringify({ lockedBar, ...d0 }));
    await p.type('#tryText', 'KOSHEK'); await sleep(120);
    await p.evaluate(() => document.querySelector('[data-pick="base"]').click()); await sleep(300);
    await p.evaluate(() => document.querySelector('.pk-tile[data-id="sc-korolevskij-sinij"]').click()); await p.evaluate(() => document.querySelector('#pkOk').click()); await sleep(250);
    await p.evaluate(() => document.querySelector('[data-pick="print"]').click()); await sleep(300);
    await p.evaluate(() => document.querySelector('.pk-tile[data-id="rp-02"]').click()); await p.evaluate(() => document.querySelector('#pkOk').click()); await sleep(250);
    const d1 = await p.evaluate(() => ({ badges: document.querySelectorAll('#pColors .cf-badge').length, strip: getComputedStyle(document.querySelector('#tryStrip')).backgroundColor, color: getComputedStyle(document.querySelector('#tryText2')).color, metal: document.querySelector('#tryText2').classList.contains('is-metal'), txt: document.querySelector('#tryText2').textContent, note: document.querySelector('#tryNote').textContent, hex: window.SHADE_HEX['sc-korolevskij-sinij'] }));
    const hexRgb = h => 'rgb(' + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')';
    ok(`${w}: примерка: текст, «Королевский Синий» и жёлтая печать; метки «по умолчанию» сняты`, d1.badges === 0 && d1.strip === hexRgb(d1.hex) && !d1.metal && /KOSHEK/.test(d1.txt) && /королевский синий, печать — жёлтый/.test(d1.note), JSON.stringify(d1));
    // заявка: строка про логотип и текст примерки
    const sum = await p.evaluate(() => buildSummary());
    ok(`${w}: в заявке — точные цвета без пометки, текст примерки и строка про логотип`, sum.includes('Цвет ленты: Королевский Синий') && !sum.includes('Королевский Синий (по умолчанию)') && sum.includes('Текст на ленте (примерка): KOSHEK') && /Логотип пришлю в этом чате\.$/.test(sum), sum.split('\n').slice(-4).join(' / '));
    // общая заявка
    await p.evaluate(() => document.querySelector('#addToCart').click()); await sleep(500);
    const c1 = await p.evaluate(() => ({ sheet: document.querySelector('#product').hidden, n: document.querySelector('#cartCount').textContent, toast: document.querySelector('#ptoast').textContent, mbarCart: !document.querySelector('#mbarCart').hidden, pill: getComputedStyle(document.querySelector('#cartPill')).display }));
    ok(`${w}: «Добавить в заявку» закрывает экран товара, счётчик 1, уведомление`, c1.sheet && c1.n === '1' && /Добавлено в заявку · 1 товар/.test(c1.toast) && (w < 768 ? c1.mbarCart : c1.pill !== 'none'), JSON.stringify(c1));
    await p.evaluate(() => document.querySelector('[data-open="vinyl"]').click()); await sleep(500);
    const box = await p.evaluate(() => ({ t: document.querySelector('#cartBoxText').textContent, open: !document.querySelector('#openCartFromSheet').hidden, tryon: document.querySelector('#tryon').hidden }));
    ok(`${w}: во втором товаре видно, что в заявке уже 1 товар; у наклеек нет примерки`, /уже 1 товар/.test(box.t) && box.open && box.tryon, JSON.stringify(box));
    await p.evaluate(() => document.querySelector('#addToCart').click()); await sleep(500);
    await p.reload(); await sleep(700);
    const persisted = await p.evaluate(() => document.querySelector('#cartCount').textContent);
    ok(`${w}: заявка сохраняется после перезагрузки страницы`, persisted === '2', persisted);
    await p.evaluate(() => document.querySelector('#catalog').scrollIntoView()); await sleep(500);
    await p.evaluate(() => (getComputedStyle(document.querySelector('#cartPill')).display !== 'none' ? document.querySelector('#cartPill') : document.querySelector('#mbarCart')).click()); await sleep(400);
    const cv = await p.evaluate(() => ({ open: !document.querySelector('#cart').hidden, items: document.querySelectorAll('#cartList .cart-item').length, total: document.querySelector('#cartTotal').textContent.replace(/\s/g, ' '), focus: document.activeElement.id, sw: document.documentElement.scrollWidth, sum: cartSummary() }));
    ok(`${w}: окно заявки: 2 позиции, итог 4 900 ₽, фокус на закрытии`, cv.open && cv.items === 2 && cv.total === '4 900 ₽' && cv.focus === 'cartClose', JSON.stringify({ ...cv, sum: undefined }));
    ok(`${w}: текст общей заявки: обе позиции с ценами, итог и строка про логотип`, /\(2 позиции\)/.test(cv.sum) && /1\. Брендированные ленты/.test(cv.sum) && /2\. Виниловые наклейки/.test(cv.sum) && /Итого по прайсу: 4 900 ₽/.test(cv.sum) && /Логотип пришлю в этом чате\./.test(cv.sum), cv.sum.split('\n').join(' / ').slice(0, 300));
    const wa = await p.evaluate(() => { const a = document.querySelector('#cartWa'); document.addEventListener('click', e => e.preventDefault(), { once: true }); a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return decodeURIComponent(a.href); });
    ok(`${w}: «Отправить в WhatsApp» из заявки — чат клиентки с полным текстом`, wa.startsWith('https://wa.me/79180536881?text=') && /2\. Виниловые наклейки/.test(wa), wa.slice(0, 90));
    await p.evaluate(() => document.querySelector('#cartList [data-rm]').click()); await sleep(200);
    const c2 = await p.evaluate(() => ({ items: document.querySelectorAll('#cartList .cart-item').length, n: document.querySelector('#cartCount').textContent }));
    ok(`${w}: «Убрать» удаляет позицию`, c2.items === 1 && c2.n === '1', JSON.stringify(c2));
    await p.keyboard.press('Escape'); await sleep(200);
    ok(`${w}: Escape закрывает заявку`, await p.$eval('#cart', e => e.hidden));
    await p.evaluate(() => (getComputedStyle(document.querySelector('#cartPill')).display !== 'none' ? document.querySelector('#cartPill') : document.querySelector('#mbarCart')).click()); await sleep(300);
    await p.evaluate(() => document.querySelector('#cartClear').click()); await sleep(200);
    const c3 = await p.evaluate(() => ({ empty: /Заявка пуста/.test(document.querySelector('#cartList').textContent), actions: document.querySelector('#cartActions').hidden, n: document.querySelector('#cartCount').textContent }));
    ok(`${w}: «Очистить» — заявка пуста, кнопки отправки скрыты`, c3.empty && c3.actions && c3.n === '0', JSON.stringify(c3));
    await p.keyboard.press('Escape'); await sleep(200);
    ok(`${w}: нет горизонтального скролла и ошибок JS`, (await p.evaluate(() => document.documentElement.scrollWidth)) <= w && errs.length === 0, errs.join(' | '));
    if (w === 390) { await p.evaluate(() => document.querySelector('#how').scrollIntoView()); await sleep(900); await p.screenshot({ path: require('path').join(__dirname, 'shots', 'v15_how_390.png') }); }
    await p.close();
  }
  // уменьшение движения: ленты стоят, блоки видны сразу
  const p = await b.newPage(); await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await p.setViewport({ width: 390, height: 844 });
  await p.goto(URL); await sleep(500);
  const rm = await p.evaluate(() => ({ anim: getComputedStyle(document.querySelector('.rb-track')).animationName, rv: document.documentElement.classList.contains('js-rv'), op: getComputedStyle(document.querySelector('#faqList')).opacity }));
  ok('Уменьшение движения: ленты не бегут, блоки видны без анимации', rm.anim === 'none' && !rm.rv && rm.op === '1', JSON.stringify(rm));
  await b.close();
  out.forEach(r => console.log(r[0], r[1], r[2] ? '— ' + r[2] : '')); console.log(`\nИтого: ${out.filter(r => r[0] === 'OK  ').length} из ${out.length}`);
})();
