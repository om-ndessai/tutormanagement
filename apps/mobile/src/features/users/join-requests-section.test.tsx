// Phase 52: the requests to join at the head of People -- nothing when there are none, a count,
// Let in opens the Let in sheet on the request (UI audit JF1), the whole address and when they asked
// each on a line of their own (JF26), and Decline asks first.
import { fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { renderWithProviders } from '@/test/render';
import { JoinRequestsSection } from './join-requests-section';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
const mockSuccess = jest.fn();
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: mockSuccess, error: jest.fn(), info: jest.fn() }),
}));

let mockRows: unknown[] = [];
const mockDecline = jest.fn();
jest.mock('@/features/organizations/api', () => ({
  useJoinRequests: (enabled: boolean) => ({ data: enabled ? { data: mockRows } : undefined }),
  useDeclineJoinRequest: () => ({ mutate: mockDecline, isPending: false }),
}));

const JO = {
  user_id: 'jo',
  full_name: 'Jo Joiner',
  email: 'spaces.joiner@example.com',
  requested_at: new Date(Date.now() - 5 * 60_000).toISOString(),
};

beforeEach(() => {
  mockRows = [];
  mockPush.mockReset();
  mockDecline.mockReset();
  mockSuccess.mockReset();
});

it('shows nothing when nobody has asked, or for a non-admin', async () => {
  await renderWithProviders(<JoinRequestsSection enabled />);
  expect(screen.queryByTestId('join-requests')).toBeNull();
  mockRows = [JO];
  await renderWithProviders(<JoinRequestsSection enabled={false} />);
  expect(screen.queryByTestId('join-requests')).toBeNull();
});

it('lists each request with a count, and Let in opens the Let in sheet on it', async () => {
  mockRows = [JO, { ...JO, user_id: 'max', full_name: 'Max Maker', email: null }];
  await renderWithProviders(<JoinRequestsSection enabled />);
  expect(screen.getByTestId('join-requests-count')).toHaveTextContent('2');
  expect(screen.getByTestId('join-request-jo')).toHaveTextContent(/Jo Joiner/);
  // The whole address, never cut short, and when they asked, each on its own line.
  expect(screen.getByTestId('join-request-email-jo')).toHaveTextContent('spaces.joiner@example.com');
  expect(screen.getByTestId('join-request-email-jo')).not.toHaveProp('numberOfLines');
  expect(screen.getByTestId('join-request-asked-jo')).toHaveTextContent(/^asked /);
  expect(screen.getByTestId('join-request-email-max')).toHaveTextContent('No address');
  await fireEvent.press(screen.getByTestId('join-request-let-in-jo'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/let-in', params: { request: 'jo' } });
});

it('asks before declining, and says so once declined', async () => {
  mockRows = [JO];
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await renderWithProviders(<JoinRequestsSection enabled />);
  await fireEvent.press(screen.getByTestId('join-request-decline-jo'));
  expect(mockDecline).not.toHaveBeenCalled();
  const [title, body, buttons] = alert.mock.calls[0]!;
  expect(title).toBe('Decline Jo Joiner’s request?');
  expect(body).toBe('They will see that this space did not let them in. They can ask again with the code.');
  buttons!.find((b) => b.text === 'Decline request')!.onPress!();
  expect(mockDecline).toHaveBeenCalledWith('jo', expect.any(Object));
  mockDecline.mock.calls[0][1].onSuccess();
  expect(mockSuccess).toHaveBeenCalledWith('Jo Joiner’s request declined.');
  alert.mockRestore();
});
