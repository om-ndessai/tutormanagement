// The web form's Field (label, "(optional)", hint, error) around a Paper TextInput, from
// apps/web/src/features/users/user-form-dialog.tsx @ 1132322.
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';

type InputProps = Omit<ComponentProps<typeof TextInput>, 'label' | 'error' | 'mode'>;

export function FormTextField({
  label,
  optional,
  hint,
  error,
  ...input
}: InputProps & { label: string; optional?: boolean; hint?: string; error?: string }) {
  return (
    <View>
      <TextInput
        mode="outlined"
        label={optional ? `${label} (optional)` : label}
        error={Boolean(error)}
        autoCorrect={false}
        {...input}
      />
      {error ? (
        <HelperText type="error" padding="none">
          {error}
        </HelperText>
      ) : hint ? (
        <HelperText type="info" padding="none">
          {hint}
        </HelperText>
      ) : null}
    </View>
  );
}
