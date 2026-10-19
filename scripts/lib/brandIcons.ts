/**
 * Pure helpers for scripts/build-brand-icons.ts: ICO packing and the full-bleed variant of the
 * logo. No sharp or file I/O here, so both are unit-testable.
 */

export type IcoFrame = { size: number; png: Uint8Array };

const HEADER_BYTES = 6;
const ENTRY_BYTES = 16;

/**
 * Packs PNG frames into one .ico file. Modern ICO readers (every browser, Windows Vista+) accept
 * PNG-compressed entries, so each frame is stored as-is rather than re-encoded as a BMP.
 */
export function encodeIco(frames: IcoFrame[]): Uint8Array {
  if (frames.length === 0) throw new Error("encodeIco needs at least one frame");
  for (const { size } of frames) {
    if (!Number.isInteger(size) || size < 1 || size > 256) throw new Error(`ICO frame size out of range: ${size}`);
  }

  const dataStart = HEADER_BYTES + ENTRY_BYTES * frames.length;
  const total = dataStart + frames.reduce((sum, f) => sum + f.png.byteLength, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, frames.length, true);

  let offset = dataStart;
  frames.forEach((frame, i) => {
    const entry = HEADER_BYTES + ENTRY_BYTES * i;
    const dim = frame.size === 256 ? 0 : frame.size; // 0 means 256
    view.setUint8(entry, dim);
    view.setUint8(entry + 1, dim);
    view.setUint8(entry + 2, 0); // palette colours
    view.setUint8(entry + 3, 0); // reserved
    view.setUint16(entry + 4, 1, true); // colour planes
    view.setUint16(entry + 6, 32, true); // bits per pixel
    view.setUint32(entry + 8, frame.png.byteLength, true);
    view.setUint32(entry + 12, offset, true);
    out.set(frame.png, offset);
    offset += frame.png.byteLength;
  });
  return out;
}

/**
 * The logo with square corners. iOS and most logo consumers (Google's Organization logo) apply
 * their own mask, so a pre-rounded tile would show its transparent corners as black wedges.
 */
export function fullBleed(svg: string): string {
  const next = svg.replace(/(<rect\b[^>]*?)\s+rx="[^"]*"/, "$1");
  if (next === svg) throw new Error("fullBleed: no rounded background <rect> found in the logo SVG");
  return next;
}
