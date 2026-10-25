// The question bank's screens (#54): the coverage, the review queue and a standard's questions. The
// api client is mocked at the network edge, so the real hooks and the real cache updates run: an
// action writes its answer into the caches instead of reading the queue and the coverage again.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { Question, QuestionCoverageLevel } from '@tmi/shared';
import type { ReactElement } from 'react';
import { Alert } from 'react-native';

import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { ThemeProvider } from '@/providers/theme-provider';
import { aLevel, aQuestion, aTopic } from '@/test/question-bank';
import { suggestedLabel } from './question-card';
import { QuestionBankScreen } from './question-bank-screen';
import { ReviewScreen } from './review-screen';
import { StandardScreen } from './standard-screen';

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: {
    get: (path: string) => mockGet(path),
    post: (path: string, body?: unknown) => mockPost(path, body),
  },
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { push: (to: string) => mockPush(to), back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = require('react') as typeof import('react');
    useEffect(() => effect(), [effect]);
  },
}));
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));
jest.mock('@/lib/haptics', () => ({
  haptics: {
    selection: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    impact: jest.fn(),
  },
}));
const mockHaptics = jest.mocked(haptics);

const Q1 = aQuestion({ id: 'q1' });
const Q2 = aQuestion({
  id: 'q2',
  kind: 'numeric',
  choices: [],
  answer: '5/6',
  stem: 'What is $\\frac{2}{3} + \\frac{1}{6}$?',
});
const Q3 = aQuestion({ id: 'q3' });

function coverage(checked: number): QuestionCoverageLevel[] {
  return [
    aLevel('NC26.3', 'Grade 3', [aTopic({ checked, approved: [0, 1, 0] })]),
    aLevel('NC26.4', 'Grade 4', [
      aTopic({
        topic_id: 'NC26.4.ANR.1',
        code: '4.ANR.1',
        name: 'Place value to 100,000',
        approved: [2, 2, 2],
      }),
    ]),
  ];
}

/** The server, as far as these screens see it. */
function serve({
  queue,
  cover,
  topic,
}: {
  queue?: Question[];
  cover?: QuestionCoverageLevel[];
  topic?: Question[];
}) {
  mockGet.mockImplementation((path: string) => {
    if (path === '/platform/questions/coverage') return Promise.resolve({ data: cover ?? coverage(3) });
    if (path.includes('status=checked')) return Promise.resolve({ data: queue ?? [Q1, Q2, Q3] });
    if (path.includes('topic_id=')) return Promise.resolve({ data: topic ?? [] });
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}
const gets = (match: string) => mockGet.mock.calls.filter(([path]) => String(path).includes(match)).length;

let client: QueryClient | undefined;
async function show(ui: ReactElement) {
  // No garbage-collection timers (gcTime: Infinity): they would hold Jest open for five minutes.
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  return await render(
    <QueryClientProvider client={client}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}
afterEach(() => {
  client?.clear();
  client = undefined;
});
const disabled = (id: string) => screen.getByTestId(id).props.accessibilityState?.disabled === true;
/**
 * Under fake timers: TanStack Query hands its results to React on a `setTimeout(0)`, so step the
 * clock a millisecond at a time until the first card shows (at most a few ms pass).
 */
async function untilCard(id: string) {
  for (let i = 0; i < 20 && !screen.queryByTestId(`question-bank-card-${id}`); i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });
  }
  expect(screen.getByTestId(`question-bank-card-${id}`)).toBeTruthy();
}
/** Review's actions wake once the body has drawn and 350 ms have passed. */
async function untilReady() {
  await waitFor(() => expect(disabled('question-bank-approve')).toBe(false));
}

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as { webviewHeight?: number | null }).webviewHeight = undefined;
  mockPost.mockImplementation((path: string) => {
    const [, id, action] = /\/platform\/questions\/([^/]+)\/(\w+)/.exec(path) ?? [];
    const status = action === 'approve' ? 'approved' : action === 'retire' ? 'retired' : 'draft';
    const before = [Q1, Q2, Q3].find((q) => q.id === id)!;
    return Promise.resolve({
      data: { ...before, status, reviewed_by_name: status === 'approved' ? 'Nav Dessai' : null },
    });
  });
});

