// Phase 62 (P6-P8), Phase 67: the Play home's pure rules -- the board's grade and its "More levels"; what one tap sends (a multiplayer favorite with the host playing and its roster invited);
// which code is which; and the lobby's invitation. Phase 73 (JF13, JF14): the board's grade from the server's
// lead, the guest grade carried once, "Which grade?" asked only when nothing says, and Continue from the
// server's open game (else "again").
import {
  DEFAULT_TILES,
  createGameSchema,
  openGameLabel,
  playAgain,
  tileGameRequest,
  tileWords,
  type MemberTile,
  type MemberTilesResponse,
  type OpenGameResponse,
} from '@tmi/shared';

import {
  asksGrade,
  codeKind,
  continueAction,
  gradeChoices,
  guestGradeToCarry,
  openGameParts,
  gameInviteUrl,
  gameShareText,
  assessmentTileRequest,
  offBoardGroups,
  rosterSavedText,
  shownGrade,
  startRequest,
  tidyCode,
} from './play-model';

const member = (code: string): MemberTile => {
  const tile = DEFAULT_TILES.find((t) => t.code === code)!;
  return { ...tile, words: tileWords(tile), available: 200, beta: false };
};

describe('offBoardGroups (Phase 67, the board\'s "More levels")', () => {
  it('keeps the levels off the 1-8 row, grouped by their words in the console order', () => {
    const tiles = ['G4Q5', 'M1Q5', 'BA3Q5', 'M1T5', 'G5Q5'].map(member);
    const groups = offBoardGroups(tiles);
    expect(groups.map(([name]) => name)).toEqual(['Math 1']);
    expect(groups[0]![1].map((t) => t.code)).toEqual(['M1Q5', 'M1T5']);
  });

  it('is empty when every tile is on the row', () => {
    expect(offBoardGroups(['G4Q5', 'BA3Q5'].map(member))).toEqual([]);
  });
});

describe('shownGrade (Phase 73: the server\'s lead)', () => {
  const tiles = ['G4Q5', 'G5Q5', 'BA3Q5', 'G6Q5'].map(member);
  it('opens on the server\'s lead grade, whatever the phone remembers', () => {
    expect(shownGrade(tiles, null, { grade: 5, from: 'picked' })).toBe(5);
    expect(shownGrade(tiles, null, { grade: 6, from: 'played' }, 'NC26.4')).toBe(6);
    expect(shownGrade(tiles, null, { grade: 4, from: 'recorded' })).toBe(4);
  });
  it('with no lead (nothing known, or an older Worker): the guest grade on this phone, else the first grade', () => {
    expect(shownGrade(tiles, null, null, 'NC26.5')).toBe(5);
    expect(shownGrade(tiles, null, undefined, 'NC26.5')).toBe(5);
    expect(shownGrade(tiles, null, null)).toBe(3);
    expect(shownGrade(tiles, null, null, 'NC26.8')).toBe(3);
    // A lead off this space's row is not shown.
    expect(shownGrade(tiles, null, { grade: 8, from: 'picked' })).toBe(3);
  });
  it('keeps the grade just tapped while it has tiles', () => {
    expect(shownGrade(tiles, 6, { grade: 5, from: 'picked' })).toBe(6);
    expect(shownGrade(tiles, 8, { grade: 5, from: 'picked' })).toBe(5);
  });
});

