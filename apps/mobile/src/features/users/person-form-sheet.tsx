// The web's UserFormDialog as a form sheet: `(org)/person-form` with `?id=` to edit, `?preset=`
// roles, `?guardian=` a preset guardian, `?sections=` the blocks to show, and `?for=guardian` when
// it was opened from a student's guardian list to add a parent there; `?request=<userId>` lets in
// someone who asked to join (Phase 52: their name and email come from the cached requests, never the
// link). Admin only, as the API
// (`requireAdmin`): the person themselves asks the office to change their record.
import type { UserDetail } from '@tmi/shared';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import type { ScrollView } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState } from '@/components/state-views';
import { FormSkeleton } from '@/components/skeletons';
import { announceFormSaved } from '@/lib/form-bridge';
import { useJoinRequests, useRefreshJoinRequests } from '@/features/organizations/api';
import { useAuth } from '@/providers/auth-provider';
import { space } from '@/theme/tokens';
import { useUserDetail } from './api';
import { announceGuardianCreated } from './guardian-bridge';
import { PersonForm } from './person-form';
import { parsePreset, parseSections } from './person-form-model';
import { recordSection } from './record-sections';

function close() {
  if (router.canGoBack()) router.back();
}

export function PersonFormSheet({
  id,
  preset,
  guardian,
  sections,
  section,
  forGuardian,
  request,
}: {
  id?: string;
  preset?: string;
  guardian?: string;
  sections?: string;
  /** One section of the person's record (U5): its blocks, under its title. */
  section?: string;
  forGuardian: boolean;
  /** Phase 52: the id of the person whose request to join this lets in. */
  request?: string;
}) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const detail = useUserDetail(isAdmin && id ? id : null);
  const letting = Boolean(request) && !id;
  const requests = useJoinRequests(isAdmin && letting);
  const joinRequest = letting ? requests.data?.data.find((r) => r.user_id === request) : undefined;
  const refreshJoinRequests = useRefreshJoinRequests();
  // A failed save lists its messages beside the buttons at the foot of the form: bring them into
  // view, since the field at fault is usually far up a long form (ux-audit F-7, F-22).
  const scrollRef = useRef<ScrollView>(null);
  const reduceMotion = useReducedMotion();
  const showErrors = useCallback(
    () => scrollRef.current?.scrollToEnd({ animated: !reduceMotion }),
    [reduceMotion],
  );

  // A half-filled record is not lost to a swipe or Back (ux-audit F-3).
  const [dirty, setDirty] = useState(false);
  const { leave } = useUnsavedChangesGuard(dirty);

  function saved(person: UserDetail) {
    // A parent added from a student's form goes back to that form, chosen.
    if (forGuardian) {
      announceGuardianCreated({ id: person.id, full_name: person.full_name, email: person.email });
    }
    if (joinRequest) void refreshJoinRequests();
    // The welcome wizard, when it opened this sheet, carries on from the saved record.
    announceFormSaved({ form: 'person', id: person.id, name: person.full_name });
    leave(close);
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
  } else if (letting && requests.isPending) {
    body = <FormSkeleton label="Loading the request…" fields={3} />;
  } else if (letting && requests.isError) {
    body = <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />;
  } else if (letting && !joinRequest) {
    // Answered already, on another device or by another admin.
    body = (
      <EmptyState
        testID="person-form-request-missing"
        icon="account-question-outline"
        title="That request was not found."
        body="Someone may have answered it already."
      />
    );
  } else if (joinRequest) {
    body = (
      <PersonForm
        key={`request-${joinRequest.user_id}`}
        preset={{ roles: [], full_name: joinRequest.full_name, email: joinRequest.email ?? '' }}
        joinRequestUserId={joinRequest.user_id}
        title={`Let ${joinRequest.full_name} in`}
        description="Choose what they do here. They are a member as soon as you save."
        onSaved={saved}
        onCancel={close}
        onFailedSave={showErrors}
        onDirtyChange={setDirty}
      />
    );
  } else if (id && detail.isPending) {
    body = <FormSkeleton label="Loading record…" fields={5} />;
  } else if (id && detail.isError) {
    body = <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  } else {
    const record = id ? detail.data?.data : undefined;
    // A section of the record (U5) names its own blocks and title.
    const fromRecord = record ? recordSection(section) : undefined;
    const shown = forGuardian
      ? (parseSections(sections) ?? ['identity', 'payment-handles'])
      : (fromRecord?.form ?? parseSections(sections));
    // The tutor record's Finish tax setup card (UI upgrades U3) opens just the tax fields.
    const taxSetup = Boolean(shown?.includes('tutor-tax'));
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
        sections={shown}
        title={
          forGuardian
            ? 'Add a parent'
            : fromRecord
              ? `${fromRecord.title}: ${record?.full_name ?? ''}`
              : taxSetup
                ? 'Finish tax setup'
                : undefined
        }
        description={
          forGuardian
            ? 'The parent or guardian: they sign in with this Google address, and are billed for the lessons.'
            : fromRecord
              ? fromRecord.editDescription
              : taxSetup
                ? 'For their 1099: where to send it, and whether the office holds their SSN — a tick, never the number.'
                : undefined
        }
        onSaved={saved}
        onCancel={close}
        onFailedSave={showErrors}
        onDirtyChange={setDirty}
      />
    );
  }

  return (
    <Screen
      testID="screen-person-form"
      edges={['bottom']}
      contentStyle={{ paddingTop: space.xl }}
      scrollRef={scrollRef}
      // This form brings its foot, where the messages are listed, into view itself (B2).
      scrollToErrors={false}
    >
      {body}
    </Screen>
  );
}
