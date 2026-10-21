// Opening a lesson's place (Phase 43): Directions in Google Maps (and, on iOS, Apple Maps as a
// choice), or a virtual place's meeting link. Through the system only: nothing is fetched, and the
// phone's location is never read.
import { ActionSheetIOS, Linking, Platform } from 'react-native';

import { mapChoices } from './now-model';

function open(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

export function openDirections(address: string) {
  const choices = mapChoices(address, Platform.OS);
  if (choices.length === 1 || Platform.OS !== 'ios') {
    open(choices[0]!.url);
    return;
  }
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: 'Directions',
      options: [...choices.map((choice) => choice.label), 'Cancel'],
      cancelButtonIndex: choices.length,
    },
    (index) => {
      const choice = choices[index];
      if (choice) open(choice.url);
    },
  );
}

export function openMeetingLink(url: string) {
  open(url);
}
