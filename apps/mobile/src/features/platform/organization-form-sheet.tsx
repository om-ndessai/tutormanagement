// Ported from apps/web/src/features/platform/organization-dialog.tsx @ 1132322 (the form).
// Creating or editing a space: its name and address name, its look (palette, the built-in logo), its
// clock and its email notifications. Logos and admins live on the space's screen (they need it to
// exist). Phase 50: creating also picks what it may use. Phase 59 (@ f96b984, working tree,
// docs/spaces-plan.md S2): "Who families pay" -- the space, with its payer details, or each tutor
// directly; a change applies from now on. The swatch colours are each palette's own (ORG_PALETTE_HEX), as data.
import {
  FEATURE_SETS,
  FEATURE_SET_LABELS,
  ORG_PALETTE_HEX,
  ORG_PALETTE_LABELS,
  ORG_TIME_ZONES,
  ORG_TIME_ZONE_LABELS,
  SPACE_PAYMENT_MODELS,
  SPACE_PAYMENT_MODEL_DESCRIPTIONS,
  SPACE_PAYMENT_MODEL_LABELS,
  type OrgPalette,
  type OrgTimeZone,
  type OrganizationListItem,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { Button, Checkbox, RadioButton, Switch, Text } from 'react-native-paper';

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
  useCreateOrganization,
  useOrganizations,
  useSetPaymentModel,
  useUpdateOrganization,
  useUpdateOrganizationFeatures,
} from './api';
import {
  EMPTY_PAYER,
  formFromOrganization,
  payerForm,
  paymentModelChange,
  palettesOnOffer,
  slugFrom,
  trustBody,
  validateOrgForm,
  type OrgFormState,
  type PayerFormState,
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
  const setPaymentModel = useSetPaymentModel();
  const [form, setForm] = useState<OrgFormState>(() => formFromOrganization(existing));
  const [slugTouched, setSlugTouched] = useState(Boolean(existing));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // What was typed is not lost to a swipe or Back (ux-audit F-3).
  const dirty = useDirty(form);
  const { leave } = useUnsavedChangesGuard(dirty);
  const pending = create.isPending || update.isPending || updateFeatures.isPending || setPaymentModel.isPending;

  function set<K extends keyof OrgFormState>(key: K, value: OrgFormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    if (errors[key]) setErrors(({ [key]: _gone, ...rest }) => rest);
  }

  async function save() {
    Keyboard.dismiss();
    setErrors({});
    // On an edit, only the payer fields that changed travel, as on the web.
    const loaded = existing ? payerForm(existing.payer) : EMPTY_PAYER;
    const verdict = validateOrgForm(form, !existing, loaded);
    if (!verdict.ok) {
      setErrors(verdict.errors);
      haptics.error();
      return;
    }
    try {
      if (existing) {
        // Who families pay first: a space that starts collecting gets its own payer record, which
        // the PATCH below then fills in.
        const model = paymentModelChange(existing, form);
        if (model) await setPaymentModel.mutateAsync({ id: existing.id, ...model });
        await update.mutateAsync({ id: existing.id, input: verdict.input });
        const trust = trustBody(existing, form.quest_trusted, form.checked_questions);
        if (trust) await updateFeatures.mutateAsync({ id: existing.id, input: trust });
        toast.success(`${form.name} saved.`);
      } else {
        await create.mutateAsync(verdict.input);
        toast.success(`${form.name} created. Add its first admin next.`);
      }
      leave(close);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setErrors(
          caught.status === 409 && caught.code === 'conflict' ? { slug: caught.message } : caught.fieldErrors,
        );
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
            ? 'Its identity, look and who families pay. Its own admins can keep its payer details too.'
            : 'Its name, look and who families pay. Its admins come next, once it exists.'}
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

      {/* Phase 59 (S2): who families pay -- the space (its own payer details, its 1099s, its cut), or
          each lesson's tutor directly. A change applies going forward. */}
      <View
        testID="org-form-payment-model"
        style={{
          gap: space.sm,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          borderRadius: radius.md,
          padding: space.md,
        }}
      >
        <Text variant="bodyMedium" accessibilityRole="header">
          Who families pay
        </Text>
        <RadioButton.Group
          value={form.payment_model}
          onValueChange={(value) => {
            haptics.selection();
            set('payment_model', value as OrgFormState['payment_model']);
          }}
        >
          {SPACE_PAYMENT_MODELS.map((model) => (
            <Pressable
              key={model}
              testID={`org-form-payment-${model}`}
              accessibilityRole="radio"
              accessibilityLabel={SPACE_PAYMENT_MODEL_LABELS[model]}
              accessibilityState={{ checked: form.payment_model === model }}
              onPress={() => {
                haptics.selection();
                set('payment_model', model);
              }}
              style={{ minHeight: MIN_TARGET, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}
            >
              <RadioButton.Android value={model} />
              <View style={{ flex: 1, gap: 2, paddingTop: space.sm }}>
                <Text variant="bodyMedium">{SPACE_PAYMENT_MODEL_LABELS[model]}</Text>
                <Text variant="bodySmall" style={{ color: muted }}>
                  {SPACE_PAYMENT_MODEL_DESCRIPTIONS[model]}
                </Text>
              </View>
            </Pressable>
          ))}
        </RadioButton.Group>
        {existing ? (
          <Text testID="org-form-payment-hint" variant="bodySmall" style={{ color: muted }}>
            A change applies from now on; recorded lessons and payments keep theirs.
          </Text>
        ) : null}
        {form.payment_model === 'space' ? (
          <PayerFields
            payer={form.payer}
            errors={errors}
            spaceName={form.name}
            onChange={(key, value) => {
              set('payer', { ...form.payer, [key]: value });
              if (errors[key]) setErrors(({ [key]: _gone, ...rest }) => rest);
            }}
          />
        ) : null}
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
        <>
        {/* Phase 51: a space whose Quest reviews only suggest approvals, for the console to decide. */}
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
        {/* Phase 62 (P1): whether its games, tiles and Assessments also draw checked ("Beta") questions. */}
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
            <Text variant="bodyMedium">Checked questions (Beta)</Text>
            <Text variant="bodySmall" style={{ color: muted }}>
              Games, tiles and assessments here also draw questions the bank has checked but no person has
              approved, each marked Beta. Off: approved questions only.
            </Text>
          </View>
          <Switch
            testID="org-checked-questions-switch"
            accessibilityLabel="Checked questions (Beta)"
            value={form.checked_questions}
            onValueChange={(value) => {
              haptics.selection();
              set('checked_questions', value);
            }}
          />
        </View>
        </>
      ) : (
        // Phase 50: what it may use, all ticked unless unticked. Editing leaves them to the space
        // screen's "This space may use" section (S3).
        <Field label="This space may use">
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
        label="Wear the built-in logo"
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

/** Phase 59: the space's payer details, shown while "The space" is who families pay. */
function PayerFields({
  payer,
  errors,
  spaceName,
  onChange,
}: {
  payer: PayerFormState;
  errors: Record<string, string>;
  spaceName: string;
  onChange: (key: keyof PayerFormState, value: string) => void;
}) {
  const field = (
    key: keyof PayerFormState,
    testID: string,
    label: string,
    extra: Partial<ComponentProps<typeof FormTextField>> = {},
  ) => (
    <FormTextField
      testID={testID}
      label={label}
      optional
      value={payer[key]}
      error={errors[key]}
      autoComplete="off"
      onChangeText={(value) => onChange(key, value)}
      {...extra}
    />
  );
  return (
    <View testID="org-form-payer" style={{ gap: space.md }}>
      {field('payer_name', 'org-form-payer-name', 'Name on the 1099', {
        hint: 'The space’s own name when left blank.',
        placeholder: spaceName || undefined,
        autoCapitalize: 'words',
      })}
      {field('tin', 'org-form-payer-tin', 'Payer TIN', {
        hint: 'The space’s EIN -- never a Social Security number, which the portal refuses to store.',
        placeholder: '12-3456789',
        autoCapitalize: 'none',
      })}
      {field('payer_address_line1', 'org-form-payer-line1', 'Address', { autoCapitalize: 'words' })}
      {field('payer_address_line2', 'org-form-payer-line2', 'Address line 2', { autoCapitalize: 'words' })}
      {field('payer_city', 'org-form-payer-city', 'City', { autoCapitalize: 'words' })}
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}>
          {field('payer_state', 'org-form-payer-state', 'State', {
            placeholder: 'NC',
            autoCapitalize: 'characters',
            maxLength: 2,
          })}
        </View>
        <View style={{ flex: 1 }}>
          {field('payer_postal_code', 'org-form-payer-zip', 'ZIP', {
            placeholder: '27514',
            keyboardType: 'number-pad',
            maxLength: 10,
          })}
        </View>
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