describe('QuestionBankScreen', () => {
  it('shows the totals and the review button, and opens a level to its standards', async () => {
    serve({});
    await show(<QuestionBankScreen />);
    expect(await screen.findByText('Review 3 checked')).toBeTruthy();
    expect(screen.getByTestId('stat-at-target-value').props.children).toBe('1 / 2');
    expect(screen.getByTestId('stat-to-review').props.accessibilityLabel).toBe('To review: 3');
    expect(screen.getByTestId('question-bank-level-NC26.4-summary').props.children).toBe(
      '1 of 1 standards at target',
    );
    expect(screen.queryByTestId('question-bank-standard-NC26.4.ANR.1')).toBeNull();
    await fireEvent.press(screen.getByTestId('question-bank-level-NC26.4'));
    expect(screen.getByTestId('question-bank-standard-NC26.4.ANR.1-status').props.children).toBe('At target');
    await fireEvent.press(screen.getByTestId('question-bank-standard-NC26.4.ANR.1'));
    expect(mockPush).toHaveBeenCalledWith('/platform/questions/NC26.4.ANR.1');
    await fireEvent.press(screen.getByTestId('question-bank-review'));
    expect(mockPush).toHaveBeenCalledWith('/question-review');
  });

  it('offers what spaces suggested, whatever the count (Phase 51)', async () => {
    serve({ cover: coverage(0) });
    await show(<QuestionBankScreen />);
    await fireEvent.press(await screen.findByTestId('bank-suggested'));
    expect(mockPush).toHaveBeenCalledWith('/question-review?suggested=1');
  });

  it('says there is nothing to review, and does not offer it, at 0', async () => {
    serve({ cover: coverage(0) });
    await show(<QuestionBankScreen />);
    expect(await screen.findByText('Nothing to review')).toBeTruthy();
    expect(disabled('question-bank-review')).toBe(true);
  });
});

