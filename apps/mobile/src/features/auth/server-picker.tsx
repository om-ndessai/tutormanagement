import { useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, RadioButton, Text, TextInput } from 'react-native-paper';

import {
  availableServers,
  customServerUrl,
  DEMO_URL,
  LOCAL_URL,
  serverKind,
  setServer,
  type ServerKind,
} from '@/lib/server';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

const LABELS: Record<ServerKind, { title: string; detail: string }> = {
  local: { title: 'This Mac', detail: `${LOCAL_URL} — wrangler dev with the local seed` },
  demo: { title: 'Feature demo', detail: `${DEMO_URL} — seeded fiction, wiped by test runs` },
  custom: { title: 'Another address', detail: 'e.g. this Mac on the LAN, for a real device' },
  production: { title: 'Production', detail: 'The tutoring portal' },
};

/** Choose the Worker the app talks to; signs out and starts again against the new one. */
export function ServerPicker({ onDone }: { onDone?: () => void }) {
  const { signOut, reboot } = useAuth();
  const theme = useAppTheme();
  const [kind, setKind] = useState<ServerKind>(serverKind());
  const [url, setUrl] = useState(customServerUrl() ?? 'http://');
  const invalid = kind === 'custom' && !/^https?:\/\/[^\s/]+/.test(url);

  async function apply() {
    await signOut();
    await setServer(kind, kind === 'custom' ? url.trim() : undefined);
    await reboot();
    onDone?.();
  }

  return (
    <View testID="server-picker" style={{ gap: space.md }}>
      <RadioButton.Group value={kind} onValueChange={(value) => setKind(value as ServerKind)}>
        {availableServers().map((option) => (
          <RadioButton.Item
            key={option}
            value={option}
            testID={`server-option-${option}`}
            label={LABELS[option].title}
            labelVariant="titleSmall"
            position="leading"
            style={{ paddingVertical: 2 }}
          />
        ))}
      </RadioButton.Group>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {LABELS[kind].detail}
      </Text>
      {kind === 'custom' ? (
        <View>
          <TextInput
            testID="server-custom-url"
            mode="outlined"
            label="Server address"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <HelperText type="error" visible={invalid}>
            Enter an address like http://192.168.1.20:8787
          </HelperText>
        </View>
      ) : null}
      <Button mode="contained" onPress={() => void apply()} disabled={invalid} testID="server-apply">
        Use this server
      </Button>
    </View>
  );
}
