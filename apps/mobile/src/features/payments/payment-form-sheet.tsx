// Ported from apps/web/src/features/payments/payment-dialog.tsx @ 1132322.
// The dialog becomes a form sheet, `(org)/payment-form`; `?id=<payment>` corrects one (the web has
// the PATCH hook but no screen for it). Records money that moved outside the portal.
//
// The direction drives the whole form: money from a family must name a student, because charges
// attach to students and that is what the balance is computed against. Money to a tutor does not.
// Once recorded, who and which way are fixed (`paymentUpdateSchema`): a correction changes the
// amount, the form, when and the notes.
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
  type Payment,
  type PaymentDirection,
  type PaymentForm,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { DateTimeField } from '@/components/date-time-field';
import { Choice, Field } from '@/components/form-choice';
import { OptionPicker } from '@/components/option-picker';
import { Screen } from '@/components/screen';
import { SecureMoney } from '@/components/secure-money';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { NoteField } from '@/features/teaching/session-notes';
import { issuesToErrors } from '@/features/teaching/session-form/use-session-form';
import { useUserDetail, useUsers } from '@/features/users/api';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { usePayments, useRecordPayment, useUpdatePayment } from './api';
import { instantToOrgClock, orgClockToInstant, orgNow } from './payment-time';

function close() {
  if (router.canGoBack()) router.back();
}

export function PaymentFormSheet({ paymentId }: { paymentId: string | undefined }) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  // The list the payment was opened from: the edit sheet is reached only from it.
  const list = usePayments({ limit: 50 });

  let body;
  if (!isAdmin) {
    // The API refuses anyone else; the sheet says so rather than offering a form that cannot save.
    body = <EmptyState icon="lock-outline" title="Only an admin can record payments." />;
  } else if (!paymentId) {
    body = <PaymentFormBody existing={null} />;
  } else if (list.isPending) {
    body = <LoadingState label="Loading the payment…" />;
  } else if (list.isError) {
    body = <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  } else {
    const existing = list.data.data.find((row) => row.id === paymentId);
    body = existing ? (
      <PaymentFormBody key={existing.id} existing={existing} />
    ) : (
      <ErrorState error={new ApiRequestError(404, 'not_found', 'That payment does not exist.')} />
    );
  }

  return (
    <Screen testID="screen-payment-form" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      <SecureMoney tag="payment-form" />
      {body}
    </Screen>
  );
}

