// Play Store listing assets: framed screenshot cards + feature graphic.
// Usage: node brand/render-store-cards.mjs
// Reads raw captures from brand/screenshots/, writes brand/store/.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const p = (rel) => fileURLToPath(new URL(rel, import.meta.url));

mkdirSync(p('./store'), { recursive: true });

const { default: sharp } = await import('sharp');

const W = 1080;
const H = 1920;
const SHOT_W = 738; // raw capture width
const STATUS_BAR = 95; // cropped off every capture

const terracotta = '#C96F4A';
const cocoa = '#2E241C';
const cream = '#FAF7F2';
const blush = '#EFC9B8';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Palatino Linotype (system font): a calligraphic old-style serif that
// matches the wax-seal identity far better than a geometric sans.
const SERIF_BOLD_ITALIC = 'C:/Windows/Fonts/palabi.ttf';
const SERIF_BOLD = 'C:/Windows/Fonts/palab.ttf';
const SERIF_ITALIC = 'C:/Windows/Fonts/palai.ttf';
const FAMILY = 'Palatino Linotype';

/** text rendered by pango with an explicit fontfile (no fontconfig) */
const text = (str, { color, size, fontfile = SERIF_BOLD_ITALIC, width = W, tracking = 0 }) =>
  sharp({
    text: {
      text: `<span foreground="${color}" letter_spacing="${tracking}">${esc(str)}</span>`,
      fontfile,
      font: `${FAMILY} ${Math.round(size * 0.75)}`, // pango pt ≈ px * 0.75
      width,
      align: 'centre',
      rgba: true,
    },
  })
    .png()
    .toBuffer();

/** centred caption block; returns a composite layer */
const captionLayer = async (lines, color) => {
  const img = await text(lines.join('\n'), { color, size: 94 });
  const { width } = await sharp(img).metadata();
  return { input: img, left: Math.round((W - width) / 2), top: 110 };
};

