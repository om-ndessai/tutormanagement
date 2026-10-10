// The web's UserFormDialog as a form sheet: `(org)/person-form` with `?id=` to edit, `?preset=`
// roles, `?guardian=` a preset guardian, `?sections=` the blocks to show, and `?for=guardian` when
// it was opened from a student's guardian list to add a parent there. Admin only, as the API
// (`requireAdmin`): the person themselves asks the office to change their record.
import type { UserDetail } from '@tmi/shared';
import { router } from 'expo-router';
import { useCallback, useRef } from 'react';
import type { ScrollView } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Screen } from '@/components/screen';
import { EmptyState, ErrorState } from '@/components/state-views';
import { FormSkeleton } from '@/components/skeletons';
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
  // A failed save lists its messages beside the buttons at the foot of the form: bring them into
  // view, since the field at fault is usually far up a long form (ux-audit F-7, F-22).
  const scrollRef = useRef<ScrollView>(null);
  const reduceMotion = useReducedMotion();
  const showErrors = useCallback(
    () => scrollRef.current?.scrollToEnd({ animated: !reduceMotion }),
    [reduceMotion],
  );

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
    body = <FormSkeleton label="Loading record…" fields={5} />;
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
        onFailedSave={showErrors}
      />
    );
  }

  return (
    <Screen
      testID="screen-person-form"
      edges={['bottom']}
      contentStyle={{ paddingTop: space.xl }}
      scrollRef={scrollRef}
    >
      {body}
    </Screen>
  );
}
