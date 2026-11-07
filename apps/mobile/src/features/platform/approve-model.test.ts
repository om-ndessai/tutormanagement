import { PLACEMENT_QUEST_OFF, accessDecisionSchema, type PlacementSpace } from '@tmi/shared';

import {
  approveDescription,
  approveRequest,
  approveTitle,
  chosenPlacementRole,
  firstNameOf,
  matchingSpaces,
  placedLine,
  placementLine,
  placementListNote,
  placementNotes,
  placementRoles,
} from './approve-model';

const CONSOLE: PlacementSpace = {
  id: '0a000000-0000-4000-8000-000000000001',
  name: 'Chapel Hill Math Institute',
  short_name: 'CHMI',
  created_via: 'console',
  quest_on: true,
  tutoring_on: true,
  assessment_on: true,
};
const SELF: PlacementSpace = {
  id: '0d000000-0000-4000-8000-000000000001',
  name: 'Ferreira Family Practice',
  short_name: 'Ferreira',
  created_via: 'self_serve',
  quest_on: false,
  tutoring_on: false,
  assessment_on: true,
};

describe('the approve sheet (Phase 80, A11, A15)', () => {
  it('offers Admin only in a console-made space, and never for a 13-17', () => {
    expect(placementRoles(null, 'adult')).toEqual(['member']);
    expect(placementRoles(CONSOLE, 'adult')).toEqual(['member', 'admin']);
    expect(placementRoles(CONSOLE, '13-17')).toEqual(['member']);
    expect(placementRoles(SELF, 'adult')).toEqual(['member']);
  });

  it('sends Member when the role chosen is no longer offered', () => {
    expect(chosenPlacementRole(['member', 'admin'], 'admin')).toBe('admin');
    expect(chosenPlacementRole(['member'], 'admin')).toBe('member');
  });

  it('says what will happen, by how the space was made, with the warning where Quest is off', () => {
    expect(placementNotes(CONSOLE, 'Pia Pending')).toEqual({
      words: 'Pia joins Chapel Hill Math Institute at once, and lands there when they sign in.',
      warning: null,
    });
    expect(placementNotes(SELF, 'Pia Pending')).toEqual({
      words: "Ferreira Family Practice's admins are asked to let Pia in. Until they answer, Pia can make a space of their own.",
      warning: PLACEMENT_QUEST_OFF,
    });
  });

  it('titles the sheet and words the account', () => {
    expect(approveTitle({ full_name: 'Pia Pending' })).toBe('Approve Pia Pending');
    expect(approveDescription({ email: 'pia@example.com', age_band: 'adult' })).toBe('pia@example.com · Adult');
    expect(approveDescription({ email: 'tam@example.com', age_band: '13-17' })).toBe('tam@example.com · Age 13-17');
    expect(approveDescription({ email: null, age_band: 'adult' })).toBe('Adult');
    expect(firstNameOf('  Pia   Pending ')).toBe('Pia');
  });

  it('lines each space by how it takes them, and matches name or short name in any case', () => {
    expect(placementLine(CONSOLE)).toBe('Joins at once');
    expect(placementLine(SELF)).toBe('Its admins let them in · Quest off');
    expect(matchingSpaces([CONSOLE, SELF], '').map((s) => s.short_name)).toEqual(['CHMI', 'Ferreira']);
    expect(matchingSpaces([CONSOLE, SELF], ' chmi ').map((s) => s.short_name)).toEqual(['CHMI']);
    expect(matchingSpaces([CONSOLE, SELF], 'family').map((s) => s.short_name)).toEqual(['Ferreira']);
    expect(matchingSpaces([CONSOLE, SELF], 'zzz')).toEqual([]);
  });

  it('notes the list: loading, a failed read, nothing matching, more than shown', () => {
    const base = { pending: false, failed: false, query: '', matching: 2, shown: 2 };
    expect(placementListNote(base)).toBeNull();
    expect(placementListNote({ ...base, pending: true })).toBe('Loading spaces…');
    expect(placementListNote({ ...base, failed: true })).toBe(
      'The spaces could not be loaded. Approving now gives them a space of their own.',
    );
    expect(placementListNote({ ...base, query: 'zzz', matching: 0, shown: 0 })).toBe('No space has that name.');
    expect(placementListNote({ ...base, matching: 80, shown: 50 })).toBe('Showing 50 of 80. Type to narrow.');
  });

  it('sends the shared decision: approved, with the place only when one is chosen', () => {
    const nowhere = approveRequest({ user_id: 'u1' }, null, 'member');
    expect(nowhere).toEqual({ userId: 'u1', access: 'approved' });
    const placed = approveRequest({ user_id: 'u1' }, CONSOLE, 'admin');
    expect(placed).toEqual({ userId: 'u1', access: 'approved', space: { organization_id: CONSOLE.id, role: 'admin' } });
    const { userId: _userId, ...body } = placed;
    expect(accessDecisionSchema.parse(body)).toEqual(body);
  });

  it('says where a decided approval placed them', () => {
    expect(placedLine({ name: 'Chapel Hill Math Institute', how: 'joined' })).toBe('Joined Chapel Hill Math Institute');
    expect(placedLine({ name: 'Ferreira Family Practice', how: 'requested' })).toBe('Asked to join Ferreira Family Practice');
  });
});
