import { bytesToBase64 } from '@/lib/base64';

describe('bytesToBase64', () => {
  it('matches Node for every padding case', () => {
    for (const text of ['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar']) {
      const bytes = new Uint8Array(Buffer.from(text));
      expect(bytesToBase64(bytes)).toBe(Buffer.from(text).toString('base64'));
    }
  });

  it('matches Node on every byte value and on a PDF-sized buffer', () => {
    const all = new Uint8Array(256).map((_, i) => i);
    expect(bytesToBase64(all)).toBe(Buffer.from(all).toString('base64'));
    const big = new Uint8Array(200_003).map((_, i) => (i * 7919) % 256);
    expect(bytesToBase64(big)).toBe(Buffer.from(big).toString('base64'));
  });
});
