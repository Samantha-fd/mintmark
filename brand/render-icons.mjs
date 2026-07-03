import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const p = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const DENSITY = 800;

const renderSvg = (file, size) =>
  sharp(p(file), { density: DENSITY }).resize(size, size).png().toBuffer();

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const cream = '#FAF7F2';

const onCanvas = (size, background, input) =>
  sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input, gravity: 'centre' }])
    .png();

// 1024 app icon: cream square, seal at 82%
await onCanvas(1024, cream, await renderSvg('./markly-seal.svg', 840)).toFile(
  p('../assets/images/icon.png'),
);

// Android adaptive foreground: transparent, seal inside the 66% safe zone
await onCanvas(1024, transparent, await renderSvg('./markly-seal.svg', 600)).toFile(
  p('../assets/images/android-icon-foreground.png'),
);

// Android adaptive background: flat cream
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: cream } })
  .png()
  .toFile(p('../assets/images/android-icon-background.png'));

// Android 13+ themed icon: white silhouette with knocked-out ring and m
await onCanvas(1024, transparent, await renderSvg('./markly-seal-mono.svg', 600)).toFile(
  p('../assets/images/android-icon-monochrome.png'),
);

// splash logo and favicon
await sharp(p('./markly-seal.svg'), { density: DENSITY })
  .resize(512, 512)
  .png()
  .toFile(p('../assets/images/splash-icon.png'));
await sharp(p('./markly-seal.svg'), { density: DENSITY })
  .resize(48, 48)
  .png()
  .toFile(p('../assets/images/favicon.png'));

console.log('All Markly icon assets rendered.');
