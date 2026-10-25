import { Pressable } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, space } from '@/theme/tokens';

/** A labelled tick at a full touch target; also the step flows' (U3). */
export function CheckRow({
  testID,
  label,
  checked,
  onChange,
}: {
  testID: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => {
        haptics.selection();
        onChange(!checked);
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: MIN_TARGET }}
    >
      <Icon
        source={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
        size={22}
        color={checked ? theme.colors.primary : theme.tokens.mutedForeground}
      />
      <Text variant="bodyMedium" style={{ flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}
