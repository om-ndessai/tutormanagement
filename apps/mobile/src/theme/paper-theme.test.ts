import { ORG_PALETTE_HEX, ORG_PALETTES } from '@tmi/shared';

import { buildTheme } from './paper-theme';
import { PALETTE_TOKENS } from './palettes.generated';

const HEX = /^#[0-9A-F]{6}([0-9A-F]{2})?$/;

describe('palette tokens generated from apps/web/src/index.css', () => {
  it('covers every organization palette, light and dark', () => {
    for (const palette of ORG_PALETTES) {
      expect(PALETTE_TOKENS[palette]).toBeDefined();
      for (const scheme of ['light', 'dark'] as const) {
        const tokens = PALETTE_TOKENS[palette][scheme] as Record<string, string>;
        for (const name of [
          'primary',
          'primaryForeground',
          'background',
          'foreground',
          'card',
          'muted',
          'border',
        ]) {
          expect(tokens[name]).toMatch(HEX);
        }
      }
    }
  });

  it('converts OKLCH exactly where the stylesheet names the hex it was sampled from', () => {
    // index.css: the platform's primary is ORG_PALETTE_HEX.platform; plum's brand-700 is #773C7D.
    expect(PALETTE_TOKENS.platform.light.primary).toBe(ORG_PALETTE_HEX.platform);
    expect(PALETTE_TOKENS.plum.light.brand700).toBe('#773C7D');
  });

  it('gives dark mode its own primary (a lighter step that carries text on a dark surface)', () => {
    for (const palette of ORG_PALETTES) {
      expect(PALETTE_TOKENS[palette].dark.primary).not.toBe(PALETTE_TOKENS[palette].light.primary);
    }
  });
});

describe('buildTheme', () => {
  it('maps the web tokens onto Paper MD3 roles', () => {
    const theme = buildTheme('indigo', 'light');
    expect(theme.colors.primary).toBe(PALETTE_TOKENS.indigo.light.primary);
    expect(theme.colors.onPrimary).toBe(PALETTE_TOKENS.indigo.light.primaryForeground);
    expect(theme.colors.background).toBe(PALETTE_TOKENS.indigo.light.background);
    expect(theme.colors.surface).toBe(PALETTE_TOKENS.indigo.light.card);
    expect(theme.colors.error).toBe(PALETTE_TOKENS.indigo.light.destructive);
    expect(theme.dark).toBe(false);
  });

  it('gives Paper an opaque outline in dark mode, where the web border is translucent', () => {
    const theme = buildTheme('platform', 'dark');
    expect(PALETTE_TOKENS.platform.dark.border).toHaveLength(9);
    expect(theme.colors.outline).toMatch(/^#[0-9A-F]{6}$/);
    expect(theme.dark).toBe(true);
  });
});
