import sharp from 'sharp';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, 'public/sarvam.jpg');
const outDir = join(__dirname, 'public/icons');

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const sizes = [192, 512];
for (const size of sizes) {
  await sharp(src)
    .resize(size, size, { fit: 'contain', background: { r: 14, g: 165, b: 233, alpha: 1 } })
    .png()
    .toFile(join(outDir, `icon-${size}.png`));
  console.log(`✅ icon-${size}.png generated`);
}

// Screenshot placeholder (blue gradient)
await sharp({
  create: { width: 390, height: 844, channels: 4, background: { r: 14, g: 165, b: 233, alpha: 1 } },
})
  .png()
  .toFile(join(outDir, 'screenshot.png'));
console.log('✅ screenshot.png generated');
