// Raw SVG string of the JobPilot mark, for raster targets (next/og apple-icon + opengraph-image)
// that need a data-URI <img>. Mirrors jobpilot-mark.tsx / public/icon.svg. `bleed` fills the whole
// square (for iOS's own mask); otherwise a rounded carbon tile with the blue halo.

const FACE = `
  <line x1="50" y1="16" x2="50" y2="9.5" stroke="#FF6A3D" stroke-width="3.2" stroke-linecap="round"/>
  <circle cx="50" cy="7" r="3" fill="#6FA8FF"/>
  <rect x="21" y="26" width="58" height="17" rx="8.5" fill="#0C0D13" stroke="#23252F" stroke-width="1.4"/>
  <circle cx="37" cy="34.5" r="5.6" fill="url(#ey)"/>
  <circle cx="63" cy="34.5" r="5.6" fill="url(#ey)"/>
  <circle cx="35" cy="32.5" r="1.7" fill="#FFFFFF" fill-opacity="0.85"/>
  <circle cx="61" cy="32.5" r="1.7" fill="#FFFFFF" fill-opacity="0.85"/>
  <path d="M45 53 L67 53" fill="none" stroke="url(#fl)" stroke-width="13" stroke-linecap="round"/>
  <path d="M63 53 L63 70 C63 80 54 86 44 86 C37 86 32 83 29 77" fill="none" stroke="url(#fl)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`;

const DEFS = `
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#191A22"/><stop offset="1" stop-color="#0B0B0A"/></linearGradient>
  <linearGradient id="fl" x1="0.15" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="#FF8A5C"/><stop offset="0.55" stop-color="#FF6A3D"/><stop offset="1" stop-color="#D9532A"/></linearGradient>
  <radialGradient id="cr" cx="0.5" cy="0.12" r="0.7"><stop offset="0" stop-color="#4C8DFF" stop-opacity="0.32"/><stop offset="1" stop-color="#4C8DFF" stop-opacity="0"/></radialGradient>
  <radialGradient id="em" cx="0.5" cy="0.85" r="0.6"><stop offset="0" stop-color="#FF6A3D" stop-opacity="0.32"/><stop offset="1" stop-color="#FF6A3D" stop-opacity="0"/></radialGradient>
  <radialGradient id="ey" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="#CFE0FF"/><stop offset="1" stop-color="#6FA8FF"/></radialGradient>`;

function markSvg(px: number, opts: { bleed?: boolean } = {}): string {
  const bleed = opts.bleed ?? false;
  const frame = bleed
    ? `<rect width="100" height="100" fill="url(#bg)"/><rect width="100" height="100" fill="url(#cr)"/><rect width="100" height="100" fill="url(#em)"/>`
    : `<rect x="3" y="3" width="94" height="94" rx="24" fill="url(#bg)" stroke="#3A3B44" stroke-width="1.5"/><rect x="3" y="3" width="94" height="94" rx="24" fill="url(#cr)"/><rect x="3" y="3" width="94" height="94" rx="24" fill="url(#em)"/>`;
  const face = bleed
    ? `<g transform="translate(50 50) scale(0.82) translate(-50 -48)">${FACE}</g>`
    : FACE;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100"><defs>${DEFS}</defs>${frame}${face}</svg>`;
}

/** Base64 `data:` URI for <img src>. next/og's resvg loads base64 SVGs reliably; the `;utf8,`
 *  form fails with "svgload_buffer: SVG rendering failed". ASCII-only markup, so btoa is safe. */
export function markDataUri(px: number, opts: { bleed?: boolean } = {}): string {
  return `data:image/svg+xml;base64,${btoa(markSvg(px, opts))}`;
}
