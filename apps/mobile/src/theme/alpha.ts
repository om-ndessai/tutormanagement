/**
 * A palette colour at an opacity, for the web's `bg-warning/15`-style tints. Takes the token's
 * `#RRGGBB` (or `#RRGGBBAA`, multiplying the alpha it already has) and returns `#RRGGBBAA`.
 */
export function withAlpha(color: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(color)) return color;
  const existing = color.length === 9 ? parseInt(color.slice(7, 9), 16) / 255 : 1;
  const value = Math.round(Math.max(0, Math.min(1, alpha * existing)) * 255);
  return `${color.slice(0, 7)}${value.toString(16).padStart(2, '0').toUpperCase()}`;
}
