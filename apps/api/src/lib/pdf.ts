// A small PDF writer: pages of text in the standard Helvetica fonts, lines,
// boxes and vector strokes. Phase 38's assessment PDF is its first use; Phase
// 58's progress report adds rounded cards, paths, dots and one PNG image (the
// organization's logo), whose compressed data is passed straight through.
//
// Written by hand rather than taken from a library: a Worker on the free plan
// has 10 ms of CPU per request, and a document of text and paths needs no font
// embedding, no image decoding and no parser -- only objects, a cross-reference
// table and deflated page contents (the runtime's own CompressionStream). The
// standard fonts need nothing embedded; their text is WinAnsi, so characters
// outside it are spelled out (≤ as <=) or become '?'.

export type PdfFont = 'regular' | 'bold' | 'italic';

const FONT_RESOURCE: Record<PdfFont, string> = { regular: 'F1', bold: 'F2', italic: 'F3' };
const FONT_NAME: Record<PdfFont, string> = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique',
};

/** US Letter, in points. */
export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;

// Helvetica's advance widths (per 1000 units of the font size) for printable
// ASCII, from its AFM. Bold runs a little wider; 5% covers it for wrapping.
const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // space .. /
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 0 .. ?
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // @ .. O
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // P .. _
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // ` .. o
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, // p .. ~
];

// WinAnsi's codes above 127 that are not Latin-1's.
const WIN_ANSI_EXTRA: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88,
  '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93,
  '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b,
  'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};

// What a character outside WinAnsi is printed as.
const SPELLED_OUT: Record<string, string> = {
  '−': '-', '≤': '<=', '≥': '>=', '≠': '!=', 'π': 'pi', '√': 'sqrt', '≈': '~', '→': '->',
  '←': '<-', '↔': '<->', '∠': 'angle ', '△': 'triangle ', '□': 'square ', '≅': 'congruent to',
  '∥': '||', '⊥': 'perpendicular to', 'Δ': 'Delta', 'θ': 'theta', '∞': 'infinity', ' ': ' ',
  '\t': ' ',
};

/** A string as WinAnsi byte codes. */
export function toWinAnsi(text: string): number[] {
  const codes: number[] = [];
  for (const ch of text) {
    const spelled = SPELLED_OUT[ch];
    if (spelled !== undefined) {
      for (const c of spelled) codes.push(c.charCodeAt(0));
      continue;
    }
    const code = ch.codePointAt(0) ?? 63;
    if (code >= 32 && code <= 126) codes.push(code);
    else if (code >= 0xa0 && code <= 0xff) codes.push(code);
    else if (WIN_ANSI_EXTRA[ch] !== undefined) codes.push(WIN_ANSI_EXTRA[ch]);
    else codes.push(63); // '?'
  }
  return codes;
}

function codeWidth(code: number): number {
  return code >= 32 && code <= 126 ? HELVETICA_WIDTHS[code - 32]! : 556;
}

/** The width of a string in points. */
export function textWidth(text: string, size: number, font: PdfFont = 'regular'): number {
  let units = 0;
  for (const code of toWinAnsi(text)) units += codeWidth(code);
  return (units * size * (font === 'bold' ? 1.05 : 1)) / 1000;
}

