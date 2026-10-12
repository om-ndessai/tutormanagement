// Ported from apps/web/src/components/layout/focus-notice.tsx @ 1132322
import { View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

/**
 * Says why a list is showing one row.
 *
 * A link narrows its destination to the thing it was about. Without a word of explanation that
 * reads as a screen which has lost everything else, so the way back is always offered here -- and
 * the case where the row is not there to show is a sentence too, not an empty list: the record may
 * have been deleted since the link was made.
 */
export function FocusNotice({
  active,
  found,
  what,
  onClear,
}: {
  active: boolean;
  found: boolean;
  what: string;
  onClear: () => void;
}) {
  const theme = useAppTheme();
  if (!active) return null;

  return (
    <Card mode="outlined" testID="focus-notice" style={{ borderRadius: radius.lg }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space.md,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
        }}
      >
        <Text variant="bodyMedium" style={{ flex: 1, minWidth: 180, color: theme.tokens.mutedForeground }}>
          {found
            ? `Showing one ${what}, linked from a comment.`
            : `That ${what} is no longer here — it may have been removed since the comment was written.`}
        </Text>
        <Button testID="focus-show-all" mode="outlined" compact onPress={onClear}>
          Show all
        </Button>
      </View>
    </Card>
  );
}
