// Ported from apps/web/src/features/users/payment-handles-field.tsx @ 1132322.
//
// Tutors are paid through these and parents are billed through them, which is why they belong to
// the person rather than to either role's profile. At most one id per method.
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentHandle } from '@tmi/shared';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { FormTextField } from './form-text-field';
import { setHandle } from './person-form-model';

export function PaymentHandlesField({
  value,
  onChange,
  hint,
}: {
  value: PaymentHandle[];
  onChange: (handles: PaymentHandle[]) => void;
  hint: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: 2 }}>
        <Text variant="titleSmall">Payment</Text>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {hint}
        </Text>
      </View>
      {PAYMENT_METHODS.map((method) => (
        <FormTextField
          key={method}
          testID={`person-pay-${method}`}
          label={PAYMENT_METHOD_LABELS[method]}
          value={value.find((entry) => entry.method === method)?.handle ?? ''}
          onChangeText={(text) => onChange(setHandle(value, method, text))}
          placeholder={method === 'venmo' ? '@username' : 'Email or phone'}
          autoCapitalize="none"
        />
      ))}
    </View>
  );
}
