/// <reference types="node" />
// Touch targets (ux-audit F-5): every icon button's frame is at least 44pt (iOS) / 48dp (Android),
// with no slop to overlap a neighbour; every icon button in the app comes from the wrapper; every
// tappable chip reaches 44pt with its slop.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '@/test/render';
import { MIN_TARGET } from '@/theme/tokens';
import { ICON_TARGET, IconButton } from './icon-button';

const SRC = join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name: string) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

test.each([18, 20, 22, 24])('a size-%i icon button has a full target and no slop', async (size) => {
  const screen = await renderWithProviders(
    <IconButton testID="probe" icon={() => null} size={size} accessibilityLabel="Close" onPress={() => {}} />,
  );
  // Paper's Surface puts the size on the view around its `-container`.
  let node = screen.getByTestId('probe-container') as { props: { style?: unknown }; parent: unknown } | null;
  let frame: { width?: number; height?: number } = {};
  while (node && frame.width === undefined) {
    frame = (StyleSheet.flatten(node.props.style as never) ?? {}) as typeof frame;
    node = node.parent as typeof node;
  }
  expect(frame.width).toBeGreaterThanOrEqual(MIN_TARGET);
  expect(frame.height).toBeGreaterThanOrEqual(MIN_TARGET);
  expect(frame.width).toBeGreaterThanOrEqual(ICON_TARGET);
  expect(screen.getByTestId('probe').props.hitSlop).toEqual({ top: 0, left: 0, bottom: 0, right: 0 });
});

test("nothing uses Paper's IconButton directly", () => {
  const offenders = sources(SRC)
    .filter((path) => !path.endsWith(join('components', 'icon-button.tsx')))
    .filter((path) =>
      /import\s*\{[^}]*\bIconButton\b[^}]*\}\s*from\s*'react-native-paper'/s.test(readFileSync(path, 'utf8')),
    )
    .map((path) => relative(SRC, path));
  expect(offenders).toEqual([]);
});

test('every tappable chip carries the chip hit slop', () => {
  const offenders: string[] = [];
  for (const path of sources(SRC)) {
    const text = readFileSync(path, 'utf8');
    for (const match of text.matchAll(/<Chip\b([\s\S]*?)(?:\n\s*>|\}>|"\s*>|\/>)/g)) {
      const props = match[1] ?? '';
      if (/\bonPress=/.test(props) && !/\bhitSlop=\{CHIP_HIT_SLOP\}/.test(props)) {
        offenders.push(`${relative(SRC, path)}:${text.slice(0, match.index).split('\n').length}`);
      }
    }
  }
  expect(offenders).toEqual([]);
});
