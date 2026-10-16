import { ORG_PALETTES, REFLECTION_QUESTIONS, type Rating } from '@tmi/shared';

import { buildTheme } from '@/theme/paper-theme';
import { faceColours } from './reflection-face-colours';
import {
  CENTRE,
  distanceFromCentre,
  faceFor,
  faceIndexOf,
  facesFor,
  faceWord,
  isCentred,
  valueOfFace,
} from './reflection-faces';

const VALUES: Rating[] = [1, 2, 3, 4, 5];

describe('face to value', () => {
  it('maps the five faces, left to right, onto the stored 1-5 and back', () => {
    expect([0, 1, 2, 3, 4].map(valueOfFace)).toEqual([1, 2, 3, 4, 5]);
    expect(valueOfFace(-1)).toBeNull();
    expect(valueOfFace(5)).toBeNull();
    for (const value of VALUES) expect(valueOfFace(faceIndexOf(value))).toBe(value);
    expect(faceIndexOf(null)).toBe(-1);
  });

  it('gives every question five faces whose values are the stored ones, in order', () => {
    for (const question of REFLECTION_QUESTIONS) {
      expect(facesFor(question.key).map((face) => face.value)).toEqual(VALUES);
    }
  });

  it('words the questions where more is better from "Not really" to "Loads!"', () => {
    for (const key of ['learned_new', 'understanding'] as const) {
      expect(isCentred(key)).toBe(false);
      expect(facesFor(key).map((face) => face.word)).toEqual([
        'Not really',
        'A little',
        'Some',
        'A lot',
        'Loads!',
      ]);
    }
  });

  it('words difficulty and pace from one miss to the other, with About right at 3', () => {
    expect(facesFor('difficulty').map((face) => face.word)).toEqual([
      'Much too easy',
      'A bit easy',
      'About right',
      'A bit hard',
      'Much too hard',
    ]);
    expect(facesFor('pace').map((face) => face.word)).toEqual([
      'Much too slow',
      'A bit slow',
      'About right',
      'A bit fast',
      'Much too fast',
    ]);
    expect(CENTRE).toBe(3);
    expect(faceWord('difficulty', 3)).toBe('About right');
    expect(faceWord('pace', 3)).toBe('About right');
    expect(faceWord('pace', null)).toBeNull();
  });

  it('follows shared on which questions are centred', () => {
    for (const question of REFLECTION_QUESTIONS) expect(isCentred(question.key)).toBe(question.centred);
  });
});

describe('centring', () => {
  it('measures the distance from About right the same either side', () => {
    expect(VALUES.map(distanceFromCentre)).toEqual([2, 1, 0, 1, 2]);
  });

  it('draws a centred scale symmetrically: the same face and tone either side of 3', () => {
    for (const key of ['difficulty', 'pace'] as const) {
      for (const value of VALUES) {
        const mirror = (6 - value) as Rating;
        expect(faceFor(key, value).icon).toBe(faceFor(key, mirror).icon);
        expect(faceFor(key, value).tone).toBe(faceFor(key, mirror).tone);
      }
      expect(faceFor(key, 3).tone).toBe('right');
      expect(faceFor(key, 2).tone).toBe('near');
      expect(faceFor(key, 5).tone).toBe('far');
    }
  });

  it('never takes the darker-is-better ramp on a centred scale', () => {
    for (const key of ['difficulty', 'pace'] as const) {
      for (const face of facesFor(key)) expect(face.tone).not.toMatch(/^rating/);
    }
  });

  it('takes the ramp, rising with the value, where more is better', () => {
    expect(facesFor('learned_new').map((face) => face.tone)).toEqual([
      'rating1',
      'rating2',
      'rating3',
      'rating4',
      'rating5',
    ]);
  });
});

describe('face colours come from the theme, symmetric on a centred scale', () => {
  it('colours difficulty and pace the same either side of About right, in every palette and scheme', () => {
    for (const palette of ORG_PALETTES) {
      for (const scheme of ['light', 'dark'] as const) {
        const theme = buildTheme(palette, scheme);
        for (const key of ['difficulty', 'pace'] as const) {
          for (const value of VALUES) {
            const mirror = (6 - value) as Rating;
            expect(faceColours(theme, faceFor(key, value).tone)).toEqual(
              faceColours(theme, faceFor(key, mirror).tone),
            );
          }
          // The two misses are not the rating ramp's darkest step.
          expect(faceColours(theme, faceFor(key, 5).tone).fill).not.toBe(theme.tokens.rating5);
        }
        // Every colour is a token's: a hex from the theme, never undefined.
        for (const tone of ['right', 'near', 'far', 'rating1', 'rating5'] as const) {
          const colours = faceColours(theme, tone);
          for (const value of Object.values(colours)) expect(typeof value).toBe('string');
        }
      }
    }
  });
});