/** Splits text into lines no wider than `width`; a word too long for a line is broken. */
export function wrapText(text: string, size: number, width: number, font: PdfFont = 'regular'): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/ +/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, font) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // A word wider than the line on its own is cut where it no longer fits.
      let rest = word;
      while (textWidth(rest, size, font) > width) {
        let cut = rest.length - 1;
        while (cut > 1 && textWidth(rest.slice(0, cut), size, font) > width) cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

/** A PDF literal string: the WinAnsi bytes, with ( ) \ and anything not ASCII escaped. */
function literal(text: string): string {
  let out = '(';
  for (const code of toWinAnsi(text)) {
    if (code === 40 || code === 41 || code === 92) out += `\\${String.fromCharCode(code)}`;
    else if (code < 32 || code > 126) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += String.fromCharCode(code);
  }
  return `${out})`;
}

/** A number as PDF writes it: at most two decimals, no exponent. */
function n(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

export type Rgb = readonly [number, number, number];

function rgb(color: Rgb, operator: 'rg' | 'RG'): string {
  return `${n(color[0])} ${n(color[1])} ${n(color[2])} ${operator}`;
}

/** A closed path filled and/or stroked. */
function paintPath(path: string, options: { fill?: Rgb; stroke?: Rgb; lineWidth?: number }): string {
  const parts = ['q'];
  if (options.fill) parts.push(rgb(options.fill, 'rg'));
  if (options.stroke) parts.push(`${rgb(options.stroke, 'RG')} ${n(options.lineWidth ?? 0.75)} w`);
  const paint = options.fill && options.stroke ? 'B' : options.fill ? 'f' : 'S';
  parts.push(path, paint, 'Q');
  return parts.join(' ');
}

/** One page's drawing operators. Coordinates are points from the bottom left. */
export class PdfPage {
  readonly ops: string[] = [];

  text(x: number, y: number, text: string, size: number, font: PdfFont = 'regular', color: Rgb = [0, 0, 0]): void {
    this.ops.push(
      `BT ${n(color[0])} ${n(color[1])} ${n(color[2])} rg /${FONT_RESOURCE[font]} ${n(size)} Tf ${n(x)} ${n(y)} Td ${literal(text)} Tj ET`,
    );
  }

  /** A filled and/or stroked rectangle; (x, y) is its bottom-left corner. */
  rect(x: number, y: number, width: number, height: number, options: { fill?: Rgb; stroke?: Rgb; lineWidth?: number }): void {
    const parts = ['q'];
    if (options.fill) parts.push(`${n(options.fill[0])} ${n(options.fill[1])} ${n(options.fill[2])} rg`);
    if (options.stroke) {
      parts.push(`${n(options.stroke[0])} ${n(options.stroke[1])} ${n(options.stroke[2])} RG ${n(options.lineWidth ?? 0.75)} w`);
    }
    const paint = options.fill && options.stroke ? 'B' : options.fill ? 'f' : 'S';
    parts.push(`${n(x)} ${n(y)} ${n(width)} ${n(height)} re ${paint}`, 'Q');
    this.ops.push(parts.join(' '));
  }

  line(x1: number, y1: number, x2: number, y2: number, color: Rgb, lineWidth = 0.75): void {
    this.ops.push(
      `q ${n(color[0])} ${n(color[1])} ${n(color[2])} RG ${n(lineWidth)} w ${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S Q`,
    );
  }

  /** A path through points, stroked: a chart's line. `dash` is [on, off] in points. */
  polyline(
    points: readonly (readonly [number, number])[],
    color: Rgb,
    lineWidth = 1,
    options: { dash?: readonly [number, number]; closeFill?: Rgb } = {},
  ): void {
    if (points.length < 2) return;
    const path = points.map(([x, y], index) => `${n(x)} ${n(y)} ${index === 0 ? 'm' : 'l'}`).join(' ');
    if (options.closeFill) {
      this.ops.push(`q ${rgb(options.closeFill, 'rg')} ${path} h f Q`);
      return;
    }
    const dash = options.dash ? `[${n(options.dash[0])} ${n(options.dash[1])}] 0 d ` : '';
    this.ops.push(`q ${rgb(color, 'RG')} ${n(lineWidth)} w 1 J 1 j ${dash}${path} S Q`);
  }

  /** A dashed straight line. */
  dashedLine(x1: number, y1: number, x2: number, y2: number, color: Rgb, lineWidth = 0.75, dash: readonly [number, number] = [3, 3]): void {
    this.polyline([[x1, y1], [x2, y2]], color, lineWidth, { dash });
  }

  /** A rectangle with rounded corners (Bezier quarter circles); (x, y) is its bottom-left corner. */
  roundedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    options: { fill?: Rgb; stroke?: Rgb; lineWidth?: number },
  ): void {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    const k = r * 0.5523; // the control distance that makes a Bezier a quarter circle
    const right = x + width;
    const top = y + height;
    const path = [
      `${n(x + r)} ${n(y)} m`,
      `${n(right - r)} ${n(y)} l`,
      `${n(right - r + k)} ${n(y)} ${n(right)} ${n(y + r - k)} ${n(right)} ${n(y + r)} c`,
      `${n(right)} ${n(top - r)} l`,
      `${n(right)} ${n(top - r + k)} ${n(right - r + k)} ${n(top)} ${n(right - r)} ${n(top)} c`,
      `${n(x + r)} ${n(top)} l`,
      `${n(x + r - k)} ${n(top)} ${n(x)} ${n(top - r + k)} ${n(x)} ${n(top - r)} c`,
      `${n(x)} ${n(y + r)} l`,
      `${n(x)} ${n(y + r - k)} ${n(x + r - k)} ${n(y)} ${n(x + r)} ${n(y)} c`,
      'h',
    ].join(' ');
    this.ops.push(paintPath(path, options));
  }

  /** A circle: a chart's dot. */
  circle(cx: number, cy: number, radius: number, options: { fill?: Rgb; stroke?: Rgb; lineWidth?: number }): void {
    const r = radius;
    const k = r * 0.5523;
    const path = [
      `${n(cx + r)} ${n(cy)} m`,
      `${n(cx + r)} ${n(cy + k)} ${n(cx + k)} ${n(cy + r)} ${n(cx)} ${n(cy + r)} c`,
      `${n(cx - k)} ${n(cy + r)} ${n(cx - r)} ${n(cy + k)} ${n(cx - r)} ${n(cy)} c`,
      `${n(cx - r)} ${n(cy - k)} ${n(cx - k)} ${n(cy - r)} ${n(cx)} ${n(cy - r)} c`,
      `${n(cx + k)} ${n(cy - r)} ${n(cx + r)} ${n(cy - k)} ${n(cx + r)} ${n(cy)} c`,
      'h',
    ].join(' ');
    this.ops.push(paintPath(path, options));
  }

  /** Text whose right edge is at `x`. */
  textRight(x: number, y: number, text: string, size: number, font: PdfFont = 'regular', color: Rgb = [0, 0, 0]): void {
    this.text(x - textWidth(text, size, font), y, text, size, font, color);
  }

  /** Text centred on `x`. */
  textCentered(x: number, y: number, text: string, size: number, font: PdfFont = 'regular', color: Rgb = [0, 0, 0]): void {
    this.text(x - textWidth(text, size, font) / 2, y, text, size, font, color);
  }

  /** An image added to the document (`PdfDocument.addImage`), drawn into the box with (x, y) its bottom-left corner. */
  image(name: string, x: number, y: number, width: number, height: number): void {
    this.ops.push(`q ${n(width)} 0 0 ${n(height)} ${n(x)} ${n(y)} cm /${name} Do Q`);
  }

  /**
   * Freehand strokes, given in a canvas's own units (y down from its top
   * left), drawn scaled by `scale` with the canvas's top-left corner at
   * (left, top) on the page. Each stroke is its width then x,y pairs; a stroke
   * of one point is a dot, which round caps draw.
   */
  strokes(strokes: readonly { width: number; points: readonly number[] }[], left: number, top: number, scale: number, color: Rgb): void {
    if (strokes.length === 0) return;
    const out: string[] = [
      'q',
      `${n(color[0])} ${n(color[1])} ${n(color[2])} RG 1 J 1 j`,
      // Flip y and scale once, so the points are written exactly as drawn.
      `${n(scale)} 0 0 ${n(-scale)} ${n(left)} ${n(top)} cm`,
    ];
    for (const stroke of strokes) {
      const p = stroke.points;
      if (p.length < 2) continue;
      out.push(`${stroke.width} w ${p[0]} ${p[1]} m`);
      if (p.length === 2) out.push(`${p[0]} ${p[1]} l`);
      for (let i = 2; i < p.length; i += 2) out.push(`${p[i]} ${p[i + 1]} l`);
      out.push('S');
    }
    out.push('Q');
    this.ops.push(out.join('\n'));
  }
}

const encoder = new TextEncoder();

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---------------------------------------------------------------------------
// Images: a PNG, for an organization's logo (Phase 58)
// ---------------------------------------------------------------------------
// A PNG's IDAT is a zlib stream of filtered scanlines, which is exactly what
// PDF's FlateDecode with the PNG predictor (15) reads -- so an opaque PNG goes
// in untouched. Transparency is the one thing PDF keeps apart: an alpha
// channel becomes a soft mask, which means inflating, undoing the scanline
// filters and splitting colour from alpha once. Interlaced and 16-bit PNGs are
// refused (null): the caller draws the organization's name instead.

/** An image ready to be written as an XObject. */
export interface PdfImage {
  width: number;
  height: number;
  /** A PDF colour space: `/DeviceRGB`, `/DeviceGray` or an `[/Indexed ...]` array. */
  colorSpace: string;
  bitsPerComponent: number;
  /** The stream's bytes, FlateDecode-compressed. */
  data: Uint8Array;
  /** `/DecodeParms` for a PNG-predicted stream, or undefined for raw samples. */
  decodeParms?: string;
  /** The alpha channel as an 8-bit gray soft mask, deflated, raw samples. */
  smask?: Uint8Array;
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function uint32(bytes: Uint8Array, at: number): number {
  return ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0;
}

/** Undoes PNG's five scanline filters in place, returning the unfiltered rows without their filter bytes. */
function unfilter(raw: Uint8Array, rowBytes: number, height: number, bpp: number): Uint8Array | null {
  if (raw.length < (rowBytes + 1) * height) return null;
  const out = new Uint8Array(rowBytes * height);
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (rowBytes + 1)]!;
    const src = row * (rowBytes + 1) + 1;
    const dst = row * rowBytes;
    const prev = dst - rowBytes; // the row above, already unfiltered
    for (let i = 0; i < rowBytes; i += 1) {
      const x = raw[src + i]!;
      const a = i >= bpp ? out[dst + i - bpp]! : 0;
      const b = row > 0 ? out[prev + i]! : 0;
      let value: number;
      switch (filter) {
        case 0: value = x; break;
        case 1: value = x + a; break;
        case 2: value = x + b; break;
        case 3: value = x + ((a + b) >> 1); break;
        case 4: {
          const c = row > 0 && i >= bpp ? out[prev + i - bpp]! : 0;
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          value = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          return null;
      }
      out[dst + i] = value & 0xff;
    }
  }
  return out;
}

/**
 * A PNG as a PDF image, or null when it is not one this writer takes
 * (not a PNG, interlaced, 16-bit, or damaged). Never throws.
 */
export async function pngToPdfImage(input: ArrayBuffer | Uint8Array): Promise<PdfImage | null> {
  try {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.length < 33 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) return null;

    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = -1;
    let interlace = 0;
    let palette: Uint8Array | null = null;
    let transparency: Uint8Array | null = null;
    const idat: Uint8Array[] = [];
    let idatLength = 0;

    for (let at = 8; at + 8 <= bytes.length; ) {
      const length = uint32(bytes, at);
      const type = String.fromCharCode(bytes[at + 4]!, bytes[at + 5]!, bytes[at + 6]!, bytes[at + 7]!);
      const data = bytes.subarray(at + 8, at + 8 + length);
      if (data.length !== length) return null;
      if (type === 'IHDR') {
        width = uint32(data, 0);
        height = uint32(data, 4);
        bitDepth = data[8]!;
        colorType = data[9]!;
        interlace = data[12]!;
      } else if (type === 'PLTE') palette = data;
      else if (type === 'tRNS') transparency = data;
      else if (type === 'IDAT') {
        idat.push(data);
        idatLength += data.length;
      } else if (type === 'IEND') break;
      at += 12 + length;
    }

    if (!width || !height || width > 4096 || height > 4096 || interlace !== 0 || idat.length === 0) return null;
    if (bitDepth === 16 || ![0, 2, 3, 4, 6].includes(colorType)) return null;
    if ((colorType === 4 || colorType === 6) && bitDepth !== 8) return null;
    if (colorType === 3 && !palette) return null;

    const stream = new Uint8Array(idatLength);
    let offset = 0;
    for (const chunk of idat) {
      stream.set(chunk, offset);
      offset += chunk.length;
    }

    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType as 0 | 2 | 3 | 4 | 6];
    const colorChannels = colorType === 0 || colorType === 4 ? 1 : colorType === 3 ? 1 : 3;
    const device = colorType === 0 || colorType === 4 ? '/DeviceGray' : '/DeviceRGB';
    const colorSpace =
      colorType === 3
        ? `[/Indexed /DeviceRGB ${palette!.length / 3 - 1} <${[...palette!].map((b) => b.toString(16).padStart(2, '0')).join('')}>]`
        : device;
    const predictor = (colors: number, bits: number) =>
      `<< /Predictor 15 /Colors ${colors} /BitsPerComponent ${bits} /Columns ${width} >>`;

    const needsMask = colorType === 4 || colorType === 6 || (colorType === 3 && transparency !== null);
    if (!needsMask) {
      // Opaque (a gray or RGB colour-key tRNS is ignored: a logo's background shows).
      return {
        width,
        height,
        colorSpace,
        bitsPerComponent: bitDepth,
        data: stream,
        decodeParms: predictor(colorChannels, bitDepth),
      };
    }

    const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
    const bpp = Math.max(1, (channels * bitDepth) >> 3);
    const pixels = unfilter(await inflate(stream), rowBytes, height, bpp);
    if (!pixels) return null;

    const alpha = new Uint8Array(width * height);
    if (colorType === 3) {
      // The palette's colours pass through as they were; the alpha comes from tRNS by index.
      const perByte = 8 / bitDepth;
      const mask = (1 << bitDepth) - 1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const byte = pixels[y * rowBytes + Math.floor(x / perByte)]!;
          const index = (byte >> ((perByte - 1 - (x % perByte)) * bitDepth)) & mask;
          alpha[y * width + x] = index < transparency!.length ? transparency![index]! : 255;
        }
      }
      return {
        width,
        height,
        colorSpace,
        bitsPerComponent: bitDepth,
        data: stream,
        decodeParms: predictor(1, bitDepth),
        smask: await deflate(alpha),
      };
    }

    const color = new Uint8Array(width * height * colorChannels);
    const count = width * height;
    if (colorType === 6) {
      for (let i = 0, c = 0; i < count; i += 1, c += 3) {
        const p = i * 4;
        color[c] = pixels[p]!;
        color[c + 1] = pixels[p + 1]!;
        color[c + 2] = pixels[p + 2]!;
        alpha[i] = pixels[p + 3]!;
      }
    } else {
      for (let i = 0; i < count; i += 1) {
        color[i] = pixels[i * 2]!;
        alpha[i] = pixels[i * 2 + 1]!;
      }
    }
    const [colorData, alphaData] = await Promise.all([deflate(color), deflate(alpha)]);
    return { width, height, colorSpace: device, bitsPerComponent: 8, data: colorData, smask: alphaData };
  } catch {
    return null;
  }
}

