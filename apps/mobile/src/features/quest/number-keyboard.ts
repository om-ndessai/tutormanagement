import type { KeyboardTypeOptions } from 'react-native';

/**
 * The keyboard for a number answer (Quest and Quest Games). An answer may be 12, 2.5, -3 or 3/4, so it
 * needs the digits, the point, the minus sign and the fraction bar. iOS's numbers-and-punctuation
 * keyboard has them all; its decimal and number pads have neither "-" nor "/". Android's phone pad has
 * no "/" (found on 2026-10-29), so Android gets the full keyboard, without suggestions.
 */
export function numberAnswerKeyboard(os: string): KeyboardTypeOptions {
  return os === 'ios' ? 'numbers-and-punctuation' : 'visible-password';
}
