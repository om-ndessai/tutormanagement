// Ported from apps/web/src/features/users/let-in-sheet.tsx @ ab71793
//
// Letting in someone who asked with the space's code (Phase 52), as a short sheet (owner, 2026-11-04; UI
// audit JF1): the role first (Member by default since Phase 79, below) -- then, for a parent,
// "Which child is theirs?": a student already here (linked as their guardian), one added now through Add a
// student (the parent preset as guardian, with its consent step), or later. A parent let in with no child here
// cannot start the space's assessment (J07, J07A), so the sheet asks at the moment the admin knows the answer.
// Anything else: the full person form on the request. The `/let-in?request=<userId>` route, a fitted quick
// sheet; the request comes from the cached requests, never the link, and is held once they are in (it then
// leaves the list). Adult admins only, as the API (`mayAddPeople`).
// Phase 72 (UI audit JF26, @ 98c40ab, working tree): it starts on the role the person asked for, where it is one of
// its choices, and says what they asked and their note (`let-in-asked`), which only the space's admins read (R32).
// Phase 79 (M5, @ 758a19f, working tree): Member first and the start for a learner or no role said (one tap to let
// someone in to play); no Admin for a teen (`request.teen`, R32); "Which child is theirs?" follows Parent only.
import {
  featureOn,
  formatRelativeTime,
  mayAddPeople,
  type ApiOk,
  type JoinRequest,
  type UserDetail,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { OptionPicker } from '@/components/option-picker';
import { QuickSheet } from '@/components/quick-sheet';
import { FormSkeleton } from '@/components/skeletons';
import { EmptyState, ErrorState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { useJoinRequests, useRefreshJoinRequests } from '@/features/organizations/api';
import { apiClient } from '@/lib/api-client';
import { problemMessage } from '@/lib/api-errors';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { useCreateUser, useUpdateUser, useUsers } from './api';
import {
  askedAsLine,
  firstNameOf,
  guardiansWith,
  initialLetInRole,
  letInChoices,
  letInContext,
  letInRequest,
  type LetInChoice,
  type LetInRole,
} from './let-in-model';

function close() {
  if (router.canGoBack()) router.back();
}

/** Out of this sheet, then into another route (a sheet cannot present a step flow over itself). */
function closeThen(go: () => void) {
  close();
  go();
}

export function LetInSheet({ requestId }: { requestId?: string }) {
  const { user, account } = useAuth();
  const allowed = mayAddPeople({ roles: user?.roles ?? [], account });
  const requests = useJoinRequests(allowed && Boolean(requestId));
  // Held once they are in: the request leaves the list (and the cache) while the sheet asks about their child.
  const [held, setHeld] = useState<JoinRequest | null>(null);
  const request = held ?? requests.data?.data.find((r) => r.user_id === requestId) ?? null;

  // A fitted sheet sizes only a root ScrollView (QuickSheet), so the states below sit in one.
  if (!allowed) {
    return (
      <ScrollView testID="let-in-sheet">
        <EmptyState
          icon="lock-outline"
          title="Only an admin can let people in."
          body="Ask an administrator of this space to answer the request."
        />
      </ScrollView>
    );
  }
  if (!request && requests.isPending) {
    return (
      <ScrollView testID="let-in-sheet">
        <FormSkeleton label="Loading the request…" fields={3} />
      </ScrollView>
    );
  }
  if (!request && requests.isError) {
    return (
      <ScrollView testID="let-in-sheet">
        <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />
      </ScrollView>
    );
  }
  if (!request) {
    // Answered already, on another device or by another admin.
    return (
      <ScrollView testID="let-in-sheet">
        <EmptyState
          testID="let-in-missing"
          icon="account-question-outline"
          title="That request was not found."
          body="Someone may have answered it already."
        />
      </ScrollView>
    );
  }
  return <LetInSteps request={request} onIn={setHeld} />;
}

function LetInSteps({ request, onIn }: { request: JoinRequest; onIn: (request: JoinRequest) => void }) {
  const { organization } = useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const tutoring = featureOn(organization, 'tutoring');
  const create = useCreateUser();
  const refreshRequests = useRefreshJoinRequests();
  // The sheet starts on the role they asked for (Phase 72, JF26), where it is one of its choices; else Member.
  const context = letInContext(request, tutoring);
  const [role, setRole] = useState<LetInRole>(() => initialLetInRole(request.role, context));
  const asked = askedAsLine(request.role);
  const [member, setMember] = useState<UserDetail | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const first = firstNameOf(request.full_name);

  if (member) return <ChildStep request={request} member={member} first={first} />;

  return (
    <QuickSheet
      testID="let-in-sheet"
      actionTestID="let-in"
      primaryTestID="let-in-submit"
      title={`Let ${request.full_name} in`}
      description={`${request.email ?? 'No address'} · asked ${formatRelativeTime(request.requested_at)}`}
      primaryLabel="Let in"
      primaryIcon="account-check-outline"
      loading={create.isPending}
      error={problem}
      onPrimary={async ({ leave }) => {
        setProblem(null);
        try {
          const answer = await create.mutateAsync(letInRequest(request, role));
          // They are in: their request leaves the list at once, whatever comes next here.
          onIn(request);
          void refreshRequests();
          toast.success(`${request.full_name} is in.`);
          if (role === 'parent') setMember(answer.data);
          else leave();
        } catch (caught) {
          haptics.error();
          setProblem(problemMessage(caught, 'Could not let them in. Please try again.'));
        }
      }}
    >
      {asked || request.note ? (
        <View
          testID="let-in-asked"
          style={{ gap: space.xs, padding: space.md, borderRadius: radius.md, backgroundColor: theme.tokens.muted }}
        >
          {asked ? <Text variant="bodyMedium">{asked}</Text> : null}
          {request.note ? <Text variant="bodyMedium">{`“${request.note}”`}</Text> : null}
        </View>
      ) : null}
      <View accessibilityRole="radiogroup" accessibilityLabel="What they do here" style={{ gap: space.sm }}>
        {letInChoices(context).map((choice) => (
          <RoleChoice key={choice.role} choice={choice} chosen={role} onChoose={setRole} />
        ))}
      </View>
      <Button
        testID="let-in-full-form"
        mode="text"
        compact
        style={{ alignSelf: 'flex-start' }}
        contentStyle={{ minHeight: MIN_TARGET }}
        disabled={create.isPending}
        onPress={() =>
          closeThen(() => router.push({ pathname: '/person-form', params: { request: request.user_id } }))
        }
      >
        Something else? The full form
      </Button>
    </QuickSheet>
  );
}

function RoleChoice({
  choice,
  chosen,
  onChoose,
}: {
  choice: LetInChoice;
  chosen: LetInRole;
  onChoose: (role: LetInRole) => void;
}) {
  const theme = useAppTheme();
  const selected = chosen === choice.role;
  return (
    <Pressable
      testID={`let-in-role-${choice.role}`}
      accessibilityRole="radio"
      accessibilityLabel={`${choice.title}. ${choice.hint}`}
      // `selected` too, as the grade row's: what a flow reads on both systems.
      accessibilityState={{ checked: selected, selected }}
      onPress={() => {
        haptics.selection();
        onChoose(choice.role);
      }}
      style={({ pressed }) => ({
        minHeight: MIN_TARGET,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.md,
        padding: space.md,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
        backgroundColor: pressed ? theme.tokens.muted : 'transparent',
      })}
    >
      <Icon
        source={selected ? 'radiobox-marked' : 'radiobox-blank'}
        size={22}
        color={selected ? theme.colors.primary : theme.tokens.mutedForeground}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleSmall">{choice.title}</Text>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {choice.hint}
        </Text>
      </View>
    </Pressable>
  );
}

/** "Which child is <first>'s?": link a student here, add their child now, or later. */
function ChildStep({ request, member, first }: { request: JoinRequest; member: UserDetail; first: string }) {
  const toast = useToast();
  const update = useUpdateUser();
  const students = useUsers({ role: 'student', limit: 100, sort: 'full_name', order: 'asc' });
  const [studentId, setStudentId] = useState('');
  const [linking, setLinking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const list = students.data?.data ?? [];
  const none = students.isSuccess && list.length === 0;

  async function link() {
    if (!studentId) return;
    setLinking(true);
    setProblem(null);
    try {
      // A student's guardians are saved as a whole: the ones they have, and the parent just let in.
      const student = (await apiClient.get<ApiOk<UserDetail>>(`/users/${studentId}`)).data;
      await update.mutateAsync({ id: studentId, input: { guardians: guardiansWith(student, member.id) } });
      toast.success(`${student.full_name} is linked to ${first}.`);
      close();
    } catch (caught) {
      haptics.error();
      setProblem(problemMessage(caught, 'Could not link them. Please try again.'));
    } finally {
      setLinking(false);
    }
  }

  return (
    <QuickSheet
      testID="let-in-child"
      primaryTestID="let-in-add-child"
      cancelTestID="let-in-later"
      title={`Which child is ${first}'s?`}
      description={`${first} is in as a parent. Link their child so ${first} can follow them here and start an assessment for them.`}
      primaryLabel={`Add ${first}'s child now`}
      primaryIcon="account-school-outline"
      cancelLabel="Later"
      loading={linking}
      error={problem}
      onPrimary={({ leave }) =>
        // Add a student, with the new parent chosen on its Family step (and its consent step, where asked).
        leave(() =>
          closeThen(() =>
            router.push({
              pathname: '/add-student',
              params: { guardian: member.id, guardianName: request.full_name },
            }),
          ),
        )
      }
    >
      <View style={{ gap: space.sm }}>
        <OptionPicker
          testID="let-in-student"
          label="A student already here"
          placeholder={students.isPending ? 'Loading…' : none ? 'No students here yet' : 'Choose a student'}
          options={list.map((student) => ({ id: student.id, label: student.full_name }))}
          value={studentId}
          onChange={setStudentId}
          emptyText={students.isPending ? undefined : 'No students here yet.'}
          searchPlaceholder="Search students"
          defaultOpen={false}
        />
        <Button
          testID="let-in-link"
          mode="outlined"
          icon="link-variant"
          disabled={!studentId || linking}
          loading={linking}
          style={{ alignSelf: 'flex-start' }}
          contentStyle={{ minHeight: MIN_TARGET }}
          onPress={() => void link()}
        >
          Link
        </Button>
      </View>
    </QuickSheet>
  );
}
