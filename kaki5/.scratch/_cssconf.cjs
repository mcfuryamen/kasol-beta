const fs=require('fs');const path=require('path');
const dir='css';
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.css')&&f!=='style.css');
function strip(c){return c.replace(/\/\*[\s\S]*?\*\//g,'')}
function parse(css){
  css=strip(css);
  const rules=[];let i=0;
  while(i<css.length){
    const at=css.indexOf('{',i);if(at<0)break;
    let sel=css.slice(i,at).trim();
    if(sel.startsWith('@')){
      let d=1,j=at+1;while(j<css.length&&d>0){if(css[j]==='{')d++;else if(css[j]==='}')d--;j++}
      if(/^@(media|supports)/.test(sel)){
        const inner=css.slice(at+1,j-1);
        const ctxKey=sel.replace(/\s+/g,' ').replace(/\s*:\s*/g,':');
        parse(inner).forEach(r=>rules.push({ctx:ctxKey+(r.ctx?'>>'+r.ctx:''),sel:r.sel,body:r.body}));
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
const norm=b=>b.split(';').map(x=>x.replace(/\s*:\s*/,':').replace(/\s*,\s*/g,',').replace(/\s+/g,' ').trim()).filter(Boolean).sort().join(';');
const master=parse(fs.readFileSync(path.join(dir,'style.css'),'utf8'));
const mKey=new Map();
master.forEach(r=>{const k=r.ctx+'||'+r.sel;if(!mKey.has(k))mKey.set(k,[]);mKey.get(k).push(norm(r.body))});
let conflicts=0;
for(const f of files){
  for(const r of parse(fs.readFileSync(path.join(dir,f),'utf8'))){
    const k=r.ctx+'||'+r.sel;
    if(!mKey.has(k))continue;
    const nb=norm(r.body);
    if(!mKey.get(k).includes(nb)){
      conflicts++;
      console.log('CONFLICT ['+f+'] '+(r.ctx?r.ctx+' ':'')+r.sel);
      console.log('   modular: '+nb.slice(0,300));
      console.log('   style  : '+mKey.get(k).join('  ~~  ').slice(0,300));
    }
  }
}
console.log('\nTOTAL rule konflik nilai: '+conflicts);
