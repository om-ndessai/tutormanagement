// Ported from apps/web/src/features/auth/legal-sheet.tsx @ 98c40ab (working tree)
//
// Phase 72 (owner, 2026-11-04; UI audit JF12): someone a space added never saw the terms or the privacy notice, which
// a person who signs up accepts on the way in. At their first sign-in they read and accept both, once; until then the
// app waits behind this sheet. Sign out is the other way out.
//
// Mobile: a cover over the whole app (the root layout, as the access refusal), so nothing beneath can be reached; the
// links open the server's own pages in the system browser, as sign-up's do (`LegalLink`). The versions accepted are
// the shared TERMS_VERSION and PRIVACY_VERSION (POST /auth/legal), then the session is read again.
import { PRIVACY_VERSION, TERMS_VERSION, type AcceptLegalInput, type ApiOk } from '@tmi/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';

import { CheckRow } from '@/components/check-row';
import { LogoMark } from '@/components/logo';
import { Screen } from '@/components/screen';
import { apiClient } from '@/lib/api-client';
import { problemMessage } from '@/lib/api-errors';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

import { LegalLink } from './legal-links';

/** What "Accept and continue" sends: the versions this build shows. */
export const LEGAL_ACCEPTANCE: AcceptLegalInput = { terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION };

export function LegalSheet() {
  const theme = useAppTheme();
  const { refreshSession, signOut } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function accept() {
    setSending(true);
    setProblem(null);
    try {
      await apiClient.post<ApiOk<{ accepted: true }>>('/auth/legal', LEGAL_ACCEPTANCE);
      haptics.success();
      await refreshSession();
    } catch (caught) {
      haptics.error();
      setProblem(problemMessage(caught, 'Could not save that. Please try again.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen testID="legal-sheet" edges={['top', 'bottom']} contentStyle={{ justifyContent: 'center', flexGrow: 1 }}>
      <View style={{ gap: space.lg }}>
        <LogoMark size={40} />
        <View style={{ gap: space.sm }}>
          <Text variant="headlineSmall" accessibilityRole="header">
            Before you start
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            You were added by a space, so you have not seen how the platform works yet. Read the terms and the privacy
            notice; you accept them once.
          </Text>
        </View>
        <View style={{ gap: space.md, alignItems: 'flex-start' }}>
          <LegalLink kind="terms" label="Terms of use" testID="legal-terms" />
          <LegalLink kind="privacy" label="Privacy notice" testID="legal-privacy" />
        </View>
        <CheckRow
          testID="legal-agree"
          label="I have read and accept the terms of use and the privacy notice."
          checked={agreed}
          onChange={setAgreed}
        />
        {problem ? (
          <HelperText type="error" padding="none" testID="legal-error" accessibilityRole="alert">
            {problem}
          </HelperText>
        ) : null}
        <View style={{ gap: space.sm }}>
          <Button
            testID="legal-accept"
            mode="contained"
            disabled={!agreed || sending}
            loading={sending}
            onPress={() => void accept()}
            contentStyle={{ minHeight: 48 }}
          >
            Accept and continue
          </Button>
          <Button testID="legal-sign-out" mode="text" disabled={sending} onPress={() => void signOut()} contentStyle={{ minHeight: 48 }}>
            Sign out
          </Button>
        </View>
      </View>
    </Screen>
  );
}
