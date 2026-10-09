import { router } from 'expo-router';
import { IconButton } from 'react-native-paper';

/** The header's way into search (the web header's palette button), beside the account button. */
export function SearchButton() {
  return (
    <IconButton
      testID="header-search"
      icon="magnify"
      size={22}
      accessibilityLabel="Search pages, people and actions"
      style={{ margin: 0 }}
      onPress={() => router.push('/search')}
    />
  );
}
