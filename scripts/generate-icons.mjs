/**
 * Generates the PWA / favicon icon set from the source logo.
 *
 * Dev-time only: this is NOT part of the app runtime, the test suite, or the
 * build. It exists so the committed raster assets can be regenerated
 * reproducibly instead of being resized by hand.
 *
 *   node scripts/generate-icons.mjs
 *
 * `sharp` is already present in node_modules (Next.js uses it for image
 * optimization), so no new dependency is added. Run this only when the source
 * logo changes, then commit the regenerated files.
 */
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const SRC = "public/Logo.png";

// The logo sits on a near-white plate; padding the maskable icon with the same
// colour keeps the emblem edge seamless on Android's adaptive shape.
const MASKABLE_BG = "#ffffff";

/** A square PNG at `size`, cropped/fitted to fill. */
async function squarePng(size, out) {
  await sharp(SRC)
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ${out}  (${size}x${size})`);
}

/**
 * A maskable icon: the logo scaled to ~86% and centred on a solid plate, so the
 * emblem stays inside Android's circular safe zone (~80% of the canvas).
 */
async function maskablePng(size, out) {
  const inner = Math.round(size * 0.86);
  const plate = await sharp(SRC).resize(inner, inner, { fit: "cover" }).toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: MASKABLE_BG },
  })
    .composite([{ input: plate, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ${out}  (${size}x${size}, maskable, ${Math.round(0.86 * 100)}% logo)`);
}

/** Assemble a multi-image .ico from PNG payloads (PNG-in-ICO, all modern browsers). */
function buildIco(images, sizes) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  const payloads = [];
  let offset = 6 + images.length * 16;

  images.forEach((png, index) => {
    const size = sizes[index];
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // width  (0 means 256)
    entry[1] = size >= 256 ? 0 : size; // height
    entry[2] = 0; // palette colours
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8); // byte size of the payload
    entry.writeUInt32LE(offset, 12); // payload offset
    offset += png.length;
    entries.push(entry);
    payloads.push(png);
  });

  return Buffer.concat([header, ...entries, ...payloads]);
}

console.log("Generating icons from", SRC);

// PWA manifest icons (referenced by app/manifest.ts).
await squarePng(192, "public/icon-192.png");
await squarePng(512, "public/icon-512.png");
await maskablePng(512, "public/icon-maskable-512.png");

// Next.js app-router file-convention icons.
await squarePng(192, "app/icon.png"); // modern PNG favicon
await squarePng(180, "app/apple-icon.png"); // iOS home-screen (opaque, 180x180)

// Classic multi-size favicon.ico (16/32/48) for browser tabs & legacy.
// Next.js decodes this at build time and requires RGBA PNG payloads, so
// ensureAlpha() is mandatory here even though the source has no transparency.
const icoSizes = [16, 32, 48];
const icoPngs = await Promise.all(
  icoSizes.map((size) =>
    sharp(SRC).resize(size, size, { fit: "cover" }).ensureAlpha().png().toBuffer()
  )
);
await writeFile("app/favicon.ico", buildIco(icoPngs, icoSizes));
console.log(`  app/favicon.ico  (${icoSizes.join("/")})`);

console.log("Done.");
