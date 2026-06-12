import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const svgPath = join(publicDir, 'favicon.svg');
const svgBuffer = readFileSync(svgPath);

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];

for (const { name, size } of sizes) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(join(publicDir, name));
  console.log(`✓ ${name}`);
}

// Build favicon.ico (16x16 + 32x32 combined)
const png16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();
const png32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();

// ICO format: header + directory + image data
function buildIco(images) {
  const count = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dataOffset = headerSize + dirEntrySize * count;

  const offsets = [];
  let currentOffset = dataOffset;
  for (const img of images) {
    offsets.push(currentOffset);
    currentOffset += img.length;
  }

  const totalSize = currentOffset;
  const buf = Buffer.alloc(totalSize);

  // Header
  buf.writeUInt16LE(0, 0);     // reserved
  buf.writeUInt16LE(1, 2);     // type: icon
  buf.writeUInt16LE(count, 4); // count

  // Directory entries
  images.forEach((img, i) => {
    const entry = headerSize + i * dirEntrySize;
    // For PNG inside ICO: width/height can be read from PNG header
    const w = img.readUInt32BE(16); // PNG IHDR width
    const h = img.readUInt32BE(20); // PNG IHDR height
    buf.writeUInt8(w >= 256 ? 0 : w, entry);
    buf.writeUInt8(h >= 256 ? 0 : h, entry + 1);
    buf.writeUInt8(0, entry + 2);   // color count
    buf.writeUInt8(0, entry + 3);   // reserved
    buf.writeUInt16LE(1, entry + 4); // planes
    buf.writeUInt16LE(32, entry + 6); // bit count
    buf.writeUInt32LE(img.length, entry + 8);
    buf.writeUInt32LE(offsets[i], entry + 12);
  });

  // Image data
  images.forEach((img, i) => {
    img.copy(buf, offsets[i]);
  });

  return buf;
}

const ico = buildIco([png16, png32]);
writeFileSync(join(publicDir, 'favicon.ico'), ico);
console.log('✓ favicon.ico (16+32)');

console.log('\nDone. All favicons generated in public/');
