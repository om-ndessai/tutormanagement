// Ported from apps/web/src/features/organizations/organization-settings-page.tsx @ 1132322 (the
// Assessment card, Phase 38, @ 22b9701; the Gamification card, Phase 42, @ 82397b8; Phase 50's
// feature sets @ 2471d84, working tree: each card shows only where its set is allowed, and the
// platform's facts name the allowed sets; Phase 52's space code, danger panel and words @ 9485a8e).
//
// The organization's own settings, for its admins: the payer box on every 1099 it issues. Its name,
// look and clock are set by the platform, and shown here for reference. The organization's name on
// screen is data, never written into code.
import {
  FEATURE_SET_LABELS,
  ORG_PALETTE_LABELS,
  ORG_TIME_ZONE_LABELS,
  allowedFeatureSets,
  featureAllowed,
  type FeatureSet,
} from '@tmi/shared';
import { Stack } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { PageIntro } from '@/components/page-intro';
import { LogoMark } from '@/components/logo';
import { Screen } from '@/components/screen';
import { SecureMoney } from '@/components/secure-money';
import { Panel } from '@/components/section';
import { ErrorState } from '@/components/state-views';
import { DetailSkeleton } from '@/components/skeletons';
import { useToast } from '@/components/toast';
import { FormTextField } from '@/features/users/form-text-field';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import {
  useCurriculumOfferings,
  useOrganizationNotifications,
  useOrganizationSettings,
  useSpaceCode,
  useUpdateOrganizationSettings,
} from './api';
import { CanvasAssessmentsCard } from './canvas-assessments-card';
import { CurriculaCard } from './curricula-card';
import { GamificationCard } from './gamification-card';
import { EmailNotificationsCard } from './notifications-card';
import { SpaceCodePanel, SpaceDangerPanel } from './space-code-card';
import { formFromSettings, validateForm, type PayerField, type SettingsForm } from './settings-form';

