import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { markSvg, monoMarkSvg } from "@/components/brand/mark-svg";

// Regenerates every static copy of the brand mark from mark-svg.ts.

const PUBLIC_DIR = resolve(import.meta.dir, "../public");
const TERMINAL_ICON = resolve(import.meta.dir, "../../terminal/jobpilot.ico");
const ICO_SIZES = [16, 32, 48, 64, 128, 256];

async function rasterize(markup: string, px: number): Promise<Buffer> {
  // Supersample: librsvg at 1x antialiases the thin visor edge into mud.
  const density = Math.max(72, Math.round((72 * px * 4) / 100));
  return sharp(Buffer.from(markup), { density }).resize(px, px).png().toBuffer();
}

interface IcoImage {
  px: number;
  png: Buffer;
}

// PNG-in-ICO: a 6-byte header, one 16-byte entry per image, then the PNG bytes.
function icoFrom(images: IcoImage[]): Buffer {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    // ICO stores 256 as 0.
    header.writeUInt8(image.px % 256, entry);
    header.writeUInt8(image.px % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.png.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

// icon.svg is mostly the tab favicon, so it ships the small form.
await writeFile(resolve(PUBLIC_DIR, "icon.svg"), markSvg(100, { small: true }));
await writeFile(resolve(PUBLIC_DIR, "icon-maskable.svg"), markSvg(100, { bleed: true }));
await writeFile(resolve(PUBLIC_DIR, "icon-192.png"), await rasterize(markSvg(192), 192));
await writeFile(resolve(PUBLIC_DIR, "icon-512.png"), await rasterize(markSvg(512), 512));
// Android tints the badge from its alpha channel alone.
await writeFile(
  resolve(PUBLIC_DIR, "badge-96.png"),
  await rasterize(monoMarkSvg(96, "#FFFFFF"), 96),
);

const icoImages = await Promise.all(
  ICO_SIZES.map(async (px) => ({ px, png: await rasterize(markSvg(px, { small: px < 48 }), px) })),
);
await writeFile(TERMINAL_ICON, icoFrom(icoImages));
