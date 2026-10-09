// Ported from apps/web/src/features/dashboard/form-1099-dialog.tsx @ 1132322. The dialog becomes a
// form sheet, `(org)/form-1099?tutor=<id>&year=<yyyy>`, opened from the year-end list.
//
// The Social Security number is typed here and goes NOWHERE ELSE. It lives in this component's
// state -- never a route param, the query cache, storage, a log or a toast -- and the document is
// written on the device and handed straight to the system print UI with Print.printAsync({ html }):
// nothing is sent to the server, so there is no request body, log line or row that could carry it,
// and no file is written (the PDF-to-disk call is banned). The number is cleared the moment the page is
// built, on Cancel, on leaving, and whenever the app stops being the active one. Screen capture is
// prevented while the sheet is open.
//
// What it prints is the recipient's copy and the payer's record. Copy A -- the red scannable sheet
// the IRS keeps -- cannot be printed on a home printer by anybody.
import { formatCents, formatMailingAddress, type TutorTaxStatus } from '@tmi/shared';
import * as Print from 'expo-print';
import { router } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { DismissKeyboard } from '@/components/dismiss-keyboard';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { useOrganizationSettings } from '@/features/organizations/api';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useTaxStatus } from './api';
import { buildForm1099Html, formatPayerAddress, normaliseSsn } from './form-1099-html';

function close() {
  if (router.canGoBack()) router.back();
}

export function Form1099Sheet({ tutorId, year }: { tutorId: string | undefined; year: number }) {
  usePreventScreenCapture('form-1099');
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const valid = Number.isInteger(year) && year >= 2000 && year <= 2100;
  const status = useTaxStatus(year, isAdmin && valid);

  let body;
  if (!isAdmin) {
    body = <EmptyState icon="lock-outline" title="Only an admin can print tax documents." />;
  } else if (!tutorId || !valid) {
    body = <ErrorState error={new ApiRequestError(404, 'not_found', 'That tutor does not exist.')} />;
  } else if (status.isPending) {
    body = <LoadingState label="Loading the year's figures…" />;
  } else if (status.isError) {
    body = <ErrorState error={status.error} onRetry={() => void status.refetch()} />;
  } else {
    const tutor = status.data.data.find((row) => row.user_id === tutorId);
    body = tutor ? (
      <Form1099Body key={`${tutor.user_id}-${year}`} tutor={tutor} year={year} />
    ) : (
      <ErrorState error={new ApiRequestError(404, 'not_found', 'That tutor does not exist.')} />
    );
  }

  return (
    <Screen testID="screen-form-1099" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      {body}
    </Screen>
  );
}

