const fs=require('fs');const path=require('path');
const dir='css';
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.css')&&f!=='style.css');
function strip(c){return c.replace(/\/\*[\s\S]*?\*\//g,'')}
function parse(css){
  css=strip(css);const rules=[];let i=0;
  while(i<css.length){
    const at=css.indexOf('{',i);if(at<0)break;
    let sel=css.slice(i,at).trim();
    if(sel.startsWith('@')){
      let d=1,j=at+1;while(j<css.length&&d>0){if(css[j]==='{')d++;else if(css[j]==='}')d--;j++}
      if(/^@(media|supports)/.test(sel)){
        const ctxKey=sel.replace(/\s+/g,' ').replace(/\s*:\s*/g,':');
        parse(css.slice(at+1,j-1)).forEach(r=>rules.push({ctx:ctxKey+(r.ctx?'>>'+r.ctx:''),sel:r.sel,body:r.body}));
      }
      i=j;continue;
    }
    let d=1,j=at+1;while(j<css.length&&d>0){if(css[j]==='{')d++;else if(css[j]==='}')d--;j++}
    const body=css.slice(at+1,j-1).trim();
    sel.split(',').forEach(s=>{s=s.replace(/\s+/g,' ').trim();if(s)rules.push({ctx:'',sel:s,body})});
    i=j;
  }
  return rules;
}
const master=parse(fs.readFileSync(path.join(dir,'style.css'),'utf8'));
const mSelSet=new Set(master.map(r=>r.ctx+'||'+r.sel));
const out={};
for(const f of files){
  for(const r of parse(fs.readFileSync(path.join(dir,f),'utf8'))){
    const k=r.ctx+'||'+r.sel;
    if(mSelSet.has(k))continue;
    (out[f]=out[f]||[]).push(r);
  }
}
for(const f of Object.keys(out)){
  console.log('=== '+f+' ('+out[f].length+') ===');
  out[f].forEach(r=>console.log((r.ctx?'@['+r.ctx+'] ':'')+r.sel+' { '+r.body.replace(/\s+/g,' ')+' }'));
}
