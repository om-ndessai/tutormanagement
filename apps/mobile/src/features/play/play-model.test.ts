// Phase 62 (P6-P8), Phase 67: the Play home's pure rules -- the board's grade and its "More levels"; what one tap sends (a multiplayer favorite with the host playing and its roster invited);
// which code is which; and the lobby's invitation.
import { DEFAULT_TILES, createGameSchema, tileGameRequest, tileWords, type MemberTile } from '@tmi/shared';

import {
  codeKind,
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

describe('shownGrade', () => {
  const tiles = ['G4Q5', 'G5Q5', 'BA3Q5', 'G6Q5'].map(member);
  it('opens on the lead level\'s grade, else the first grade with tiles', () => {
    expect(shownGrade(tiles, null, 'NC26.5')).toBe(5);
    expect(shownGrade(tiles, null, null)).toBe(3);
    expect(shownGrade(tiles, null, 'NC26.8')).toBe(3);
  });
  it('keeps the grade chosen here while it has tiles', () => {
    expect(shownGrade(tiles, 6, 'NC26.5')).toBe(6);
    expect(shownGrade(tiles, 8, 'NC26.5')).toBe(5);
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
