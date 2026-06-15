/**
 * Encode a JavaScript string as base64 using UTF-8 bytes.
 *
 * Browser `btoa` only accepts binary strings, so this first converts the input
 * with TextEncoder to preserve non-ASCII terminal input correctly.
 */
export function toBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
