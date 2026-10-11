// Profile's Dictation row (P3), beside Haptics. Where the phone can turn speech into text by
// itself, that is all dictation ever does here, and the row says so. Where it cannot, a switch
// lets the person agree -- on this phone only, off by default -- to its online speech service.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Switch, Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { networkConsent, setNetworkConsent, speechEngine, type SpeechCapabilities } from '@/lib/speech';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { askConsent } from './dictation-dialogs';

export function DictationControl({ testID }: { testID?: string }) {
  const theme = useAppTheme();
  const [capabilities, setCapabilities] = useState<SpeechCapabilities | null>(null);
  const [on, setOn] = useState(false);
  const supported = speechEngine() !== null;

  useEffect(() => {
    let cancelled = false;
    const engine = speechEngine();
    if (!engine) return;
    void (async () => {
      const [caps, consent] = await Promise.all([engine.capabilities(), networkConsent()]);
      if (cancelled) return;
      setCapabilities(caps);
      setOn(consent);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const muted = theme.tokens.mutedForeground;
  const onDevice = capabilities ? capabilities.onDevice : false;
  let description: string;
  if (!supported || (capabilities && !capabilities.available)) {
    description = "Dictation isn't available on this phone.";
  } else if (!capabilities) {
    description = 'Checking this phone…';
  } else if (onDevice) {
    description = 'On this phone only. Your voice is turned into text here, and the audio is never kept.';
  } else {
    description =
      "This phone can't turn speech into text by itself. Allow its online speech service to dictate; the app never keeps or sends the audio itself.";
  }
  const showSwitch = Boolean(capabilities?.available && !onDevice);

  async function toggle(next: boolean) {
    if (next) {
      if (!capabilities || !(await askConsent(capabilities.service))) return;
    }
    await setNetworkConsent(next);
    setOn(next);
    haptics.selection();
  }

  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="labelLarge">Dictation</Text>
        <Text variant="bodySmall" style={{ color: muted }}>
          {description}
        </Text>
        {showSwitch ? (
          <Text variant="bodySmall" style={{ color: muted }}>
            Use the phone&apos;s online speech service
          </Text>
        ) : null}
      </View>
      {showSwitch ? (
        <Switch
          testID="dictation-network-switch"
          accessibilityLabel="Use the phone's online speech service"
          value={on}
          onValueChange={(next) => void toggle(next)}
        />
      ) : null}
    </View>
  );
}
