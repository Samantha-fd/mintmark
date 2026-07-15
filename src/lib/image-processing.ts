import { Inter_700Bold } from '@expo-google-fonts/inter';
import {
    AlphaType,
    ColorType,
    FontStyle,
    ImageFormat,
    Skia,
    type SkImage,
    type SkTypeface,
} from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';

/**
 * Logos are capped at this size on their longest side. Big enough to stay
 * crisp on a full-resolution photo, small enough that pixel processing is
 * fast. The source is never upscaled — only downscaled when larger.
 */
const LOGO_MAX_DIM = 1500;

export async function loadImage(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Could not read that image.');
  return image;
}

function makeSurface(width: number, height: number) {
  const surface = Skia.Surface.Make(width, height);
  if (!surface) throw new Error('Could not create a drawing surface.');
  return surface;
}

/** High-quality (Mitchell cubic) resample onto a new surface. */
function drawToSize(image: SkImage, width: number, height: number): SkImage {
  const surface = makeSurface(width, height);
  const canvas = surface.getCanvas();
  canvas.drawImageRectCubic(
    image,
    Skia.XYWHRect(0, 0, image.width(), image.height()),
    Skia.XYWHRect(0, 0, width, height),
    1 / 3,
    1 / 3,
  );
  surface.flush();
  return surface.makeImageSnapshot();
}

export function downscale(image: SkImage, maxDim: number = LOGO_MAX_DIM): SkImage {
  const scale = Math.min(1, maxDim / Math.max(image.width(), image.height()));
  if (scale >= 1) return image;
  return drawToSize(
    image,
    Math.max(1, Math.round(image.width() * scale)),
    Math.max(1, Math.round(image.height() * scale)),
  );
}

