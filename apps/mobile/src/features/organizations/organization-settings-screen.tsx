// Ported from apps/web/src/features/organizations/organization-settings-page.tsx @ 1132322.
//
// The organization's own settings, for its admins: the payer box on every 1099 it issues. Its name,
// look and clock are set by the platform, and shown here for reference. The organization's name on
// screen is data, never written into code.
import { ORG_PALETTE_LABELS, ORG_TIME_ZONE_LABELS } from '@tmi/shared';
import { Stack } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { LogoMark } from '@/components/logo';
import { Screen } from '@/components/screen';
import { Panel } from '@/components/section';
import { ErrorState, LoadingState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { FormTextField } from '@/features/users/form-text-field';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useOrganizationNotifications, useOrganizationSettings, useUpdateOrganizationSettings } from './api';
import { EmailNotificationsCard } from './notifications-card';
import { formFromSettings, validateForm, type PayerField, type SettingsForm } from './settings-form';

export function OrganizationSettingsScreen() {
  const { organization, user } = useAuth();
  const theme = useAppTheme();
  const isAdmin = Boolean(user?.roles.includes('admin'));
  const settings = useOrganizationSettings(isAdmin);
  const notifications = useOrganizationNotifications(isAdmin);
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([settings.refetch(), notifications.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

  if (!organization) return null;

  if (!isAdmin) {
    return (
      <Screen testID="screen-organization">
        <Stack.Screen options={{ title: 'Organization' }} />
        <Text testID="organization-stub" variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          Only an administrator can see the organization’s settings.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen testID="screen-organization" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Stack.Screen options={{ title: 'Organization' }} />
      <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
        {`What ${organization.name} files its 1099s under, and how the portal presents it.`}
      </Text>

      {settings.isPending ? (
        <LoadingState label="Loading the settings…" />
      ) : settings.isError || !settings.data ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        // Keyed on the load, so the form starts from the server's values once.
        <PayerForm key={settings.dataUpdatedAt} initial={formFromSettings(settings.data.data)} />
      )}

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
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            To change the name, logo, palette or clock, ask the platform administrator.
          </Text>
        </View>
      </Panel>

      <EmailNotificationsCard enabled={settings.data?.data.email_notifications ?? false} />
    </Screen>
  );
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
      haptics.success();
      toast.success('Organization settings saved.');
    } catch (caught) {
      haptics.error();
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
          hint: 'The EIN the organization files under. Prefills the payer box — never a Social Security number, which the portal refuses to store.',
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
