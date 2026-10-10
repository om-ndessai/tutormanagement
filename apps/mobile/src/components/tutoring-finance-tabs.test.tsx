// The Tutoring / Finance switch is a tab list to a screen reader, with the open half selected
// (ux-audit F-20), and switching sets `?tab=`.
import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { TutoringFinanceSwitch } from './tutoring-finance-tabs';

const mockSetParams = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ tab: 'finance' }),
  router: { setParams: (params: unknown) => mockSetParams(params) },
}));

test('two tabs in a tab list, Finance selected; Tutoring switches back', async () => {
  const screen = await renderWithProviders(<TutoringFinanceSwitch />);
  const tabs = screen.getAllByRole('tab');
  expect(tabs).toHaveLength(2);
  expect(screen.getByRole('tab', { name: 'Finance' }).props.accessibilityState).toEqual({ selected: true });
  expect(screen.getByRole('tab', { name: 'Tutoring' }).props.accessibilityState).toEqual({ selected: false });
  // The two sit in one tab list (a container, so not itself an accessible element).
  let node = screen.getByTestId('tabs-tutoring').parent as {
    props: { accessibilityRole?: string };
    parent: unknown;
  } | null;
  while (node && node.props.accessibilityRole !== 'tablist') node = node.parent as typeof node;
  expect(node?.props.accessibilityRole).toBe('tablist');

  fireEvent.press(screen.getByTestId('tabs-tutoring'));
  expect(mockSetParams).toHaveBeenCalledWith({ tab: 'tutoring' });
});
