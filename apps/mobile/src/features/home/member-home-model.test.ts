// Phase 66: the member home's words and choices, per persona (fixtures trimmed from the local seed's
// `GET /api/home`). The rules are shared; these pin the phone's wording and what the device adds.
import { chooseNextUp, nextUpCandidates, nextUpKey, orderHats, quickActionsFor } from '@tmi/shared';

import { ALEX, ANITA, DAY, INES, MARIA, PRIYA, SOFIA, child, homeLesson, tutorLesson } from './member-home-fixtures';
import {
  childStrip,
  deviceExtras,
  lessonNowLine,
  lessonWithTutor,
  nextUpShowsLesson,
  officeStrip,
  questionQuestExtra,
  reviewsLine,
  stripLine,
  tutorStrip,
} from './member-home-model';

const opts = { tutoring: true, quest: true, assessment: true, mayBringPeople: true };

describe('the band strip', () => {
  it('says a tutor\'s day', () => {
    expect(tutorStrip(ALEX.tutor!)).toBe('Today: 1 lesson · 7 to record');
    expect(tutorStrip(PRIYA.tutor!)).toBe('Today: 0 lessons');
  });

  it("names only the office's non-zero parts, else All caught up", () => {
    expect(officeStrip(PRIYA.office!)).toBe('24 to record · 2 invitations');
    expect(officeStrip({ ...PRIYA.office!, to_record_count: 0, invitations: 1, join_requests: 3 })).toBe(
      '1 invitation · 3 asking to join',
    );
    expect(officeStrip(INES.office!)).toBe('All caught up');
  });

  it("gives a parent the first child's next lesson, or none", () => {
    expect(childStrip(child(), DAY)).toBe('Sanjay: next Thu at 5:00 PM');
    expect(childStrip(child({ next_lesson: null }), DAY)).toBe('Sanjay: no lessons scheduled');
  });

  it('gives a learner their next lesson, else the streak, else a calm word', () => {
    expect(stripLine(SOFIA, 'learner', null)).toBe('Next lesson: Tue, Nov 10 at 4:00 PM with Alex');
    expect(stripLine(INES, 'learner', '3 weeks in a row')).toBe('3 weeks in a row');
    expect(stripLine(INES, 'learner', null)).toBe('Ready when you are');
  });

  it('follows the first hat of orderHats', () => {
    expect(stripLine(ANITA, orderHats(ANITA)[0], null)).toBe('Sanjay: next Thu at 5:00 PM');
    // The office has lessons to record, so it comes first today.
    expect(stripLine(PRIYA, orderHats(PRIYA)[0], null)).toBe('24 to record · 2 invitations');
    expect(stripLine(ANITA, undefined, null)).toBeNull();
  });
});

