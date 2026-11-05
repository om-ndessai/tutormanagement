// Phase 72 (UI audit JF4, JF9, JF26; owner 2026-11-04): the one "Have a code?" sheet's pure parts -- the roles a
// person may ask for (a teen a learner only; a tutor only where the space has Tutoring), the role a request carries,
// the request itself, the sheet's words, and what a signed-out visit left on this phone for the first home.
import { joinRequestSchema } from '@tmi/shared';

import {
  askedToJoinText,
  codeSheetStanding,
  joinAskRequest,
  joinAskRole,
  joinAskRoles,
  keptOffer,
  keptText,
  sentQuestText,
} from './code-sheet-model';

describe('what a request asks for', () => {
  it('offers an adult a parent, a learner and helping run it -- and a tutor only where there is Tutoring', () => {
    expect(joinAskRoles({ age_band: 'adult' }, { offers_tutoring: false })).toEqual(['parent', 'student', 'admin']);
    expect(joinAskRoles({ age_band: 'adult' }, { offers_tutoring: true })).toEqual(['parent', 'student', 'tutor', 'admin']);
    // Someone a space added (no account of their own) asks as an adult; an older Worker says nothing of Tutoring.
    expect(joinAskRoles(null, {})).toEqual(['parent', 'student', 'admin']);
  });

  it('offers a 13-17 a learner only, wherever they ask', () => {
    expect(joinAskRoles({ age_band: '13-17' }, { offers_tutoring: true })).toEqual(['student']);
  });

  it('carries the role chosen while it is offered, else the first offered', () => {
    expect(joinAskRole(null, ['parent', 'student', 'admin'])).toBe('parent');
    expect(joinAskRole('admin', ['parent', 'student', 'admin'])).toBe('admin');
    // Chosen, then no longer offered (another space found): back to the first.
    expect(joinAskRole('tutor', ['parent', 'student', 'admin'])).toBe('parent');
    expect(joinAskRole(null, ['student'])).toBe('student');
    expect(joinAskRole(null, [])).toBe('parent');
  });

  it('sends the code, the role and the note trimmed -- an empty note is none -- in the shape the API takes', () => {
    expect(joinAskRequest('FMXY2345', 'parent', '   ')).toEqual({ code: 'FMXY2345', role: 'parent', note: null });
    const request = joinAskRequest('FMXY2345', 'admin', '  Mother of Noor  ');
    expect(request).toEqual({ code: 'FMXY2345', role: 'admin', note: 'Mother of Noor' });
    expect(joinRequestSchema.safeParse(request).success).toBe(true);
  });
});

describe('the sheet’s words', () => {
  it('names the space once asked, and says where a found space stands', () => {
    expect(askedToJoinText('Ferreira Family Practice')).toBe(
      'Asked to join Ferreira Family Practice. Its admins will let you in.',
    );
    expect(codeSheetStanding({ name: 'Ferreira Family Practice', standing: null })).toBe(
      'Ask to join, and its admins let you in.',
    );
    expect(codeSheetStanding({ name: 'Ferreira Family Practice', standing: 'member' })).toBe(
      'You already belong to Ferreira Family Practice.',
    );
    expect(codeSheetStanding({ name: 'Ferreira Family Practice', standing: 'requested' })).toBe(
      'You have already asked to join Ferreira Family Practice.',
    );
  });

  it('says what keeping a code signed out means, and names a quest a friend sent', () => {
    expect(keptText('FMXY2345')).toBe(
      'FMXY2345 will be waiting on your first screen once you have signed up or signed in. Nothing is sent until you use it.',
    );
    expect(sentQuestText('10 in a row, Grade 4')).toBe(
      'You were sent 10 in a row, Grade 4. It needs a free account; it will be waiting once you are in.',
    );
  });
});

describe('what the first home offers', () => {
  it('a code kept first, else a quest sent (by its name), else nothing', () => {
    expect(keptOffer({ keptCode: 'FMXY2345', sentTile: 'G4T10' })).toEqual({ kind: 'code', code: 'FMXY2345' });
    expect(keptOffer({ sentTile: 'G4T10' })).toEqual({
      kind: 'sent',
      code: 'G4T10',
      name: expect.stringContaining('Grade 4'),
    });
    expect(keptOffer({})).toBeNull();
    // A link that is no tile's code is not offered.
    expect(keptOffer({ sentTile: 'NOT-A-TILE' })).toBeNull();
  });
});
