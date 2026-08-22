const fs=require('fs');const path=require('path');
const dir='css';
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.css')&&f!=='style.css');
const master=fs.readFileSync(path.join(dir,'style.css'),'utf8');
function selectors(css){
  css=css.replace(/\/\*[\s\S]*?\*\//g,'');
  const out=new Set();
  const re=/([^{}]+)\{/g;let m;
  while((m=re.exec(css))){
    const s=m[1].trim();
    if(!s||s.startsWith('@')||s.includes(':root')) continue;
    s.split(',').forEach(x=>{x=x.trim();if(x&&!x.startsWith('@'))out.add(x)});
  }
  return out;
}
const mSel=selectors(master);
let totalMissing=0;
for(const f of files){
  const sel=selectors(fs.readFileSync(path.join(dir,f),'utf8'));
  const missing=[...sel].filter(s=>!mSel.has(s));
  if(missing.length){totalMissing+=missing.length;console.log('['+f+'] '+missing.length+' selector tidak ada di style.css:');missing.forEach(s=>console.log('   - '+s));}
}
console.log('\nTOTAL selector modular yang hilang di style.css: '+totalMissing);
