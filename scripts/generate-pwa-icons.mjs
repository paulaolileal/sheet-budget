import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const iconsDir = join(publicDir, "icons");
const source = join(publicDir, "logo-bs.png");

const BACKGROUND = "#0f172a";

await mkdir(iconsDir, { recursive: true });

await sharp(source).resize(192, 192).png().toFile(join(iconsDir, "icon-192.png"));
await sharp(source).resize(512, 512).png().toFile(join(iconsDir, "icon-512.png"));

// Maskable: extra safe-area padding (~20%) since platforms crop to a circle/squircle.
const maskableSize = 512;
const logoSize = Math.round(maskableSize * 0.6);
await sharp({
  create: { width: maskableSize, height: maskableSize, channels: 4, background: BACKGROUND },
})
  .composite([
    { input: await sharp(source).resize(logoSize, logoSize).toBuffer(), gravity: "center" },
  ])
  .png()
  .toFile(join(iconsDir, "icon-512-maskable.png"));

// apple-touch-icon: iOS handles transparency poorly, flatten onto an opaque background.
await sharp(source)
  .resize(180, 180)
  .flatten({ background: BACKGROUND })
  .png()
  .toFile(join(iconsDir, "apple-touch-icon-180.png"));

console.log("PWA icons generated at public/icons/");
