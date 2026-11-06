// Phase 66: the member home's words and choices, per persona (fixtures trimmed from the local seed's
// `GET /api/home`). The rules are shared; these pin the phone's wording and what the device adds.
import {
  chooseNextUp,
  nextUpCandidates,
  nextUpKey,
  openGameLabel,
  orderHats,
  playAgain,
  quickActionsFor,
  type OpenGameResponse,
} from '@tmi/shared';

import { ALEX, ANITA, DAY, INES, MARIA, PRIYA, SOFIA, child, homeLesson, tutorLesson } from './member-home-fixtures';
import {
  bandDoors,
  CHILD_OFF_LINE,
  childCardFallback,
  childStrip,
  deviceExtras,
  LEARNER_EMPTY_LINE,
  learnerSectionParts,
  lessonNowLine,
  lessonWithTutor,
  nextUpShowsLearnerLesson,
  nextUpShowsLesson,
  officeNeeds,
  officeStrip,
  OFFICE_NOTHING_LINE,
  openAssessmentsLine,
  placeWords,
  questionQuestExtra,
  reviewsLine,
  shownQuickActions,
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

  // Phase 73 (JF13): Continue comes from the server's open-game read, never from the phone.
  const SHAPE = { level_id: 'NC26.4' as const, level_scope: 'level' as const, mode: 'timed' as const, question_count: null, duration_seconds: 600 };
  const AGAIN: OpenGameResponse = { open: null, again: playAgain(SHAPE) };
  const OPEN: OpenGameResponse = {
    open: {
      game_id: 'g-open',
      status: 'running',
      label: openGameLabel({ ...SHAPE, status: 'running', question: null, of: null, points: 3 }),
      question: null,
      of: null,
      points: 3,
    },
    again: null,
  };

  it('Sofia: a game she was invited to, then her Daily, then "again", then her lesson', () => {
    const { extras, codes } = deviceExtras({
      waiting: [{ game_id: 'g1', code: 'ABC123', host_first_name: 'Maria' }],
      open: AGAIN,
      daily: { level_id: 'NC26.4', done: false },
    });
    expect(codes).toEqual({ g1: 'ABC123' });
    expect(chooseNextUp(nextUpCandidates(SOFIA, extras))?.kind).toBe('game_invite');
    const noGame = deviceExtras({ waiting: [], open: AGAIN, daily: { level_id: 'NC26.4', done: false } });
    expect(chooseNextUp(nextUpCandidates(SOFIA, noGame.extras))?.kind).toBe('daily');
    const played = deviceExtras({ waiting: [], open: AGAIN, daily: { level_id: 'NC26.4', done: true } });
    expect(chooseNextUp(nextUpCandidates(SOFIA, played.extras))).toMatchObject({
      kind: 'continue_quest',
      title: 'Play Grade 4 10-minute challenge again',
    });
    expect(chooseNextUp(nextUpCandidates(SOFIA))?.kind).toBe('learner_lesson');
  });

  it('Phase 75 (JF30): the reader’s running lesson leads Next up, before anything the home holds', () => {
    const { extras } = deviceExtras({
      waiting: [{ game_id: 'g1', code: 'ABC123', host_first_name: 'Maria' }],
      daily: null,
      running: { student_name: 'Sofia Okafor', started_at: '2026-11-03T18:48:00Z', mode: 'virtual' },
    });
    expect(extras.running).toEqual({ student_name: 'Sofia Okafor', started_at: '2026-11-03T18:48:00Z', mode: 'virtual' });
    expect(chooseNextUp(nextUpCandidates(ALEX, extras))).toMatchObject({ kind: 'lesson_running', hat: 'tutor' });
    // None running (or Tutoring off, where it is never read): nothing changes.
    expect(deviceExtras({ waiting: [], daily: null }).extras.running).toBeNull();
    expect(chooseNextUp(nextUpCandidates(ALEX, deviceExtras({ waiting: [], daily: null }).extras))?.kind).not.toBe(
      'lesson_running',
    );
  });

  it('Phase 73: an open game is Next up right after an invitation -- before the Daily -- and "again" is not offered with it', () => {
    const { extras } = deviceExtras({ waiting: [], open: OPEN, daily: { level_id: 'NC26.4', done: false } });
    expect(extras.open_game).toEqual({ game_id: 'g-open', title: 'Grade 4 10-minute challenge · 3 points' });
    expect(extras.continue_quest).toBeNull();
    const item = chooseNextUp(nextUpCandidates(SOFIA, extras));
    expect(item).toMatchObject({ kind: 'open_game', game: { game_id: 'g-open' } });
    expect(nextUpKey(item!)).toBe('open_game:g-open');
    const invited = deviceExtras({ waiting: [{ game_id: 'g1', code: 'ABC123', host_first_name: 'Maria' }], open: OPEN, daily: null });
    expect(chooseNextUp(nextUpCandidates(SOFIA, invited.extras))?.kind).toBe('game_invite');
    // Nothing read (Quest off, or not yet loaded): neither.
    const none = deviceExtras({ waiting: [], daily: null });
    expect(none.extras.open_game).toBeNull();
    expect(none.extras.continue_quest).toBeNull();
  });

  it('Phase 67: a Quest question waiting comes before the Daily; welcome back after it', () => {
    const quest = deviceExtras({
      waiting: [],
      open: AGAIN,
      daily: { level_id: 'NC26.4', done: false },
      questionQuest: questionQuestExtra({ level_id: 'BA3', question: {} as never }),
      welcomeBack: true,
    });
    expect(chooseNextUp(nextUpCandidates(SOFIA, quest.extras))).toMatchObject({ kind: 'question_quest', level_id: 'BA3' });
    const back = deviceExtras({
      waiting: [],
      open: AGAIN,
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
    // Phase 74 (JF6): the server's order where Tutoring is off -- her child, the office, then playing -- kept.
    expect(orderHats(INES)).toEqual(['parent', 'office', 'learner']);
    // Something today (an assessment waiting for review) brings the office forward, by the shared rule.
    expect(orderHats({ ...INES, office: { ...INES.office!, assessments_open: 2 } })).toEqual(['office', 'parent', 'learner']);
    const today = { ...ANITA, hats: ['tutor', 'parent'] as MemberHomeHats, tutor: { ...PRIYA.tutor! } };
    today.parent = { children: [child({ next_lesson: homeLesson({ occurs_on: DAY }) })] };
    expect(orderHats(today)).toEqual(['parent', 'tutor']);
  });

  it('offers at most three quick actions for the hats worn', () => {
    expect(quickActionsFor(orderHats(ALEX), opts)).toEqual(['record_lesson', 'start_lesson']);
    expect(quickActionsFor(orderHats(INES), { ...opts, tutoring: false })).toEqual([
      'add_person',
      'new_quest',
      'join_code',
    ]);
    expect(quickActionsFor(['office'], { ...opts, mayBringPeople: false })).toEqual(['schedule']);
  });

  it('words a lesson with its tutor', () => {
    expect(lessonWithTutor(homeLesson(), DAY)).toBe('Thu at 5:00 PM with Priya');
  });
});

type MemberHomeHats = typeof ALEX.hats;

describe('Phase 74: the first home', () => {
  it('a lesson line says where it is, by name (JF17)', () => {
    const lesson = homeLesson({ place: { name: 'Institute, room 2', kind: 'physical' } });
    expect(lessonWithTutor(lesson, DAY)).toBe('Thu at 5:00 PM with Priya · Institute, room 2');
    expect(placeWords(homeLesson({ place: null }))).toBe('');
    expect(placeWords(homeLesson())).toBe('');
    expect(childStrip(child({ next_lesson: lesson }), DAY)).toBe('Sanjay: next Thu at 5:00 PM · Institute, room 2');
    expect(stripLine({ ...SOFIA, learner: { ...SOFIA.learner!, next_lesson: { ...SOFIA.learner!.next_lesson!, place: { name: 'Online room', kind: 'virtual' } } } }, 'learner', null)).toBe(
      'Next lesson: Tue, Nov 10 at 4:00 PM with Alex · Online room',
    );
  });

  it('the band never repeats what Next up says (JF23)', () => {
    const toRecord = chooseNextUp(nextUpCandidates(PRIYA))!;
    expect(toRecord.kind).toBe('office_to_record');
    expect(stripLine(PRIYA, 'office', null, { next: toRecord })).toBe('2 invitations');
    expect(officeStrip(PRIYA.office!, 'needs')).toBe('24 to record');
    expect(officeStrip({ ...PRIYA.office!, invitations: 0 }, 'to_record')).toBeNull();
    // A parent: Next up names the child's lesson, so the band leaves it out.
    const lesson = chooseNextUp(nextUpCandidates(ANITA))!;
    expect(stripLine(ANITA, 'parent', null, { next: lesson })).toBeNull();
    const played = { ...ANITA, parent: { children: [child({ days_played_this_week: 2 })] } };
    expect(stripLine(played, 'parent', null, { next: chooseNextUp(nextUpCandidates(played)) })).toBe('Sanjay: played 2 days this week');
    // A learner: the streak in words, not the lesson Next up already shows.
    expect(stripLine(SOFIA, 'learner', 'Start a streak', { next: chooseNextUp(nextUpCandidates(SOFIA)) })).toBe('Start a streak');
  });

  it('office and parent lines say nothing about lessons where Tutoring is off (JF16)', () => {
    expect(stripLine(INES, 'parent', null, { tutoring: false })).toBe('Noor: all caught up');
    const noor = { ...INES, parent: { children: [child({ first_name: 'Noor', next_lesson: null, days_played_this_week: 0 })] } };
    expect(stripLine(noor, 'parent', null, { tutoring: false })).toBe('Noor: not played yet this week');
    noor.parent.children[0]!.days_played_this_week = 1;
    expect(stripLine(noor, 'parent', null, { tutoring: false })).toBe('Noor: played 1 day this week');
    expect(stripLine({ ...INES, parent: { children: [] } }, 'parent', null, { tutoring: false })).toBeNull();
    expect(stripLine(INES, 'office', null, { tutoring: false })).toBe('All caught up');
    expect(officeStrip({ ...INES.office!, assessments_open: 2 })).toBe('2 assessments to review');
    for (const line of [stripLine(INES, 'parent', null, { tutoring: false }), stripLine(noor, 'parent', null, { tutoring: false })]) {
      expect(line).not.toMatch(/lesson/i);
    }
  });

  it('three doors, never a zero, for a learner who has not played here (JF6, JF16)', () => {
    expect(bandDoors({ hat: 'learner', quest: true, playedBefore: false, mayMakeSpace: true })).toEqual(['play', 'code', 'start']);
    expect(bandDoors({ hat: 'learner', quest: true, playedBefore: false, mayMakeSpace: false })).toEqual(['play', 'code']);
    // Played before, an older Worker (no word), Quest off, or another hat leading: no doors.
    expect(bandDoors({ hat: 'learner', quest: true, playedBefore: true, mayMakeSpace: true })).toEqual([]);
    expect(bandDoors({ hat: 'learner', quest: true, playedBefore: undefined, mayMakeSpace: true })).toEqual([]);
    expect(bandDoors({ hat: 'learner', quest: false, playedBefore: false, mayMakeSpace: true })).toEqual([]);
    expect(bandDoors({ hat: 'parent', quest: true, playedBefore: false, mayMakeSpace: true })).toEqual([]);
  });

  it('no New Quest beside the board, no Have a code? beside the doors (JF23)', () => {
    const actions = ['new_quest', 'join_code', 'start_assessment'] as const;
    expect(shownQuickActions(actions, { board: true, doors: [] })).toEqual(['join_code', 'start_assessment']);
    expect(shownQuickActions(actions, { board: true, doors: ['play', 'code'] })).toEqual(['start_assessment']);
    expect(shownQuickActions(actions, { board: false, doors: [] })).toEqual(actions);
  });

  it('the office lists what is above zero, else one line (JF6)', () => {
    expect(officeNeeds(INES.office!, false)).toMatchObject({ nothing: true, invitations: false, requests: false });
    expect(OFFICE_NOTHING_LINE).toBe('Nothing needs you right now.');
    expect(officeNeeds({ ...INES.office!, assessments_open: 3 }, false)).toMatchObject({ nothing: false, assessments: true });
    expect(openAssessmentsLine(3)).toBe('3 assessments not yet reviewed');
    expect(openAssessmentsLine(1)).toBe('1 assessment not yet reviewed');
    // Lessons to record are Tutoring's.
    expect(officeNeeds(PRIYA.office!, true)).toMatchObject({ toRecord: true, invitations: true, requests: false, nothing: false });
    expect(officeNeeds({ ...PRIYA.office!, invitations: 0 }, false)).toMatchObject({ toRecord: false, nothing: true });
  });
});

describe('Your learning and the child card, with sets off', () => {
  it("leaves the learner's next lesson out while Next up shows it", () => {
    const item = chooseNextUp(nextUpCandidates(SOFIA));
    expect(item?.kind).toBe('learner_lesson');
    expect(nextUpShowsLearnerLesson(item)).toBe(true);
    const parts = learnerSectionParts(SOFIA.learner!.next_lesson, item, { quest: true, assessment: false });
    expect(parts).toEqual({ next: null, empty: false });
    // A game invite leads instead: the section shows the lesson itself.
    const invite = chooseNextUp(nextUpCandidates(SOFIA, { game_invite: { game_id: 'g1', title: 'G4', host_first_name: 'Maria' } }));
    expect(nextUpShowsLearnerLesson(invite)).toBe(false);
    expect(learnerSectionParts(SOFIA.learner!.next_lesson, invite, { quest: true, assessment: false }).next).toEqual(
      SOFIA.learner!.next_lesson,
    );
  });

  it('is empty only with no lesson shown and Quest and Assessment off, and says so', () => {
    const lesson = SOFIA.learner!.next_lesson;
    expect(learnerSectionParts(null, null, { quest: false, assessment: false }).empty).toBe(true);
    expect(learnerSectionParts(lesson, { kind: 'learner_lesson', hat: 'learner', lesson: lesson! }, { quest: false, assessment: false }).empty).toBe(true);
    expect(learnerSectionParts(lesson, null, { quest: false, assessment: false }).empty).toBe(false);
    expect(learnerSectionParts(null, null, { quest: true, assessment: false }).empty).toBe(false);
    expect(learnerSectionParts(null, null, { quest: false, assessment: true }).empty).toBe(false);
    expect(LEARNER_EMPTY_LINE).toBe('Nothing to practise here yet: Quest and Assessments are off in this space.');
  });

  it('with every set off, Next up offers no quest (the focus is only a fallback)', () => {
    const none = { ...SOFIA, learner: { ...SOFIA.learner!, next_lesson: null }, focus: 'quest' as const, focus_options: [] };
    expect(chooseNextUp(nextUpCandidates(none))).toBeNull();
  });

  it("gives a child's card Assessments, else a word, only with Tutoring and Quest off", () => {
    expect(childCardFallback({ tutoring: true, quest: false, assessment: true })).toBeNull();
    expect(childCardFallback({ tutoring: false, quest: true, assessment: false })).toBeNull();
    expect(childCardFallback({ tutoring: false, quest: false, assessment: true })).toBe('assessments');
    expect(childCardFallback({ tutoring: false, quest: false, assessment: false })).toBe('off');
    expect(CHILD_OFF_LINE).toBe('Lessons and quests are off in this space.');
  });
});