export function OrganizationSettingsScreen() {
  const { organization, user } = useAuth();
  const theme = useAppTheme();
  const isAdmin = Boolean(user?.roles.includes('admin'));
  const settings = useOrganizationSettings(isAdmin);
  // A self-serve space has no email card (Phase 51), so its log is not asked for.
  const notifications = useOrganizationNotifications(isAdmin && organization?.created_via !== 'self_serve');
  const offerings = useCurriculumOfferings(isAdmin);
  const code = useSpaceCode(isAdmin);
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        settings.refetch(),
        organization?.created_via !== 'self_serve' ? notifications.refetch() : null,
        offerings.refetch(),
        code.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  if (!organization) return null;
  const tutoring = featureAllowed(organization, 'tutoring');

  if (!isAdmin) {
    return (
      <Screen testID="screen-organization">
        <Stack.Screen options={{ title: 'Space' }} />
        <Text testID="organization-stub" variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          Only an administrator can see the space’s settings.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen testID="screen-organization" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Stack.Screen options={{ title: 'Space' }} />
      {/* The payer TIN: a sole proprietor's is their SSN (ux-audit F-1). Tutoring's alone (Phase 50). */}
      {tutoring ? <SecureMoney tag="organization" /> : null}
      <PageIntro>
        {tutoring
          ? `What ${organization.name} files its 1099s under, teaches from, and how the portal presents it.`
          : `${organization.name}: its code, what it teaches from, and how it is set up.`}
      </PageIntro>

      {/* Phase 52: on a phone the code is what a new space's admin came for, so it leads. */}
      <SpaceCodePanel />

      {settings.isPending ? (
        <DetailSkeleton label="Loading the settings…" rows={5} />
      ) : settings.isError || !settings.data ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : tutoring ? (
        // Keyed on the load, so the form starts from the server's values once. The 1099 payer
        // belongs to Tutoring (payments and tax), Phase 50.
        <PayerForm key={settings.dataUpdatedAt} initial={formFromSettings(settings.data.data)} />
      ) : null}

      <Panel title="Set by the platform" testID="org-platform">
        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <LogoMark size={40} />
            <Text variant="titleMedium" style={{ flex: 1 }}>
              {organization.name}
            </Text>
          </View>
          <Fact label="Name" value={organization.name} />
          <Fact label="Palette" value={ORG_PALETTE_LABELS[organization.palette]} />
          <Fact
            label="Lessons are recorded on"
            value={`${ORG_TIME_ZONE_LABELS[organization.time_zone]} time`}
          />
          <View testID="org-features">
            <Fact label="Feature sets" value={featureSetsLabel(allowedFeatureSets(organization))} />
          </View>
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            To change the name, logo, palette, clock or feature sets, ask the platform administrator.
          </Text>
        </View>
      </Panel>

      {/* Phase 51: a self-serve space sends no email under the platform's sender. */}
      {organization.created_via !== 'self_serve' ? (
        <EmailNotificationsCard enabled={settings.data?.data.email_notifications ?? false} />
      ) : null}

      <CurriculaCard />

      {featureAllowed(organization, 'assessment') ? (
        <CanvasAssessmentsCard
          enabled={settings.data?.data.canvas_assessments ?? false}
          unreviewed={settings.data?.data.canvas_assessments_unreviewed ?? false}
          questions={settings.data?.data.canvas_assessment_questions ?? 10}
        />
      ) : null}

      {featureAllowed(organization, 'quest') ? (
        <GamificationCard questQuest={settings.data?.data.gamify_question_quest ?? false} />
      ) : null}

      <SpaceDangerPanel />
    </Screen>
  );
}

/** "Assessment", "Tutoring and Assessment", "Tutoring, Assessment and Quest", or "None yet". */
export function featureSetsLabel(sets: readonly FeatureSet[]): string {
  const labels = sets.map((set) => FEATURE_SET_LABELS[set]);
  if (labels.length === 0) return 'None yet';
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

function Fact({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View>
      <Text variant="labelSmall" style={{ color: theme.tokens.mutedForeground }}>
        {label}
      </Text>
      <Text variant="bodyMedium">{value}</Text>
    </View>
  );
}

function PayerForm({ initial }: { initial: SettingsForm }) {
  const toast = useToast();
  const update = useUpdateOrganizationSettings();
  const [form, setForm] = useState<SettingsForm>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save() {
    setErrors({});
    const verdict = validateForm(form);
    if (!verdict.ok) {
      setErrors(verdict.errors);
      haptics.error();
      return;
    }
    try {
      await update.mutateAsync(verdict.payload);
      toast.success('Space settings saved.');
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setErrors(caught.fieldErrors);
        toast.error(caught.message);
      } else {
        toast.error('Could not save the settings.');
      }
    }
  }

  const field = (
    key: PayerField,
    label: string,
    extra: Partial<ComponentProps<typeof FormTextField>> = {},
  ) => (
    <FormTextField
      testID={`org-${key}`}
      label={label}
      optional
      value={form[key]}
      error={errors[key]}
      onChangeText={(value) => {
        setForm((previous) => ({ ...previous, [key]: value }));
        if (errors[key]) setErrors(({ [key]: _gone, ...rest }) => rest);
      }}
      {...extra}
    />
  );

  return (
    <Panel title="1099 payer" testID="org-payer">
      <View style={{ gap: space.md }}>
        {field('tin', 'Payer TIN', {
          hint: 'The EIN the space files under. Prefills the payer box — never a Social Security number, which the portal refuses to store.',
          placeholder: '12-3456789',
          autoComplete: 'off',
          autoCapitalize: 'none',
        })}
        {field('payer_address_line1', 'Address', { autoComplete: 'street-address' })}
        {field('payer_address_line2', 'Address line 2')}
        {field('payer_city', 'City')}
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}>
            {field('payer_state', 'State', { placeholder: 'NC', autoCapitalize: 'characters', maxLength: 2 })}
          </View>
          <View style={{ flex: 1 }}>
            {field('payer_postal_code', 'ZIP', {
              placeholder: '27514',
              keyboardType: 'number-pad',
              maxLength: 10,
            })}
          </View>
        </View>
        <Button
          testID="org-save"
          mode="contained"
          onPress={() => void save()}
          loading={update.isPending}
          disabled={update.isPending}
          style={{ alignSelf: 'flex-end' }}
        >
          Save
        </Button>
      </View>
    </Panel>
  );
}
