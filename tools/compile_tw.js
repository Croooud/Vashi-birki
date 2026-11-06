// Собирает статический CSS Tailwind 3.4.17 для страницы: все классы из исходника → Play-скрипт в headless Chrome → готовые стили.
const puppeteer = require('/opt/npm-tools/node_modules/puppeteer'); const fs = require('fs'); const path = require('path');
const src = fs.readFileSync(process.argv[2], 'utf8'), out = process.argv[3];
const cfg = src.match(/<script>\s*(tailwind\.config\s*=[\s\S]*?)<\/script>/)[1];
const tokens = [...new Set(src.split(/[\s"'`<>{}=,;()]+/).filter(t => /^[!a-z0-9:_\-\[\]\/.%#&]+$/i.test(t) && t.length < 60 && /[a-z]/.test(t)))];
const html = `<!doctype html><html><head><script src="file:///opt/npm-tools/node_modules/@zenuml/core/dist/vendor/tailwindcss/tailwindcss.js"></script><script>${cfg}</script></head><body><div class="${tokens.join(' ').replace(/"/g, '')}"></div></body></html>`;
const tmp = path.resolve(path.dirname(path.resolve(out)), '_tw_tmp.html'); fs.writeFileSync(tmp, html);
(async () => { const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const p = await b.newPage(); await p.goto('file://' + tmp); await new Promise(r => setTimeout(r, 1500));
  const css = await p.evaluate(() => [...document.querySelectorAll('style')].map(s => s.textContent).join('\n'));
  fs.writeFileSync(out, css); console.log('tokens', tokens.length, 'css', css.length);
  await b.close(); fs.unlinkSync(tmp); })();
