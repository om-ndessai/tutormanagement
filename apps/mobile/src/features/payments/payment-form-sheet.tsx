// Ported from apps/web/src/features/payments/payment-dialog.tsx @ 1132322; reshaped as a quick sheet
// in UI upgrades U5 (docs/ui-upgrades-spec.md). `(org)/payment-form`; `?id=<payment>` corrects one
// (the web has the PATCH hook but no screen for it). Records money that moved outside the portal.
//
// The sheet leads with the amount, large; then who, already filled when it was opened from a Billing
// row or a person's record (`?direction=&party=&student=`), with Change to choose someone else; then
// how it was paid. The date, time, reference and notes wait under "More details" (now, by default).
//
// The direction drives who may be chosen: money from a family must name a student, because charges
// attach to students and that is what the balance is computed against. Money to a tutor does not.
// Once recorded, who and which way are fixed (`paymentUpdateSchema`): a correction changes the
// amount, the form, when and the notes. Finance only: an admin's, as the API.
//
// Phase 54 (@ 24066d9, working tree): in a space paid directly every payment is a family paying a
// tutor, so there is no direction to choose. A tutor records what a family paid them (the payee is
// themselves, "Record a payment you received"); an admin chooses the tutor ("Paid to (tutor)"). The
// payee tutor may also correct their own.
import {
  PAYMENT_DIRECTIONS,
  PAYMENT_DIRECTION_LABELS,
  PAYMENT_FORMS,
  PAYMENT_FORM_LABELS,
  centsToInput,
  formatCents,
  parseCentsInput,
  paymentInputSchema,
  paymentUpdateSchema,
  paidDirectly,
  type Payment,
  type PaymentDirection,
  type PaymentForm,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { Button, HelperText, Icon, Text, TextInput } from 'react-native-paper';

import { OfflineSaveNote, useOffline } from '@/components/connectivity';
import { DateTimeField } from '@/components/date-time-field';
import { FieldError } from '@/components/field-error';
import { Choice, Field } from '@/components/form-choice';
import { OptionPicker } from '@/components/option-picker';
import { OutlinedCard } from '@/components/outlined-card';
import { QuickSheet } from '@/components/quick-sheet';
import { SecureMoney } from '@/components/secure-money';
import { FormSkeleton } from '@/components/skeletons';
import { EmptyState, ErrorState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { useDirty } from '@/hooks/use-unsaved-changes';
import { NoteField } from '@/features/teaching/session-notes';
import { issuesToErrors } from '@/features/teaching/session-form/use-session-form';
import { useUserDetail, useUsers } from '@/features/users/api';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, space } from '@/theme/tokens';
import { usePayments, useRecordPayment, useUpdatePayment } from './api';
import { mayChangePayment } from './payment-format';
import { instantToOrgClock, orgClockToInstant, orgNow } from './payment-time';

function close() {
  if (router.canGoBack()) router.back();
}

/** The fields under "More details": a refusal on one of them opens it. */
const DETAIL_FIELDS = ['paid_at', 'reference', 'notes'] as const;

/** A new payment opened from a ledger row or a person's record (ux-audit F-21; U5): who, and for whom. */
export interface PaymentPrefill {
  direction?: PaymentDirection;
  party?: string;
  student?: string;
  /** Phase 54: the tutor a family paid directly (an admin's choice, from a direct ledger row). */
  payee?: string;
}

/** Reads the route's params into a prefill; anything unrecognised is dropped. */
export function paymentPrefill(params: {
  direction?: string;
  party?: string;
  student?: string;
  payee?: string;
}): PaymentPrefill {
  const direction = (PAYMENT_DIRECTIONS as readonly string[]).includes(params.direction ?? '')
    ? (params.direction as PaymentDirection)
    : undefined;
  return {
    direction,
    party: direction && params.party ? params.party : undefined,
    student: direction === 'from_parent' && params.party && params.student ? params.student : undefined,
    payee: direction === 'from_parent' && params.payee ? params.payee : undefined,
  };
}

/** "From Anita Patel, for Sanjay Patel" / "To Alex Chen" / (Phase 54) "…, to Diego Ramos". */
export function paymentWhoText(
  direction: PaymentDirection,
  party: string,
  student?: string | null,
  payee?: string | null,
): string {
  if (direction === 'to_tutor') return `To ${party}`;
  const from = student ? `From ${party}, for ${student}` : `From ${party}`;
  return payee ? `${from}, to ${payee}` : from;
}

/** Phase 54: the sheet's title -- a tutor in a space paid directly records what they received. */
export function paymentSheetTitle(direct: boolean, isAdmin: boolean): string {
  return direct && !isAdmin ? 'Record a payment you received' : 'Record a payment';
}

/** The states before the form: a fitted sheet's root is a ScrollView too. */
function SheetState({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <ScrollView
      testID="screen-payment-form"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: space.lg, paddingTop: space.xl }}
    >
      {children}
    </ScrollView>
  );
}

