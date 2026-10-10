// Ported from apps/web/src/features/platform/platform-people-page.tsx @ 1132322.
// Correcting a person's SHARED details -- name, email, phone -- which show in every organization they
// belong to. An organization's own admins cannot change these for someone who belongs to more than
// one, which is what stops one organization taking over another's member by changing their email.
import { platformPersonLookupSchema, platformPersonUpdateSchema, type PlatformPerson } from '@tmi/shared';
import { useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { Panel } from '@/components/section';
import { useToast } from '@/components/toast';
import { FormTextField } from '@/features/users/form-text-field';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useLookupPerson, useUnpinPerson, useUpdatePerson } from './api';
import { firstErrors } from './form-errors';

export function PlatformPeopleScreen() {
  const theme = useAppTheme();
  const toast = useToast();
  const lookup = useLookupPerson();
  const update = useUpdatePerson();
  const unpin = useUnpinPerson();
  const [query, setQuery] = useState('');
  const [queryError, setQueryError] = useState<string | undefined>();
  const [person, setPerson] = useState<PlatformPerson | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function find() {
    Keyboard.dismiss();
    setQueryError(undefined);
    const parsed = platformPersonLookupSchema.safeParse({ email: query });
    if (!parsed.success) {
      setQueryError(parsed.error.issues[0]?.message);
      haptics.error();
      return;
    }
    try {
      const found = (await lookup.mutateAsync(parsed.data.email)).data;
      haptics.selection();
      setPerson(found);
      setForm({ full_name: found.full_name, email: found.email ?? '', phone: found.phone ?? '' });
      setErrors({});
    } catch (caught) {
      haptics.error();
      setPerson(null);
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Lookup failed.');
    }
  }

  async function save() {
    if (!person) return;
    Keyboard.dismiss();
    setErrors({});
    const parsed = platformPersonUpdateSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(firstErrors(parsed.error.issues));
      haptics.error();
      return;
    }
    try {
      const updated = (await update.mutateAsync({ id: person.id, input: form })).data;
      haptics.success();
      setPerson(updated);
      toast.success('Shared details saved, in every organization.');
    } catch (caught) {
      haptics.error();
      if (caught instanceof ApiRequestError) {
        // "Another person already has that email address" is a 409 with no field: it is the email's.
        setErrors(caught.status === 409 ? { email: caught.message } : caught.fieldErrors);
        toast.error(caught.message);
      } else {
        toast.error('Could not save the shared details.');
      }
    }
  }

  function confirmUnpin() {
    if (!person) return;
    haptics.warning();
    Alert.alert(
      'Unpin Google sign-in?',
      'The next Google sign-in with this address is accepted, whichever Google account it comes from.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpin',
          onPress: () =>
            unpin.mutate(person.id, {
              onSuccess: () => {
                haptics.success();
                setPerson({ ...person, google_sub_pinned: false });
                toast.success('Unpinned: the next Google sign-in with this address is accepted.');
              },
              onError: (error) => {
                haptics.error();
                toast.error(error instanceof ApiRequestError ? error.message : 'Could not unpin.');
              },
            }),
        },
      ],
    );
  }

  const field = (key: 'full_name' | 'email' | 'phone', label: string, extra: object = {}) => (
    <FormTextField
      testID={`platform-person-${key === 'full_name' ? 'name' : key}`}
      label={label}
      value={form[key]}
      error={errors[key]}
      onChangeText={(value) => setForm((previous) => ({ ...previous, [key]: value }))}
      autoComplete="off"
      {...extra}
    />
  );

  return (
    <Screen testID="screen-platform-people">
      <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
        Correct someone’s shared name, email or phone, or let a recreated Google account sign in again.
      </Text>
      <View style={{ gap: space.sm }}>
        <FormTextField
          testID="platform-people-query"
          label="Email address"
          value={query}
          error={queryError}
          onChangeText={setQuery}
          placeholder="name@gmail.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="off"
          returnKeyType="search"
          onSubmitEditing={() => void find()}
        />
        <Button
          testID="platform-people-find"
          mode="contained"
          icon="magnify"
          onPress={() => void find()}
          disabled={!query || lookup.isPending}
          loading={lookup.isPending}
          style={{ alignSelf: 'flex-end' }}
        >
          Find
        </Button>
      </View>

      {person ? (
        <Panel testID="platform-person-card">
          <View style={{ gap: space.md, paddingVertical: space.sm }}>
            <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
              Belongs to {person.organization_count}{' '}
              {person.organization_count === 1 ? 'organization' : 'organizations'}.
            </Text>
            {field('full_name', 'Name')}
            {field('email', 'Email', { keyboardType: 'email-address', autoCapitalize: 'none' })}
            {field('phone', 'Phone', { keyboardType: 'phone-pad', optional: true })}
            <Button
              testID="platform-person-save"
              mode="contained"
              onPress={() => void save()}
              loading={update.isPending}
              disabled={update.isPending}
              style={{ alignSelf: 'flex-end' }}
            >
              Save shared details
            </Button>
            {person.google_sub_pinned ? (
              <View
                style={{
                  gap: space.sm,
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.outlineVariant,
                  paddingTop: space.md,
                }}
              >
                <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                  Signed in with a Google account before. If that account was deleted and recreated, unpin it
                  so the new one can sign in.
                </Text>
                <Button
                  testID="platform-person-unpin"
                  mode="outlined"
                  onPress={confirmUnpin}
                  disabled={unpin.isPending}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Unpin Google sign-in
                </Button>
              </View>
            ) : null}
          </View>
        </Panel>
      ) : null}
    </Screen>
  );
}