export function PaymentFormBody({ existing }: { existing: Payment | null }) {
  const theme = useAppTheme();
  const toast = useToast();
  const timeZone = useOrgTimeZone();
  const muted = theme.tokens.mutedForeground;
  const isEdit = existing !== null;

  const [initialWhen] = useState(() =>
    existing ? instantToOrgClock(existing.paid_at, timeZone) : orgNow(timeZone),
  );
  const [direction, setDirection] = useState<PaymentDirection>(existing?.direction ?? 'from_parent');
  const [partyId, setPartyId] = useState(existing?.party_user_id ?? '');
  const [studentId, setStudentId] = useState(existing?.student_user_id ?? '');
  const [amount, setAmount] = useState(centsToInput(existing?.amount_cents));
  const [method, setMethod] = useState<PaymentForm>(existing?.method ?? 'zelle');
  const [day, setDay] = useState(initialWhen.day);
  const [clock, setClock] = useState(initialWhen.clock);
  const [reference, setReference] = useState(existing?.reference ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const parents = useUsers({ role: 'parent', limit: 100, sort: 'full_name' }, { enabled: !isEdit });
  const tutors = useUsers({ role: 'tutor', limit: 100, sort: 'full_name' }, { enabled: !isEdit });
  // A parent's own children are the only students their payment can be for.
  const payer = useUserDetail(!isEdit && direction === 'from_parent' && partyId ? partyId : null);
  const children = payer.data?.data.dependents ?? [];

  // With exactly one child there is nothing to choose. Adjusted while rendering, in the same pass.
  const onlyChild = children.length === 1 ? children[0]!.user_id : null;
  if (!isEdit && onlyChild && studentId !== onlyChild) setStudentId(onlyChild);

  const record = useRecordPayment();
  const update = useUpdatePayment();
  const saving = record.isPending || update.isPending;
  const parties = direction === 'from_parent' ? parents : tutors;
  const today = orgNow(timeZone).day;

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

  async function handleSave() {
    setErrors({});
    const cents = parseCentsInput(amount);

    const local: Record<string, string> = {};
    if (!isEdit && !partyId) local.party_user_id = 'Choose a person.';
    if (cents == null || cents <= 0) local.amount_cents = 'Enter an amount.';
    if (!isEdit && direction === 'from_parent' && !studentId) {
      local.student_user_id = 'Choose which student this is for.';
    }
    if (Object.keys(local).length > 0) {
      setErrors(local);
      haptics.error();
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
          setErrors(issuesToErrors(parsed.error.issues));
          haptics.error();
          return;
        }
        await update.mutateAsync({ id: existing.id, input: parsed.data });
        haptics.success();
        toast.success('Payment updated.');
      } else {
        const parsed = paymentInputSchema.safeParse({
          direction,
          party_user_id: partyId,
          student_user_id: direction === 'from_parent' ? studentId : null,
          ...common,
        });
        if (!parsed.success) {
          setErrors(issuesToErrors(parsed.error.issues));
          haptics.error();
          return;
        }
        await record.mutateAsync(parsed.data);
        haptics.success();
        toast.success('Payment recorded.');
      }
      close();
    } catch (error) {
      haptics.error();
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
        return;
      }
      toast.error(isEdit ? 'Could not update the payment.' : 'Could not record the payment.');
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {isEdit ? 'Edit payment' : 'Record a payment'}
        </Text>
        <Text variant="bodyMedium" style={{ color: muted }}>
          {isEdit
            ? `${PAYMENT_DIRECTION_LABELS[existing.direction]}: ${existing.party_name}${
                existing.student_name ? `, for ${existing.student_name}` : ''
              }. Recorded as ${formatCents(existing.amount_cents)}.`
            : 'No money moves through the portal. This is a record of a payment made elsewhere.'}
        </Text>
      </View>

      {!isEdit ? (
        <>
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
          />

          {direction === 'from_parent' && partyId ? (
            <OptionPicker
              // Remounted once the children arrive, so an only child, chosen for the reader, shows
              // closed like any made choice.
              key={`${partyId}-${payer.isSuccess}`}
              testID="payment-student"
              label="For which student"
              placeholder="Choose a student"
              options={children.map((child) => ({ id: child.user_id, label: child.full_name }))}
              value={studentId}
              onChange={setStudentId}
              error={errors.student_user_id}
              emptyText={payer.isPending ? 'Loading…' : 'This parent has no students assigned to them.'}
            />
          ) : null}
          {direction === 'from_parent' && !partyId && errors.student_user_id ? (
            <HelperText type="error" padding="none">
              {errors.student_user_id}
            </HelperText>
          ) : null}
        </>
      ) : null}

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
          left={<TextInput.Affix text="$" />}
          error={Boolean(errors.amount_cents)}
        />
        {errors.amount_cents ? (
          <HelperText type="error" padding="none">
            {errors.amount_cents}
          </HelperText>
        ) : null}
      </View>

      <Field label="Paid by" error={errors.method}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
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
        <DateTimeField testID="payment-time" mode="time" label="Time" value={clock} onChange={setClock} />
        {errors.paid_at ? (
          <HelperText type="error" padding="none">
            {errors.paid_at}
          </HelperText>
        ) : null}
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
      {errors.form ? (
        <HelperText type="error" padding="none">
          {errors.form}
        </HelperText>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Button
          testID="payment-save"
          mode="contained"
          onPress={() => void handleSave()}
          loading={saving}
          disabled={saving}
        >
          {isEdit ? 'Save changes' : 'Record payment'}
        </Button>
        <Button testID="payment-cancel" mode="outlined" onPress={close} disabled={saving}>
          Cancel
        </Button>
      </View>
    </View>
  );
}
