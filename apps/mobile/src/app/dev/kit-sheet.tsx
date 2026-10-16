// Developer-only: the surface kit's QuickSheet (UI upgrades U2), fitted to its content.
//   aimtrue://dev/kit-sheet  -- form sheet. Save with the field empty shows the refusal above the
//   action; with something typed it closes. Absent from production (DEV_TOOLS).
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native-paper';

import { QuickSheet } from '@/components/quick-sheet';
import { DEV_TOOLS } from '@/lib/variant';

export default function DevKitSheet() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!DEV_TOOLS) return <Redirect href="/" />;
  return (
    <QuickSheet
      title="Quick sheet"
      description="One decision, or up to three inputs."
      primaryLabel="Save"
      error={error}
      dirty={value !== ''}
      onPrimary={({ leave }) => {
        if (!value.trim()) {
          setError('Enter something first.');
          return;
        }
        leave();
      }}
    >
      <TextInput
        testID="kit-sheet-input"
        mode="outlined"
        label="Something"
        value={value}
        onChangeText={(next) => {
          setValue(next);
          setError(null);
        }}
      />
    </QuickSheet>
  );
}
