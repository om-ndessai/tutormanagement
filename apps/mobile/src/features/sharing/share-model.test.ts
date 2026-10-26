// Phase 56 (R22): who may share, who may show a first name, and the link and text.
import { mayShowName, shareAllowed, shareLinkAndText } from './share-model';

const student = { roles: ['student'] as const } as never;
const parent = { roles: ['parent'] as const } as never;

describe('shareAllowed / mayShowName', () => {
  it('never offers Share to a child a space added (a student with no account)', () => {
    expect(shareAllowed(student, null)).toBe(false);
    expect(shareAllowed(null, null)).toBe(false);
  });

  it('offers it to a student who signed themselves up, and to every adult', () => {
    expect(shareAllowed(student, { age_band: 'teen' } as never)).toBe(true);
    expect(shareAllowed(parent, null)).toBe(true);
  });

  it('lets only an adult show their first name', () => {
    expect(mayShowName(parent, null)).toBe(true);
    expect(mayShowName(student, { age_band: 'teen' } as never)).toBe(false);
    expect(mayShowName(student, { age_band: 'adult' } as never)).toBe(true);
    expect(mayShowName(parent, { age_band: 'teen' } as never)).toBe(false);
  });
});

describe('shareLinkAndText', () => {
  it('links to the server the app talks to, and ends the text with the link', () => {
    const card = { kind: 'level_finished', level_id: 'NC26.4', level_label: 'Grade 4', answered: 12, correct: 10 } as const;
    const { link, text } = shareLinkAndText({ id: 'abcDEF1234567890', card, first_name: null }, 'http://localhost:8787/', 'Aimtrue');
    expect(link).toBe('http://localhost:8787/s/abcDEF1234567890');
    expect(text).toBe('Aimtrue Quest · Finished Grade 4 · 12 questions\nhttp://localhost:8787/s/abcDEF1234567890');
  });
});
