// Paper's IconButton with a full touch target (ux-audit F-5). Paper draws a `size + 16` circle and
// relies on a hitSlop that its own `overflow: hidden` container clips away, so a default icon
// button was a 40pt target and an 18pt one 34pt. Here the frame itself is the target: 44pt on iOS
// (HIG), 48dp on Android (Material), with no slop to overlap a neighbour's. The glyph keeps its
// size; only the invisible frame grows. Every icon button in the app comes from here (a Jest check
// refuses Paper's directly).
import type { ComponentProps } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { IconButton as PaperIconButton } from 'react-native-paper';

import { MIN_TARGET } from '@/theme/tokens';

/** The platform's minimum touch target: 44pt on iOS, 48dp on Android. */
export const ICON_TARGET = Platform.OS === 'android' ? 48 : MIN_TARGET;

const NO_SLOP = { top: 0, left: 0, bottom: 0, right: 0 };

export type IconButtonProps = ComponentProps<typeof PaperIconButton>;

export function IconButton({ size = 24, style, ...rest }: IconButtonProps) {
  const frame = Math.max(ICON_TARGET, size + 16);
  return (
    <PaperIconButton
      size={size}
      hitSlop={NO_SLOP}
      {...rest}
      style={[styles.reset, style, { width: frame, height: frame, borderRadius: frame / 2 }]}
    />
  );
}

const styles = StyleSheet.create({ reset: { margin: 0 } });
