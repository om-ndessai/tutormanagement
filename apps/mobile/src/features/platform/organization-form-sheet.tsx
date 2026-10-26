// Ported from apps/web/src/features/platform/organization-dialog.tsx @ 1132322 (the form).
// Creating or editing an organization: its name and address name, its look (palette, the built-in
// logo), its clock and its email notifications. Logos and admins live on the organization's screen
// (they need it to exist). Phase 50: creating also picks its feature sets. Phase 54 (@ 24066d9, working
// tree): the Organization that runs its money, or Paid directly; a change applies from now on. The swatch colours are each palette's own (ORG_PALETTE_HEX), as data.
import {
  FEATURE_SETS,
  FEATURE_SET_LABELS,
  ORG_PALETTE_HEX,
  ORG_PALETTE_LABELS,
  ORG_TIME_ZONES,
  ORG_TIME_ZONE_LABELS,
  PAID_DIRECTLY_LABEL,
  type OrgPalette,
  type OrgTimeZone,
  type OrganizationListItem,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { Button, Checkbox, Switch, Text } from 'react-native-paper';

import { useDirty, useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes';
import { Field } from '@/components/form-choice';
import { OptionPicker } from '@/components/option-picker';
import { Screen } from '@/components/screen';
import { ErrorState } from '@/components/state-views';
import { FormSkeleton } from '@/components/skeletons';
import { useToast } from '@/components/toast';
import { OrgAvatar } from '@/features/organizations/org-avatar';
import { FormTextField } from '@/features/users/form-text-field';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import {
  useBusinesses,
  useCreateOrganization,
  useOrganizations,
  useSetSpaceBusiness,
  useUpdateOrganization,
  useUpdateOrganizationFeatures,
} from './api';
import {
  DIRECT,
  businessChange,
  formFromOrganization,
  palettesOnOffer,
  slugFrom,
  trustBody,
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
  if (id && organizations.isPending) body = <FormSkeleton label="Loading the space…" fields={5} />;
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
  const updateFeatures = useUpdateOrganizationFeatures();
  const businesses = useBusinesses();
  const setBusiness = useSetSpaceBusiness();
  const [form, setForm] = useState<OrgFormState>(() => formFromOrganization(existing));
  const [slugTouched, setSlugTouched] = useState(Boolean(existing));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // What was typed is not lost to a swipe or Back (ux-audit F-3).
  const dirty = useDirty(form);
  const { leave } = useUnsavedChangesGuard(dirty);
  const pending = create.isPending || update.isPending || updateFeatures.isPending || setBusiness.isPending;

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
        const trust = trustBody(existing, form.quest_trusted);
        if (trust) await updateFeatures.mutateAsync({ id: existing.id, input: trust });
        const business = businessChange(existing, form);
        if (business) await setBusiness.mutateAsync({ id: existing.id, ...business });
        toast.success(`${form.name} saved.`);
      } else {
        await create.mutateAsync(verdict.input);
        toast.success(`${form.name} created. Add its first admin next.`);
      }
      leave(close);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setErrors(caught.status === 409 ? { slug: caught.message } : caught.fieldErrors);
        toast.error(caught.message);
      } else {
        toast.error('Could not save the space.');
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
          {existing ? existing.name : 'New space'}
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

      {/* Phase 54: who families pay. An organization (its TIN, its 1099s, its cut), or nobody: paid
          directly, each family paying the tutor of each lesson. Applies going forward. */}
      <View style={{ gap: space.xs }}>
        <OptionPicker
          testID="org-form-business"
          label="Organization"
          placeholder={PAID_DIRECTLY_LABEL}
          options={[
            { id: DIRECT, label: PAID_DIRECTLY_LABEL },
            ...(businesses.data?.data ?? [])
              .filter((b) => !b.archived_at || b.id === existing?.business?.id)
              .map((b) => ({ id: b.id, label: b.name })),
          ]}
          value={form.business_id}
          onChange={(value) => set('business_id', value)}
          error={errors.business_id}
          defaultOpen={false}
          scroll
        />
        <Text testID="org-form-business-hint" variant="bodySmall" style={{ color: muted }}>
          {form.business_id === DIRECT
            ? 'Families pay each tutor directly: one price per lesson, nobody’s cut, no 1099s from the space.'
            : 'Families pay the organization, which pays the tutors and files their 1099s.'}
          {existing ? ' A change applies from now on; recorded lessons and payments keep theirs.' : ''}
        </Text>
      </View>

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

      {existing ? (
        // Phase 51: a space whose Quest reviews only suggest approvals, for the console to decide.
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
            <Text variant="bodyMedium">Quest reviews approve questions</Text>
            <Text variant="bodySmall" style={{ color: muted }}>
              Off: its tutors’ “Question is right” only suggests the approval here, in the console.
            </Text>
          </View>
          <Switch
            testID="org-form-quest-trusted"
            accessibilityLabel="Quest reviews approve questions"
            value={form.quest_trusted}
            onValueChange={(value) => {
              haptics.selection();
              set('quest_trusted', value);
            }}
          />
        </View>
      ) : (
        // Phase 50: what it may use, all ticked unless unticked. Editing leaves them to the
        // organization screen's Feature sets section.
        <Field label="Feature sets">
          <View>
            {FEATURE_SETS.map((feature) => (
              <Checkbox.Item
                key={feature}
                testID={`org-form-feature-${feature}`}
                label={FEATURE_SET_LABELS[feature]}
                status={form.features[feature] ? 'checked' : 'unchecked'}
                onPress={() => {
                  haptics.selection();
                  set('features', { ...form.features, [feature]: !form.features[feature] });
                }}
                position="leading"
                mode="android"
                labelStyle={{ textAlign: 'left' }}
                style={{ paddingHorizontal: 0 }}
              />
            ))}
          </View>
        </Field>
      )}

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
          {existing ? 'Save' : 'Create space'}
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
