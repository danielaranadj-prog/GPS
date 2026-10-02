import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, r, g, b) {
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      // create a nice gradient with transit colors
      const factor = (x + y) / (width + height);
      rawData[pxOffset] = Math.round(15 + factor * 20);     // R: #0f172a
      rawData[pxOffset + 1] = Math.round(23 + factor * 80); // G
      rawData[pxOffset + 2] = Math.round(42 + factor * 160);// B: #2563eb
      rawData[pxOffset + 3] = 255;                          // A
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (-(c & 1) & 0xedb88320);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([len, typeAndData, crc]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const chunks = [
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', deflated),
    makeChunk('IEND', Buffer.alloc(0))
  ];

  return Buffer.concat(chunks);
}

fs.writeFileSync('public/icon-192.png', createPNG(192, 192, 37, 99, 235));
fs.writeFileSync('public/icon-512.png', createPNG(512, 512, 37, 99, 235));
fs.writeFileSync('public/apple-touch-icon.png', createPNG(180, 180, 37, 99, 235));
console.log('Generated PNG icons successfully.');
