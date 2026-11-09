import { accent, line, markEye, surfaces } from "@/theme/palette";

// The one source of the brand mark. `bun run brand:icons` regenerates public/ and the terminal .ico.

interface MarkOptions {
  /** Under 48px: drops the antenna and glow, enlarges the eyes. */
  small?: boolean;
  /** Full-bleed tile with the face inside the maskable safe zone. */
  bleed?: boolean;
}

const J_PATH = "M46 52H66M66 52V67C66 77 57.5 83 47.5 83C40.5 83 35 80 31.5 74";
const TILE = `x="3" y="3" width="94" height="94" rx="24"`;

function pill(x: number, y: number, width: number, height: number): string {
  const r = height / 2;
  return `M${x + r} ${y}H${x + width - r}A${r} ${r} 0 0 1 ${x + width - r} ${y + height}H${x + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

function dot(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
}

function face(small: boolean): string {
  const eyeRadius = small ? 7.5 : 6.5;
  const eyes = `${dot(36, 30.5, eyeRadius)}${dot(64, 30.5, eyeRadius)}`;
  const antenna = small
    ? ""
    : `<path d="M50 19V13" stroke="${accent.primary}" stroke-width="4.5" stroke-linecap="round"/><circle cx="50" cy="10" r="4" fill="${markEye}"/>`;
  return `${antenna}<path d="${pill(18, 20, 64, 21)}" fill="${surfaces.base}" stroke="${line.borderHi}" stroke-width="2"/><path d="${eyes}" fill="${markEye}"/><path d="${J_PATH}" fill="none" stroke="${accent.primary}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export function markSvg(px: number, options: MarkOptions = {}): string {
  const { small = false, bleed = false } = options;
  const shape = bleed ? `width="100" height="100"` : TILE;
  const border = bleed ? "" : ` stroke="${line.borderHi}" stroke-width="1.5"`;
  const ember = small ? "" : `<rect ${shape} fill="url(#ember)"/>`;
  const content = bleed
    ? `<g transform="translate(50 50) scale(0.8) translate(-50 -48)">${face(small)}</g>`
    : face(small);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100"><defs><linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${surfaces.elevated}"/><stop offset="1" stop-color="${surfaces.base}"/></linearGradient><radialGradient id="ember" cx="0.5" cy="0.95" r="0.65"><stop offset="0" stop-color="${accent.primary}" stop-opacity="0.22"/><stop offset="1" stop-color="${accent.primary}" stop-opacity="0"/></radialGradient></defs><rect ${shape} fill="url(#tile)"${border}/>${ember}${content}</svg>`;
}

/** The single-color mark is the J alone: the face turns to noise at badge sizes. */
export function monoMarkSvg(px: number, ink: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100"><path d="${J_PATH}" transform="translate(50 50) scale(1.55) translate(-48.75 -67.5)" fill="none" stroke="${ink}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Base64: resvg fails the `;utf8,` form ("svgload_buffer"). ASCII-only markup, so btoa is safe. */
export function markDataUri(px: number, options: MarkOptions = {}): string {
  return `data:image/svg+xml;base64,${btoa(markSvg(px, options))}`;
}
