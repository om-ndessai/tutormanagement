// A form's frame that puts the keyboard away when a blank part of it is tapped. A multiline field
// keeps its keyboard up (Return makes a new line), and in a form sheet it can cover the rest of
// the form; a tap anywhere that is not a control closes it, as in the system's own forms.
import type { ReactNode } from 'react';
import { Keyboard, Pressable, type ViewStyle } from 'react-native';

export function DismissKeyboard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <Pressable accessible={false} onPress={Keyboard.dismiss} style={style}>
      {children}
    </Pressable>
  );
}
