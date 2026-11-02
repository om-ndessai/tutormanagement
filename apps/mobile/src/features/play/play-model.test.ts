// Phase 62 (P6-P8): the Play home's pure rules -- the tiles in their curricula, the level last played
// first; what one tap sends (a multiplayer favorite with the host playing and its roster invited);
// which code is which; and the lobby's invitation.
import { DEFAULT_TILES, createGameSchema, tileGameRequest, tileWords, type MemberTile } from '@tmi/shared';

import {
  codeKind,
  gameInviteUrl,
  gameShareText,
  groupOf,
  groupTiles,
  rosterSavedText,
  startRequest,
  tidyCode,
} from './play-model';

const member = (code: string): MemberTile => {
  const tile = DEFAULT_TILES.find((t) => t.code === code)!;
  return { ...tile, words: tileWords(tile), available: 200, beta: false };
};

describe('groupTiles', () => {
  it('groups by curriculum in the order first seen, keeping the console order inside a group', () => {
    const tiles = ['G4Q5', 'BA3Q5', 'G5Q5', 'MK34Q10', 'PAQ10'].map(member);
    const groups = groupTiles(tiles);
    expect(groups.map(([name]) => name)).toEqual([
      'NC standards',
      'Beast Academy',
      'Math Kangaroo',
      'Art of Problem Solving',
    ]);
    expect(groups[0]![1].map((t) => t.code)).toEqual(['G4Q5', 'G5Q5']);
  });

  it('puts the level last played first, so its curriculum leads', () => {
    const tiles = ['G4Q5', 'G5Q5', 'BA3Q5', 'BA3T10'].map(member);
    const groups = groupTiles(tiles, 'BA3');
    expect(groups[0]![0]).toBe('Beast Academy');
    expect(groups[0]![1].map((t) => t.code)).toEqual(['BA3Q5', 'BA3T10']);
    expect(groupTiles(tiles, 'NC26.5')[0]![1].map((t) => t.code)).toEqual(['G5Q5', 'G4Q5']);
  });

  it('names NC 2017 apart from NC 2026', () => {
    expect(groupOf('NC17.4')).toBe('NC standards (2017)');
    expect(groupOf('NC26.M1')).toBe('NC standards');
    expect(groupOf('GEO')).toBe('Art of Problem Solving');
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
