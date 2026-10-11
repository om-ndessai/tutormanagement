import { fireEvent, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { renderWithProviders } from '@/test/render';
import { SwipeRow, rowActionsA11y, type RowAction } from './swipe-row';

jest.mock('@/lib/haptics', () => ({
  haptics: { impact: jest.fn(), selection: jest.fn(), warning: jest.fn() },
}));

// Paper's Menu measures its anchor before it shows, which a test renderer cannot; a stand-in
// shows the items while visible and says where it was anchored.
jest.mock('react-native-paper', () => {
  const actual = jest.requireActual('react-native-paper');
  const { Pressable, Text: RNText, View } = jest.requireActual('react-native');
  function Menu({
    visible,
    anchor,
    children,
  }: {
    visible: boolean;
    anchor: { x: number; y: number };
    children: unknown;
  }) {
    if (!visible) return null;
    return (
      <View testID="menu">
        <RNText testID="menu-anchor">{`${anchor.x},${anchor.y}`}</RNText>
        {children as never}
      </View>
    );
  }
  function MenuItem({ testID, title, onPress }: { testID: string; title: string; onPress: () => void }) {
    return (
      <Pressable testID={testID} onPress={onPress}>
        <RNText>{title}</RNText>
      </Pressable>
    );
  }
  Menu.Item = MenuItem;
  return { ...actual, Menu };
});

const press = { nativeEvent: { pageX: 10, pageY: 20 } };

describe('a swipe row', () => {
  it('is just the row when there is nothing the reader may do', async () => {
    await renderWithProviders(
      <SwipeRow actions={[]} testID="row">
        <Text>Row</Text>
      </SwipeRow>,
    );
    expect(screen.getByText('Row')).toBeTruthy();
    expect(screen.queryByTestId('swipe-row-row')).toBeNull();
  });

  it('opens the same verbs as a menu on a long press, and runs the one chosen', async () => {
    const edit = jest.fn();
    const remove = jest.fn();
    const actions: RowAction[] = [
      { key: 'delete', label: 'Delete', icon: 'trash-can-outline', destructive: true, onPress: remove },
      { key: 'edit', label: 'Edit', icon: 'pencil-outline', onPress: edit },
    ];
    await renderWithProviders(
      <SwipeRow actions={actions} testID="row">
        {({ openMenu }) => (
          <Pressable testID="row-body" onLongPress={openMenu}>
            <Text>Row</Text>
          </Pressable>
        )}
      </SwipeRow>,
    );
    expect(screen.queryByTestId('menu')).toBeNull();
    await fireEvent(screen.getByTestId('row-body'), 'longPress', press);
    expect(screen.getByTestId('menu-anchor').props.children).toBe('16,20');
    // Non-destructive verbs first, the destructive one last.
    const items = screen.getAllByTestId(/^row-action-/);
    expect(items.map((item) => item.props.testID)).toEqual(['row-action-edit', 'row-action-delete']);
    await fireEvent.press(screen.getByTestId('row-action-delete'));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(edit).not.toHaveBeenCalled();
    expect(screen.queryByTestId('menu')).toBeNull();
  });
});

describe('accessibility actions', () => {
  it('name each verb and dispatch it, with activate opening the row', () => {
    const open = jest.fn();
    const edit = jest.fn();
    const a11y = rowActionsA11y([{ key: 'edit', label: 'Edit', icon: 'pencil', onPress: edit }], open);
    expect(a11y.accessibilityActions).toEqual([{ name: 'activate' }, { name: 'edit', label: 'Edit' }]);
    a11y.onAccessibilityAction({ nativeEvent: { actionName: 'edit' } } as never);
    a11y.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } } as never);
    expect(edit).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