/** A whole document: pages in order, then `save()`. */
export class PdfDocument {
  private readonly pages: PdfPage[] = [];
  private readonly images: PdfImage[] = [];

  constructor(private readonly title: string) {}

  addPage(): PdfPage {
    const page = new PdfPage();
    this.pages.push(page);
    return page;
  }

  /** Adds an image once, returning the name a page draws it by (`page.image(name, ...)`). */
  addImage(image: PdfImage): string {
    this.images.push(image);
    return `Im${this.images.length}`;
  }

  get pageCount(): number {
    return this.pages.length;
  }

  /** The pages so far, in order: for drawing a footer that counts them once the last exists. */
  get allPages(): readonly PdfPage[] {
    return this.pages;
  }

  async save(): Promise<Uint8Array> {
    const chunks: Uint8Array[] = [];
    const offsets: number[] = [];
    let length = 0;
    const push = (chunk: Uint8Array | string) => {
      const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
      chunks.push(bytes);
      length += bytes.length;
    };
    const object = (id: number, body: string) => {
      offsets[id] = length;
      push(`${id} 0 obj\n${body}\nendobj\n`);
    };
    const streamObject = (id: number, dictionary: string, data: Uint8Array) => {
      offsets[id] = length;
      push(`${id} 0 obj\n<< ${dictionary ? `${dictionary} ` : ''}/Length ${data.length} /Filter /FlateDecode >>\nstream\n`);
      push(data);
      push('\nendstream\nendobj\n');
    };

    // 1 catalog, 2 page tree, 3-5 fonts, 6 info; then each page and its
    // contents; then each image (and its soft mask, when it has one).
    const firstPage = 7;
    const pageIds = this.pages.map((_, index) => firstPage + index * 2);
    let nextId = firstPage + this.pages.length * 2;
    const imageIds = this.images.map((image) => {
      const id = nextId;
      nextId += image.smask ? 2 : 1;
      return id;
    });
    const xObjects = this.images.length
      ? ` /XObject << ${imageIds.map((id, index) => `/Im${index + 1} ${id} 0 R`).join(' ')} >>`
      : '';

    // The header's second line carries bytes above 127, as the format asks of a
    // file with binary streams (these letters' UTF-8 is all high bytes).
    push('%PDF-1.4\n%âãÏÓ\n');
    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    object(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
    (['regular', 'bold', 'italic'] as const).forEach((font, index) => {
      object(3 + index, `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_NAME[font]} /Encoding /WinAnsiEncoding >>`);
    });
    object(6, `<< /Title ${literal(this.title)} /Producer (Aimtrue) >>`);

    for (const [index, page] of this.pages.entries()) {
      const pageId = pageIds[index]!;
      const contentId = pageId + 1;
      object(
        pageId,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>${xObjects} >> /Contents ${contentId} 0 R >>`,
      );
      streamObject(contentId, '', await deflate(encoder.encode(page.ops.join('\n'))));
    }

    for (const [index, image] of this.images.entries()) {
      const id = imageIds[index]!;
      const common = `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height}`;
      streamObject(
        id,
        `${common} /ColorSpace ${image.colorSpace} /BitsPerComponent ${image.bitsPerComponent}` +
          (image.decodeParms ? ` /DecodeParms ${image.decodeParms}` : '') +
          (image.smask ? ` /SMask ${id + 1} 0 R` : ''),
        image.data,
      );
      if (image.smask) streamObject(id + 1, `${common} /ColorSpace /DeviceGray /BitsPerComponent 8`, image.smask);
    }

    const count = nextId;
    const xref = length;
    push(`xref\n0 ${count}\n0000000000 65535 f \n`);
    for (let id = 1; id < count; id += 1) push(`${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`);
    push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

    const out = new Uint8Array(length);
    let at = 0;
    for (const chunk of chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
}