describe('the grade asked once (Phase 73, JF14)', () => {
  const tiles = ['G4Q5', 'G5Q5', 'BA3Q5', 'G6Q5'].map(member);
  const asked: MemberTilesResponse = { play_home: true, tiles, lead: null, ask_grade: true, picked_grade: null };
  const byAge: MemberTilesResponse = { ...asked, lead: { grade: 6, from: 'age' }, ask_grade: false };
  // An older Worker: no lead, no question, no pick.
  const older: MemberTilesResponse = { play_home: true, tiles };

  it('carries a guest grade on this phone once the server knows nothing more particular', () => {
    expect(guestGradeToCarry(asked, 'NC26.4')).toBe(4);
    // A 13+ newcomer led only by age: the grade they played as a guest says more (P13).
    expect(guestGradeToCarry(byAge, 'NC26.5')).toBe(5);
    // A harder track takes its grade.
    expect(guestGradeToCarry(asked, 'BA3')).toBe(3);
  });

  it('never over a pick, a recorded or played grade, an older Worker, or a grade off the row', () => {
    expect(guestGradeToCarry({ ...asked, picked_grade: 6, ask_grade: false, lead: { grade: 6, from: 'picked' } }, 'NC26.4')).toBeNull();
    expect(guestGradeToCarry({ ...asked, ask_grade: false, lead: { grade: 5, from: 'recorded' } }, 'NC26.4')).toBeNull();
    expect(guestGradeToCarry({ ...asked, ask_grade: false, lead: { grade: 5, from: 'played' } }, 'NC26.4')).toBeNull();
    expect(guestGradeToCarry(older, 'NC26.4')).toBeNull();
    expect(guestGradeToCarry(asked, 'NC26.8')).toBeNull();
    expect(guestGradeToCarry(asked, 'NC26.M1')).toBeNull();
    expect(guestGradeToCarry(asked, null)).toBeNull();
  });

  it('asks only when the server asks, nothing is carried instead, and it was not put off', () => {
    expect(asksGrade(asked, null, false)).toBe(true);
    expect(asksGrade(asked, 4, false)).toBe(false);
    expect(asksGrade(asked, null, true)).toBe(false);
    expect(asksGrade(byAge, null, false)).toBe(false);
    expect(asksGrade({ ...asked, picked_grade: 0 }, null, false)).toBe(false);
    expect(asksGrade(older, null, false)).toBe(false);
  });

  it('offers the grades the row reaches, then Not in school (0)', () => {
    expect(gradeChoices(tiles)).toEqual([
      { grade: 3, label: 'Grade 3' },
      { grade: 4, label: 'Grade 4' },
      { grade: 5, label: 'Grade 5' },
      { grade: 6, label: 'Grade 6' },
      { grade: 0, label: 'Not in school' },
    ]);
  });
});

describe('continueAction (Phase 73, JF13)', () => {
  const shape = { level_id: 'NC26.7' as const, level_scope: 'level' as const, mode: 'count' as const, question_count: 5, duration_seconds: null };
  const running = openGameLabel({ ...shape, status: 'running', question: 3, of: 5, points: 2 });
  const again = playAgain(shape);

  it('opens the open game, in words with where the reader is', () => {
    const data: OpenGameResponse = {
      open: { game_id: 'g-1', status: 'running', label: running, question: 3, of: 5, points: 2 },
      again: null,
    };
    expect(continueAction(data)).toEqual({
      kind: 'open',
      game_id: 'g-1',
      label: 'Continue Grade 7 Quick 5 · question 3 of 5 · 2 points',
      title: 'Continue Grade 7 Quick 5',
      where: 'Question 3 of 5 · 2 points',
    });
    const lobby = openGameLabel({ ...shape, status: 'lobby', question: null, of: null, points: null });
    expect(
      continueAction({ open: { game_id: 'g-2', status: 'lobby', label: lobby, question: null, of: null, points: null }, again: null }),
    ).toMatchObject({ title: 'Continue Grade 7 Quick 5', where: 'Waiting to start' });
  });

  it('with none open, starts the last one\'s settings again under their own name; else nothing', () => {
    expect(continueAction({ open: null, again })).toEqual({
      kind: 'again',
      label: 'Play Grade 7 Quick 5 again',
      title: 'Play Grade 7 Quick 5 again',
      where: null,
      request: { ...tileGameRequest({ kind: 'quest', level_id: 'NC26.7', mode: 'count', value: 5 }), level_scope: 'level' },
    });
    expect(createGameSchema.safeParse(again.request).success).toBe(true);
    expect(continueAction({ open: null, again: null })).toBeNull();
    expect(continueAction(undefined)).toBeNull();
  });

  it('splits a label into the game\'s words and where the reader is', () => {
    expect(openGameParts('Grade 7 Quick 5 · question 3 of 5 · 2 points')).toEqual({
      words: 'Grade 7 Quick 5',
      where: 'Question 3 of 5 · 2 points',
    });
    expect(openGameParts('Grade 7 10-minute challenge · 1 point')).toEqual({
      words: 'Grade 7 10-minute challenge',
      where: '1 point',
    });
    expect(openGameParts('Grade 7 Quick 5')).toEqual({ words: 'Grade 7 Quick 5', where: null });
  });
});

