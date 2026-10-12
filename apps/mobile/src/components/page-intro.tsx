import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { useIconSize, useLargeText } from '@/hooks/use-large-text';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, space } from '@/theme/tokens';

/**
 * A page's opening sentence ("Standing weekly lessons…"). At the largest text sizes it alone
 * filled the first screen (ux-audit F-12), so there it folds into an "About this page" control
 * that opens it in place; at every other size it is the plain muted sentence it always was.
 */
export function PageIntro({ children, testID }: { children: string; testID?: string }) {
  const theme = useAppTheme();
  const large = useLargeText();
  const [open, setOpen] = useState(false);
  const iconSize = useIconSize(18);
  const sentence = (
    <Text testID={testID} variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
      {children}
    </Text>
  );
  if (!large) return sentence;
  return (
    <View style={{ gap: space.xs }}>
      <Pressable
        testID={testID ? `${testID}-toggle` : 'page-intro-toggle'}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="About this page"
        onPress={() => setOpen((value) => !value)}
        style={{ minHeight: MIN_TARGET, flexDirection: 'row', alignItems: 'center', gap: space.sm }}
      >
        <Icon source="information-outline" size={iconSize} color={theme.colors.primary} />
        <Text variant="labelLarge" style={{ flexShrink: 1, color: theme.colors.primary }}>
          About this page
        </Text>
      </Pressable>
      {open ? sentence : null}
    </View>
  );
}
