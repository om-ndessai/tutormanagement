// Phase 76 (JF21): the one Add chooser -- its four choices, each giving way to its flow, "My child" in a personal
// space, and a calm line for a reader who may not add people.
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { AddChooser } from './add-chooser';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args), back: jest.fn(), canGoBack: () => true },
}));
let mockAuth: Record<string, unknown> = {};
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth }));

const as = (roles: string[], organization: Record<string, unknown> = {}, account: unknown = null) => {
  mockAuth = { user: { id: 'ines', roles }, account, organization };
};

beforeEach(() => mockReplace.mockReset());

it('offers a family, anyone by email, a tutor and someone with details; each opens its flow in place', async () => {
  as(['admin']);
  await renderWithProviders(<AddChooser />);
  // Phase 78 (the glossary): the web's "Add a person" won over the app's "Add people" / "Add someone".
  expect(screen.getByTestId('add-chooser-title')).toHaveTextContent('Add a person');
  // Phase 79 (M3): the shared words and order -- just the email is second.
  expect(screen.getAllByRole('menuitem').map((node) => node.props.testID)).toEqual([
    'add-choice-family',
    'add-choice-invite',
    'add-choice-tutor',
    'add-choice-someone',
  ]);
  expect(screen.getByText('A family (parent and child)')).toBeTruthy();
  expect(screen.getByText('Anyone, by email')).toBeTruthy();
  expect(screen.getByText('Just their email. They join as a member; give them a role whenever you like.')).toBeTruthy();
  expect(screen.getByText('Someone, with details')).toBeTruthy();
  expect(screen.queryByText('Invite by email')).toBeNull();
  expect(screen.queryByText('Someone else')).toBeNull();

  await fireEvent.press(screen.getByTestId('add-choice-family'));
  expect(mockReplace).toHaveBeenLastCalledWith('/add-student');
  await fireEvent.press(screen.getByTestId('add-choice-tutor'));
  expect(mockReplace).toHaveBeenLastCalledWith('/add-tutor');
  await fireEvent.press(screen.getByTestId('add-choice-someone'));
  expect(mockReplace).toHaveBeenLastCalledWith({ pathname: '/person-form', params: { from: 'add' } });
  await fireEvent.press(screen.getByTestId('add-choice-invite'));
  expect(mockReplace).toHaveBeenLastCalledWith('/invite-people');
});

it('in a personal space: "My child", with the reader as the parent, and no tutor', async () => {
  as(['admin'], { personal: true, feature_tutoring: false });
  await renderWithProviders(<AddChooser />);
  expect(screen.getByTestId('add-chooser-title')).toHaveTextContent('Add my child');
  expect(screen.getByText('My child')).toBeTruthy();
  expect(screen.queryByTestId('add-choice-tutor')).toBeNull();
  await fireEvent.press(screen.getByTestId('add-choice-family'));
  expect(mockReplace).toHaveBeenLastCalledWith({ pathname: '/add-student', params: { guardian: 'me' } });
});

it('a reader who may not add people (a tutor, a 13-17 admin) is told so, and offered nothing', async () => {
  as(['tutor']);
  const tutor = await renderWithProviders(<AddChooser />);
  expect(screen.getByText("Only the space's admins add people.")).toBeTruthy();
  expect(screen.queryByTestId('add-choice-family')).toBeNull();
  await tutor.unmount();
  as(['admin'], {}, { age_band: '13-17' });
  await renderWithProviders(<AddChooser />);
  expect(screen.queryByTestId('add-choice-family')).toBeNull();
  expect(screen.getByTestId('add-chooser-cancel')).toHaveTextContent('Close');
});