describe('assessmentTileRequest', () => {
  it('asks for the reader\'s own assessment of the tile\'s level and size', () => {
    expect(assessmentTileRequest({ level_id: 'NC26.4', value: 5 }, 'me-id')).toEqual({
      student_user_id: 'me-id',
      level_id: 'NC26.4',
      question_count: 5,
    });
  });
});

describe('startRequest', () => {
  const single = tileGameRequest(member('G4T10'));
  const multi = createGameSchema.parse({
    level_id: 'NC26.4',
    mode: 'count',
    question_count: 10,
    max_team_size: 1,
    late_join: true,
  });

  it('sends a tile (a single player) as it is: no host flag, nobody invited', () => {
    expect(single).toEqual({
      level_id: 'NC26.4',
      level_scope: 'level',
      mode: 'timed',
      duration_minutes: 10,
      players: 'single',
      max_team_size: 1,
    });
    expect(startRequest(single, ['u-2'])).toBe(single);
  });

  it('has the host playing in a multiplayer favorite, and invites its roster when it has one', () => {
    expect(startRequest(multi)).toEqual({ ...multi, host_plays: true });
    expect(startRequest(multi, [])).toEqual({ ...multi, host_plays: true });
    expect(startRequest(multi, ['u-2', 'u-3'])).toEqual({
      ...multi,
      host_plays: true,
      invite_user_ids: ['u-2', 'u-3'],
    });
    // And the shared schema accepts what is sent.
    expect(createGameSchema.safeParse(startRequest(multi, ['u-2'])).success).toBe(true);
  });
});

describe('codes', () => {
  it('tells a game (six) from a space (eight), ignoring spaces, dashes and case', () => {
    expect(codeKind('abc234')).toBe('game');
    expect(codeKind(' ABC-234 ')).toBe('game');
    expect(codeKind('fmxy-2345')).toBe('space');
    expect(tidyCode('fmxy-2345')).toBe('FMXY2345');
    expect(codeKind('ABC23')).toBeNull();
    expect(codeKind('ABC2345')).toBeNull();
    expect(codeKind('')).toBeNull();
  });
});

describe('the lobby invitation', () => {
  it('leads to the server’s Play home with the code, or is the code alone with no web origin', () => {
    expect(gameInviteUrl('https://tutoring.example.dev/', 'ABC234')).toBe(
      'https://tutoring.example.dev/?code=ABC234',
    );
    expect(gameInviteUrl('http://localhost:8787', 'ABC234')).toBe('http://localhost:8787/?code=ABC234');
    expect(gameInviteUrl('', 'ABC234')).toBe('ABC234');
    expect(gameInviteUrl(null, 'ABC234')).toBe('ABC234');
  });

  it('shares the web’s words, naming nobody', () => {
    expect(gameShareText('ABC234')).toBe('Join my Aimtrue game: code ABC234');
    expect(rosterSavedText('Family G4', 1)).toBe('Family G4 invites 1 person.');
    expect(rosterSavedText('Family G4', 3)).toBe('Family G4 invites 3 people.');
    expect(rosterSavedText('Family G4', 0)).toBe('Family G4 is open to anyone with the code.');
  });
});
