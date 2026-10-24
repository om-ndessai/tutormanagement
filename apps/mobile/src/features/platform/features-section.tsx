// Phase 50 (docs/mobile/build-log.md entry 62), the console's feature sets, from the web's
// organization-dialog.tsx @ 2471d84 (working tree): which of Tutoring, Assessment and Quest an
// organization may use. On the web the switches sit in the edit dialog; on the phone they are a
// section of the organization's screen, saved one switch at a time. Disallowing asks first: everyone
// there stops seeing the set. Each save sends all three (PUT .../features).
import {
  FEATURE_SETS,
  FEATURE_SET_DESCRIPTIONS,
  FEATURE_SET_LABELS,
  featureAllowed,
  type FeatureSet,
  type OrganizationListItem,
} from '@tmi/shared';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';

import { Panel } from '@/components/section';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useUpdateOrganizationFeatures } from './api';
import { featuresBody } from './org-form';

export function FeaturesSection({ organization }: { organization: OrganizationListItem }) {
  const theme = useAppTheme();
  const toast = useToast();
  const update = useUpdateOrganizationFeatures();
  // The switch moves at once; it settles on the server's answer, or back if it was refused.
  const [wanted, setWanted] = useState<Partial<Record<FeatureSet, boolean>>>({});
  const archived = Boolean(organization.archived_at);

  async function save(set: FeatureSet, next: boolean) {
    setWanted((previous) => ({ ...previous, [set]: next }));
    try {
      await update.mutateAsync({ id: organization.id, input: featuresBody(organization, set, next) });
      toast.success(`${next ? 'Allowed' : 'Disallowed'} ${FEATURE_SET_LABELS[set]}.`);
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'That did not work. Try again.');
    } finally {
      setWanted(({ [set]: _gone, ...rest }) => rest);
    }
  }

  function toggle(set: FeatureSet, next: boolean) {
    haptics.selection();
    if (next) {
      void save(set, next);
      return;
    }
    haptics.warning();
    const label = FEATURE_SET_LABELS[set];
    Alert.alert(
      `Disallow ${label} in ${organization.short_name}?`,
      'Everyone there stops seeing it, admins included. Nothing is deleted; allowing it again brings it back.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disallow', style: 'destructive', onPress: () => void save(set, false) },
      ],
    );
  }

  return (
    <Panel title="Feature sets" testID="platform-org-features">
      <View style={{ gap: space.md }}>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          What {organization.short_name} may use. Its own admins switch Assessment and Quest on.
        </Text>
        {FEATURE_SETS.map((set) => {
          const shown = wanted[set] ?? featureAllowed(organization, set);
          const label = FEATURE_SET_LABELS[set];
          const disabled = archived || update.isPending;
          return (
            <View key={set} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="labelLarge">{label}</Text>
                <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                  {FEATURE_SET_DESCRIPTIONS[set]}
                </Text>
              </View>
              <Switch
                testID={`platform-org-feature-${set}`}
                value={shown}
                disabled={disabled}
                onValueChange={(next) => toggle(set, next)}
                accessibilityLabel={`Allow ${label}`}
                accessibilityRole="switch"
                accessibilityState={{ checked: shown, disabled }}
              />
            </View>
          );
        })}
      </View>
    </Panel>
  );
}
