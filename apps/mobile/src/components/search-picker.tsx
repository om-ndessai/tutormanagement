// Choosing a person, a topic or a place (UI upgrades U2; docs/ui-upgrades-spec.md): a search field
// on top, large rows (title, a muted line, an optional avatar), a tick on the chosen row or rows,
// and a sentence when nothing matches -- with, optionally, the next step ("New parent").
//
// A FlatList keyed by id with memoized rows, so a long directory stays smooth. It scrolls itself:
// in a `StepFlow` give its step `scroll: false`; inside a scroll view, cap it with `style`.
// Filtering is local by default (`filterPickerItems`); a caller searching on the server passes
// `query`/`onQueryChange` and `filter={false}`.
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { ActivityIndicator, Icon, Searchbar, Text } from 'react-native-paper';

import { useLineLimit } from '@/hooks/use-large-text';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { PersonAvatar } from '@/features/users/person-avatar';

export interface SearchPickerItem {
  id: string;
  title: string;
  /** A muted second line ("Parent of Sofia Okafor"). */
  description?: string;
  /** A person's name: their initials disc leads the row. */
  avatarName?: string;
  /** Any other leading element (an icon disc), when there is no `avatarName`. */
  avatar?: ReactNode;
  /** Extra words the search matches but the row does not show (an email, a code). */
  keywords?: string;
  disabled?: boolean;
}

interface SingleSelect {
  multiple?: false;
  value: string | null;
  onChange: (id: string) => void;
}

interface MultiSelect {
  multiple: true;
  value: readonly string[];
  onChange: (ids: string[]) => void;
}

export type SearchPickerProps = (SingleSelect | MultiSelect) & {
  items: readonly SearchPickerItem[];
  /** The prefix: `<testID>-input`, `<testID>-row-<id>`, `<testID>-empty` (default `search-picker`). */
  testID?: string;
  /** What the list is, for a screen reader ("Parents"). */
  label?: string;
  placeholder?: string;
  /** A controlled search, e.g. for a server-side lookup. */
  query?: string;
  onQueryChange?: (query: string) => void;
  /** The local match (default `filterPickerItems`), or false when the items are already the matches. */
  filter?: ((items: readonly SearchPickerItem[], query: string) => SearchPickerItem[]) | false;
  emptyTitle?: string;
  emptyBody?: string;
  /** The empty state's next step, e.g. a "New parent" button. */
  emptyAction?: ReactNode;
  /** Above the rows, under the search field (a "New parent" row, a hint). */
  header?: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Folds case and accents, so "zoe" finds "Zoë". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** The rows whose title, line or keywords hold every word of the query, in their order. */
export function filterPickerItems(items: readonly SearchPickerItem[], query: string): SearchPickerItem[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...items];
  return items.filter((item) => {
    const haystack = fold([item.title, item.description, item.keywords].filter(Boolean).join(' '));
    return words.every((word) => haystack.includes(word));
  });
}

