import type { ActiveSession } from '@tmi/shared';
import { act, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { LiveSessionBanner } from './live-session-banner';

jest.mock('expo-glass-effect', () => ({ GlassView: () => null, isGlassEffectAPIAvailable: () => false }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useSegments: () => [] }));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));
jest.mock('@/providers/auth-provider', () => ({ useOrgTimeZone: () => 'America/New_York' }));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock('./api', () => ({ useCancelActiveSession: () => ({ mutate: jest.fn(), isPending: false }) }));

function active(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    tutor_user_id: 'tutor-1',
    tutor_name: 'Alex Chen',
    student_user_id: 'student-1',
    student_name: 'Sofia Okafor',
    mode: 'virtual',
    started_at: '2026-10-08T16:00:00.000Z',
    rounded_start: '12:00',
    occurred_on: '2026-10-08',
    notes: null,
    // Filled in on purpose: the banner must render neither.
    tutor_rate_cents: 6500,
    charge_rate_cents: 9000,
    max_minutes: 90,
    auto_stop_at: '2026-10-08T17:30:00.000Z',
    ...overrides,
  };
}

describe('the live lesson banner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-08T16:01:05.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('ticks from the server start, says when it ends, and shows no money', async () => {
    await renderWithProviders(<LiveSessionBanner active={active()} />);
    expect(screen.getByTestId('live-stopwatch')).toHaveTextContent('0:01:05');
    expect(screen.getByTestId('live-from')).toHaveTextContent(/from 12:00 PM/);
    expect(screen.getByTestId('live-ends-by')).toHaveTextContent('ends by 1:30 PM');
    expect(screen.getByText(/Sofia Okafor/)).toBeOnTheScreen();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.getByLabelText('Discard this session')).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('live-stopwatch')).toHaveTextContent('0:01:07');
  });
});