const roundedMask = (w, h, r) =>
  Buffer.from(
    `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
  );

const rounded = async (buf, r) => {
  const { width, height } = await sharp(buf).metadata();
  return sharp(buf)
    .composite([{ input: roundedMask(width, height, r), blend: 'dest-in' }])
    .png()
    .toBuffer();
};

const shadow = (w, h, r) =>
  sharp(
    Buffer.from(
      `<svg width="${w + 120}" height="${h + 120}">
        <rect x="60" y="70" width="${w}" height="${h}" rx="${r}" fill="rgba(0,0,0,0.38)"/>
      </svg>`,
    ),
  )
    .blur(18)
    .png()
    .toBuffer();

/** a raw capture minus its status bar, optionally region-limited */
const cleanShot = (file, cropH, cropTop = STATUS_BAR) =>
  sharp(p(`./screenshots/${file}`))
    .extract({ left: 0, top: cropTop, width: SHOT_W, height: cropH ?? 1600 - cropTop })
    .toBuffer();

/** bold card: caption on top, screenshot bleeding off the bottom edge */
async function card(file, outName, bg, capLines, capColor, opts = {}) {
  const shotW = 850;
  const src = await cleanShot(file, opts.cropH, opts.cropTop);
  const scaled = await sharp(src).resize({ width: shotW }).toBuffer();
  const shot = await rounded(scaled, 44);
  const meta = await sharp(shot).metadata();
  const top = opts.floatY ?? 430;
  const layers = [
    { input: await shadow(shotW, Math.min(meta.height, H - top), 44), left: (W - shotW) / 2 - 60, top: top - 70 },
    { input: shot, left: (W - shotW) / 2, top },
    await captionLayer(capLines, capColor),
  ];
  await sharp({ create: { width: W, height: H, channels: 4, background: bg } })
    .composite(layers)
    .flatten({ background: bg })
    .jpeg({ quality: 92 })
    .toFile(p(`./store/${outName}`));
  console.log('rendered', outName);
}

/** before/after card: the two logo previews stacked vertically */
async function splitCard(beforeFile, afterFile, outName) {
  const region = { left: 30, top: 190, width: 676, height: 520 };
  const panelW = 800;
  const half = async (file, label) => {
    const crop = await sharp(p(`./screenshots/${file}`)).extract(region).toBuffer();
    const scaled = await sharp(crop).resize({ width: panelW }).toBuffer();
    const img = await rounded(scaled, 36);
    const { height } = await sharp(img).metadata();
    const tag = await text(label, { color: '#8A7A6D', size: 46, fontfile: SERIF_ITALIC, width: panelW });
    return { img, height, tag };
  };
  const before = await half(beforeFile, 'before');
  const after = await half(afterFile, 'after');
  const x = (W - panelW) / 2;
  const y1 = 470;
  const y2 = y1 + before.height + 150;
  const arrow = await text('↓', { color: terracotta, size: 96 });
  const arrowMeta = await sharp(arrow).metadata();
  await sharp({ create: { width: W, height: H, channels: 4, background: cream } })
    .composite([
      { input: await shadow(panelW, before.height, 36), left: x - 60, top: y1 - 70 },
      { input: before.img, left: x, top: y1 },
      { input: before.tag, left: x, top: y1 + before.height + 14 },
      { input: await shadow(panelW, after.height, 36), left: x - 60, top: y2 - 70 },
      { input: after.img, left: x, top: y2 },
      { input: after.tag, left: x, top: y2 + after.height + 14 },
      await captionLayer(['white background?', 'gone in one slide'], cocoa),
      {
        input: arrow,
        left: Math.round((W - arrowMeta.width) / 2),
        top: y1 + before.height + 74 - Math.round(arrowMeta.height / 2),
      },
    ])
    .flatten({ background: cream })
    .jpeg({ quality: 92 })
    .toFile(p(`./store/${outName}`));
  console.log('rendered', outName);
}

/** gallery capture with a second row of tiles composited from real crops */
async function fillGallery() {
  const cake = p('./screenshots/Markly  (8).jpeg'); // 1086x1448 stamped photo
  const tile = async (extract) =>
    rounded(
      await sharp(cake).extract(extract).resize(236, 236).toBuffer(),
      10,
    );
  const tiles = [
    await tile({ left: 60, top: 40, width: 960, height: 960 }), // biscuit crown
    await tile({ left: 60, top: 460, width: 960, height: 960 }), // pink band
    await tile({ left: 0, top: 180, width: 1086, height: 1086 }), // whole cake
  ];
  const xs = [8, 250, 492];
  return sharp(p('./screenshots/Markly  (2).jpeg'))
    .composite(tiles.map((input, i) => ({ input, left: xs[i], top: 428 })))
    .toBuffer();
}

/** 1024x500 feature graphic: wordmark left, stamped photo right */
async function featureGraphic() {
  const cakeCard = await rounded(
    await sharp(p('./screenshots/Markly  (8).jpeg'))
      .extract({ left: 60, top: 60, width: 966, height: 1260 })
      .resize({ width: 330 })
      .toBuffer(),
    24,
  );
  const tilted = await sharp(cakeCard)
    .rotate(-5, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const seal = await sharp(p('./mintmark-seal.svg'), { density: 800 })
    .resize(140, 140)
    .png()
    .toBuffer();
  const wordmark = await text('Mintmark', {
    color: cocoa,
    size: 104,
    fontfile: SERIF_BOLD,
    width: 620,
    tracking: 2048,
  });
  const tagline = await text('your logo on every photo', {
    color: '#8A7A6D',
    size: 40,
    fontfile: SERIF_ITALIC,
    width: 620,
  });
  const rule = Buffer.from(
    `<svg width="300" height="6"><rect width="300" height="4" rx="2" fill="${terracotta}"/></svg>`,
  );
  await sharp({ create: { width: 1024, height: 500, channels: 4, background: cream } })
    .composite([
      {
        input: Buffer.from(
          `<svg width="1024" height="500"><circle cx="960" cy="80" r="260" fill="${blush}" opacity="0.55"/>
           <circle cx="120" cy="470" r="180" fill="${blush}" opacity="0.35"/></svg>`,
        ),
        left: 0,
        top: 0,
      },
      { input: seal, left: 96, top: 78 },
      { input: wordmark, left: 96, top: 236 },
      { input: rule, left: 100, top: 372 },
      { input: tagline, left: 100, top: 396 },
      { input: tilted, left: 630, top: 40 },
    ])
    .flatten({ background: cream })
    .png()
    .toFile(p('./store/feature-graphic.png'));
  console.log('rendered feature-graphic.png');
}

await card('Markly  (4).jpeg', 'card-1-editor.jpg', terracotta, ['your logo, right', 'where you want it'], cream);
await splitCard('Markly  (3).jpeg', 'Markly  (5).jpeg', 'card-2-remove-bg.jpg');
await card('Markly  (1).jpeg', 'card-3-batch.jpg', cocoa, ['your whole gallery,', 'one stampede'], cream);
const galleryBuf = await fillGallery();
writeFileSync(p('./store/gallery-filled.png'), galleryBuf);
await card('../store/gallery-filled.png', 'card-4-gallery.jpg', blush, ['ready to post,', 'name attached'], cocoa, { cropH: 720, floatY: 560 });
await card('Markly  (7).jpeg', 'card-5-overview.jpg', terracotta, ['make it. stamp it.', 'share it.'], cream, { cropTop: 520, cropH: 560, floatY: 620 });
await featureGraphic();
console.log('All store assets rendered into brand/store/.');
