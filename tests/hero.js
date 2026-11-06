// Запуск: npm i puppeteer && node tests/hero.js  (сайт: ../index.html или SITE_URL; Chrome: CHROME_PATH, по умолчанию браузер puppeteer)
require('fs').mkdirSync(require('path').join(__dirname, 'shots'), { recursive: true });
const puppeteer = require('puppeteer');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out=[]; const ok=(n,c,i='')=>out.push([c?'OK  ':'FAIL',n,i]);
// Тёмный первый экран: фото без рамки растворяется в фоне, шапка прозрачная над фото, переход к молочному — по ленте
(async()=>{const b=await puppeteer.launch({executablePath: process.env.CHROME_PATH || undefined,headless:'new',args:['--no-sandbox']});
for (const [w,h] of [[360,780],[390,844],[430,932],[768,1024],[1024,768],[1280,800],[1440,900]]) {
  const p=await b.newPage(); await p.setViewport({width:w,height:h,isMobile:w<700,hasTouch:w<700,deviceScaleFactor:1});
  await p.goto((process.env.SITE_URL || 'file://'+require('path').resolve(__dirname,'..','index.html'))); await p.waitForFunction(()=>getComputedStyle(document.querySelector('#catalogGrid')).display==='grid'); await sleep(400);
  const r=await p.evaluate(()=>{
    const img=document.querySelector('img[data-photo="hero"]'), ph=img.parentElement, cs=getComputedStyle(img), pcs=getComputedStyle(ph);
    const hero=document.querySelector('#hero'), ir=img.getBoundingClientRect(), btn=hero.querySelector('.btn-milk').getBoundingClientRect(), t=document.querySelector('#heroTitle').getBoundingClientRect(), copy=hero.querySelector('.hero-copy').getBoundingClientRect();
    const hdr=document.querySelector('#siteHeader'), rbb=getComputedStyle(document.querySelector('.rb'),'::before');
    return {w:Math.round(ir.width),h:Math.round(ir.height),left:Math.round(ir.left),right:Math.round(innerWidth-ir.right),top:Math.round(ir.top),
      radius:cs.borderTopLeftRadius, fit:cs.objectFit, filter:cs.filter, shadow:cs.boxShadow, border:cs.borderTopWidth,
      mask:(cs.maskImage||cs.webkitMaskImage||''), pmask:(pcs.maskImage||pcs.webkitMaskImage||''),
      natural:img.naturalWidth+'x'+img.naturalHeight, heroTop:Math.round(hero.getBoundingClientRect().top), heroBottom:Math.round(hero.getBoundingClientRect().bottom),
      tTop:Math.round(t.top), copyRight:Math.round(copy.right), copyMid:Math.round((copy.top+copy.bottom)/2), btnBottom:Math.round(btn.bottom),
      h1c:getComputedStyle(document.querySelector('#heroTitle')).color, rbBg:rbb.backgroundColor, heroBg:getComputedStyle(hero).backgroundImage,
      hdrCls:hdr.className, hdrBg:getComputedStyle(hdr).backgroundColor, hdrColor:getComputedStyle(hdr).color,
      vh:innerHeight, sw:document.documentElement.scrollWidth, vw:document.documentElement.clientWidth};
  });
  const mobile=w<1024;
  ok(`${w}: фото без рамки: cover, без скругления, теней и фильтров, края растворяются (маска)`, r.fit==='cover' && r.radius==='0px' && r.filter==='none' && r.shadow==='none' && r.border==='0px' && /linear-gradient/.test(r.mask) && (mobile || /linear-gradient/.test(r.pmask)), JSON.stringify({radius:r.radius,mask:!!r.mask,pmask:!!r.pmask,natural:r.natural}));
  ok(`${w}: первый экран под шапкой, начинается с самого верха`, r.heroTop===0, `top ${r.heroTop}`);
  if (mobile) {
    ok(`${w}: фото во всю ширину сверху, заголовок ниже лент`, r.left===0 && r.right===0 && r.top===0 && r.tTop >= r.h*0.75 && r.tTop < r.h+20, `фото ${r.w}×${r.h}, заголовок с ${r.tTop}`);
  } else {
    ok(`${w}: фото справа до края окна, текст слева на растворённой части`, r.right===0 && r.left < r.copyRight && r.left > 0, `фото с ${r.left}, текст до ${r.copyRight}`);
    ok(`${w}: текст по центру первого экрана`, Math.abs(r.copyMid - (r.heroBottom + 61)/2) < 90, `середина текста ${r.copyMid}, экран до ${r.heroBottom}`);
  }
  ok(`${w}: кнопка «Выбрать продукцию» видна на первом экране`, r.btnBottom <= r.vh, `${r.btnBottom} из ${r.vh}`);
  ok(`${w}: светлый заголовок, тёмный фон совпадает с полосой под лентой`, r.h1c==='rgb(247, 242, 234)' && r.rbBg==='rgb(61, 51, 47)' && /rgb\(61, 51, 47\)/.test(r.heroBg), `${r.h1c} / ${r.rbBg}`);
  ok(`${w}: шапка прозрачная над фото, текст светлый`, /on-hero/.test(r.hdrCls) && /at-top/.test(r.hdrCls) && r.hdrBg==='rgba(0, 0, 0, 0)' && r.hdrColor==='rgb(247, 242, 234)', `${r.hdrBg} ${r.hdrColor}`);
  ok(`${w}: нет горизонтальной прокрутки`, r.sw<=r.vw, `${r.sw}/${r.vw}`);
  // прокрутка: внутри первого экрана шапка тёмная, после — молочная
  await p.evaluate(()=>scrollTo(0,120)); await sleep(350);
  const s1=await p.evaluate(()=>{const hd=document.querySelector('#siteHeader');return {cls:hd.className,bg:getComputedStyle(hd).backgroundColor}});
  await p.evaluate(()=>scrollTo(0,document.querySelector('#catalog').offsetTop)); await sleep(350);
  const s2=await p.evaluate(()=>{const hd=document.querySelector('#siteHeader');return {cls:hd.className,bg:getComputedStyle(hd).backgroundColor,theme:document.querySelector('meta[name="theme-color"]').content, top:document.documentElement.classList.contains('hero-top')}});
  ok(`${w}: при прокрутке шапка тёмная над первым экраном, молочная после`, /on-hero/.test(s1.cls) && !/at-top/.test(s1.cls) && /^rgba\(61, 51, 47/.test(s1.bg) && !/on-hero/.test(s2.cls) && (/^rgba\(247, 242, 234/.test(s2.bg) || /^color\(srgb 0\.9686/.test(s2.bg)) && s2.theme==='#F7F2EA' && !s2.top, `${s1.bg} → ${s2.bg}`);
  await p.evaluate(()=>scrollTo(0,0)); await sleep(350);
  await p.screenshot({path: require('path').join(__dirname, 'shots', `hero_${w}.png`), clip:{x:0,y:0,width:w,height:Math.min(r.heroBottom+150, 1400)}});
  await p.close();
}
await b.close(); out.forEach(r=>console.log(r[0],r[1],r[2]?'— '+r[2]:'')); console.log('\nИтого:',out.filter(r=>r[0].trim()==='OK').length,'из',out.length);
})();
