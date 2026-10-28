import type { CanvasStroke } from '@tmi/shared';

// ---------------------------------------------------------------------------
// A line of ink as a picture (Phase 54)
// ---------------------------------------------------------------------------
// The handwriting reader is given a picture of one line, never the strokes
// themselves: their order and shape describe how a person writes as well as
// what (think-aloud-canvas.md, "Send the least"). The picture is drawn here,
// from the strokes the canvas sent, so the web and the app send the same thing
// and the reader sees the same thing from both.
//
// Black ink on white, anti-aliased, cropped to the ink with a margin, and scaled
// so the writing is a size a vision model reads well -- about 90 px tall --
// whatever size it was written. A grey PNG of a line is a few KB, and a model
// counts it as roughly (width x height) / 750 tokens: a hundred or two.

export interface GrayImage {
  width: number;
  height: number;
  /** One byte a pixel, row by row: 0 is ink, 255 is paper. */
  pixels: Uint8Array;
}

export const LINE_IMAGE = {
  /** The ink's height in the picture, in pixels. */
  inkHeight: 90,
  /** Paper around the ink, in pixels. */
  padding: 16,
  /** A model scales anything larger down, so nothing larger is drawn. */
  maxWidth: 1568,
  maxHeight: 480,
  /** Never shrink small writing past half, nor blow it up past three times. */
  minScale: 0.5,
  maxScale: 3,
  /** The thinnest pen line drawn, in pixels, whatever the scale. */
  minPen: 2.4,
  /**
   * A line is measured as at least this tall (page units), so a lone minus
   * sign or a dot is not blown up to fill the picture.
   */
  minInkHeight: 40,
} as const;

/** One capsule of ink (a segment with round ends), blended by coverage into the picture. */
function capsule(image: GrayImage, ax: number, ay: number, bx: number, by: number, r: number): void {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1));
  const maxX = Math.min(image.width - 1, Math.ceil(Math.max(ax, bx) + r + 1));
  const minY = Math.max(0, Math.floor(Math.min(ay, by) - r - 1));
  const maxY = Math.min(image.height - 1, Math.ceil(Math.max(ay, by) + r + 1));
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const { pixels, width } = image;
  for (let y = minY; y <= maxY; y += 1) {
    const py = y + 0.5;
    for (let x = minX; x <= maxX; x += 1) {
      const px = x + 0.5;
      const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - py;
      const coverage = r + 0.5 - Math.sqrt(ex * ex + ey * ey);
      if (coverage <= 0) continue;
      const value = 255 - Math.round(255 * Math.min(1, coverage));
      const at = y * width + x;
      if (value < pixels[at]!) pixels[at] = value;
    }
  }
}

/** Draws one line's strokes (in the canvas's page units) as a picture, cropped to the ink. */
export function rasterizeLine(strokes: readonly CanvasStroke[], options = LINE_IMAGE): GrayImage {
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;
  for (const stroke of strokes) {
    const half = stroke.width / 2;
    for (let i = 0; i + 1 < stroke.points.length; i += 2) {
      left = Math.min(left, stroke.points[i]! - half);
      right = Math.max(right, stroke.points[i]! + half);
      top = Math.min(top, stroke.points[i + 1]! - half);
      bottom = Math.max(bottom, stroke.points[i + 1]! + half);
    }
  }
  if (!Number.isFinite(top)) return { width: 1, height: 1, pixels: new Uint8Array([255]) };

  // Centre a short line in a box of the minimum height, so a flat stroke keeps its size.
  const inkHeight = Math.max(bottom - top, options.minInkHeight);
  const middle = (top + bottom) / 2;
  top = middle - inkHeight / 2;
  const inkWidth = Math.max(right - left, 1);
  const pad = options.padding;
  const scale = Math.min(
    Math.max(options.inkHeight / inkHeight, options.minScale),
    options.maxScale,
    (options.maxWidth - 2 * pad) / inkWidth,
    (options.maxHeight - 2 * pad) / inkHeight,
  );
  const width = Math.max(1, Math.ceil(inkWidth * scale + 2 * pad));
  const height = Math.max(1, Math.ceil(inkHeight * scale + 2 * pad));
  const image: GrayImage = { width, height, pixels: new Uint8Array(width * height).fill(255) };
  const ox = pad - left * scale;
  const oy = pad - top * scale;

  for (const stroke of strokes) {
    const r = Math.max(options.minPen, stroke.width * scale) / 2;
    const p = stroke.points;
    if (p.length === 2) {
      capsule(image, ox + p[0]! * scale, oy + p[1]! * scale, ox + p[0]! * scale, oy + p[1]! * scale, r);
      continue;
    }
    for (let i = 0; i + 3 < p.length; i += 2) {
      capsule(image, ox + p[i]! * scale, oy + p[i + 1]! * scale, ox + p[i + 2]! * scale, oy + p[i + 3]! * scale, r);
    }
  }
  return image;
}

// ---------------------------------------------------------------------------
// PNG: 8-bit greyscale, no filter, deflated by the runtime's CompressionStream
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function zlibDeflate(bytes: Uint8Array): Promise<Uint8Array> {
  // 'deflate' is the zlib format (RFC 1950), which is what a PNG's IDAT holds.
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export async function encodePng(image: GrayImage): Promise<Uint8Array> {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, image.width);
  view.setUint32(4, image.height);
  header[8] = 8; // bit depth
  header[9] = 0; // colour type: greyscale
  // compression, filter and interlace methods: 0, 0, 0

  // Each row is its filter byte (0: none) and then its pixels.
  const raw = new Uint8Array((image.width + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) {
    raw.set(image.pixels.subarray(y * image.width, (y + 1) * image.width), y * (image.width + 1) + 1);
  }
  const parts = [PNG_SIGNATURE, chunk('IHDR', header), chunk('IDAT', await zlibDeflate(raw)), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Base64 of bytes, in chunks so a large picture does not overflow the argument list. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
