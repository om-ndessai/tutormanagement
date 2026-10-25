import { Linking, Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';

import { serverOrigin } from '@/lib/server';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

import { legalUrl } from './sign-up-model';

/** Opens the portal's own terms or privacy page in the system browser (Phase 51). */
export function openLegal(kind: 'terms' | 'privacy'): void {
  void Linking.openURL(legalUrl(kind, serverOrigin())).catch(() => undefined);
}

/** One link: its own target, so a neighbouring tick box never shares a tap with it. */
export function LegalLink({ kind, label, testID }: { kind: 'terms' | 'privacy'; label: string; testID: string }) {
  const theme = useAppTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={12}
      onPress={() => openLegal(kind)}
    >
      <Text variant="bodySmall" style={{ color: theme.tokens.primary, textDecorationLine: 'underline' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The line under a way in (Phase 51): "By continuing you agree to the Terms and the Privacy
 * notice." `prefix` null gives the links alone (My profile).
 */
export function LegalLine({
  testID,
  prefix = 'By continuing you agree to the',
  ids,
  termsLabel = 'Terms',
  privacyLabel = 'Privacy notice',
}: {
  testID: string;
  prefix?: string | null;
  ids: { terms: string; privacy: string };
  termsLabel?: string;
  privacyLabel?: string;
}) {
  const theme = useAppTheme();
  const muted = { color: theme.colors.onSurfaceVariant };
  return (
    <View
      testID={testID}
      style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: space.xs }}
    >
      {prefix ? (
        <Text variant="bodySmall" style={muted}>
          {prefix}
        </Text>
      ) : null}
      <LegalLink kind="terms" label={termsLabel} testID={ids.terms} />
      <Text variant="bodySmall" style={muted}>
        {prefix ? 'and the' : '·'}
      </Text>
      <LegalLink kind="privacy" label={privacyLabel} testID={ids.privacy} />
      {prefix ? (
        <Text variant="bodySmall" style={muted}>
          .
        </Text>
      ) : null}
    </View>
  );
}
