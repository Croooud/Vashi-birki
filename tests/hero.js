// Запуск: npm i puppeteer && node tests/hero.js  (сайт: ../index.html или SITE_URL; Chrome: CHROME_PATH, по умолчанию браузер puppeteer)
require('fs').mkdirSync(require('path').join(__dirname, 'shots'), { recursive: true });
const puppeteer = require('puppeteer');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out=[]; const ok=(n,c,i='')=>out.push([c?'OK  ':'FAIL',n,i]);
(async()=>{const b=await puppeteer.launch({executablePath: process.env.CHROME_PATH || undefined, headless:'new',args:['--no-sandbox']});
for (const [w,h] of [[360,780],[390,844],[430,932],[768,1024],[1024,768],[1280,800],[1440,900]]) {
  const p=await b.newPage(); await p.setViewport({width:w,height:h,isMobile:w<700,hasTouch:w<700,deviceScaleFactor:1});
  await p.goto((process.env.SITE_URL || 'file://'+require('path').resolve(__dirname,'..','index.html'))); await p.waitForFunction(()=>getComputedStyle(document.querySelector('#catalogGrid')).display==='grid'); await sleep(300);
  const r=await p.evaluate(()=>{
    const img=document.querySelector('img[data-photo="hero"]'), fig=img.parentElement, cs=getComputedStyle(img);
    const ir=img.getBoundingClientRect(), btn=document.querySelector('a.btn-wine').getBoundingClientRect(), txt=document.querySelector('#heroTitle').parentElement.getBoundingClientRect();
    return {w:Math.round(ir.width),h:Math.round(ir.height),ratio:+(ir.width/ir.height).toFixed(3),left:Math.round(ir.left),right:Math.round(innerWidth-ir.right),top:Math.round(ir.top),bottom:Math.round(ir.bottom),
      radius:cs.borderTopLeftRadius, fit:cs.objectFit, pos:cs.objectPosition, filter:cs.filter, shadow:cs.boxShadow, border:cs.borderTopWidth, minH:cs.minHeight,
      natural:img.naturalWidth+'x'+img.naturalHeight, btnBottom:Math.round(btn.bottom), btnLeft:Math.round(btn.left), txtTop:Math.round(txt.top), txtH:Math.round(txt.height), txtRight:Math.round(txt.right), vh:innerHeight, sw:document.documentElement.scrollWidth, vw:document.documentElement.clientWidth};
  });
  const mobile=w<1024;
  ok(`${w}: кадр ${w>=1280?'3:2':w>=1024?'5:4':'16:9'}, cover, без фильтров, теней и рамок`, Math.abs(r.ratio-(w>=1280?1.5:w>=1024?1.25:1.778))<0.01 && r.fit==='cover' && r.filter==='none' && r.shadow==='none' && r.border==='0px' && r.minH!=='' , JSON.stringify({ratio:r.ratio,fit:r.fit,pos:r.pos,natural:r.natural}));
  if (mobile) {
    ok(`${w}: фото после кнопки, поля ${r.left}/${r.right} px, скругление ${r.radius}`, r.top>r.btnBottom && (w>=640 || (r.left>=20 && r.left<=24 && r.right>=20 && r.right<=24)) && /1[2-6]px/.test(r.radius), `фото ${r.w}×${r.h}, сверху ${r.top}, кнопка до ${r.btnBottom}`);
    ok(`${w}: фото не занимает отдельный экран (≤ 45% высоты окна)`, r.h <= r.vh*0.45, `${r.h} из ${r.vh}`);
  } else {
    ok(`${w}: фото справа от текста, высота согласована с текстом`, r.left>r.txtRight && Math.abs(r.h-r.txtH) <= r.txtH*0.3, `фото ${r.w}×${r.h}, текст ${r.txtH} px`);
  }
  ok(`${w}: нет горизонтальной прокрутки`, r.sw<=r.vw, `${r.sw}/${r.vw}`);
  await p.screenshot({path: require('path').join(__dirname, 'shots', `hero_${w}.png`), clip:{x:0,y:0,width:w,height:Math.min(mobile? r.bottom+24 : r.bottom+40, 1400)}});
  await p.close();
}
await b.close(); out.forEach(r=>console.log(r[0],r[1],r[2]?'— '+r[2]:'')); console.log('\nИтого:',out.filter(r=>r[0].trim()==='OK').length,'из',out.length);
})();
