import { sessionInputSchema, type Assignment, type TutoringSession } from '@tmi/shared';
import { screen } from '@testing-library/react-native';

import { session } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { SessionMoneyPreview, previewFigures } from './session-money-preview';
import {
  addMinutes,
  emptyForm,
  formBody,
  formFromSession,
  issuesToErrors,
  toUpdatePayload,
} from './use-session-form';

jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));

const TUTOR = '00000000-0000-4000-8000-000000000003';
const STUDENT = '00000000-0000-4000-8000-000000000009';
const pair = { tutor_user_id: TUTOR, student_user_id: STUDENT };

const assignment = {
  id: 'a1',
  ...pair,
  tutor_name: 'Alex Chen',
  student_name: 'Ben Whitfield',
  rate_in_person_cents: null,
  rate_virtual_cents: null,
  effective_rate_in_person_cents: 6000,
  effective_rate_virtual_cents: 5000,
} as Assignment;

const existing = session({
  ...pair,
  notes: 'Long division',
  write_up: {
    planned: 'Division',
    previous_review: null,
    homework_review: null,
    homework_status: 'done',
    homework_assigned: 'Page 4',
  },
  progress: { goal_rating: 3, topic_ratings: [{ topic_id: 'BA3.08', rating: 4 }] },
  assessments: [
    {
      author_user_id: TUTOR,
      author_name: 'Alex Chen',
      author_role: 'tutor',
      rating: 4,
      body: 'Good',
    },
  ],
  reflection: null,
} as Partial<TutoringSession>);

describe('session form state', () => {
  it('starts a new lesson today, with the only pairing chosen', () => {
    const form = emptyForm('2026-10-08', [{ id: 'a1' }]);
    expect(form).toMatchObject({ assignmentId: 'a1', occurredOn: '2026-10-08', startedAt: '16:00' });
    expect(emptyForm('2026-10-08', [{ id: 'a1' }, { id: 'a2' }]).assignmentId).toBe('');
  });

  it('round-trips a lesson on the record, with the editor’s own assessment', () => {
    const form = formFromSession(existing, [assignment], TUTOR);
    expect(form).toMatchObject({
      assignmentId: 'a1',
      notes: 'Long division',
      planned: 'Division',
      homeworkStatus: 'done',
      goalRating: 3,
      topicRatings: { 'BA3.08': 4 },
      myRating: 4,
      myAssessment: 'Good',
    });
    // Another reader editing it holds their own assessment, which is none.
    expect(formFromSession(existing, [assignment], 'admin-1').myRating).toBeNull();
  });

  it('records progress only when scored, an assessment only when given', () => {
    const body = formBody(emptyForm('2026-10-08', [assignment]), pair);
    expect(body).not.toHaveProperty('progress');
    expect(body).not.toHaveProperty('assessment');
    expect(body.write_up).toEqual({
      planned: null,
      previous_review: null,
      homework_review: null,
      homework_status: null,
      homework_assigned: null,
    });
    expect(sessionInputSchema.safeParse(body).success).toBe(true);

    const scored = formBody({ ...emptyForm('2026-10-08', []), goalRating: 2, myAssessment: ' ok ' }, pair);
    expect(scored.progress).toEqual({ goal_rating: 2, topic_ratings: [] });
    expect(scored.assessment).toEqual({ rating: null, body: 'ok' });
  });

  it('withdraws the editor’s own assessment when its fields are emptied', () => {
    const form = { ...formFromSession(existing, [assignment], TUTOR), myRating: null, myAssessment: '' };
    expect(toUpdatePayload(form, existing, TUTOR).assessment).toBeNull();
    // Someone with no assessment of their own sends none.
    expect(toUpdatePayload(form, existing, 'admin-1')).not.toHaveProperty('assessment');
    // Clearing every score still sends progress, so the old one is replaced.
    const cleared = { ...form, goalRating: null, topicRatings: {} };
    expect(toUpdatePayload(cleared, existing, TUTOR).progress).toEqual({
      goal_rating: null,
      topic_ratings: [],
    });
  });

  it('adds a quick length within the day', () => {
    expect(addMinutes('16:00', 90)).toBe('17:30');
    expect(addMinutes('23:30', 60)).toBe('23:59');
  });

  it('keys errors as the server does, and refuses an SSN in a note before it is sent', () => {
    const body = formBody({ ...emptyForm('2026-10-08', []), planned: 'SSN 123-45-6789' }, pair);
    const parsed = sessionInputSchema.safeParse(body);
    expect(parsed.success).toBe(false);
    const errors = issuesToErrors(parsed.error!.issues);
    expect(Object.keys(errors)).toContain('write_up.planned');
    const bad = sessionInputSchema.safeParse({
      ...body,
      planned: undefined,
      ended_at: '15:00',
      write_up: {},
    });
    expect(issuesToErrors(bad.error!.issues).ended_at).toBe('The end time must be after the start time.');
  });
});

describe('the length and money preview', () => {
  const figures = previewFigures('16:00', '17:20', 'in_person', assignment, null)!;

  it('bills quarter hours at the pairing’s rate', () => {
    expect(figures).toMatchObject({ elapsed: 80, billed: 75, rate: 6000, amount: 7500, charge: null });
  });

  it('shows no money unless opened from Finance', async () => {
    await renderWithProviders(<SessionMoneyPreview preview={figures} hasAssignment isAdmin={false} />);
    expect(screen.getByText('1 hr 15 min')).toBeTruthy();
    expect(screen.queryByTestId('record-money')).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('labels the reader’s side when it is', async () => {
    await renderWithProviders(
      <SessionMoneyPreview preview={figures} hasAssignment isAdmin={false} showMoney />,
    );
    expect(screen.getByText('Your pay')).toBeTruthy();
    expect(screen.getByText('$75.00')).toBeTruthy();
  });

  it('gives the office the family’s charge and the cut', async () => {
    const admin = previewFigures('16:00', '17:00', 'in_person', assignment, {
      charge_rate_in_person_cents: 9000,
      charge_rate_virtual_cents: null,
    })!;
    await renderWithProviders(<SessionMoneyPreview preview={admin} hasAssignment isAdmin showMoney />);
    expect(screen.getByText('Tutor pay')).toBeTruthy();
    expect(screen.getByText('$90.00')).toBeTruthy();
    expect(screen.getByText('$30.00')).toBeTruthy();
  });
});
