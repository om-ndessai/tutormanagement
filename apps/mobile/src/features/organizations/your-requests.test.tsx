// UI audit (JF5; owner, 2026-11-04: "stay until dismissed"): the home's "Your requests" -- waiting with
// Withdraw, let in with Open and a dismiss, declined with its day, Ask again and a dismiss -- from the
// person's own session, and nothing when there is nothing.
import type { MyJoinRequest } from '@tmi/shared';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { YourRequestsCard } from './your-requests';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  dismissAll: jest.fn(),
  canDismiss: jest.fn(() => false),
};
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockAuth(),
  useOrgTimeZone: () => 'America/New_York',
}));

const mockDismiss = jest.fn();
const mockWithdraw = jest.fn();
jest.mock('./api', () => ({
  useDismissJoinOutcome: () => ({ mutateAsync: mockDismiss, isPending: false }),
  useWithdrawRequest: () => ({ mutateAsync: mockWithdraw, isPending: false }),
}));

const request = (slug: string, name: string, outcome: MyJoinRequest['outcome']): MyJoinRequest => ({
  slug,
  name,
  short_name: slug,
  palette: 'teal',
  logo_mark_url: null,
  requested_at: '2026-11-01T12:00:00Z',
  outcome,
  answered_at: outcome ? '2026-11-03T15:00:00Z' : null,
});
const chooseOrganization = jest.fn(async () => undefined);

function as(joinRequests: MyJoinRequest[]) {
  mockAuth.mockReturnValue({ joinRequests, chooseOrganization });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDismiss.mockResolvedValue({ data: { dismissed: true } });
  mockWithdraw.mockResolvedValue(undefined);
});

it('shows nothing without a request', async () => {
  as([]);
  await renderWithProviders(<YourRequestsCard />);
  expect(screen.queryByTestId('home-requests')).toBeNull();
});

it('a waiting request: who it is waiting for, and Withdraw', async () => {
  as([request('assess', 'Ferreira Family Practice', null)]);
  await renderWithProviders(<YourRequestsCard />);
  expect(screen.getByTestId('home-requests')).toHaveTextContent(/Your requests/);
  expect(screen.getByTestId('home-request-assess')).toHaveTextContent(
    /Asked to join Ferreira Family Practice · waiting for its admins/,
  );
  expect(screen.queryByTestId('home-request-dismiss-assess')).toBeNull();
  await act(async () => {
    await fireEvent.press(screen.getByTestId('home-request-withdraw-assess'));
  });
  expect(mockWithdraw).toHaveBeenCalledWith('assess');
  expect(mockToast.success).toHaveBeenCalledWith('Request to Ferreira Family Practice withdrawn.');
});

it('let in: "You\'re in", Open enters the space; the answer stays until dismissed', async () => {
  as([request('riverside', 'Riverside Tutoring', 'approved')]);
  await renderWithProviders(<YourRequestsCard />);
  expect(screen.getByTestId('home-request-riverside')).toHaveTextContent(/You're in Riverside Tutoring\./);
  expect(screen.queryByTestId('home-request-ask-again-riverside')).toBeNull();
  expect(screen.queryByTestId('home-request-withdraw-riverside')).toBeNull();
  await act(async () => {
    await fireEvent.press(screen.getByTestId('home-request-open-riverside'));
  });
  expect(mockDismiss).not.toHaveBeenCalled();
  expect(chooseOrganization).toHaveBeenCalledWith('riverside');
  expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
});

it('declined: the day it answered, Ask again opens Join with a code, and the dismiss is labelled', async () => {
  as([request('riverside', 'Riverside Tutoring', 'declined')]);
  await renderWithProviders(<YourRequestsCard />);
  const row = screen.getByTestId('home-request-riverside');
  expect(row).toHaveTextContent(/Riverside Tutoring did not let you in/);
  expect(row).toHaveTextContent(/Declined on Nov 3, 2026\./);
  expect(screen.queryByTestId('home-request-open-riverside')).toBeNull();
  await fireEvent.press(screen.getByTestId('home-request-ask-again-riverside'));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/spaces', params: { join: '1' } });
  expect(mockDismiss).not.toHaveBeenCalled();
  expect(screen.getByTestId('home-request-dismiss-riverside')).toHaveProp('accessibilityLabel', 'Dismiss');
});

it('dismiss calls the new route (the session is then read again by the hook)', async () => {
  as([
    request('riverside', 'Riverside Tutoring', 'declined'),
    request('assess', 'Ferreira Family Practice', 'approved'),
  ]);
  await renderWithProviders(<YourRequestsCard />);
  await act(async () => {
    await fireEvent.press(screen.getByTestId('home-request-dismiss-riverside'));
  });
  expect(mockDismiss).toHaveBeenCalledTimes(1);
  expect(mockDismiss).toHaveBeenCalledWith('riverside');
  expect(chooseOrganization).not.toHaveBeenCalled();
});

it('a failed dismiss says so', async () => {
  mockDismiss.mockRejectedValueOnce(new Error('offline'));
  as([request('riverside', 'Riverside Tutoring', 'declined')]);
  await renderWithProviders(<YourRequestsCard />);
  await act(async () => {
    await fireEvent.press(screen.getByTestId('home-request-dismiss-riverside'));
  });
  expect(mockToast.error).toHaveBeenCalledWith('Could not dismiss it. Try again.');
});