export function Form1099Body({ tutor, year }: { tutor: TutorTaxStatus; year: number }) {
  const theme = useAppTheme();
  const toast = useToast();
  const brand = useBrand();
  const { organization } = useAuth();
  const muted = theme.tokens.mutedForeground;

  // The organization's payer details: its settings (admins read them), the session's copy until
  // they arrive.
  const settingsQuery = useOrganizationSettings(true);
  const settings = settingsQuery.data?.data ?? organization?.settings ?? null;
  const settingsTin = settings?.tin ?? '';
  const settingsAddress = formatPayerAddress(settings) ?? '';
  const recipientAddress = formatMailingAddress(tutor.address) ?? '';

  const [ssn, setSsn] = useState('');
  const [revealed, setRevealed] = useState(false);
  // Prefilled from the tutor's record. A change here is for this printout only.
  const [address, setAddress] = useState(recipientAddress);
  const [payerTin, setPayerTin] = useState(settingsTin);
  const [payerAddress, setPayerAddress] = useState(settingsAddress);
  const [printing, setPrinting] = useState(false);
  // Which settings the payer fields were filled from: once, when they arrive, never over typing.
  const [filledFrom, setFilledFrom] = useState(settingsQuery.data ? 'server' : 'session');
  if (settingsQuery.data && filledFrom !== 'server') {
    setFilledFrom('server');
    if (!payerTin) setPayerTin(settingsTin);
    if (!payerAddress) setPayerAddress(settingsAddress);
  }

  const formatted = normaliseSsn(ssn);

  // The number goes the moment the app is not the one in front: the app switcher, Control
  // Center, a call, Android's print activity. A typed payer TIN goes too: a sole proprietor's TIN
  // is their SSN.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        setSsn('');
        setRevealed(false);
        setPayerTin(settingsTin);
      }
    });
    return () => {
      subscription.remove();
      setSsn('');
    };
  }, [settingsTin]);

  function cancel() {
    setSsn('');
    close();
  }

  async function print() {
    if (!formatted) return;
    const html = buildForm1099Html({
      payerName: brand.name,
      payerTin,
      payerAddress,
      tutorName: tutor.full_name,
      address,
      year,
      amountCents: tutor.paid_this_year_cents,
      ssn: formatted,
    });
    // From here the number exists only in `html`, which goes to the print UI and nowhere else.
    setSsn('');
    setRevealed(false);
    setPrinting(true);
    haptics.success();
    try {
      await Print.printAsync({ html });
    } catch (error) {
      // iOS rejects when the print UI is dismissed without printing: a quiet close, not a fault.
      const message = error instanceof Error ? error.message : '';
      if (!/did not complete|cancel/i.test(message)) toast.error('Could not open the print dialog.');
    } finally {
      setPrinting(false);
      close();
    }
  }

  return (
    // The number pad has no return key: a tap anywhere that is not a control puts it away.
    <DismissKeyboard style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text testID="form-1099-title" variant="titleLarge" accessibilityRole="header">
          {year} 1099-NEC for {tutor.full_name}
        </Text>
        <Text testID="form-1099-amount" variant="bodyMedium" style={{ color: muted }}>
          {formatCents(tutor.paid_this_year_cents)} was paid to {tutor.full_name} in {year}. Their Social
          Security number is needed to print the form.
        </Text>
      </View>

      <View>
        <TextInput
          testID="form-1099-ssn"
          mode="outlined"
          label="Recipient’s SSN"
          value={ssn}
          onChangeText={setSsn}
          placeholder="Nine digits"
          autoFocus
          secureTextEntry={!revealed}
          keyboardType="number-pad"
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          autoCorrect={false}
          spellCheck={false}
          contextMenuHidden
          maxLength={11}
          right={
            <TextInput.Icon
              testID="form-1099-ssn-reveal"
              icon={revealed ? 'eye-off-outline' : 'eye-outline'}
              accessibilityLabel={revealed ? 'Hide the number' : 'Show the number'}
              onPress={() => {
                haptics.selection();
                setRevealed((was) => !was);
              }}
            />
          }
        />
        {revealed && formatted ? (
          <Text testID="form-1099-ssn-shown" variant="bodySmall" style={{ color: muted, marginTop: 4 }}>
            {formatted}
          </Text>
        ) : null}
        {/* Said plainly, because an admin typing an SSN into an app is entitled to know where it goes. */}
        <HelperText type="info" padding="none">
          Typed here and used only to print this form. It is never sent to the server, never saved, and is
          gone when this sheet closes or the app leaves the screen.
        </HelperText>
      </View>

      <View>
        <TextInput
          testID="form-1099-address"
          mode="outlined"
          label={`Recipient’s address ${recipientAddress ? '(from their record)' : '(optional)'}`}
          value={address}
          onChangeText={setAddress}
          placeholder={'Street\nCity, State ZIP'}
          multiline
          autoComplete="off"
          style={{ minHeight: 88 }}
        />
        <HelperText type="info" padding="none">
          {recipientAddress
            ? 'A change here is for this printout only. Correct it on the tutor’s record to keep it.'
            : 'No address is on the tutor’s record. Add it there so next year’s form fills itself.'}
        </HelperText>
      </View>

      <View>
        <TextInput
          testID="form-1099-payer-tin"
          mode="outlined"
          label={`Payer’s TIN ${settingsTin ? '(from the organization settings)' : '(optional)'}`}
          value={payerTin}
          onChangeText={setPayerTin}
          placeholder="The organization’s EIN"
          autoComplete="off"
          autoCorrect={false}
          importantForAutofill="no"
        />
        <TextInput
          testID="form-1099-payer-address"
          mode="outlined"
          label="Payer’s address (optional)"
          value={payerAddress}
          onChangeText={setPayerAddress}
          multiline
          autoComplete="off"
          style={{ minHeight: 88, marginTop: space.sm }}
        />
        {!settingsTin ? (
          <HelperText type="info" padding="none">
            Add the TIN on the Organization settings page and it will fill the payer box for you.
          </HelperText>
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        <Button
          testID="form-1099-print"
          mode="contained"
          icon="printer-outline"
          onPress={() => void print()}
          disabled={!formatted || printing}
          loading={printing}
        >
          {formatted ? 'Print 1099-NEC' : 'Enter nine digits'}
        </Button>
        <Button testID="form-1099-cancel" mode="outlined" onPress={cancel} disabled={printing}>
          Cancel
        </Button>
      </View>
    </DismissKeyboard>
  );
}