export function PaymentFormSheet({
  paymentId,
  prefill = {},
}: {
  paymentId: string | undefined;
  prefill?: PaymentPrefill;
}) {
  const { user, organization } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  // Phase 54: paid directly, a tutor records (and corrects) the payments families made to them.
  const direct = organization ? paidDirectly(organization) : false;
  const mayRecord = isAdmin || (direct && Boolean(user?.roles.includes('tutor')));
  // The list the payment was opened from: the edit sheet is reached only from it.
  const list = usePayments({ limit: 50 });

  if (!mayRecord) {
    // The API refuses anyone else; the sheet says so rather than offering a form that cannot save.
    return (
      <SheetState>
        <EmptyState icon="lock-outline" title="Only an admin can record payments." />
      </SheetState>
    );
  }
  if (!paymentId) return <PaymentFormBody existing={null} prefill={prefill} />;
  if (list.isPending) {
    return (
      <SheetState>
        <FormSkeleton label="Loading the payment…" fields={3} />
      </SheetState>
    );
  }
  if (list.isError) {
    return (
      <SheetState>
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      </SheetState>
    );
  }
  const found = list.data.data.find((row) => row.id === paymentId);
  // Only the office, or the tutor a family paid directly, may correct one (the API's rule).
  const existing = found && mayChangePayment(found, user?.id, isAdmin) ? found : undefined;
  return existing ? (
    <PaymentFormBody key={existing.id} existing={existing} />
  ) : (
    <SheetState>
      <ErrorState error={new ApiRequestError(404, 'not_found', 'That payment does not exist.')} />
    </SheetState>
  );
}

