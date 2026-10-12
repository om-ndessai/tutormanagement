import { router } from 'expo-router';
import { IconButton } from '@/components/icon-button';
import { useAppTheme } from '@/providers/theme-provider';

/** The header's way into search (the web header's palette button), beside the account button. */
export function SearchButton() {
  const theme = useAppTheme();
  return (
    <IconButton
      testID="header-search"
      icon="magnify"
      size={22}
      // onSurface, not Paper's muted default: legible on the header glass in both themes (F-4).
      iconColor={theme.colors.onSurface}
      accessibilityLabel="Search pages, people and actions"
      style={{ margin: 0 }}
      onPress={() => router.push('/search')}
    />
  );
}
