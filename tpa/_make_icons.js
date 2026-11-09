const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([len, typeBuffer, data, crcBuffer]);
}

// Create a PNG with an orange background and a simple white dome (mosque-like) shape
function createIcon(size) {
  const w = size, h = size;
  const px = Buffer.alloc(w * h * 4);
  const bg = [234, 88, 12];   // #ea580c
  const fg = [255, 255, 255]; // white
  const cx = w / 2, cy = h / 2;
  const R = w * 0.30; // dome radius
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // dome: upper semicircle
      const dx = x - cx, dy = y - (cy + R * 0.15);
      const inDome = (dx * dx + dy * dy) <= R * R && y < cy + R * 0.15;
      // base rectangle
      const inBase = Math.abs(x - cx) <= R * 0.75 && y >= cy + R * 0.15 && y <= cy + R * 0.15 + R * 0.55;
      // minaret (thin vertical bar on left)
      const inMinaret = Math.abs(x - (cx - R * 1.05)) <= R * 0.12 && y >= cy - R * 0.2 && y <= cy + R * 0.7;
      const c = (inDome || inBase || inMinaret) ? fg : bg;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
    }
  }
  // Add filter byte (0) to each row
  const stride = w * 4 + 1;
  const filtered = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    filtered[y * stride] = 0;
    px.copy(filtered, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }
  const compressed = zlib.deflateSync(filtered);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

const dir = __dirname;
fs.writeFileSync(path.join(dir, 'icon-192.png'), createIcon(192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), createIcon(512));
fs.writeFileSync(path.join(dir, 'favicon.ico'), createIcon(48));
console.log('Icons created: icon-192.png, icon-512.png, favicon.ico');