export function PaymentFormBody({
  existing,
  prefill = {},
}: {
  existing: Payment | null;
  prefill?: PaymentPrefill;
}) {
  const theme = useAppTheme();
  const toast = useToast();
  const timeZone = useOrgTimeZone();
  const { user, organization } = useAuth();
  const muted = theme.tokens.mutedForeground;
  const isEdit = existing !== null;
  const isAdmin = user?.roles.includes('admin') ?? false;
  // Phase 54: a family paying a tutor directly is the only payment there is in such a space.
  const direct = organization ? paidDirectly(organization) : false;

  const [initialWhen] = useState(() =>
    existing ? instantToOrgClock(existing.paid_at, timeZone) : orgNow(timeZone),
  );
  const [direction, setDirection] = useState<PaymentDirection>(
    existing?.direction ?? (direct ? 'from_parent' : (prefill.direction ?? 'from_parent')),
  );
  // The tutor the family paid: the reader themselves unless they are the office, who choose.
  const [payeeId, setPayeeId] = useState(
    existing?.payee_user_id ?? (direct ? (isAdmin ? (prefill.payee ?? '') : (user?.id ?? '')) : ''),
  );
  const [partyId, setPartyId] = useState(existing?.party_user_id ?? prefill.party ?? '');
  const [studentId, setStudentId] = useState(existing?.student_user_id ?? prefill.student ?? '');
  const [amount, setAmount] = useState(centsToInput(existing?.amount_cents));
  const [method, setMethod] = useState<PaymentForm>(existing?.method ?? 'zelle');
  const [day, setDay] = useState(initialWhen.day);
  const [clock, setClock] = useState(initialWhen.clock);
  const [reference, setReference] = useState(existing?.reference ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  // Who came with the sheet: shown as a line with Change, until Change opens the pickers.
  const [choosing, setChoosing] = useState(!isEdit && !prefill.party);
  // The details open themselves when they hold something (an edit with a reference) or a refusal.
  const [moreOpen, setMoreOpen] = useState(Boolean(existing?.reference || existing?.notes));
  // What was typed is not lost to a swipe or Back (ux-audit F-3); offline, Save waits (F-16).
  const dirty = useDirty({
    direction,
    payeeId,
    partyId,
    studentId,
    amount,
    method,
    day,
    clock,
    reference,
    notes,
  });
  const offline = useOffline();

  const parents = useUsers({ role: 'parent', limit: 100, sort: 'full_name' }, { enabled: !isEdit });
  const tutors = useUsers(
    { role: 'tutor', limit: 100, sort: 'full_name' },
    // A tutor recording what they received chooses nobody from this list.
    { enabled: !isEdit && (!direct || isAdmin) },
  );
  // A parent's own children are the only students their payment can be for; a prefilled person's
  // record also gives their name.
  const party = useUserDetail(!isEdit && partyId ? partyId : null);
  const children = direction === 'from_parent' ? (party.data?.data.dependents ?? []) : [];

  // With exactly one child there is nothing to choose. Adjusted while rendering, in the same pass.
  const onlyChild = children.length === 1 ? children[0]!.user_id : null;
  if (!isEdit && onlyChild && studentId !== onlyChild) setStudentId(onlyChild);

  const record = useRecordPayment();
  const update = useUpdatePayment();
  const saving = record.isPending || update.isPending;
  const parties = direction === 'from_parent' ? parents : tutors;
  const today = orgNow(timeZone).day;

  const partyName =
    existing?.party_name ??
    party.data?.data.full_name ??
    (parties.data?.data ?? []).find((person) => person.id === partyId)?.full_name ??
    '';
  const studentName =
    existing?.student_name ?? children.find((child) => child.user_id === studentId)?.full_name ?? null;

  const payeeName = (tutors.data?.data ?? []).find((person) => person.id === payeeId)?.full_name ?? null;

  function chooseDirection(value: PaymentDirection) {
    setDirection(value);
    setPartyId('');
    setStudentId('');
  }

  function chooseParty(id: string) {
    setPartyId(id);
    setStudentId('');
  }

  /** The date and time as an instant, keeping the recorded one untouched when they did not change. */
  function paidAt(): string {
    if (existing && day === initialWhen.day && clock === initialWhen.clock) return existing.paid_at;
    return orgClockToInstant(day, clock, timeZone);
  }

  function refuse(found: Record<string, string>) {
    setErrors(found);
    if (DETAIL_FIELDS.some((field) => found[field])) setMoreOpen(true);
    // A refusal about who opens the pickers, so the field at fault is on screen.
    if (found.party_user_id || found.student_user_id || found.payee_user_id) setChoosing(true);
    haptics.error();
  }

  async function handleSave({ leave }: { leave: (close?: () => void) => void }) {
    setErrors({});
    setFailure(null);
    const cents = parseCentsInput(amount);

    const local: Record<string, string> = {};
    if (!isEdit && !partyId) local.party_user_id = 'Choose a person.';
    if (!isEdit && direct && !payeeId) local.payee_user_id = 'Choose the tutor the family paid.';
    if (cents == null || cents <= 0) local.amount_cents = 'Enter an amount.';
    if (!isEdit && direction === 'from_parent' && !studentId) {
      local.student_user_id = 'Choose which student this is for.';
    }
    if (Object.keys(local).length > 0) {
      refuse(local);
      return;
    }

    const common = {
      amount_cents: cents!,
      method,
      // Sent as an instant so ordering is unambiguous across timezones.
      paid_at: paidAt(),
      reference: reference.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      if (isEdit) {
        const parsed = paymentUpdateSchema.safeParse(common);
        if (!parsed.success) {
          refuse(issuesToErrors(parsed.error.issues));
          return;
        }
        await update.mutateAsync({ id: existing.id, input: parsed.data });
        toast.success('Payment updated.');
      } else {
        const parsed = paymentInputSchema.safeParse({
          direction,
          party_user_id: partyId,
          student_user_id: direction === 'from_parent' ? studentId : null,
          ...(direct ? { payee_user_id: payeeId } : {}),
          ...common,
        });
        if (!parsed.success) {
          refuse(issuesToErrors(parsed.error.issues));
          return;
        }
        await record.mutateAsync(parsed.data);
        toast.success('Payment recorded.');
      }
      haptics.success();
      leave(close);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        refuse(error.fieldErrors);
        // A form sheet covers the app's toasts: the refusal is said above the action.
        setFailure(error.message);
        return;
      }
      haptics.error();
      setFailure(isEdit ? 'Could not update the payment.' : 'Could not record the payment.');
    }
  }

  return (
    <QuickSheet
      testID="screen-payment-form"
      actionTestID="payment"
      title={isEdit ? 'Edit payment' : paymentSheetTitle(direct, isAdmin)}
      description={
        isEdit
          ? `${paymentWhoText(existing.direction, existing.party_name, existing.student_name, existing.payee_name)}. Recorded as ${formatCents(existing.amount_cents)}.`
          : direct
            ? 'Families here pay each tutor directly. A record of money that moved outside the portal.'
            : 'A record of money that moved outside the portal.'
      }
      primaryLabel={isEdit ? 'Save changes' : 'Record payment'}
      primaryIcon={isEdit ? undefined : 'cash-check'}
      onPrimary={handleSave}
      primaryDisabled={offline}
      loading={saving}
      error={failure ?? errors.form ?? null}
      dirty={dirty}
    >
      <SecureMoney tag="payment-form" />

      {/* The amount, large: the one thing every payment has. */}
      <View>
        <TextInput
          testID="payment-amount"
          mode="outlined"
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          placeholder="75.00"
          // iOS's decimal pad has no return key, so it could never be put away: this one has.
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          left={<TextInput.Affix text="$" textStyle={{ fontSize: 28 }} />}
          style={{ fontSize: 28 }}
          contentStyle={{ fontVariant: ['tabular-nums'] }}
          error={Boolean(errors.amount_cents)}
        />
        {errors.amount_cents ? <FieldError>{errors.amount_cents}</FieldError> : null}
      </View>

      {isEdit ? null : choosing ? (
        <>
          {direct && isAdmin ? (
            <OptionPicker
              testID="payment-payee"
              label="Paid to (tutor)"
              placeholder="Choose the tutor"
              searchPlaceholder="Search tutors"
              options={(tutors.data?.data ?? []).map((person) => ({
                id: person.id,
                label: person.full_name,
              }))}
              value={payeeId}
              onChange={setPayeeId}
              error={errors.payee_user_id}
              defaultOpen={false}
            />
          ) : null}
          {direct && !isAdmin && errors.payee_user_id ? (
            <FieldError>{errors.payee_user_id}</FieldError>
          ) : null}
          {direct ? null : (
            <Field label="Direction">
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                {PAYMENT_DIRECTIONS.map((value) => (
                  <Choice
                    key={value}
                    testID={`payment-direction-${value}`}
                    label={PAYMENT_DIRECTION_LABELS[value]}
                    selected={direction === value}
                    onPress={() => chooseDirection(value)}
                  />
                ))}
              </View>
            </Field>
          )}
          <OptionPicker
            key={direction}
            testID="payment-party"
            label={direction === 'from_parent' ? 'Parent' : 'Tutor'}
            placeholder={`Choose a ${direction === 'from_parent' ? 'parent' : 'tutor'}`}
            searchPlaceholder={direction === 'from_parent' ? 'Search parents' : 'Search tutors'}
            options={(parties.data?.data ?? []).map((person) => ({ id: person.id, label: person.full_name }))}
            value={partyId}
            onChange={chooseParty}
            error={errors.party_user_id}
            // Closed until tapped, so the sheet fits and its action stays in reach (U5).
            defaultOpen={false}
          />
        </>
      ) : (
        <WhoCard
          text={
            partyName
              ? paymentWhoText(direction, partyName, studentName, direct && isAdmin ? payeeName : null)
              : 'Loading…'
          }
          onChange={() => {
            haptics.selection();
            setChoosing(true);
          }}
        />
      )}

      {!isEdit && direction === 'from_parent' && partyId && (choosing || !studentId) ? (
        <OptionPicker
          // Remounted once the children arrive, so an only child, chosen for the reader, shows
          // closed like any made choice.
          key={`${partyId}-${party.isSuccess}`}
          testID="payment-student"
          label="For which student"
          placeholder="Choose a student"
          options={children.map((child) => ({ id: child.user_id, label: child.full_name }))}
          value={studentId}
          onChange={setStudentId}
          error={errors.student_user_id}
          emptyText={party.isPending ? 'Loading…' : 'This parent has no students assigned to them.'}
        />
      ) : null}
      {!isEdit && direction === 'from_parent' && !partyId && errors.student_user_id ? (
        <FieldError>{errors.student_user_id}</FieldError>
      ) : null}

      <Field label="Paid by" error={errors.method}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {PAYMENT_FORMS.map((form) => (
            <Choice
              key={form}
              testID={`payment-method-${form}`}
              label={PAYMENT_FORM_LABELS[form]}
              selected={method === form}
              onPress={() => setMethod(form)}
            />
          ))}
        </View>
      </Field>

      <View style={{ gap: space.md }}>
        <Pressable
          testID="payment-more"
          accessibilityRole="button"
          accessibilityState={{ expanded: moreOpen }}
          accessibilityLabel={moreOpen ? 'Fewer details' : 'More details: date, reference and notes'}
          onPress={() => {
            haptics.selection();
            setMoreOpen((was) => !was);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: MIN_TARGET }}
        >
          <Icon source={moreOpen ? 'chevron-up' : 'chevron-down'} size={22} color={theme.colors.primary} />
          <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
            More details
          </Text>
          {!moreOpen ? (
            <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1, color: muted }}>
              {day === today ? 'Today' : day}
              {reference.trim() ? ` · ${reference.trim()}` : ''}
            </Text>
          ) : null}
        </Pressable>
        {moreOpen ? (
          <>
            <View style={{ gap: space.sm }}>
              <DateTimeField
                testID="payment-date"
                mode="date"
                label="Date"
                value={day}
                onChange={setDay}
                maximumDate={today > day ? today : day}
                error={Boolean(errors.paid_at)}
              />
              <DateTimeField
                testID="payment-time"
                mode="time"
                label="Time"
                value={clock}
                onChange={setClock}
              />
              {errors.paid_at ? <FieldError>{errors.paid_at}</FieldError> : null}
            </View>
            <View>
              <TextInput
                testID="payment-reference"
                mode="outlined"
                label="Reference (optional)"
                value={reference}
                onChangeText={setReference}
                placeholder={method === 'check' ? '1042' : 'Confirmation'}
                returnKeyType="done"
                autoCorrect={false}
                error={Boolean(errors.reference)}
              />
              <HelperText
                type={errors.reference ? 'error' : 'info'}
                padding="none"
                visible={Boolean(errors.reference) || method === 'check'}
              >
                {errors.reference ?? 'Check number.'}
              </HelperText>
            </View>
            <NoteField
              testID="payment-notes"
              label="Notes (optional)"
              value={notes}
              onChange={setNotes}
              placeholder="September, first half"
              error={errors.notes}
            />
          </>
        ) : null}
      </View>
      <OfflineSaveNote offline={offline} />
    </QuickSheet>
  );
}

/** Who the payment is to or from, filled from where the sheet was opened, with Change. */
function WhoCard({ text, onChange }: { text: string; onChange: () => void }) {
  const theme = useAppTheme();
  return (
    <OutlinedCard>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingLeft: space.lg,
          paddingVertical: space.sm,
        }}
      >
        <Icon source="account-cash-outline" size={24} color={theme.tokens.mutedForeground} />
        <Text testID="payment-who" variant="bodyLarge" style={{ flex: 1 }}>
          {text}
        </Text>
        <Button
          testID="payment-who-change"
          mode="text"
          compact
          onPress={onChange}
          accessibilityLabel={`${text}. Change`}
          contentStyle={{ minHeight: MIN_TARGET }}
        >
          Change
        </Button>
      </View>
    </OutlinedCard>
  );
}
