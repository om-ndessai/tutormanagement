// Ported from apps/web/src/features/platform/organization-dialog.tsx @ 1132322 (the form).
// Creating or editing an organization: its name and address name, its look (palette, the built-in
// logo), its clock and its email notifications. Logos and admins live on the organization's screen
// (they need it to exist). The swatch colours are each palette's own (ORG_PALETTE_HEX), as data.
import {
  ORG_PALETTE_HEX,
  ORG_PALETTE_LABELS,
  ORG_TIME_ZONES,
  ORG_TIME_ZONE_LABELS,
  type OrgPalette,
  type OrgTimeZone,
  type OrganizationListItem,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { Button, Checkbox, Switch, Text } from 'react-native-paper';

import { Field } from '@/components/form-choice';
import { OptionPicker } from '@/components/option-picker';
import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { OrgAvatar } from '@/features/organizations/org-avatar';
import { FormTextField } from '@/features/users/form-text-field';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { useCreateOrganization, useOrganizations, useUpdateOrganization } from './api';
import {
  formFromOrganization,
  palettesOnOffer,
  slugFrom,
  validateOrgForm,
  type OrgFormState,
} from './org-form';

function close() {
  if (router.canGoBack()) router.back();
}

export function OrganizationFormSheet({ id }: { id?: string }) {
  const organizations = useOrganizations();
  const existing = id ? (organizations.data?.data.find((row) => row.id === id) ?? null) : null;

  let body;
  if (id && organizations.isPending) body = <LoadingState />;
  else if (id && (organizations.isError || !existing))
    body = (
      <ErrorState
        error={organizations.error ?? new ApiRequestError(404, 'not_found', 'Not found.')}
        onRetry={() => void organizations.refetch()}
      />
    );
  else body = <OrganizationForm key={existing?.id ?? 'new'} existing={existing} />;

  return (
    <Screen testID="screen-organization-form" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      {body}
    </Screen>
  );
}

function OrganizationForm({ existing }: { existing: OrganizationListItem | null }) {
  const theme = useAppTheme();
  const toast = useToast();
  const muted = theme.tokens.mutedForeground;
  const create = useCreateOrganization();
  const update = useUpdateOrganization();
  const [form, setForm] = useState<OrgFormState>(() => formFromOrganization(existing));
  const [slugTouched, setSlugTouched] = useState(Boolean(existing));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pending = create.isPending || update.isPending;

  function set<K extends keyof OrgFormState>(key: K, value: OrgFormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    if (errors[key]) setErrors(({ [key]: _gone, ...rest }) => rest);
  }

  async function save() {
    Keyboard.dismiss();
    setErrors({});
    const verdict = validateOrgForm(form, !existing);
    if (!verdict.ok) {
      setErrors(verdict.errors);
      haptics.error();
      return;
    }
    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, input: verdict.input });
        haptics.success();
        toast.success(`${form.name} saved.`);
      } else {
        await create.mutateAsync(verdict.input);
        haptics.success();
        toast.success(`${form.name} created. Add its first admin next.`);
      }
      close();
    } catch (caught) {
      haptics.error();
      if (caught instanceof ApiRequestError) {
        setErrors(caught.status === 409 ? { slug: caught.message } : caught.fieldErrors);
        toast.error(caught.message);
      } else {
        toast.error('Could not save the organization.');
      }
    }
  }

  const text = (
    key: 'name' | 'short_name' | 'slug' | 'place' | 'tagline' | 'blurb',
    testID: string,
    label: string,
    extra: { optional?: boolean; hint?: string; autoCapitalize?: 'none' | 'words' | 'sentences' } = {},
  ) => (
    <FormTextField
      testID={testID}
      label={label}
      value={form[key]}
      error={errors[key]}
      optional={extra.optional}
      hint={extra.hint}
      autoCapitalize={extra.autoCapitalize ?? 'words'}
      autoComplete="off"
      onChangeText={(value) => {
        if (key === 'slug') setSlugTouched(true);
        set(key, value);
        if (key === 'name' && !slugTouched) set('slug', slugFrom(value));
      }}
    />
  );

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {existing ? existing.name : 'New organization'}
        </Text>
        <Text variant="bodyMedium" style={{ color: muted }}>
          {existing
            ? 'Its identity and look. Its own admins keep its payer details.'
            : 'Its name and look. Its admins come next, once it exists.'}
        </Text>
      </View>

      {text('name', 'org-form-name', 'Name')}
      {text('short_name', 'org-form-short', 'Short name', { hint: 'For the sidebar and the tab title.' })}
      {text('slug', 'org-form-slug', 'Address name', {
        hint: 'Lower-case letters, digits and hyphens. Names its files and remembers the choice.',
        autoCapitalize: 'none',
      })}
      {text('place', 'org-form-place', 'Place', { optional: true })}
      {text('tagline', 'org-form-tagline', 'Tagline', { optional: true, autoCapitalize: 'sentences' })}
      {text('blurb', 'org-form-blurb', 'Description', {
        optional: true,
        hint: 'The line under the tagline on the sign-in page.',
        autoCapitalize: 'sentences',
      })}

      <OptionPicker
        testID="org-form-tz"
        label="Lessons are recorded on"
        placeholder="Choose a time zone"
        options={ORG_TIME_ZONES.map((zone) => ({ id: zone, label: `${ORG_TIME_ZONE_LABELS[zone]} time` }))}
        value={form.time_zone}
        onChange={(zone) => set('time_zone', zone as OrgTimeZone)}
        error={errors.time_zone}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space.md,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          borderRadius: radius.md,
          padding: space.md,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyMedium">Email notifications</Text>
          <Text variant="bodySmall" style={{ color: muted }}>
            Emails the people concerned when someone is added, a plan or assessment is added, lessons are
            scheduled, or a session is recorded. Its own admins can switch it too.
          </Text>
        </View>
        <Switch
          testID="org-form-notifications"
          accessibilityLabel="Email notifications"
          value={form.email_notifications}
          onValueChange={(value) => {
            haptics.selection();
            set('email_notifications', value);
          }}
        />
      </View>

      <Field label="Palette" error={errors.palette}>
        <PaletteSwatches
          palettes={palettesOnOffer(form)}
          value={form.palette}
          onChange={(palette) => set('palette', palette)}
        />
      </Field>

      <Checkbox.Item
        testID="org-form-builtin"
        label="Wear the institute’s built-in logo"
        status={form.builtin_institute ? 'checked' : 'unchecked'}
        onPress={() => {
          haptics.selection();
          set('builtin_institute', !form.builtin_institute);
        }}
        position="leading"
        mode="android"
        labelStyle={{ textAlign: 'left' }}
        style={{ paddingHorizontal: 0 }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <OrgAvatar
          org={{
            ...(existing ?? { id: 'preview', logo_mark_url: null, logo_full_url: null }),
            slug: form.slug,
            name: form.name,
            short_name: form.short_name || form.name || '?',
            tagline: null,
            blurb: null,
            place: null,
            palette: form.palette,
            builtin_logo: form.builtin_institute ? 'institute' : null,
          }}
        />
        <Text variant="bodySmall" style={{ color: muted, flex: 1 }}>
          How it shows in lists, in its palette.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm }}>
        <Button mode="text" onPress={close}>
          {existing ? 'Close' : 'Cancel'}
        </Button>
        <Button
          testID="org-form-save"
          mode="contained"
          onPress={() => void save()}
          loading={pending}
          disabled={pending}
        >
          {existing ? 'Save' : 'Create organization'}
        </Button>
      </View>
    </View>
  );
}

/** The palettes as a radio group, each with its own colour. */
export function PaletteSwatches({
  palettes,
  value,
  onChange,
}: {
  palettes: readonly OrgPalette[];
  value: OrgPalette;
  onChange: (palette: OrgPalette) => void;
}) {
  const theme = useAppTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Palette"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
    >
      {palettes.map((palette) => {
        const selected = palette === value;
        return (
          <Pressable
            key={palette}
            testID={`org-form-palette-${palette}`}
            accessibilityRole="radio"
            accessibilityLabel={ORG_PALETTE_LABELS[palette]}
            accessibilityState={{ checked: selected }}
            onPress={() => {
              haptics.selection();
              onChange(palette);
            }}
            style={({ pressed }) => ({
              minHeight: MIN_TARGET,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              paddingHorizontal: space.md,
              borderRadius: radius.md,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
              backgroundColor: pressed ? theme.tokens.muted : 'transparent',
            })}
          >
            <View
              style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: ORG_PALETTE_HEX[palette] }}
            />
            <Text variant="bodyMedium">{ORG_PALETTE_LABELS[palette]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
