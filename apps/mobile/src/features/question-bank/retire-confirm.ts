// Retiring a question asks first (#54): a retired question comes back only through the desk, where
// restoring it sends it to be checked again. Approve is not confirmed -- it is the job. A native
// alert, as the app's other confirmations are.
import { Alert } from 'react-native';

import { haptics } from '@/lib/haptics';

export function confirmRetire(): Promise<boolean> {
  haptics.warning();
  return new Promise((resolve) => {
    Alert.alert(
      'Retire this question?',
      'It leaves the bank. Restoring it sends it back to be checked at the desk.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Retire', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
