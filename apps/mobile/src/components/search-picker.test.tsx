// SearchPicker (UI upgrades U2): the search narrows the rows, one row or several are chosen with a
// tick, and an empty search says so with its next step.
import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Button } from 'react-native-paper';

import { renderWithProviders } from '@/test/render';
import { filterPickerItems, SearchPicker, type SearchPickerItem } from './search-picker';

const ITEMS: SearchPickerItem[] = [
  { id: 'a', title: 'Anita Patel', description: 'Parent of Sanjay Patel', avatarName: 'Anita Patel' },
  { id: 'm', title: 'Maria Okafor', description: 'Parent of Sofia Okafor', keywords: 'maria@example.com' },
  { id: 'z', title: 'Zoë Lindqvist', description: 'Guardian' },
];

describe('filterPickerItems', () => {
  it('matches the title, the line and the keywords, every word, ignoring case and accents', () => {
    const ids = (query: string) => filterPickerItems(ITEMS, query).map((item) => item.id);
    expect(ids('')).toEqual(['a', 'm', 'z']);
    expect(ids('  ')).toEqual(['a', 'm', 'z']);
    expect(ids('anita')).toEqual(['a']);
    expect(ids('sofia')).toEqual(['m']);
    expect(ids('example.com')).toEqual(['m']);
    expect(ids('zoe')).toEqual(['z']);
    expect(ids('parent okafor')).toEqual(['m']);
    expect(ids('parent nobody')).toEqual([]);
  });
});

function Single({ onChange }: { onChange?: (id: string) => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <SearchPicker
      items={ITEMS}
      value={value}
      onChange={(id) => {
        setValue(id);
        onChange?.(id);
      }}
      emptyTitle="Nobody matches."
      emptyAction={<Button testID="new-parent">New parent</Button>}
    />
  );
}

function Multi() {
  const [value, setValue] = useState<string[]>([]);
  return <SearchPicker multiple items={ITEMS} value={value} onChange={setValue} />;
}

describe('SearchPicker', () => {
  it('narrows the rows as the search is typed', async () => {
    await renderWithProviders(<Single />);
    expect(screen.getByTestId('search-picker-row-a')).toBeTruthy();
    expect(screen.getByTestId('search-picker-row-m')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('search-picker-input'), 'okafor');
    expect(screen.queryByTestId('search-picker-row-a')).toBeNull();
    expect(screen.getByTestId('search-picker-row-m')).toBeTruthy();
  });

  it('says when nothing matches, with the next step', async () => {
    await renderWithProviders(<Single />);
    await fireEvent.changeText(screen.getByTestId('search-picker-input'), 'nobody at all');
    expect(screen.getByTestId('search-picker-empty')).toBeTruthy();
    expect(screen.getByText('Nobody matches.')).toBeTruthy();
    expect(screen.getByTestId('new-parent')).toBeTruthy();
  });

  it('chooses one row: the tick moves with the choice', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Single onChange={onChange} />);
    await fireEvent.press(screen.getByTestId('search-picker-row-a'));
    expect(onChange).toHaveBeenLastCalledWith('a');
    expect(screen.getByTestId('search-picker-row-a').props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByTestId('search-picker-row-m'));
    expect(screen.getByTestId('search-picker-row-a').props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByTestId('search-picker-row-m').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('chooses several, and a second tap takes one back', async () => {
    await renderWithProviders(<Multi />);
    await fireEvent.press(screen.getByTestId('search-picker-row-a'));
    await fireEvent.press(screen.getByTestId('search-picker-row-z'));
    const checked = (id: string) =>
      screen.getByTestId(`search-picker-row-${id}`).props.accessibilityState.checked as boolean;
    expect([checked('a'), checked('m'), checked('z')]).toEqual([true, false, true]);
    await fireEvent.press(screen.getByTestId('search-picker-row-a'));
    expect([checked('a'), checked('m'), checked('z')]).toEqual([false, false, true]);
  });
});