export function SearchPicker(props: SearchPickerProps) {
  const {
    items,
    testID = 'search-picker',
    label,
    placeholder = 'Search',
    filter = filterPickerItems,
    emptyTitle = 'Nothing matches.',
    emptyBody,
    emptyAction,
    header,
    footer,
    loading = false,
    autoFocus = false,
    style,
  } = props;
  const theme = useAppTheme();
  const [ownQuery, setOwnQuery] = useState('');
  const query = props.query ?? ownQuery;
  const setQuery = props.onQueryChange ?? setOwnQuery;

  const shown = useMemo(() => (filter ? filter(items, query) : [...items]), [filter, items, query]);

  // The chosen ids as a set, so a row's tick is a lookup.
  const chosen = useMemo(
    () => new Set<string>(props.multiple ? props.value : props.value ? [props.value] : []),
    [props.multiple, props.value],
  );

  // Kept stable for the memoized rows: the latest selection is read when a row is pressed.
  const multiple = Boolean(props.multiple);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const choose = useCallback((id: string) => {
    haptics.selection();
    const current = latest.current;
    if (current.multiple) {
      current.onChange(
        current.value.includes(id) ? current.value.filter((other) => other !== id) : [...current.value, id],
      );
    } else {
      current.onChange(id);
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: SearchPickerItem }) => (
      <PickerRow
        item={item}
        selected={chosen.has(item.id)}
        multiple={multiple}
        onChoose={choose}
        testID={`${testID}-row-${item.id}`}
      />
    ),
    [choose, chosen, multiple, testID],
  );

  return (
    <View style={[{ flex: 1, gap: space.md }, style]}>
      <Searchbar
        testID={`${testID}-input`}
        placeholder={placeholder}
        value={query}
        onChangeText={setQuery}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel={placeholder}
        style={{ backgroundColor: theme.tokens.muted }}
      />
      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        extraData={chosen}
        accessibilityLabel={label}
        accessibilityRole={multiple ? undefined : 'radiogroup'}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        initialNumToRender={12}
        ItemSeparatorComponent={RowGap}
        ListHeaderComponent={header ? <View style={{ paddingBottom: space.sm }}>{header}</View> : null}
        ListFooterComponent={footer ? <View style={{ paddingTop: space.sm }}>{footer}</View> : null}
        ListEmptyComponent={
          loading ? (
            <View style={{ padding: space.xl, alignItems: 'center' }}>
              <ActivityIndicator accessibilityLabel="Loading" />
            </View>
          ) : (
            <View
              testID={`${testID}-empty`}
              style={{ padding: space.xl, alignItems: 'center', gap: space.sm }}
            >
              <Icon source="magnify" size={28} color={theme.tokens.mutedForeground} />
              <Text variant="titleMedium" style={{ textAlign: 'center' }}>
                {emptyTitle}
              </Text>
              {emptyBody ? (
                <Text variant="bodyMedium" style={{ textAlign: 'center', color: theme.tokens.mutedForeground }}>
                  {emptyBody}
                </Text>
              ) : null}
              {emptyAction}
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: space.lg }}
      />
    </View>
  );
}

function RowGap() {
  return <View style={{ height: space.xs }} />;
}

const PickerRow = memo(function PickerRow({
  item,
  selected,
  multiple,
  onChoose,
  testID,
}: {
  item: SearchPickerItem;
  selected: boolean;
  multiple: boolean;
  onChoose: (id: string) => void;
  testID: string;
}) {
  const theme = useAppTheme();
  const lines = useLineLimit(1);
  const leading = item.avatarName ? <PersonAvatar name={item.avatarName} size={40} /> : item.avatar;
  return (
    <Pressable
      testID={testID}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityLabel={item.description ? `${item.title}, ${item.description}` : item.title}
      accessibilityState={{ checked: selected, selected, disabled: item.disabled }}
      disabled={item.disabled}
      onPress={() => onChoose(item.id)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: item.description ? 64 : 56,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
        backgroundColor: selected
          ? withAlpha(theme.colors.primary, 0.08)
          : pressed
            ? theme.tokens.muted
            : theme.colors.surface,
        opacity: item.disabled ? 0.5 : 1,
      })}
    >
      {leading ?? null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyLarge" numberOfLines={lines} style={{ fontWeight: selected ? '600' : '400' }}>
          {item.title}
        </Text>
        {item.description ? (
          <Text variant="bodyMedium" numberOfLines={lines} style={{ color: theme.tokens.mutedForeground }}>
            {item.description}
          </Text>
        ) : null}
      </View>
      {selected ? (
        <Icon source="check-circle" size={24} color={theme.colors.primary} />
      ) : multiple ? (
        <Icon source="checkbox-blank-circle-outline" size={24} color={theme.colors.outline} />
      ) : null}
    </Pressable>
  );
});
