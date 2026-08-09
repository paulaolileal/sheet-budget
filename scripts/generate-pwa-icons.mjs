import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const iconsDir = join(publicDir, "icons");
const source = join(publicDir, "logo-bs.png");

const BACKGROUND = "#000000";

// The source artwork bakes a near-black background into the PNG itself (it's fully
// opaque, not transparent) with the "B$" mark occupying only ~50-60% of the canvas.
// At home-screen icon sizes that margin — stacked with the safe-zone padding Android
// adds for maskable icons — left almost nothing visible. `cropToMark` removes that
// dead margin so the mark actually fills the icon, and `boostContrast` widens the gap
// between the near-black background and the charcoal "B" (originally only ~10-24
// luminance levels apart) so it reads as a shape instead of a flat dark blob.
const CONTENT_THRESHOLD = 25; // luminance delta from the background considered "mark"
const CROP_PADDING_RATIO = 0.06; // extra breathing room around the detected mark, relative to its largest side
const CONTRAST_SLOPE = 1.6;
const CONTRAST_OFFSET = -8;

async function detectContentBoundingBox(image) {
  const { data, info } = await image.clone().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const bg = [data[0], data[1], data[2]];

  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const delta = Math.max(
        Math.abs(data[idx] - bg[0]),
        Math.abs(data[idx + 1] - bg[1]),
        Math.abs(data[idx + 2] - bg[2]),
      );
      if (delta > CONTENT_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;
  const padding = Math.round(Math.max(boxWidth, boxHeight) * CROP_PADDING_RATIO);
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + padding);
  const bottom = Math.min(height, maxY + padding);
  return { left, top, width: right - left, height: bottom - top };
}

/** Tightly crops the mark and widens the background/foreground contrast so it stays
 *  legible at small icon sizes. Returns a PNG buffer, not yet placed on any canvas. */
async function prepareMark() {
  const original = sharp(source);
  const box = await detectContentBoundingBox(original);
  return original.extract(box).linear(CONTRAST_SLOPE, CONTRAST_OFFSET).png().toBuffer();
}

/** Composites the prepared mark onto a square canvas, scaled so its largest side
 *  covers `fillRatio` of the canvas. */
async function renderIcon(mark, size, fillRatio, background = BACKGROUND) {
  const markMeta = await sharp(mark).metadata();
  const scale = (size * fillRatio) / Math.max(markMeta.width, markMeta.height);
  const resized = await sharp(mark)
    .resize(Math.round(markMeta.width * scale), Math.round(markMeta.height * scale))
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

await mkdir(iconsDir, { recursive: true });

const mark = await prepareMark();

// "any" purpose icons: no OS-guaranteed safe zone, so the mark can fill most of the frame.
const ANY_FILL_RATIO = 0.86;
await sharp(await renderIcon(mark, 192, ANY_FILL_RATIO)).toFile(join(iconsDir, "icon-192.png"));
await sharp(await renderIcon(mark, 512, ANY_FILL_RATIO)).toFile(join(iconsDir, "icon-512.png"));

// Maskable: platforms may crop outside a centered safe zone, so keep more margin.
const MASKABLE_FILL_RATIO = 0.7;
await sharp(await renderIcon(mark, 512, MASKABLE_FILL_RATIO)).toFile(
  join(iconsDir, "icon-512-maskable.png"),
);

// apple-touch-icon: iOS rounds the corners itself and handles transparency poorly,
// so it gets the same opaque black canvas as everything else.
await sharp(await renderIcon(mark, 180, ANY_FILL_RATIO)).toFile(
  join(iconsDir, "apple-touch-icon-180.png"),
);

console.log("PWA icons generated at public/icons/");
