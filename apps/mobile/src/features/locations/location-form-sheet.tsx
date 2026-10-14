// Ported from apps/web/src/features/locations/location-dialog.tsx @ 2933e3f (Phase 33, working tree).
// The dialog becomes a form sheet, `(org)/location-form`: `?owner=<user>` to add one of their
// locations, `&id=<location>` to edit it. Who may is the server's (R16): an admin anyone's, a tutor or
// student their own, a parent their child's; anyone else finds no such location.
import {
  LOCATION_KINDS,
  LOCATION_KIND_LABELS,
  MAX_REMINDER_MINUTES,
  locationInputSchema,
  locationUpdateSchema,
  type Location,
  type LocationKind,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { OfflineSaveNote, useOffline } from '@/components/connectivity';
import { FieldError } from '@/components/field-error';
import { Field } from '@/components/form-choice';
import { Screen } from '@/components/screen';
import { ErrorState } from '@/components/state-views';
import { FormSkeleton } from '@/components/skeletons';
import { useToast } from '@/components/toast';
import { issuesToErrors } from '@/features/teaching/session-form/use-session-form';
import { useUserDetail } from '@/features/users/api';
import { useDirty, useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useCreateLocation, useLocations, useUpdateLocation } from './api';

function close() {
  if (router.canGoBack()) router.back();
}

export function LocationFormSheet({
  ownerId,
  locationId,
}: {
  ownerId: string;
  locationId: string | undefined;
}) {
  const list = useLocations(ownerId || null);
  const owner = useUserDetail(ownerId || null);
  const ownerName = owner.data?.data.full_name ?? null;

  let body;
  if (!ownerId) {
    body = <ErrorState error={new ApiRequestError(404, 'not_found', 'That person does not exist.')} />;
  } else if (!locationId) {
    body = <LocationForm ownerId={ownerId} ownerName={ownerName} existing={null} />;
  } else if (list.isPending) {
    body = <FormSkeleton label="Loading the location…" fields={4} />;
  } else if (list.isError) {
    body = <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  } else {
    const existing = list.data.data.find((row) => row.id === locationId);
    body = existing ? (
      <LocationForm key={existing.id} ownerId={ownerId} ownerName={existing.owner_name} existing={existing} />
    ) : (
      <ErrorState error={new ApiRequestError(404, 'not_found', 'That location does not exist.')} />
    );
  }

  return (
    <Screen testID="screen-location-form" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      {body}
    </Screen>
  );
}

/** Add or edit one of a person's locations. */
export function LocationForm({
  ownerId,
  ownerName,
  existing,
}: {
  ownerId: string;
  ownerName: string | null;
  existing: Location | null;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const toast = useToast();
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<LocationKind>(existing?.kind ?? 'physical');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [reminder, setReminder] = useState(String(existing?.reminder_minutes ?? 0));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // What was typed is not lost to a swipe or Back (ux-audit F-3); offline, Save waits (F-16).
  const dirty = useDirty({ name, kind, address, reminder });
  const { leave } = useUnsavedChangesGuard(dirty);
  const offline = useOffline();

  const create = useCreateLocation();
  const update = useUpdateLocation();
  const saving = create.isPending || update.isPending;

  async function handleSave() {
    setErrors({});
    const minutes = Number(reminder.trim() === '' ? 'x' : reminder);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_REMINDER_MINUTES) {
      setErrors({ reminder_minutes: 'Use whole minutes, from 0 (no reminder) up to a day.' });
      haptics.error();
      return;
    }
    const fields = { name: name.trim(), kind, address: address.trim() || null, reminder_minutes: minutes };
    try {
      if (existing) {
        const parsed = locationUpdateSchema.safeParse(fields);
        if (!parsed.success) {
          setErrors(issuesToErrors(parsed.error.issues));
          haptics.error();
          return;
        }
        await update.mutateAsync({ id: existing.id, input: parsed.data });
      } else {
        const parsed = locationInputSchema.safeParse({ owner_user_id: ownerId, ...fields });
        if (!parsed.success) {
          setErrors(issuesToErrors(parsed.error.issues));
          haptics.error();
          return;
        }
        await create.mutateAsync(parsed.data);
      }
      toast.success(existing ? 'Location updated.' : 'Location added.');
      leave(close);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
        return;
      }
      toast.error('Could not save the location.');
    }
  }

  const virtual = kind === 'virtual';

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {existing ? 'Edit location' : 'Add a location'}
        </Text>
        <Text variant="bodyMedium" style={{ color: muted }}>
          {ownerName ? `Where ${ownerName} likes to have lessons.` : 'Where they like to have lessons.'}
        </Text>
      </View>

      <View>
        <TextInput
          testID="location-form-name"
          mode="outlined"
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Main library, room 2"
          returnKeyType="done"
          error={Boolean(errors.name)}
        />
        {errors.name ? <FieldError>{errors.name}</FieldError> : null}
      </View>

      <Field label="Type" error={errors.kind}>
        <SegmentedButtons
          value={kind}
          onValueChange={(value) => {
            haptics.selection();
            setKind(value as LocationKind);
          }}
          buttons={LOCATION_KINDS.map((value) => ({
            value,
            label: LOCATION_KIND_LABELS[value],
            testID: `location-form-kind-${value}`,
          }))}
        />
      </Field>

      <View>
        <TextInput
          testID="location-form-address"
          mode="outlined"
          label={virtual ? 'Meeting link or instructions (optional)' : 'Address (optional)'}
          value={address}
          onChangeText={setAddress}
          placeholder={virtual ? 'https://meet.example.com/…' : '123 Main St, Cary NC'}
          autoCapitalize={virtual ? 'none' : 'sentences'}
          keyboardType={virtual ? 'url' : 'default'}
          returnKeyType="done"
          error={Boolean(errors.address)}
        />
        {errors.address ? <FieldError>{errors.address}</FieldError> : null}
      </View>

      <View style={{ gap: space.xs }}>
        <TextInput
          testID="location-form-reminder"
          mode="outlined"
          label="Reminder, minutes before"
          value={reminder}
          onChangeText={setReminder}
          // iOS's number pad has no return key, so it could never be put away: this one has.
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'number-pad'}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          error={Boolean(errors.reminder_minutes)}
        />
        {errors.reminder_minutes ? (
          <FieldError>{errors.reminder_minutes}</FieldError>
        ) : (
          <Text variant="bodySmall" style={{ color: muted }}>
            0 means no reminder. The app and the portal remind everyone in the lesson.
          </Text>
        )}
      </View>
      {errors.form ? <FieldError>{errors.form}</FieldError> : null}

      <View style={{ gap: space.sm }}>
        <Button
          testID="location-form-save"
          mode="contained"
          onPress={() => void handleSave()}
          loading={saving}
          disabled={saving || offline}
        >
          {existing ? 'Save changes' : 'Add location'}
        </Button>
        <OfflineSaveNote offline={offline} />
        <Button testID="location-form-cancel" mode="outlined" onPress={close} disabled={saving}>
          Cancel
        </Button>
      </View>
    </View>
  );
}