describe('Next up per persona', () => {
  it('Alex: assessments waiting come before his next lesson', () => {
    const item = chooseNextUp(nextUpCandidates(ALEX));
    expect(item?.kind).toBe('reviews_waiting');
    expect(reviewsLine(5, 0)).toBe('5 assessments to review');
    expect(reviewsLine(2, 3)).toBe('2 assessments and 3 answers to review');
  });

  it('Priya: the office\'s unrecorded lessons before her next lesson', () => {
    expect(chooseNextUp(nextUpCandidates(PRIYA))?.kind).toBe('office_to_record');
  });

  it("Anita and Maria: their child's next lesson; a cancellation outranks it", () => {
    expect(chooseNextUp(nextUpCandidates(ANITA))?.kind).toBe('child_next_lesson');
    expect(chooseNextUp(nextUpCandidates(MARIA))?.kind).toBe('child_next_lesson');
    const changed = {
      ...ANITA,
      parent: { children: [child({ cancelled: { occurs_on: '2026-11-04', start_time: '17:00', tutor_name: 'Priya Raghavan' } })] },
    };
    expect(chooseNextUp(nextUpCandidates(changed))?.kind).toBe('child_change');
  });

  it('Sofia: a game she was invited to, then her Daily, then her lesson', () => {
    const { extras, codes } = deviceExtras({
      waiting: [{ game_id: 'g1', code: 'ABC123', host_first_name: 'Maria' }],
      lastLabel: 'G4T10',
      daily: { level_id: 'NC26.4', done: false },
    });
    expect(codes).toEqual({ g1: 'ABC123' });
    expect(chooseNextUp(nextUpCandidates(SOFIA, extras))?.kind).toBe('game_invite');
    const noGame = deviceExtras({ waiting: [], lastLabel: 'G4T10', daily: { level_id: 'NC26.4', done: false } });
    expect(chooseNextUp(nextUpCandidates(SOFIA, noGame.extras))?.kind).toBe('daily');
    const played = deviceExtras({ waiting: [], lastLabel: 'G4T10', daily: { level_id: 'NC26.4', done: true } });
    expect(chooseNextUp(nextUpCandidates(SOFIA, played.extras))).toMatchObject({ kind: 'continue_quest', title: 'G4T10' });
    expect(chooseNextUp(nextUpCandidates(SOFIA))?.kind).toBe('learner_lesson');
  });

  it('Phase 67: a Quest question waiting comes before the Daily; welcome back after it', () => {
    const quest = deviceExtras({
      waiting: [],
      lastLabel: 'G4T10',
      daily: { level_id: 'NC26.4', done: false },
      questionQuest: questionQuestExtra({ level_id: 'BA3', question: {} as never }),
      welcomeBack: true,
    });
    expect(chooseNextUp(nextUpCandidates(SOFIA, quest.extras))).toMatchObject({ kind: 'question_quest', level_id: 'BA3' });
    const back = deviceExtras({
      waiting: [],
      lastLabel: 'G4T10',
      daily: { level_id: 'NC26.4', done: true },
      questionQuest: questionQuestExtra({ level_id: 'BA3', question: null }),
      welcomeBack: true,
    });
    expect(chooseNextUp(nextUpCandidates(SOFIA, back.extras))).toMatchObject({ kind: 'welcome_back' });
    expect(questionQuestExtra(undefined)).toBeNull();
  });

  it('Ines (no Tutoring): nothing waiting is "all caught up"', () => {
    expect(chooseNextUp(nextUpCandidates(INES))).toBeNull();
  });

  it('Later puts one item off and the next one shows', () => {
    const first = chooseNextUp(nextUpCandidates(PRIYA))!;
    const after = chooseNextUp(nextUpCandidates(PRIYA), new Set([nextUpKey(first)]));
    expect(after?.kind).toBe('office_needs');
    const last = chooseNextUp(nextUpCandidates(PRIYA), new Set([nextUpKey(first), nextUpKey(after!)]));
    expect(last?.kind).toBe('lesson_next');
  });

  it('a lesson about to start, and whether Next up already shows the Now card\'s lesson', () => {
    const lesson = tutorLesson();
    const soon = { ...ALEX, tutor: { ...ALEX.tutor!, reviews: { assessments: 0, quest: 0 }, now: { ...ALEX.tutor!.now, next: lesson }, next_starts_in: 10 } };
    const item = chooseNextUp(nextUpCandidates(soon));
    expect(item?.kind).toBe('lesson_now');
    expect(nextUpShowsLesson(item, lesson)).toBe(true);
    expect(nextUpShowsLesson(item, tutorLesson({ occurs_on: '2026-11-04' }))).toBe(false);
    expect(lessonNowLine(lesson, 10)).toBe("Sofia's lesson starts in 10 min.");
    expect(lessonNowLine(lesson, -5)).toBe("Sofia's lesson is under way.");
  });
});

describe('the sections and quick actions', () => {
  it('puts the hats with something today first', () => {
    expect(orderHats(INES)).toEqual(['learner', 'office', 'parent']);
    const today = { ...ANITA, hats: ['tutor', 'parent'] as MemberHomeHats, tutor: { ...PRIYA.tutor! } };
    today.parent = { children: [child({ next_lesson: homeLesson({ occurs_on: DAY }) })] };
    expect(orderHats(today)).toEqual(['parent', 'tutor']);
  });

  it('offers at most three quick actions for the hats worn', () => {
    expect(quickActionsFor(orderHats(ALEX), opts)).toEqual(['record_lesson', 'start_lesson']);
    expect(quickActionsFor(orderHats(INES), { ...opts, tutoring: false })).toEqual([
      'new_quest',
      'join_code',
      'start_assessment',
    ]);
    expect(quickActionsFor(['office'], { ...opts, mayBringPeople: false })).toEqual(['schedule']);
  });

  it('words a lesson with its tutor', () => {
    expect(lessonWithTutor(homeLesson(), DAY)).toBe('Thu at 5:00 PM with Priya');
  });
});

type MemberHomeHats = typeof ALEX.hats;
