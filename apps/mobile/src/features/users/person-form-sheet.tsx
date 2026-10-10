// The web's UserFormDialog as a form sheet: `(org)/person-form` with `?id=` to edit, `?preset=`
// roles, `?guardian=` a preset guardian, `?sections=` the blocks to show, and `?for=guardian` when
// it was opened from a student's guardian list to add a parent there. Admin only, as the API
// (`requireAdmin`): the person themselves asks the office to change their record.
import type { UserDetail } from '@tmi/shared';
import { router } from 'expo-router';

import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import { announceFormSaved } from '@/lib/form-bridge';
import { useAuth } from '@/providers/auth-provider';
import { space } from '@/theme/tokens';
import { useUserDetail } from './api';
import { announceGuardianCreated } from './guardian-bridge';
import { PersonForm } from './person-form';
import { parsePreset, parseSections } from './person-form-model';

function close() {
  if (router.canGoBack()) router.back();
}

export function PersonFormSheet({
  id,
  preset,
  guardian,
  sections,
  forGuardian,
}: {
  id?: string;
  preset?: string;
  guardian?: string;
  sections?: string;
  forGuardian: boolean;
}) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const detail = useUserDetail(isAdmin && id ? id : null);

  function saved(person: UserDetail) {
    // A parent added from a student's form goes back to that form, chosen.
    if (forGuardian) {
      announceGuardianCreated({ id: person.id, full_name: person.full_name, email: person.email });
    }
    // The welcome wizard, when it opened this sheet, carries on from the saved record.
    announceFormSaved({ form: 'person', id: person.id, name: person.full_name });
    close();
  }

  let body;
  if (!isAdmin) {
    body = (
      <EmptyState
        icon="lock-outline"
        title="Only an admin can add or change a person's record."
        body="Something wrong with yours? Ask an administrator to update it."
      />
    );
  } else if (id && detail.isPending) {
    body = <LoadingState label="Loading record…" />;
  } else if (id && detail.isError) {
    body = <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  } else {
    const record = id ? detail.data?.data : undefined;
    body = (
      <PersonForm
        key={record?.id ?? 'new'}
        detail={record}
        preset={{
          roles: parsePreset(preset),
          guardians: guardian
            ? [{ guardian_user_id: guardian, relationship: 'guardian', is_primary: true }]
            : [],
        }}
        sections={
          forGuardian ? (parseSections(sections) ?? ['identity', 'payment-handles']) : parseSections(sections)
        }
        title={forGuardian ? 'Add a parent' : undefined}
        description={
          forGuardian
            ? 'The parent or guardian: they sign in with this Google address, and are billed for the lessons.'
            : undefined
        }
        onSaved={saved}
        onCancel={close}
      />
    );
  }

  return (
    <Screen testID="screen-person-form" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      {body}
    </Screen>
  );
}
