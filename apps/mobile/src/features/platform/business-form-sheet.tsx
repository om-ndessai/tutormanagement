// Ported from apps/web/src/features/platform/businesses-page.tsx @ 24066d9 (working tree):
// BusinessDialog, as a form sheet (`(platform)/business-form`, `?id=` to edit). The payer box on every
// 1099 the organization files. The TIN is its EIN -- never a Social Security number, which the shared
// schema refuses (optionalText) before any request.
import type { BusinessListItem } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { SecureMoney } from '@/components/secure-money';
import { ErrorState } from '@/components/state-views';
import { FormSkeleton } from '@/components/skeletons';
import { useToast } from '@/components/toast';
import { useDirty, useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes';
import { FormTextField } from '@/features/users/form-text-field';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useBusinesses, useCreateBusiness, useUpdateBusiness } from './api';
import {
  BUSINESS_FIELDS,
  formFromBusiness,
  validateBusinessForm,
  type BusinessField,
  type BusinessForm,
} from './business-form';

function close() {
  if (router.canGoBack()) router.back();
}

export function BusinessFormSheet({ id }: { id?: string }) {
  const businesses = useBusinesses();
  const existing = id ? (businesses.data?.data.find((row) => row.id === id) ?? null) : null;

  let body;
  if (id && businesses.isPending) body = <FormSkeleton label="Loading the organization…" fields={4} />;
  else if (id && (businesses.isError || !existing))
    body = (
      <ErrorState
        error={businesses.error ?? new ApiRequestError(404, 'not_found', 'Not found.')}
        onRetry={() => void businesses.refetch()}
      />
    );
  else body = <BusinessFormBody key={existing?.id ?? 'new'} existing={existing} />;

  return (
    <Screen testID="screen-business-form" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      {/* The TIN: a sole proprietor's would be their SSN (ux-audit F-1). */}
      <SecureMoney tag="business-form" />
      {body}
    </Screen>
  );
}

const EXTRA: Partial<Record<BusinessField, Partial<React.ComponentProps<typeof FormTextField>>>> = {
  tin: { placeholder: '12-3456789', autoCapitalize: 'none', autoComplete: 'off' },
  payer_address_line1: { autoComplete: 'street-address' },
  payer_state: { placeholder: 'NC', autoCapitalize: 'characters', maxLength: 2 },
  payer_postal_code: { placeholder: '27514', keyboardType: 'number-pad', maxLength: 10 },
};

function BusinessFormBody({ existing }: { existing: BusinessListItem | null }) {
  const theme = useAppTheme();
  const toast = useToast();
  const create = useCreateBusiness();
  const update = useUpdateBusiness();
  const [form, setForm] = useState<BusinessForm>(() => formFromBusiness(existing));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = useDirty(form);
  const { leave } = useUnsavedChangesGuard(dirty);
  const pending = create.isPending || update.isPending;

  async function save() {
    Keyboard.dismiss();
    setErrors({});
    const verdict = validateBusinessForm(form, !existing);
    if (!verdict.ok) {
      setErrors(verdict.errors);
      haptics.error();
      return;
    }
    try {
      if (existing) await update.mutateAsync({ id: existing.id, input: verdict.input });
      else await create.mutateAsync(verdict.input);
      haptics.success();
      toast.success(`${form.name} saved.`);
      leave(close);
    } catch (caught) {
      haptics.error();
      if (caught instanceof ApiRequestError) {
        setErrors(caught.fieldErrors);
        toast.error(caught.message);
      } else {
        toast.error('Could not save the organization.');
      }
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {existing ? existing.name : 'New organization'}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          The payer box on every 1099 it files. The TIN is the organization’s EIN — never a Social Security
          number, which the portal refuses to store.
        </Text>
      </View>
      {BUSINESS_FIELDS.map(([key, label]) => (
        <FormTextField
          key={key}
          testID={`business-form-${key}`}
          label={label}
          optional={key !== 'name'}
          value={form[key]}
          error={errors[key]}
          autoCapitalize={key === 'name' ? 'words' : undefined}
          onChangeText={(value) => {
            setForm((previous) => ({ ...previous, [key]: value }));
            if (errors[key]) setErrors(({ [key]: _gone, ...rest }) => rest);
          }}
          {...EXTRA[key]}
        />
      ))}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm }}>
        <Button mode="text" onPress={close}>
          Cancel
        </Button>
        <Button
          testID="business-form-save"
          mode="contained"
          onPress={() => void save()}
          loading={pending}
          disabled={pending}
        >
          Save
        </Button>
      </View>
    </View>
  );
}
