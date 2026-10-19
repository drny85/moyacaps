/**
 * Pure image-header parsing. Shared by the Convex upload check and the admin client
 * preflight, so it works on bytes only: no Convex, Node or DOM imports.
 */
export type ImageFormat = "png" | "jpeg" | "webp";
export type ImageHeader = { format: ImageFormat; width: number; height: number; hasAlpha: boolean };

/** Callers need at most this many leading bytes. */
const MAX_HEADER_BYTES = 64 * 1024;

const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u24le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
const u32le = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

function ascii(b: Uint8Array, o: number, s: string): boolean {
  if (o + s.length > b.length) return false;
  for (let i = 0; i < s.length; i++) if (b[o + i] !== s.charCodeAt(i)) return false;
  return true;
}

function build(format: ImageFormat, width: number, height: number, hasAlpha: boolean): ImageHeader | null {
  return width > 0 && height > 0 ? { format, width, height, hasAlpha } : null;
}

function readPng(b: Uint8Array): ImageHeader | null {
  if (b.length < 26 || !ascii(b, 12, "IHDR")) return null;
  const colourType = b[25];
  let hasAlpha = colourType === 4 || colourType === 6;
  // Chunks follow the 8-byte signature and the 25-byte IHDR chunk.
  let o = 33;
  while (!hasAlpha && o + 8 <= b.length) {
    if (ascii(b, o + 4, "tRNS")) hasAlpha = true;
    else if (ascii(b, o + 4, "IDAT")) break;
    o += 12 + u32be(b, o);
  }
  return build("png", u32be(b, 16), u32be(b, 20), hasAlpha);
}

function readJpeg(b: Uint8Array): ImageHeader | null {
  let i = 2;
  while (i + 1 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) { i++; continue; } // fill byte
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { i += 2; continue; } // no length
    if (marker === 0xda) return null; // start of scan before any SOF
    if (marker >= 0xc0 && marker <= 0xc2) {
      if (i + 9 > b.length) return null;
      return build("jpeg", u16be(b, i + 7), u16be(b, i + 5), false);
    }
    if (i + 4 > b.length) return null;
    const len = u16be(b, i + 2);
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

function readWebp(b: Uint8Array): ImageHeader | null {
  if (b.length < 21 || !ascii(b, 0, "RIFF") || !ascii(b, 8, "WEBP")) return null;
  const d = 20; // first chunk data
  if (ascii(b, 12, "VP8X")) {
    if (b.length < d + 10) return null;
    return build("webp", u24le(b, d + 4) + 1, u24le(b, d + 7) + 1, (b[d] & 0x10) !== 0);
  }
  if (ascii(b, 12, "VP8L")) {
    if (b.length < d + 5 || b[d] !== 0x2f) return null;
    const v = u32le(b, d + 1);
    return build("webp", (v & 0x3fff) + 1, ((v >>> 14) & 0x3fff) + 1, ((v >>> 28) & 1) === 1);
  }
  if (ascii(b, 12, "VP8 ")) {
    if (b.length < d + 10) return null;
    return build("webp", (b[d + 6] | (b[d + 7] << 8)) & 0x3fff, (b[d + 8] | (b[d + 9] << 8)) & 0x3fff, false);
  }
  return null;
}

/** Returns null for anything unparseable: truncated, GIF, garbage, zero dimensions. */
export function readImageHeader(bytes: Uint8Array): ImageHeader | null {
  const b = bytes.length > MAX_HEADER_BYTES ? bytes.subarray(0, MAX_HEADER_BYTES) : bytes;
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, "PNG")) return readPng(b);
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) return readJpeg(b);
  return readWebp(b);
}
