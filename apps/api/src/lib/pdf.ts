// A small PDF writer: pages of text in the standard Helvetica fonts, lines,
// boxes and vector strokes. Phase 38's assessment PDF is its first use.
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

/** A whole document: pages in order, then `save()`. */
export class PdfDocument {
  private readonly pages: PdfPage[] = [];

  constructor(private readonly title: string) {}

  addPage(): PdfPage {
    const page = new PdfPage();
    this.pages.push(page);
    return page;
  }

  get pageCount(): number {
    return this.pages.length;
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

    // 1 catalog, 2 page tree, 3-5 fonts, 6 info; then each page and its contents.
    const firstPage = 7;
    const pageIds = this.pages.map((_, index) => firstPage + index * 2);

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
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`,
      );
      const content = await deflate(encoder.encode(page.ops.join('\n')));
      offsets[contentId] = length;
      push(`${contentId} 0 obj\n<< /Length ${content.length} /Filter /FlateDecode >>\nstream\n`);
      push(content);
      push('\nendstream\nendobj\n');
    }

    const count = firstPage + this.pages.length * 2;
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