function getPixels(image: SkImage): Uint8Array {
  const pixels = image.readPixels(0, 0, {
    width: image.width(),
    height: image.height(),
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!pixels) throw new Error('Could not read image pixels.');
  return pixels instanceof Uint8Array ? pixels : Uint8Array.from(pixels);
}

function imageFromPixels(pixels: Uint8Array, width: number, height: number): SkImage {
  const image = Skia.Image.MakeImage(
    { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
    Skia.Data.fromBytes(pixels),
    width * 4,
  );
  if (!image) throw new Error('Could not rebuild image from pixels.');
  return image;
}

/**
 * Removes the background by flood-filling from the image borders: only
 * pixels connected to the outside edge get erased, so white text or shapes
 * *inside* the logo survive. The background colour is sampled from the four
 * corners. `tolerance` is 0–100 (slider value).
 */
export function removeBackground(image: SkImage, tolerance: number): SkImage {
  const w = image.width();
  const h = image.height();
  const px = getPixels(image);

  // If the border is already mostly transparent, there is no solid
  // background to remove — running colour matching against empty pixels
  // would erase parts of the logo itself. Leave the image untouched.
  let borderTotal = 0;
  let borderTransparent = 0;
  const tallyBorder = (idx: number) => {
    borderTotal++;
    if (px[idx * 4 + 3] < 16) borderTransparent++;
  };
  for (let x = 0; x < w; x++) {
    tallyBorder(x);
    tallyBorder((h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y++) {
    tallyBorder(y * w);
    tallyBorder(y * w + w - 1);
  }
  if (borderTransparent / borderTotal > 0.35) return image;

  // Sample the background colour at the corners and edge midpoints,
  // ignoring any spots that are themselves transparent.
  const samplePoints = [
    0,
    w - 1,
    (h - 1) * w,
    (h - 1) * w + w - 1,
    w >> 1,
    (h - 1) * w + (w >> 1),
    (h >> 1) * w,
    (h >> 1) * w + w - 1,
  ];
  const samples: number[][] = [];
  for (const idx of samplePoints) {
    const i = idx * 4;
    if (px[i + 3] > 200) samples.push([px[i], px[i + 1], px[i + 2]]);
  }
  if (samples.length === 0) return image;

  const maxDist = 10 + tolerance * 1.2; // slider 0..100 → distance 10..130
  const maxDistSq = maxDist * maxDist;
  const featherDistSq = maxDist * 1.2 * (maxDist * 1.2);

  const distSqToBg = (idx: number): number => {
    const i = idx * 4;
    let best = Infinity;
    for (const [r, g, b] of samples) {
      const dr = px[i] - r;
      const dg = px[i + 1] - g;
      const db = px[i + 2] - b;
      const d = dr * dr + dg * dg + db * db;
      if (d < best) best = d;
    }
    return best;
  };

  const isBg = (idx: number): boolean =>
    px[idx * 4 + 3] === 0 || distSqToBg(idx) <= maxDistSq;

  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const seed = (idx: number) => {
    if (!visited[idx] && isBg(idx)) {
      visited[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }

  while (head < tail) {
    const idx = queue[head++];
    px[idx * 4 + 3] = 0;
    const x = idx % w;
    if (x > 0) seed(idx - 1);
    if (x < w - 1) seed(idx + 1);
    if (idx >= w) seed(idx - w);
    if (idx < w * (h - 1)) seed(idx + w);
  }

  // Soften the cut edge: kept pixels that touch a removed pixel and are
  // still close to the background colour get partial transparency.
  for (let idx = 0; idx < w * h; idx++) {
    if (visited[idx]) continue;
    const a = px[idx * 4 + 3];
    if (a === 0) continue;
    const x = idx % w;
    const touchesRemoved =
      (x > 0 && visited[idx - 1]) ||
      (x < w - 1 && visited[idx + 1]) ||
      (idx >= w && visited[idx - w]) ||
      (idx < w * (h - 1) && visited[idx + w]);
    if (touchesRemoved && distSqToBg(idx) <= featherDistSq) {
      px[idx * 4 + 3] = Math.round(a * 0.45);
    }
  }

  return imageFromPixels(px, w, h);
}

/** Crops away fully transparent borders, keeping a small padding. */
export function trimTransparent(image: SkImage, padding = 6): SkImage {
  const w = image.width();
  const h = image.height();
  const px = getPixels(image);

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (px[(row + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return image; // nothing visible — leave untouched

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(w - 1, maxX + padding);
  maxY = Math.min(h - 1, maxY + padding);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  if (cw === w && ch === h) return image;

  const surface = makeSurface(cw, ch);
  surface
    .getCanvas()
    .drawImageRect(
      image,
      Skia.XYWHRect(minX, minY, cw, ch),
      Skia.XYWHRect(0, 0, cw, ch),
      Skia.Paint(),
    );
  surface.flush();
  return surface.makeImageSnapshot();
}

export type LogoOptions = {
  removeBg: boolean;
  /** 0–100, only used when removeBg is true */
  tolerance: number;
};

/** Full pipeline: decode → downscale → optional background removal → trim. */
export async function processLogo(uri: string, options: LogoOptions): Promise<SkImage> {
  let image = downscale(await loadImage(uri));
  if (options.removeBg) image = removeBackground(image, options.tolerance);
  return trimTransparent(image);
}

export type PlacementAnalysis = {
  /** which corner is calmest: 0 = left/top, 1 = right/bottom */
  quietCorner: { x: 0 | 1; y: 0 | 1 };
  /** centre of visual interest (the subject), as fractions of the photo */
  subject: { cx: number; cy: number };
};

/**
 * Cheap saliency pass on a thumbnail: edge energy per region. The calmest
 * corner is where a watermark looks cleanest; the energy centroid is where
 * it protects best (removal would have to reconstruct the subject).
 */
export async function analyzePhoto(uri: string): Promise<PlacementAnalysis> {
  const image = downscale(await loadImage(uri), 96);
  const w = image.width();
  const h = image.height();
  const px = getPixels(image);

  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  }
  const energy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      energy[i] = Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + w] - lum[i - w]);
    }
  }

  // corner calm: energy sum over each ~35% corner block; bottom corners get
  // a small head start because watermarks read most natural there
  const bw = Math.max(1, Math.floor(w * 0.35));
  const bh = Math.max(1, Math.floor(h * 0.35));
  const blockEnergy = (x0: number, y0: number) => {
    let sum = 0;
    for (let y = y0; y < y0 + bh; y++) {
      for (let x = x0; x < x0 + bw; x++) sum += energy[y * w + x];
    }
    return sum;
  };
  const corners: { x: 0 | 1; y: 0 | 1; score: number }[] = [
    { x: 0, y: 0, score: blockEnergy(0, 0) },
    { x: 1, y: 0, score: blockEnergy(w - bw, 0) },
    { x: 0, y: 1, score: blockEnergy(0, h - bh) * 0.85 },
    { x: 1, y: 1, score: blockEnergy(w - bw, h - bh) * 0.85 },
  ];
  corners.sort((a, b) => a.score - b.score);

  // subject: energy-weighted centroid, squared to favour strong edges,
  // clamped so the suggestion never hugs an edge
  let sx = 0;
  let sy = 0;
  let total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = energy[y * w + x] ** 2;
      sx += x * e;
      sy += y * e;
      total += e;
    }
  }
  const cx = total > 0 ? sx / total / w : 0.5;
  const cy = total > 0 ? sy / total / h : 0.5;

  return {
    quietCorner: { x: corners[0].x, y: corners[0].y },
    subject: {
      cx: Math.min(0.7, Math.max(0.3, cx)),
      cy: Math.min(0.7, Math.max(0.3, cy)),
    },
  };
}

let textTypeface: SkTypeface | null | undefined;

/** Inter Bold (the app's own typeface) with a system-font fallback. */
async function loadTextTypeface(): Promise<SkTypeface | null> {
  if (textTypeface !== undefined) return textTypeface;
  try {
    const asset = Asset.fromModule(Inter_700Bold);
    await asset.downloadAsync();
    if (asset.localUri) {
      const data = await Skia.Data.fromURI(asset.localUri);
      const face = Skia.Typeface.MakeFreeTypeFaceFromData(data);
      if (face) {
        textTypeface = face;
        return face;
      }
    }
  } catch {
    // fall through to the system font
  }
  textTypeface = Skia.FontMgr.System().matchFamilyStyle('sans-serif', FontStyle.Bold);
  return textTypeface;
}

/**
 * Renders text (a name, @handle, ©…) as a transparent PNG so it can live in
 * the logo library and ride the normal stamping pipeline.
 */
export async function renderTextLogo(text: string, color: string): Promise<SkImage> {
  const typeface = await loadTextTypeface();
  if (!typeface) throw new Error('Could not load a font for the text.');

  // rendered large so it stays crisp on full-resolution photos
  const fontSize = 200;
  const font = Skia.Font(typeface, fontSize);
  let textWidth: number;
  try {
    textWidth = font.measureText(text).width;
  } catch {
    textWidth = text.length * fontSize * 0.6;
  }
  const pad = 40;
  const w = Math.max(1, Math.ceil(textWidth + pad * 2));
  const h = Math.ceil(fontSize * 1.7);

  const surface = makeSurface(w, h);
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(color));
  paint.setAntiAlias(true);
  canvas.drawText(text, pad, fontSize * 1.2, paint, font);
  surface.flush();

  return downscale(trimTransparent(surface.makeImageSnapshot(), 10));
}

export function encodePng(image: SkImage): Uint8Array {
  const bytes = image.encodeToBytes(ImageFormat.PNG, 100);
  if (!bytes) throw new Error('Could not encode PNG.');
  return bytes;
}

export async function encodePhotoAsJpeg(photoUri: string): Promise<Uint8Array> {
  const photo = await loadImage(photoUri);
  const bytes = photo.encodeToBytes(ImageFormat.JPEG, 95);
  if (!bytes) throw new Error('Could not encode the photo.');
  return bytes;
}

export function toDataUri(image: SkImage): string {
  return `data:image/png;base64,${image.encodeToBase64(ImageFormat.PNG, 100)}`;
}

/**
 * Placement of the logo over the photo, in *displayed* (on-screen) photo
 * coordinates. Export scales everything up to the photo's native resolution.
 */
export type StampPlacement = {
  /** width of the photo as displayed on screen */
  displayWidth: number;
  /** logo centre, relative to the displayed photo's top-left corner */
  centerX: number;
  centerY: number;
  logoDisplayWidth: number;
  /** radians */
  rotation: number;
  /** 0–1 */
  opacity: number;
};

/**
 * Composites the logo onto the photo at the photo's ORIGINAL resolution and
 * returns encoded JPEG bytes. Quality is preserved because the composite
 * happens in native pixels, never at screen size.
 */
export async function renderStampedPhoto(
  photoUri: string,
  logoUri: string,
  p: StampPlacement,
): Promise<Uint8Array> {
  const photo = await loadImage(photoUri);
  const logo = await loadImage(logoUri);

  const f = photo.width() / p.displayWidth;
  const surface = makeSurface(photo.width(), photo.height());
  const canvas = surface.getCanvas();
  canvas.drawImage(photo, 0, 0);

  const logoW = p.logoDisplayWidth * f;
  const logoH = logoW * (logo.height() / logo.width());
  const paint = Skia.Paint();
  paint.setAlphaf(Math.max(0, Math.min(1, p.opacity)));

  canvas.save();
  canvas.translate(p.centerX * f, p.centerY * f);
  canvas.rotate((p.rotation * 180) / Math.PI, 0, 0);
  canvas.drawImageRectCubic(
    logo,
    Skia.XYWHRect(0, 0, logo.width(), logo.height()),
    Skia.XYWHRect(-logoW / 2, -logoH / 2, logoW, logoH),
    1 / 3,
    1 / 3,
    paint,
  );
  canvas.restore();
  surface.flush();

  const out = surface.makeImageSnapshot();
  const bytes = out.encodeToBytes(ImageFormat.JPEG, 95);
  if (!bytes) throw new Error('Could not encode the final photo.');
  return bytes;
}

/** Small checkerboard tile (as data URI) used behind transparent previews. */
export function makeCheckerTile(light: string, dark: string): string {
  const size = 24;
  const cell = 12;
  const surface = makeSurface(size, size);
  const canvas = surface.getCanvas();
  const lightPaint = Skia.Paint();
  lightPaint.setColor(Skia.Color(light));
  const darkPaint = Skia.Paint();
  darkPaint.setColor(Skia.Color(dark));
  canvas.drawRect(Skia.XYWHRect(0, 0, size, size), lightPaint);
  canvas.drawRect(Skia.XYWHRect(0, 0, cell, cell), darkPaint);
  canvas.drawRect(Skia.XYWHRect(cell, cell, cell, cell), darkPaint);
  surface.flush();
  return toDataUri(surface.makeImageSnapshot());
}
