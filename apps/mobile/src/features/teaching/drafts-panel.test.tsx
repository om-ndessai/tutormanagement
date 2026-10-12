import type { SessionDraft } from '@tmi/shared';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { DraftsList } from './drafts-panel';

jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('./api', () => ({
  usePostDraft: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDiscardDraft: () => ({ mutate: jest.fn(), isPending: false }),
}));

function draft(overrides: Partial<SessionDraft> = {}): SessionDraft {
  return {
    id: 'd1',
    tutor_user_id: 'tutor-1',
    tutor_name: 'Alex Chen',
    student_user_id: 'student-1',
    student_name: 'Ben Whitfield',
    author_user_id: 'tutor-1',
    occurred_on: '2026-10-07',
    started_at: '16:00',
    ended_at: '17:00',
    mode: 'in_person',
    notes: null,
    progress: null,
    write_up: null,
    assessment: null,
    created_at: '2026-10-07T20:00:00Z',
    updated_at: '2026-10-07T20:00:00Z',
    ...overrides,
  };
}

describe('the drafts panel', () => {
  it('lists each draft with its day, times and mode, and says when nothing is written yet', async () => {
    const onEdit = jest.fn();
    await renderWithProviders(
      <DraftsList
        drafts={[draft(), draft({ id: 'd2', student_name: 'Sofia Okafor', notes: 'Fractions' })]}
        today="2026-10-08"
        onEdit={onEdit}
      />,
    );
    expect(screen.getByText('Only you can see these')).toBeOnTheScreen();
    expect(screen.getByText('Ben Whitfield')).toBeOnTheScreen();
    expect(screen.getByText(/Wed, Oct 7 · 4:00–5:00 PM · In person · no notes yet/)).toBeOnTheScreen();
    expect(screen.getByText(/Wed, Oct 7 · 4:00–5:00 PM · In person$/)).toBeOnTheScreen();
    // A draft carries no money, and the panel shows none.
    expect(screen.queryByText(/\$/)).toBeNull();
    fireEvent.press(screen.getByTestId('draft-continue-d2'));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'd2' }));
    expect(screen.getByLabelText('Discard the draft with Ben Whitfield')).toBeOnTheScreen();
  });

  it('speaks of one draft in the singular', async () => {
    await renderWithProviders(<DraftsList drafts={[draft()]} today="2026-10-08" onEdit={jest.fn()} />);
    expect(screen.getByText('Only you can see it')).toBeOnTheScreen();
  });
});
