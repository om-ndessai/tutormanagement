// "New parent" inside Add a student's Family step (UI upgrades U3): a quick sheet of three things
// -- name, email, phone -- that creates the parent on its own (`POST /users`, role parent) and hands
// them back to the step, chosen, through `guardian-bridge`. The student and their guardians are
// still sent in ONE request at the end of the flow, so the guardian rule is unchanged. The same
// three fields and the same shared schema as the web's NewParentDialog. Payment handles stay on the
// parent's record (the full form), to keep this to three inputs.
import { createUserRequestSchema } from '@tmi/shared';
import { useState } from 'react';
import { AccessibilityInfo, ScrollView, View } from 'react-native';

import { useOffline } from '@/components/connectivity';
import { QuickSheet } from '@/components/quick-sheet';
import { EmptyState } from '@/components/state-views';
import { issuesToErrors } from '@/features/teaching/session-form/use-session-form';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { space } from '@/theme/tokens';
import { useCreateUser } from './api';
import { FormTextField } from './form-text-field';
import { announceGuardianCreated } from './guardian-bridge';

export function NewParentSheet({ name: initialName = '' }: { name?: string }) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const offline = useOffline();
  const createUser = useCreateUser();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const dirty = name !== initialName || email !== '' || phone !== '';

  const clear = (field: string) =>
    setErrors((was) => {
      if (!(field in was)) return was;
      const { [field]: _gone, ...rest } = was;
      return rest;
    });

  if (!isAdmin) {
    // A fitted sheet sizes only a root ScrollView (QuickSheet).
    return (
      <ScrollView>
        <EmptyState
          icon="lock-outline"
          title="Only an admin can add a parent."
          body="Ask an administrator to add the family."
        />
      </ScrollView>
    );
  }

  return (
    <QuickSheet
      testID="new-parent"
      title="New parent"
      description="They sign in with this Google address and are billed for the lessons."
      primaryLabel="Add parent"
      primaryIcon="account-plus-outline"
      loading={createUser.isPending}
      primaryDisabled={offline}
      error={offline ? 'You are offline. Adding the parent needs a connection.' : formError}
      dirty={dirty}
      onPrimary={async ({ leave }) => {
        setFormError(null);
        const parsed = createUserRequestSchema.safeParse({
          full_name: name,
          email,
          phone: phone || null,
          roles: ['parent'],
        });
        if (!parsed.success) {
          setErrors(issuesToErrors(parsed.error.issues));
          haptics.error();
          return;
        }
        try {
          const saved = await createUser.mutateAsync(parsed.data as never);
          const parent = saved.data;
          announceGuardianCreated({ id: parent.id, full_name: parent.full_name, email: parent.email });
          // No toast: it would sit over the step flow's footer, where the next tap goes. The card
          // that appears on the Family step says it; a screen reader hears it.
          haptics.success();
          AccessibilityInfo.announceForAccessibility(`${parent.full_name} added as a parent and chosen.`);
          leave();
        } catch (error) {
          haptics.error();
          if (error instanceof ApiRequestError) {
            setErrors(error.fieldErrors);
            setFormError(Object.keys(error.fieldErrors).length > 0 ? null : error.message);
            return;
          }
          setFormError('Could not add the parent.');
        }
      }}
    >
      <View style={{ gap: space.md }}>
        <FormTextField
          testID="new-parent-name"
          label="Full name"
          value={name}
          onChangeText={(value) => {
            setName(value);
            clear('full_name');
          }}
          placeholder="Hannah Marsh"
          autoCapitalize="words"
          textContentType="name"
          error={errors.full_name}
        />
        <FormTextField
          testID="new-parent-email"
          label="Email"
          hint="Their Google address."
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            clear('email');
          }}
          placeholder="hannah@gmail.com"
          keyboardType="email-address"
          autoCapitalize="none"
          textContentType="emailAddress"
          error={errors.email}
        />
        <FormTextField
          testID="new-parent-phone"
          label="Phone"
          optional
          value={phone}
          onChangeText={(value) => {
            setPhone(value);
            clear('phone');
          }}
          placeholder="(919) 555-0142"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          error={errors.phone}
        />
      </View>
    </QuickSheet>
  );
}
