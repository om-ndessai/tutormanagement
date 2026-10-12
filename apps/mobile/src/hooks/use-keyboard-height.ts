import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** How much of the screen the keyboard covers now (0 while it is down). */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    // iOS announces the keyboard before it moves (so a layout can move with it); Android after.
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subscriptions = [
      Keyboard.addListener(show, (event) => setHeight(event.endCoordinates.height)),
      Keyboard.addListener(hide, () => setHeight(0)),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);
  return height;
}
