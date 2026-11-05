// UI audit (JF5): the account button (the web's switcher) counts what waits for the person -- invitations,
// and the spaces' answers to their requests not yet dismissed -- never a request still waiting.
import type { MyJoinRequest } from '@tmi/shared';
import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { AccountButton, accountButtonLabel } from './account-button';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/onboarding/tour-targets', () => ({ useTourTarget: () => undefined }));
const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));

const request = (slug: string, outcome: MyJoinRequest['outcome']): MyJoinRequest => ({
  slug,
  name: slug,
  short_name: slug,
  palette: 'teal',
  logo_mark_url: null,
  requested_at: '2026-11-01T12:00:00Z',
  outcome,
});

function as(invitations: number, joinRequests: MyJoinRequest[]) {
  mockAuth.mockReturnValue({
    user: { id: 'me', full_name: 'Nina Newcomer', roles: ['parent'] },
    invitations: Array.from({ length: invitations }, (_, i) => ({ slug: `inv-${i}` })),
    joinRequests,
  });
}

it('says nothing extra while nothing waits (a request still waiting does not count)', async () => {
  as(0, [request('assess', null)]);
  await renderWithProviders(<AccountButton />);
  expect(screen.queryByTestId('account-badge', { includeHiddenElements: true })).toBeNull();
  expect(screen.getByTestId('account-button')).toHaveProp('accessibilityLabel', 'Account menu');
});

it('counts invitations and undismissed answers, and says so to a screen reader', async () => {
  as(1, [request('assess', null), request('riverside', 'declined'), request('host', 'approved')]);
  await renderWithProviders(<AccountButton />);
  // The figure is drawn for the eye; a screen reader hears it in the button's label instead.
  expect(screen.getByTestId('account-badge', { includeHiddenElements: true })).toHaveTextContent('3');
  expect(screen.getByTestId('account-button')).toHaveProp(
    'accessibilityLabel',
    'Account menu, 1 invitation waiting, 2 answers to your requests',
  );
});

it('the label carries the whole figure; the badge draws at most 9+', async () => {
  expect(accountButtonLabel(0, 0)).toBe('Account menu');
  expect(accountButtonLabel(0, 1)).toBe('Account menu, 1 answer to your request');
  expect(accountButtonLabel(12, 0)).toBe('Account menu, 12 invitations waiting');
  as(12, []);
  await renderWithProviders(<AccountButton />);
  expect(screen.getByTestId('account-badge', { includeHiddenElements: true })).toHaveTextContent('9+');
});
