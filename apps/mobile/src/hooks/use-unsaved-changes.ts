import { useNavigation, usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { haptics } from '@/lib/haptics';

/** True when `values` no longer match what the form opened with (compared as JSON). */
export function useDirty(values: unknown): boolean {
  const [initial] = useState(() => JSON.stringify(values));
  return JSON.stringify(values) !== initial;
}

/**
 * Keeps a half-filled form sheet from being lost (ux-audit F-3): while `dirty`, leaving -- a swipe
 * down on iOS, Android's back, the form's own Cancel -- first asks "Discard changes?", with Keep
 * editing as the safe answer. On iOS the native sheet is held in place (react-native-screens'
 * `preventNativeDismiss`, which the native stack sets for a route whose removal is prevented);
 * Android's back is the JS stack's, so it is intercepted the same way. Dragging an Android sheet
 * off the screen cannot be held (see below).
 *
 * A successful save leaves through `leave(close)`: the guard stands down first, then the sheet
 * closes, so saving never asks about discarding what was just saved.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const navigation = useNavigation();
  const [released, setReleased] = useState(false);
  const then = useRef<(() => void) | null>(null);

  usePreventRemove(dirty && !released, ({ data }) => {
    // Android's form sheet can always be dragged away (react-native-screens 4.26 has no
    // prevent-dismiss there): by the time the stack hears of it (a POP from the native side) the
    // sheet is already gone, so asking would leave the stack holding a screen that no longer
    // exists. Back and Cancel arrive as GO_BACK and are asked about.
    if (Platform.OS === 'android' && data.action.type === 'POP') {
      navigation.dispatch(data.action);
      return;
    }
    haptics.warning();
    Alert.alert('Discard changes?', 'What you have entered here has not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  useEffect(() => {
    if (!released || !then.current) return;
    const run = then.current;
    then.current = null;
    run();
  }, [released]);

  const leave = useCallback((close: () => void) => {
    then.current = close;
    setReleased(true);
  }, []);

  return { leave };
}
