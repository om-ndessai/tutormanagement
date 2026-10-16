// "Finish tax setup" on a tutor's record (UI upgrades U3): adding a tutor no longer asks for their
// mailing address or whether the office holds their SSN, so the record asks instead -- admins only,
// until both are set. It opens the person form scoped to those two (`sections=tutor-tax`), where the
// SSN is a tick that records today's date: never a number, which the portal has nowhere to keep.
import { isMailingAddressComplete, type TutorProfile } from '@tmi/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';

/** Whether a tutor's tax details are still missing a part. */
export function needsTaxSetup(tutor: TutorProfile): boolean {
  return !isMailingAddressComplete(tutor) || !tutor.ssn_received_on;
}

export function TaxSetupCard({ userId, tutor }: { userId: string; tutor: TutorProfile }) {
  const theme = useAppTheme();
  const address = isMailingAddressComplete(tutor);
  const ssn = Boolean(tutor.ssn_received_on);
  const ink = theme.tokens.highlightSoftForeground;
  return (
    <View
      testID="tax-setup-card"
      style={{
        backgroundColor: theme.tokens.highlightSoft,
        borderRadius: radius.lg,
        padding: space.lg,
        gap: space.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon source="file-document-edit-outline" size={22} color={ink} />
        <Text variant="titleMedium" accessibilityRole="header" style={{ flex: 1, color: ink }}>
          Finish tax setup
        </Text>
      </View>
      <Text variant="bodyMedium" style={{ color: ink }}>
        Their 1099 needs both of these.
      </Text>
      <Item done={address} label="Mailing address" />
      <Item done={ssn} label="SSN on file (a tick, never the number)" />
      <Button
        testID="tax-setup-open"
        mode="contained"
        style={{ alignSelf: 'flex-start' }}
        contentStyle={{ minHeight: MIN_TARGET }}
        onPress={() => router.push({ pathname: '/person-form', params: { id: userId, sections: 'tutor-tax' } })}
      >
        Finish tax setup
      </Button>
    </View>
  );
}

function Item({ done, label }: { done: boolean; label: string }) {
  const theme = useAppTheme();
  const ink = theme.tokens.highlightSoftForeground;
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${done ? 'done' : 'missing'}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
    >
      <Icon source={done ? 'check-circle' : 'checkbox-blank-circle-outline'} size={20} color={ink} />
      <Text variant="bodyMedium" style={{ color: ink }}>
        {label}
      </Text>
    </View>
  );
}
