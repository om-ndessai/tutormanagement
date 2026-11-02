// Phase 62 (P7): the lobby's QR code, drawn with Views from the pure-JS `qrcode` matrix. Every dark
// module is drawn, once, and nothing else; a longer text makes a larger symbol.
import { render, screen } from '@testing-library/react-native';
import { create } from 'qrcode';

import { QrCode, qrRows } from './qr-code';

const TEXT = 'http://localhost:8787/?code=ABC234';

describe('qrRows', () => {
  it('holds exactly the dark modules of the matrix, as runs', () => {
    const { modules } = create(TEXT, { errorCorrectionLevel: 'M' });
    const { size, rows } = qrRows(TEXT);
    expect(size).toBe(modules.size);
    expect(rows).toHaveLength(size);
    for (let y = 0; y < size; y++) {
      const drawn = new Array<boolean>(size).fill(false);
      for (const [x, length] of rows[y]!) {
        expect(length).toBeGreaterThan(0);
        for (let i = x; i < x + length; i++) drawn[i] = true;
      }
      for (let x = 0; x < size; x++) expect(drawn[x]).toBe(Boolean(modules.get(y, x)));
    }
  });

  it('starts with the finder pattern: a run of seven in the first row', () => {
    const { rows } = qrRows('ABC234');
    expect(rows[0]![0]).toEqual([0, 7]);
    expect(qrRows('ABC234').size).toBeLessThan(qrRows(`${TEXT}&more=${'x'.repeat(60)}`).size);
  });
});

describe('QrCode', () => {
  it('draws one View per run in whole points, labelled for a screen reader', async () => {
    await render(
      <QrCode testID="qr" text={TEXT} size={150} accessibilityLabel="QR code for game A B C 2 3 4" />,
    );
    const qr = screen.getByTestId('qr');
    expect(qr.props.accessibilityLabel).toBe('QR code for game A B C 2 3 4');
    const { size, rows } = qrRows(TEXT);
    const cell = Math.floor(150 / (size + 4));
    expect(qr.props.style).toMatchObject({ width: cell * (size + 4), height: cell * (size + 4) });
    const runs = rows.reduce((n, row) => n + row.length, 0);
    const rowViews = qr.children as unknown as { children: unknown[] }[];
    expect(rowViews).toHaveLength(size);
    expect(rowViews.reduce((n, row) => n + row.children.length, 0)).toBe(runs);
  });
});
