// Phase 76 (JF21): "Someone else" from the Add chooser (`?from=add`) ends on the next steps, not a toast and a close;
// the person form opened any other way still closes on save.
import type { UserDetail } from '@tmi/shared';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { PersonFormSheet } from './person-form-sheet';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockBack(...args), canGoBack: () => true, push: jest.fn(), navigate: jest.fn() },
}));
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'ines', roles: ['admin'] }, account: null, organization: { canvas_assessments: true } }),
  useOrgTimeZone: () => 'America/New_York',
}));
jest.mock('@/hooks/use-unsaved-changes', () => ({
  useUnsavedChangesGuard: () => ({ leave: (close: () => void) => close() }),
}));
jest.mock('@/features/organizations/api', () => ({
  useJoinRequests: () => ({ isPending: false, data: { data: [] } }),
  useRefreshJoinRequests: () => jest.fn(),
}));
jest.mock('./api', () => ({ useUserDetail: () => ({ isPending: false, data: undefined }) }));
const mockSaved = { id: 'yusuf', full_name: 'Yusuf Haddad', roles: ['student'] } as unknown as UserDetail;
// The form itself has its own tests: here it only saves, and says whether it was asked to be quiet.
jest.mock('./person-form', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    PersonForm: ({ onSaved, quiet }: { onSaved: (user: UserDetail) => void; quiet?: boolean }) => (
      <Pressable testID="stub-save" onPress={() => onSaved(mockSaved)}>
        <Text>{quiet ? 'quiet' : 'loud'}</Text>
      </Pressable>
    ),
  };
});

beforeEach(() => mockBack.mockReset());

it('from the Add chooser, a new person ends on the next steps, quietly', async () => {
  await renderWithProviders(<PersonFormSheet forGuardian={false} fromAdd />);
  expect(screen.getByText('quiet')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('stub-save'));
  expect(mockBack).not.toHaveBeenCalled();
  expect(screen.getByText('Yusuf Haddad is added')).toBeTruthy();
  expect(screen.getByTestId('add-done-next-pair_tutor')).toBeTruthy();
  expect(screen.getByTestId('add-done-next-assessment')).toBeTruthy();
  // "Add someone else" starts a fresh form.
  await fireEvent.press(screen.getByTestId('add-person-done-again'));
  expect(screen.getByTestId('stub-save')).toBeTruthy();
});

it('opened any other way, the form closes on save as before', async () => {
  await renderWithProviders(<PersonFormSheet forGuardian={false} />);
  expect(screen.getByText('loud')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('stub-save'));
  expect(mockBack).toHaveBeenCalled();
  expect(screen.queryByText('Yusuf Haddad is added')).toBeNull();
});
