// Ported from apps/web/src/features/platform/organization-dialog.tsx (AdminsSection) @ 1132322.
// The organization's admins -- the only people of an organization the console lists (R14). Removing
// one asks first, which the web does not: a list row on a phone is easy to tap by accident.
import { addOrganizationAdminSchema, type OrganizationListItem } from '@tmi/shared';
import { useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';
import { Button, Chip, IconButton, Text } from 'react-native-paper';

import { Panel } from '@/components/section';
import { useToast } from '@/components/toast';
import { FormTextField } from '@/features/users/form-text-field';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useAddOrganizationAdmin, useOrganizationAdmins, useRemoveOrganizationAdmin } from './api';
import { firstErrors } from './form-errors';

export function AdminsSection({ organization }: { organization: OrganizationListItem }) {
  const theme = useAppTheme();
  const toast = useToast();
  const admins = useOrganizationAdmins(organization.id);
  const add = useAddOrganizationAdmin(organization.id);
  const remove = useRemoveOrganizationAdmin(organization.id);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const rows = admins.data?.data ?? [];

  async function addAdmin() {
    Keyboard.dismiss();
    setErrors({});
    const parsed = addOrganizationAdminSchema.safeParse({ email, full_name: name });
    if (!parsed.success) {
      setErrors(firstErrors(parsed.error.issues));
      haptics.error();
      return;
    }
    try {
      await add.mutateAsync({ email, full_name: name });
      haptics.success();
      toast.success(`${name || email} added as an admin of ${organization.name}.`);
      setEmail('');
      setName('');
    } catch (caught) {
      haptics.error();
      if (caught instanceof ApiRequestError) {
        setErrors(caught.fieldErrors);
        toast.error(caught.message);
      } else {
        toast.error('Could not add that admin.');
      }
    }
  }

  function confirmRemove(userId: string, fullName: string) {
    haptics.warning();
    Alert.alert(`Remove ${fullName} as an admin?`, `They stop administering ${organization.name}.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          remove.mutate(userId, {
            onSuccess: () => {
              haptics.success();
              toast.success(`${fullName} is no longer an admin of ${organization.name}.`);
            },
            onError: (error) => {
              haptics.error();
              toast.error(error instanceof ApiRequestError ? error.message : 'Could not remove that admin.');
            },
          }),
      },
    ]);
  }

  return (
    <Panel title="Admins" testID="platform-org-admins">
      <View style={{ gap: space.md }}>
        {rows.map((admin) => (
          <View
            key={admin.user_id}
            testID={`platform-org-admin-${admin.user_id}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              borderWidth: 1,
              borderColor: theme.colors.outlineVariant,
              borderRadius: radius.md,
              paddingLeft: space.md,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, paddingVertical: space.sm }}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {admin.full_name}
              </Text>
              <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.tokens.mutedForeground }}>
                {admin.email ?? 'No email'}
              </Text>
            </View>
            {admin.status !== 'active' ? (
              <Chip compact mode="outlined">
                {admin.status === 'invited' ? 'Invited' : 'Suspended'}
              </Chip>
            ) : null}
            <IconButton
              testID={`platform-org-admin-remove-${admin.user_id}`}
              icon="account-minus-outline"
              accessibilityLabel={`Remove ${admin.full_name} as an admin`}
              disabled={remove.isPending}
              onPress={() => confirmRemove(admin.user_id, admin.full_name)}
            />
          </View>
        ))}
        {admins.data && rows.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
            No admins yet. Add the first one below.
          </Text>
        ) : null}

        <FormTextField
          testID="platform-org-admin-email"
          label="Google address"
          value={email}
          error={errors.email}
          onChangeText={setEmail}
          placeholder="name@gmail.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="off"
        />
        <FormTextField
          testID="platform-org-admin-name"
          label="Name"
          value={name}
          error={errors.full_name}
          onChangeText={setName}
          autoComplete="off"
        />
        <Button
          testID="platform-org-admin-add"
          mode="contained-tonal"
          icon="account-plus-outline"
          onPress={() => void addAdmin()}
          loading={add.isPending}
          disabled={add.isPending || !email || !name}
          style={{ alignSelf: 'flex-end' }}
        >
          Add admin
        </Button>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          Someone new signs in with that Google address to accept. Someone who already uses the portal is
          invited, and accepts when they next sign in.
        </Text>
      </View>
    </Panel>
  );
}