describe('ReviewScreen', () => {
  it('approves the question on screen and moves on without reading the queue again', async () => {
    serve({});
    await show(<ReviewScreen />);
    await untilReady();
    expect(screen.getByTestId('question-bank-left').props.children).toBe('3 left');
    expect(gets('status=checked')).toBe(1);
    await fireEvent.press(screen.getByTestId('question-bank-approve'));
    await waitFor(() => expect(screen.getByTestId('question-bank-card-q2')).toBeTruthy());
    expect(mockPost).toHaveBeenCalledWith('/platform/questions/q1/approve', undefined);
    expect(mockHaptics.success).toHaveBeenCalled();
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(screen.getByTestId('question-bank-left').props.children).toBe('2 left');
    expect(gets('status=checked')).toBe(1);
    expect(gets('coverage')).toBe(1);
    // A later read that still lists the approved question does not bring it back.
    await act(() => client!.refetchQueries({ queryKey: ['platform', 'questions', 'list'] }));
    expect(gets('status=checked')).toBe(2);
    expect(screen.queryByTestId('question-bank-card-q1')).toBeNull();
    expect(screen.getByTestId('question-bank-card-q2')).toBeTruthy();
  });

  it('keeps its actions asleep until the body has drawn, and for 350 ms after', async () => {
    jest.useFakeTimers();
    try {
      (globalThis as { webviewHeight?: number | null }).webviewHeight = null;
      serve({});
      await show(<ReviewScreen />);
      await untilCard('q1');
      await act(() => {
        jest.advanceTimersByTime(1000);
      });
      // Drawn? Not yet: the page has not reported its height, so 350 ms are not enough.
      expect(disabled('question-bank-approve')).toBe(true);
      // Three seconds without a height: the plain text stands in, and counts as drawn.
      await act(() => {
        jest.advanceTimersByTime(2050);
      });
      expect(screen.getByTestId('question-bank-body-fallback')).toBeTruthy();
      expect(disabled('question-bank-approve')).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not wake within 350 ms of a new card', async () => {
    jest.useFakeTimers();
    try {
      serve({});
      await show(<ReviewScreen />);
      await untilCard('q1');
      await act(() => {
        jest.advanceTimersByTime(330);
      });
      expect(disabled('question-bank-approve')).toBe(true);
      await act(() => {
        jest.advanceTimersByTime(20);
      });
      expect(disabled('question-bank-approve')).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('asks before retiring, and retires only on Retire', async () => {
    serve({});
    const alert = jest.spyOn(Alert, 'alert');
    alert.mockImplementationOnce((_title, _message, buttons) => buttons?.[0]?.onPress?.());
    await show(<ReviewScreen />);
    await untilReady();
    await fireEvent.press(screen.getByTestId('question-bank-retire'));
    expect(alert).toHaveBeenCalledWith(
      'Retire this question?',
      'It leaves the bank. Restoring it sends it back to be checked at the desk.',
      expect.any(Array),
      expect.any(Object),
    );
    expect(mockHaptics.warning).toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
    alert.mockImplementationOnce((_title, _message, buttons) => buttons?.[1]?.onPress?.());
    await fireEvent.press(screen.getByTestId('question-bank-retire'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/platform/questions/q1/retire', undefined));
    await waitFor(() => expect(screen.getByTestId('question-bank-card-q2')).toBeTruthy());
    alert.mockRestore();
  });

  it('skips, and says how many were skipped', async () => {
    serve({});
    await show(<ReviewScreen />);
    await untilReady();
    await fireEvent.press(screen.getByTestId('question-bank-skip'));
    expect(mockHaptics.selection).toHaveBeenCalled();
    expect(screen.getByTestId('question-bank-card-q2')).toBeTruthy();
    expect(screen.getByTestId('question-bank-left').props.children).toBe('2 left, 1 skipped');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('keeps a refusal inline above the bar, with the card, and reads the queue again', async () => {
    serve({});
    mockPost.mockRejectedValueOnce(
      new ApiRequestError(409, 'conflict', 'It is nearly the same as another question on this standard.'),
    );
    await show(<ReviewScreen />);
    await untilReady();
    await fireEvent.press(screen.getByTestId('question-bank-approve'));
    expect(
      await screen.findByText('It is nearly the same as another question on this standard.'),
    ).toBeTruthy();
    expect(screen.getByTestId('question-bank-error')).toBeTruthy();
    expect(screen.getByTestId('question-bank-card-q1')).toBeTruthy();
    expect(mockHaptics.error).toHaveBeenCalled();
    await waitFor(() => expect(gets('status=checked')).toBe(2));
  });

  it('reads only what spaces suggested, and says when none did (Phase 51)', async () => {
    serve({ queue: [] });
    await show(<ReviewScreen suggested />);
    expect(await screen.findByTestId('question-review-none-suggested')).toBeTruthy();
    expect(screen.getByText('No space has suggested approving a question.')).toBeTruthy();
    expect(gets('suggested=true')).toBe(1);
  });

  it('marks a question spaces suggested, in the singular and the plural (Phase 51)', async () => {
    serve({ queue: [{ ...Q1, suggestions: 2 }] });
    await show(<ReviewScreen suggested />);
    expect(await screen.findByTestId('question-suggested-q1')).toBeTruthy();
    expect(screen.getByText('Suggested by 2 spaces')).toBeTruthy();
    expect(suggestedLabel(1)).toBe('Suggested by 1 space');
  });

  it('shows no suggestion pill for a question nobody suggested', async () => {
    serve({});
    await show(<ReviewScreen />);
    await screen.findByTestId('question-bank-card-q1');
    expect(screen.queryByTestId('question-suggested-q1')).toBeNull();
  });

  it('says when nothing waits', async () => {
    serve({ queue: [], cover: coverage(0) });
    await show(<ReviewScreen />);
    expect(await screen.findByText('Nothing waiting for review.')).toBeTruthy();
    expect(screen.queryByTestId('question-bank-actions')).toBeNull();
  });

  it('says when only skipped questions are left, and goes through them again', async () => {
    serve({ queue: [Q1], cover: coverage(1) });
    await show(<ReviewScreen />);
    await untilReady();
    await fireEvent.press(screen.getByTestId('question-bank-skip'));
    expect(await screen.findByText('Only skipped questions are left.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('question-bank-again'));
    expect(screen.getByTestId('question-bank-card-q1')).toBeTruthy();
    expect(screen.getByTestId('question-bank-left').props.children).toBe('1 left');
  });

  it('labels the body with its spoken form and hides the web view from assistive tech', async () => {
    serve({});
    await show(<ReviewScreen />);
    await untilReady();
    const body = screen.getByTestId('question-bank-body-q1');
    expect(body.props.accessibilityLabel).toBe(
      'Question. Which number is the greatest? (q1). Choice A: 3,908. Choice B: 3,980, the answer. Choice C: 3,890. Choice D: 3,098. Solution. Compare the hundreds, then the tens: 3,980 is the greatest.',
    );
    // Assistive tech cannot reach the web view: only a query that includes hidden elements finds it.
    expect(screen.queryByTestId('mock-webview')).toBeNull();
    const webview = screen.getByTestId('mock-webview', { includeHiddenElements: true });
    let hidden = webview.parent;
    while (hidden && hidden.props.importantForAccessibility !== 'no-hide-descendants') hidden = hidden.parent;
    expect(hidden?.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(hidden?.props.accessibilityElementsHidden).toBe(true);
  });
});

describe('StandardScreen', () => {
  const TOPIC = [
    aQuestion({ id: 'q1', status: 'checked' }),
    aQuestion({
      id: 'q4',
      status: 'approved',
      reviewed_by_name: 'Nav Dessai',
      reviewed_at: new Date().toISOString(),
    }),
    aQuestion({ id: 'q5', status: 'retired' }),
  ];

  it('offers Approve only when checked and Restore only when retired', async () => {
    serve({ topic: TOPIC });
    await show(<StandardScreen topicId="NC26.3.ANR.1" />);
    expect(await screen.findByTestId('question-bank-card-q1')).toBeTruthy();
    expect(screen.getByText('All (2)')).toBeTruthy();
    expect(screen.getByTestId('question-bank-approve-q1')).toBeTruthy();
    expect(screen.queryByTestId('question-bank-approve-q4')).toBeNull();
    expect(screen.getByTestId('question-bank-provenance-q4').props.children).toMatch(
      /^Approved by Nav Dessai, /,
    );
    // All leaves the retired out; its own filter shows it, with Restore and no Retire.
    expect(screen.queryByTestId('question-bank-card-q5')).toBeNull();
    await fireEvent.press(screen.getByTestId('question-bank-filter-retired'));
    expect(screen.getByTestId('question-bank-restore-q5')).toBeTruthy();
    expect(screen.queryByTestId('question-bank-retire-q5')).toBeNull();
  });

  it("approves with the web's toast and moves the counts without a refetch", async () => {
    serve({ topic: TOPIC });
    await show(<StandardScreen topicId="NC26.3.ANR.1" />);
    await fireEvent.press(await screen.findByTestId('question-bank-approve-q1'));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Approved.'));
    expect(await screen.findByText('Approved (2)')).toBeTruthy();
    expect(screen.queryByTestId('question-bank-approve-q1')).toBeNull();
    expect(gets('topic_id=')).toBe(1);
  });

  it('says a standard that is not in the bank is not there', async () => {
    serve({});
    await show(<StandardScreen topicId="NC26.9.XX.1" />);
    expect(await screen.findByText('That standard is not in the question bank.')).toBeTruthy();
  });

  it('offers no writing, editing, checking or figure switch on a standard', async () => {
    serve({ topic: TOPIC });
    await show(<StandardScreen topicId="NC26.3.ANR.1" />);
    await screen.findByTestId('question-bank-card-q1');
    nothingOfTheDesk();
    expect(screen.queryByText(/Needs a figure/)).toBeNull();
  });
});

/** Writing, editing, checking and the figure switch stay at the desk (#54). */
function nothingOfTheDesk() {
  for (const word of [/Edit/, /Write/, /Solve blind/, /Check again/]) {
    expect(screen.queryByText(word)).toBeNull();
  }
  expect(screen.queryByRole('switch')).toBeNull();
}

describe('nothing of the desk', () => {
  it('shows "Needs a figure" read-only on the bank, and offers no writing there', async () => {
    serve({ cover: [aLevel('NC26.3', 'Grade 3', [aTopic({ needs_figure: true, checked: 1 })])] });
    await show(<QuestionBankScreen />);
    await fireEvent.press(await screen.findByTestId('question-bank-level-NC26.3'));
    expect(screen.getByTestId('question-bank-standard-NC26.3.ANR.1-figure')).toBeTruthy();
    nothingOfTheDesk();
  });

  it('offers no writing, editing or checking on Review', async () => {
    serve({});
    await show(<ReviewScreen />);
    await untilReady();
    nothingOfTheDesk();
  });
});
