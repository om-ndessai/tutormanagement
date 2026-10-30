import { inflateSync } from 'node:zlib';

/**
 * The text drawn on the pages of one of our own PDFs (lib/pdf.ts): each page's
 * content stream is deflated, so it is inflated here. Image streams (a logo)
 * are left out -- their bytes are pixels, not text.
 */
export function pdfPageText(bytes: Buffer): string {
  const text = bytes.toString('latin1');
  let out = '';
  for (const match of text.matchAll(/obj\n<< (\/Type \/XObject[^>]*)?\/Length (\d+) \/Filter \/FlateDecode >>\nstream\n/g)) {
    if (match[1]) continue;
    const start = match.index! + match[0].length;
    out += inflateSync(bytes.subarray(start, start + Number(match[2]))).toString('latin1');
  }
  return out;
}

/** The strings a page shows, from its `(...) Tj` operators, escapes undone. */
export function pdfStrings(bytes: Buffer): string[] {
  return [...pdfPageText(bytes).matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((m) =>
    m[1]!.replace(/\\([0-7]{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))).replace(/\\(.)/g, '$1'),
  );
}
