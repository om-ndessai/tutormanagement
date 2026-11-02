// Phase 62 (P7, docs/stickiness-plan.md): the lobby's QR code, as the web's LobbyInvite draws one with
// `qrcode`. Mobile: the pure-JS `qrcode` package's matrix (`create`), drawn with Views -- one View per
// run of dark modules in a row -- so no native module and no rebuild of the dev client is needed.
import { create } from 'qrcode';
import { useMemo } from 'react';
import { View } from 'react-native';

import { QR_CODE } from '@/theme/brand-art';

/** One row's dark runs: [first module, length]. */
export type QrRow = [number, number][];

/** The QR code of `text` as rows of dark runs, and its size in modules (without the quiet zone). */
export function qrRows(text: string): { size: number; rows: QrRow[] } {
  const { modules } = create(text, { errorCorrectionLevel: 'M' });
  const { size } = modules;
  const rows: QrRow[] = [];
  for (let y = 0; y < size; y++) {
    const row: QrRow = [];
    let start = -1;
    for (let x = 0; x <= size; x++) {
      const dark = x < size && Boolean(modules.get(y, x));
      if (dark && start < 0) start = x;
      if (!dark && start >= 0) {
        row.push([start, x - start]);
        start = -1;
      }
    }
    rows.push(row);
  }
  return { size, rows };
}

/** The quiet zone around the code, in modules (the standard asks for four; two reads well on a screen). */
const MARGIN = 2;

export function QrCode({
  text,
  size = 160,
  testID,
  accessibilityLabel,
}: {
  text: string;
  size?: number;
  testID?: string;
  accessibilityLabel: string;
}) {
  const matrix = useMemo(() => qrRows(text), [text]);
  // Whole points per module, so neighbouring runs never leave a hairline seam between rows.
  const cell = Math.max(2, Math.floor(size / (matrix.size + MARGIN * 2)));
  const side = cell * (matrix.size + MARGIN * 2);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: side, height: side, backgroundColor: QR_CODE.plate, padding: cell * MARGIN }}
    >
      {matrix.rows.map((row, y) => (
        <View key={y} style={{ height: cell, flexDirection: 'row' }}>
          {row.map(([x, length]) => (
            <View
              key={x}
              style={{
                position: 'absolute',
                left: x * cell,
                width: length * cell,
                height: cell,
                backgroundColor: QR_CODE.ink,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
