// Phase 68 (docs/member-home-plan.md H4, H10): focus and families -- the pin's choices and words, the
// parent card's played line and Play with label, and the two new Next up items as the phone gathers them.
import { chooseNextUp, nextUpCandidates, orderHats, type MemberHome } from '@tmi/shared';

import { ANITA, DAY, MARIA, PRIYA, SOFIA, child, homeLesson } from './member-home-fixtures';
import { childPlayLabel, childPlayedLine, deviceExtras, pinChoices, pinLabel } from './member-home-model';

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

  it("offers practice together before a lesson within three days, else Play with", () => {
    // Thursday 2026-11-05 from Tuesday 2026-11-03.
    expect(childPlayLabel(child(), DAY)).toBe("Practise together before Thursday's lesson");
    expect(childPlayLabel(child({ next_lesson: homeLesson({ occurs_on: '2026-11-10' }) }), DAY)).toBe('Play with Sanjay');
    expect(childPlayLabel(child({ next_lesson: null }), DAY)).toBe('Play with Sanjay');
    // Later today, more than an hour away: still worth a warm-up.
    expect(childPlayLabel(child({ next_lesson: homeLesson({ occurs_on: DAY, starts_in: 120 }) }), DAY)).toBe(
      "Practise together before today's lesson",
    );
    expect(childPlayLabel(child({ next_lesson: homeLesson({ occurs_on: DAY, starts_in: 30 }) }), DAY)).toBe('Play with Sanjay');
  });
});

describe('Next up, Phase 68', () => {
  const soon: MemberHome = {
    ...SOFIA,
    learner: { ...SOFIA.learner!, next_lesson: homeLesson({ occurs_on: '2026-11-05', tutor_name: 'Alex Chen' }) },
  };

  it('a learner with a lesson soon practises five first, unless they played today', () => {
    const { extras } = deviceExtras({ waiting: [], lastLabel: null, daily: null, practiceLevelId: 'NC26.4', playedToday: false });
    expect(extras.practice_level_id).toBe('NC26.4');
    const item = chooseNextUp(nextUpCandidates(soon, extras));
    expect(item).toMatchObject({ kind: 'practise_before', level_id: 'NC26.4' });
    const played = deviceExtras({ waiting: [], lastLabel: null, daily: null, practiceLevelId: 'NC26.4', playedToday: true });
    expect(chooseNextUp(nextUpCandidates(soon, played.extras))?.kind).toBe('learner_lesson');
    // A lesson a week out is not "before your lesson".
    expect(chooseNextUp(nextUpCandidates(SOFIA, extras))?.kind).toBe('learner_lesson');
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
