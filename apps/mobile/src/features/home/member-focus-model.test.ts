// Phase 68 (docs/member-home-plan.md H4, H10): focus and families -- the pin's choices and words, the
// parent card's played line and Play with label, and the two new Next up items as the phone gathers them. Phase 77
// (JF15): a child who does not sign in plays on this device, at their grade, and "Continue with Ben" reopens it.
import { chooseNextUp, nextUpCandidates, orderHats, type MemberHome } from '@tmi/shared';

import { ANITA, DAY, MARIA, PRIYA, SOFIA, child, homeLesson } from './member-home-fixtures';
import {
  childPlayHint,
  childPlayLabel,
  childPlayLevel,
  childPlayedLine,
  deviceExtras,
  pinChoices,
  pinLabel,
} from './member-home-model';

describe('Make this my home', () => {
  it('offers Automatic and each option, only with two or more', () => {
    expect(pinChoices({ focus_options: ['assessment', 'family'] })).toEqual([null, 'assessment', 'family']);
    expect(pinChoices({ focus_options: ['quest'] })).toEqual([]);
    expect(pinChoices({})).toEqual([]);
  });

  it('says what Automatic picks while nothing is pinned', () => {
    expect(pinLabel(null, { focus: 'family', pin: null })).toBe('Automatic (My children)');
    expect(pinLabel(null, { focus: 'family', pin: 'family' })).toBe('Automatic');
    expect(pinLabel(null, {})).toBe('Automatic (Quest)');
    expect(pinLabel('office', { focus: 'family', pin: null })).toBe('Running the space');
    expect(pinLabel('tutoring', {})).toBe('Teaching');
  });

  it("puts the pinned focus's hat first, whatever today holds", () => {
    expect(orderHats(PRIYA)).toEqual(['office', 'tutor']);
    expect(orderHats({ ...PRIYA, focus: 'tutoring', pin: 'tutoring' })).toEqual(['tutor', 'office']);
    expect(orderHats({ ...MARIA, focus: 'family', pin: 'family' })).toEqual(['parent']);
  });
});

describe("a parent's child card", () => {
  it('says the days played this week and the Daily, counts only; nothing where Quest is off', () => {
    expect(childPlayedLine(child({ days_played_this_week: 2, daily_done_today: true }))).toBe(
      "Played 2 days this week (aim: 3) · today's Daily done",
    );
    expect(childPlayedLine(child({ days_played_this_week: 1, daily_done_today: false }))).toBe(
      'Played 1 day this week (aim: 3)',
    );
    expect(childPlayedLine(child({ days_played_this_week: null }))).toBeNull();
    expect(childPlayedLine(child())).toBeNull();
  });

  // Phase 74 (JF17, owner 2026-11-05): the week before a lesson (PRACTISE_BEFORE_DAYS 7), strictly less than 7 days
  // ahead, so "Tuesday's lesson" is never said on a Tuesday of a lesson a week away.
  it("offers practice together before a lesson in the coming week, else Play with", () => {
    // Thursday 2026-11-05 from Tuesday 2026-11-03.
    expect(childPlayLabel(child(), DAY)).toBe("Practise together before Thursday's lesson");
    // Six days ahead (Monday the 9th): still the coming week.
    expect(childPlayLabel(child({ next_lesson: homeLesson({ occurs_on: '2026-11-09' }) }), DAY)).toBe(
      "Practise together before Monday's lesson",
    );
    // Seven days ahead (next Tuesday, the 10th): not yet.
    expect(childPlayLabel(child({ next_lesson: homeLesson({ occurs_on: '2026-11-10' }) }), DAY)).toBe('Play with Sanjay');
    expect(childPlayLabel(child({ next_lesson: null }), DAY)).toBe('Play with Sanjay');
    // Later today, more than an hour away: still worth a warm-up.
    expect(childPlayLabel(child({ next_lesson: homeLesson({ occurs_on: DAY, starts_in: 120 }) }), DAY)).toBe(
      "Practise together before today's lesson",
    );
    expect(childPlayLabel(child({ next_lesson: homeLesson({ occurs_on: DAY, starts_in: 30 }) }), DAY)).toBe('Play with Sanjay');
  });
});

