// Проверка палитры и типографики: npm i puppeteer && node tests/style.js
const puppeteer = require('puppeteer');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out=[]; const ok=(n,c,i='')=>out.push([c?'OK  ':'FAIL',n,i]);
(async()=>{const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
for (const w of [360,390,430,1280]) {
  const p=await b.newPage(); await p.setViewport({width:w,height:820,isMobile:w<700,hasTouch:w<700});
  await p.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await p.waitForFunction(()=>getComputedStyle(document.querySelector('#catalogGrid')).display==='grid'); await sleep(300);
  const scan = (root='body') => p.evaluate((root)=>{
    const small=[], synth=[], display=new Set(), body=new Set(), oldColors=[];
    const old=['rgb(44, 42, 41)','rgb(201, 122, 126)','rgb(154, 83, 87)','rgb(86, 101, 79)','rgb(103, 97, 94)','rgb(249, 248, 246)'];
    const vis = el => { const r=el.getBoundingClientRect(); return r.width>0 && r.height>0 && getComputedStyle(el).visibility!=='hidden' && !el.closest('[hidden]'); };
    document.querySelectorAll(root+' *').forEach(el=>{
      if(!vis(el) || el.closest('svg')) return;
      const cs=getComputedStyle(el);
      const own=[...el.childNodes].some(n=>n.nodeType===3 && n.textContent.trim());
      if(own){
        const fs=parseFloat(cs.fontSize);
        const isLogo = el.classList.contains('font-script');
        if(fs<13 && !isLogo) small.push(el.tagName+' '+fs+' «'+el.textContent.trim().slice(0,30)+'»');
        if(cs.fontFamily.startsWith('Prata')){ display.add(el.id||el.tagName); if(+cs.fontWeight>400||cs.fontStyle!=='normal') synth.push(el.id||el.tagName); }
        else body.add(cs.fontFamily.split(',')[0]);
      }
      ['color','backgroundColor','borderTopColor'].forEach(k=>{ if(old.includes(cs[k])) oldColors.push(el.tagName+'#'+el.id+' '+k+' '+cs[k]); });
    });
    return {small:small.slice(0,6), synth, display:[...display], body:[...body], oldColors:oldColors.slice(0,6), bg:getComputedStyle(document.body).backgroundColor, bodyFs:getComputedStyle(document.body).fontSize, lh:getComputedStyle(document.body).lineHeight};
  }, root);
  let s=await scan();
  ok(`${w}: фон молочный #F7F2EA, текст 16px / 24px`, s.bg==='rgb(247, 242, 234)' && s.bodyFs==='16px' && s.lh==='24px', `${s.bg} ${s.bodyFs}/${s.lh}`);
  ok(`${w}: на главной нет текста мельче 13px (кроме рукописного birki)`, s.small.length===0, s.small.join(' | '));
  ok(`${w}: Prata только в логотипе, заголовках и цифрах шагов, без искусственного жирного/курсива`, s.synth.length===0, 'Prata: '+s.display.join(', '));
  ok(`${w}: основной шрифт — Manrope`, s.body.every(f=>/Manrope|Pinyon/.test(f)), s.body.join(', '));
  ok(`${w}: старые цвета (графит, пудровый, шалфей) не используются`, s.oldColors.length===0, s.oldColors.join(' | '));
  const h1=await p.evaluate(()=>{const h=document.querySelector('#heroTitle');const r=h.getBoundingClientRect();return {fs:getComputedStyle(h).fontSize, lines:Math.round(r.height/parseFloat(getComputedStyle(h).lineHeight)), fits:h.scrollWidth<=h.clientWidth}});
  ok(`${w}: заголовок первого экрана подстраивается под ширину`, h1.fits, JSON.stringify(h1));
  const btn=await p.evaluate(()=>getComputedStyle(document.querySelector('a.btn-wine')).backgroundColor);
  ok(`${w}: основная кнопка бордовая`, btn==='rgb(112, 45, 62)', btn);
  if (w===390 || w===1280) {
    await p.hover('a.btn-wine'); await sleep(250);
    ok(`${w}: наведение на кнопку — #54202E`, await p.evaluate(()=>getComputedStyle(document.querySelector('a.btn-wine')).backgroundColor)==='rgb(84, 32, 46)');
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
    const f=await p.evaluate(()=>{const e=document.activeElement, cs=getComputedStyle(e);return e.tagName+' '+cs.outlineStyle+' '+cs.outlineColor+' '+cs.outlineWidth});
    ok(`${w}: клавиатурный фокус заметен (бордовая обводка 2px)`, /solid rgb\(112, 45, 62\) 2px/.test(f), f);
    await p.evaluate(()=>window.scrollTo(0,0)); await sleep(100);
    await p.screenshot({path:__dirname+'/'+`v5_home_${w}.png`, fullPage:true});
  }
  // экран товара
  await p.evaluate(()=>document.querySelector('[data-open="ribbon"]').scrollIntoView({block:'center'})); await sleep(80);
  await p.click('[data-open="ribbon"]'); await sleep(450);
  await p.click('#pMore summary'); await p.click('[data-layout="need"]'); await p.click('#priceToggle'); await sleep(120);
  s=await scan('#product');
  ok(`${w}: в экране товара нет текста мельче 13px`, s.small.length===0, s.small.join(' | '));
  ok(`${w}: в экране товара Prata только в названии товара`, s.synth.length===0 && s.display.every(x=>x==='pTitle'), s.display.join(', '));
  ok(`${w}: старые цвета в экране товара не используются`, s.oldColors.length===0, s.oldColors.join(' | '));
  const st=await p.evaluate(()=>({chip:getComputedStyle(document.querySelector('[data-dim][aria-pressed="true"]')).backgroundColor, chipOff:getComputedStyle(document.querySelector('[data-dim][aria-pressed="false"]')).backgroundColor, copy:getComputedStyle(document.querySelector('#copyBtn')).backgroundColor, tot:(c=>({fontWeight:c.fontWeight,fontFamily:c.fontFamily}))(getComputedStyle(document.querySelector('#sumTotal'))), active:getComputedStyle(document.querySelector('[data-pp][aria-current="true"]')).color, check:getComputedStyle(document.querySelector('#x-matte')).accentColor}));
  ok(`${w}: выбранная ширина и активная строка прайса — бордовые, невыбранные — светлые`, st.chip==='rgb(112, 45, 62)' && st.chipOff==='rgb(255, 252, 247)' && st.active==='rgb(112, 45, 62)' && st.check==='rgb(112, 45, 62)', JSON.stringify({chip:st.chip,off:st.chipOff,active:st.active}));
  ok(`${w}: кнопка «Скопировать заявку» бордовая, итог — Manrope 600`, st.copy==='rgb(112, 45, 62)' && st.tot.fontWeight==='600' && st.tot.fontFamily.startsWith('Manrope'), st.copy+' '+st.tot.fontWeight+' '+st.tot.fontFamily.split(',')[0]);
  // фокус в поле
  await p.focus('#comment'); await sleep(350); const fc=await p.evaluate(()=>getComputedStyle(document.querySelector('#comment')).borderTopColor);
  ok(`${w}: поле в фокусе выделено бордовым`, fc==='rgb(112, 45, 62)', fc);
  // уведомление
  await p.evaluate(()=>{ navigator.clipboard.writeText=()=>Promise.resolve(); }); await p.click('#copyBtn'); await sleep(200);
  const t=await p.evaluate(()=>{const e=document.querySelector('#toast'), cs=getComputedStyle(e);return {txt:e.textContent, bg:cs.backgroundColor, c:cs.color, fs:cs.fontSize}});
  ok(`${w}: сообщение «Текст заявки скопирован» — бордовое, 14px`, t.txt==='Текст заявки скопирован' && t.bg==='rgb(84, 32, 46)' && t.fs==='14px', JSON.stringify(t));
  if (w===390 || w===1280) { await p.evaluate(()=>document.querySelector('#pBody').scrollTop=0); await sleep(3600); await p.screenshot({path:__dirname+'/'+`v5_dlg_${w}.png`}); }
  await p.close();
}
await b.close(); out.forEach(r=>console.log(r[0],r[1],r[2]?'— '+r[2]:'')); console.log('\nИтого:',out.filter(r=>r[0].trim()==='OK').length,'из',out.length);
})();
