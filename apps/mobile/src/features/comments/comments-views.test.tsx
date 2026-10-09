import { SSN_REJECTED_MESSAGE, type Comment } from '@tmi/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { CommentThread } from './comment-thread';

jest.mock('@/providers/auth-provider', () => ({ useOrgTimeZone: () => 'America/New_York' }));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

const mockThread = jest.fn();
const mockAdd = jest.fn();
jest.mock('./api', () => ({
  useComments: () => mockThread(),
  useAddComment: () => ({ mutateAsync: mockAdd, isPending: false }),
  useDeleteComment: () => ({ mutate: jest.fn(), isPending: false }),
}));

const SESSION = { target_type: 'session', target_id: '50000000-0000-4000-8000-000000000002' } as const;
const PERSON = { target_type: 'user', target_id: '00000000-0000-4000-8000-000000000008' } as const;

function comment(id: string, body: string, can_delete: boolean): Comment {
  return {
    id,
    author_user_id: 'a',
    author_name: can_delete ? 'Alex Chen' : 'Priya Raghavan',
    target_type: 'session',
    target_id: SESSION.target_id,
    body,
    created_at: '2026-09-16T08:02:00.000Z',
    can_delete,
  };
}

function thread(comments: Comment[], target_name: string | null = null) {
  mockThread.mockReturnValue({
    data: { data: { comments, target_name } },
    isPending: false,
    error: null,
    refetch: jest.fn(),
  });
}

beforeEach(() => {
  mockAdd.mockReset();
  mockThread.mockReset();
});

describe('CommentThread', () => {
  it('lists the comments in the server’s order, with delete only where the server allows it', async () => {
    thread([comment('c2', 'Newest', true), comment('c1', 'Older', false)]);
    await renderWithProviders(<CommentThread target={SESSION} />);
    const rows = screen.getAllByTestId(/^comment-c/);
    expect(rows.map((row) => row.props.testID)).toEqual(['comment-c2', 'comment-c1']);
    expect(screen.getByTestId('comment-delete-c2')).toBeTruthy();
    expect(screen.queryByTestId('comment-delete-c1')).toBeNull();
  });

  it('says so when nothing has been noted', async () => {
    thread([]);
    await renderWithProviders(<CommentThread target={SESSION} />);
    expect(screen.getByText('Nothing has been noted here yet.')).toBeTruthy();
  });

  it('names a lesson’s audience', async () => {
    thread([]);
    await renderWithProviders(<CommentThread target={SESSION} />);
    expect(screen.getByTestId('comments-audience')).toHaveTextContent(
      'Visible to admins, the tutor, the student, and the student’s parents. Comments cannot be edited.',
    );
  });

  it('names a person’s narrower audience', async () => {
    thread([], 'Sofia Okafor');
    await renderWithProviders(<CommentThread target={PERSON} />);
    expect(screen.getByTestId('comments-audience')).toHaveTextContent(
      'Visible to admins, Sofia Okafor, and their parents. Comments cannot be edited.',
    );
  });

  it('refuses an SSN-shaped body on the device, with the shared sentence and no request', async () => {
    thread([]);
    await renderWithProviders(<CommentThread target={SESSION} />);
    await fireEvent.changeText(screen.getByTestId('comments-composer'), 'Her number is 123-45-6789');
    await fireEvent.press(screen.getByTestId('comments-post'));
    expect(await screen.findByTestId('comments-body-error')).toHaveTextContent(SSN_REJECTED_MESSAGE);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('counts characters and posts the trimmed body', async () => {
    thread([]);
    mockAdd.mockResolvedValue({});
    await renderWithProviders(<CommentThread target={SESSION} />);
    expect(screen.getByTestId('comments-counter')).toHaveTextContent('0 / 2000');
    await fireEvent.changeText(screen.getByTestId('comments-composer'), '  Room 1 next week  ');
    expect(screen.getByTestId('comments-counter')).toHaveTextContent('20 / 2000');
    await fireEvent.press(screen.getByTestId('comments-post'));
    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith({ ...SESSION, body: 'Room 1 next week' }));
    await waitFor(() => expect(screen.getByTestId('comments-counter')).toHaveTextContent('0 / 2000'));
  });

  it('shows a target the reader may not see as not found', async () => {
    mockThread.mockReturnValue({
      data: undefined,
      isPending: false,
      error: new ApiRequestError(404, 'not_found', 'That session does not exist.'),
      refetch: jest.fn(),
    });
    await renderWithProviders(<CommentThread target={SESSION} />);
    expect(screen.getByText(/Not found/)).toBeTruthy();
    expect(screen.queryByTestId('comments-composer')).toBeNull();
  });
});