describe('Play with, on this device (Phase 77)', () => {
  const ben = (over: Parameters<typeof child>[0] = {}) =>
    child({ student_user_id: 'ben', first_name: 'Ben', signs_in: false, next_lesson: null, ...over });

  it('says where it is played, keeps the online words for a child who signs in, and continues a game still running', () => {
    expect(childPlayLabel(ben(), DAY)).toBe('Play with Ben on this device');
    expect(childPlayHint(ben(), DAY)).toBeNull();
    expect(childPlayLabel(child({ signs_in: true, next_lesson: null }), DAY)).toBe('Play with Sanjay');
    // An older Worker sends no signs_in: the online invite's words.
    expect(childPlayLabel(child({ next_lesson: null }), DAY)).toBe('Play with Sanjay');
    // A lesson in the coming week: practice together -- on this device too, which the line under it says.
    expect(childPlayLabel(ben({ next_lesson: homeLesson() }), DAY)).toBe("Practise together before Thursday's lesson");
    expect(childPlayHint(ben({ next_lesson: homeLesson() }), DAY)).toBe('Ben plays beside you, on this device.');
    expect(childPlayHint(child(), DAY)).toBeNull();
    expect(childPlayHint(child({ signs_in: true }), DAY)).toBeNull();
    // The game the reader seated him in, still running: Continue, whatever the lesson.
    expect(childPlayLabel(ben({ open_game_id: 'g-1', next_lesson: homeLesson() }), DAY)).toBe('Continue with Ben');
    expect(childPlayHint(ben({ open_game_id: 'g-1', next_lesson: homeLesson() }), DAY)).toBeNull();
  });

  it("plays at the child's grade through the board's rules, else the level the card played before", () => {
    const tiles = [{ level_id: 'NC26.3' }, { level_id: 'NC26.5' }, { level_id: 'BA5' }, { level_id: 'NC26.6' }] as never[];
    expect(childPlayLevel({ grade: 5, play_level_id: 'NC26.3' }, tiles)).toBe('NC26.5');
    // "Not in school" (0): the top of the row, as the board leads.
    expect(childPlayLevel({ grade: 0 }, tiles)).toBe('NC26.6');
    // A grade the tiles do not reach, or none: the child's last level, else the first tile.
    expect(childPlayLevel({ grade: 8, play_level_id: 'NC26.3' }, tiles)).toBe('NC26.3');
    expect(childPlayLevel({ grade: null, play_level_id: 'BA5' }, tiles)).toBe('BA5');
    expect(childPlayLevel({}, tiles)).toBe('NC26.3');
    expect(childPlayLevel({}, [])).toBeNull();
  });
});

describe('Next up, Phase 68', () => {
  const soon: MemberHome = {
    ...SOFIA,
    learner: { ...SOFIA.learner!, next_lesson: homeLesson({ occurs_on: '2026-11-05', tutor_name: 'Alex Chen' }) },
  };

  it('a learner with a lesson soon practises five first, unless they played today', () => {
    const { extras } = deviceExtras({ waiting: [], daily: null, practiceLevelId: 'NC26.4', playedToday: false });
    expect(extras.practice_level_id).toBe('NC26.4');
    const item = chooseNextUp(nextUpCandidates(soon, extras));
    expect(item).toMatchObject({ kind: 'practise_before', level_id: 'NC26.4' });
    const played = deviceExtras({ waiting: [], daily: null, practiceLevelId: 'NC26.4', playedToday: true });
    expect(chooseNextUp(nextUpCandidates(soon, played.extras))?.kind).toBe('learner_lesson');
    // A lesson a week out is not "before your lesson"; six days out is (Phase 74: the week before).
    expect(chooseNextUp(nextUpCandidates(SOFIA, extras))?.kind).toBe('learner_lesson');
    const sixDays: MemberHome = {
      ...SOFIA,
      learner: { ...SOFIA.learner!, next_lesson: homeLesson({ occurs_on: '2026-11-09', tutor_name: 'Alex Chen' }) },
    };
    expect(chooseNextUp(nextUpCandidates(sixDays, extras))?.kind).toBe('practise_before');
  });

  it("with nothing else, an assessment-led or quest-led home offers its own first step", () => {
    const quiet: MemberHome = { ...SOFIA, learner: { ...SOFIA.learner!, next_lesson: null }, focus_options: ['quest', 'assessment'] };
    expect(chooseNextUp(nextUpCandidates({ ...quiet, focus: 'assessment' }))).toMatchObject({ kind: 'focus_default', focus: 'assessment' });
    expect(chooseNextUp(nextUpCandidates({ ...quiet, focus: 'quest' }))).toMatchObject({ kind: 'focus_default', focus: 'quest' });
    // Only a focus this space offers: with its set off, the focus is a fallback and offers nothing (a 403 page).
    expect(chooseNextUp(nextUpCandidates({ ...quiet, focus: 'quest', focus_options: ['assessment'] }))).toBeNull();
    expect(chooseNextUp(nextUpCandidates({ ...quiet, focus: 'quest', focus_options: [] }))).toBeNull();
    expect(chooseNextUp(nextUpCandidates({ ...ANITA, focus: 'family' }))?.kind).toBe('child_next_lesson');
  });
});
