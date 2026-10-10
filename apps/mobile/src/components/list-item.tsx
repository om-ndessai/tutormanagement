import type { ComponentProps } from 'react';
import { List } from 'react-native-paper';

import { useLineLimit } from '@/hooks/use-large-text';

/**
 * Paper's List.Item with line limits that follow the text size: one line for the title and two
 * for the description as Paper has it, more under large text, where Paper's single line cut
 * "Comments" to "Comme…" on More (ux-audit F-12). Every list row in the app comes from here.
 */
export function ListItem(props: ComponentProps<typeof List.Item>) {
  const title = useLineLimit(1);
  const description = useLineLimit(2);
  return <List.Item titleNumberOfLines={title} descriptionNumberOfLines={description} {...props} />;
}
