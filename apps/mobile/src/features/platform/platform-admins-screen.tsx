// Ported from apps/web/src/features/platform/platform-admins-page.tsx @ 1132322.
// Who may use this console. Adding someone gives them every organization's front door.
import { addPlatformAdminSchema, formatRelativeTime } from '@tmi/shared';
import { useState } from 'react';
import { Keyboard, View } from 'react-native';
import { Button, Divider, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { Panel } from '@/components/section';
import { ErrorState, LoadingState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { FormTextField } from '@/features/users/form-text-field';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useAddPlatformAdmin, usePlatformAdmins } from './api';
import { firstErrors } from './form-errors';

export function PlatformAdminsScreen() {
  const theme = useAppTheme();
  const toast = useToast();
  const admins = usePlatformAdmins();
  const add = useAddPlatformAdmin();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const rows = admins.data?.data ?? [];

  async function onRefresh() {
    setRefreshing(true);
    try {
      await admins.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  async function submit() {
    Keyboard.dismiss();
    setErrors({});
    const parsed = addPlatformAdminSchema.safeParse({ email, full_name: name });
    if (!parsed.success) {
      setErrors(firstErrors(parsed.error.issues));
      haptics.error();
      return;
    }
    try {
      await add.mutateAsync({ email, full_name: name });
      haptics.success();
      toast.success(`${name} is now a platform admin.`);
      setEmail('');
      setName('');
    } catch (caught) {
      haptics.error();
      if (caught instanceof ApiRequestError) {
        setErrors(caught.fieldErrors);
        toast.error(caught.message);
      } else {
        toast.error('Could not add that platform admin.');
      }
    }
  }

  return (
    <Screen testID="screen-platform-admins" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
        They create organizations and their admins. They see nothing inside an organization unless it makes
        them a member.
      </Text>

      <Panel testID="platform-admins-list">
        {admins.isPending ? (
          <LoadingState />
        ) : admins.isError ? (
          <ErrorState error={admins.error} onRetry={() => void admins.refetch()} />
        ) : (
          <View accessibilityLabel="Platform admins">
            {rows.map((admin, index) => (
              <View key={admin.user_id}>
                {index > 0 ? <Divider /> : null}
                <View
                  testID={`platform-admin-${admin.user_id}`}
                  style={{ paddingVertical: space.md, gap: 2 }}
                >
                  <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                    {admin.full_name}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                    {admin.email ?? 'No email'} · Added {formatRelativeTime(admin.created_at)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Panel>

      <Panel title="Add a platform admin" testID="platform-admin-add-form">
        <View style={{ gap: space.md }}>
          <FormTextField
            testID="platform-admin-email"
            label="Google address"
            value={email}
            error={errors.email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="off"
          />
          <FormTextField
            testID="platform-admin-name"
            label="Name"
            value={name}
            error={errors.full_name}
            onChangeText={setName}
            autoComplete="off"
          />
          <Button
            testID="platform-admin-add"
            mode="contained"
            icon="account-plus-outline"
            onPress={() => void submit()}
            loading={add.isPending}
            disabled={add.isPending || !email || !name}
            style={{ alignSelf: 'flex-end' }}
          >
            Add platform admin
          </Button>
        </View>
      </Panel>
    </Screen>
  );
}
