// ===== GBK HMAC-V2 (serial dari dashboard admin) =====
const GBK_PREFIX='GBK';
const GBK_SALT='KASIRSOLO-GEROBAK-HMAC-V2';
const GBK_B32='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function gbkNormalizeDevice(id){return String(id||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8).padEnd(8,'X');}
function gbkB32(bytes,len){let bits=0,val=0,out='';for(let i=0;i<bytes.length;i++){val=(val<<8)|bytes[i];bits+=8;while(bits>=5){out+=GBK_B32[(val>>>(bits-5))&31];bits-=5;}}if(bits>0)out+=GBK_B32[(val<<(5-bits))&31];return len?(out.slice(0,len)):out;}
async function gbkHmac(data){const enc=new TextEncoder();const key=await crypto.subtle.importKey('raw',enc.encode(GBK_SALT),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=await crypto.subtle.sign('HMAC',key,enc.encode(GBK_SALT+data));return gbkB32(new Uint8Array(sig),6);}
function gbkExpired(exp){if(exp==='99')return false;const months=parseInt(exp);if(isNaN(months))return false;const d=new Date();d.setMonth(d.getMonth()+months);return new Date()>d;}
async function validateGBKSerial(serial, deviceId){
  const clean=(serial||'').trim().toUpperCase().replace(/\s+/g,'');
  const re=/^GBK-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{2})-([A-Z0-9]{6})$/;
  const m=clean.match(re); if(!m)return null;
  const d1=m[1],d2=m[2],exp=m[3],sig=m[4];
  if((d1+d2)!==gbkNormalizeDevice(deviceId))return {valid:false,reason:'device'};
  const expected=await gbkHmac(d1+d2+exp);
  if(sig!==expected)return {valid:false,reason:'hmac'};
  if(gbkExpired(exp))return {valid:false,reason:'expired'};
  return {valid:true,expCode:exp};
}