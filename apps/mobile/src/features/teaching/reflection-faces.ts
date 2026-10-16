// The student's reflection as five faces with words (UI upgrades U4; docs/ui-upgrades-spec.md). Pure,
// so the mapping from a face to the stored 1-5 value -- and the centring of difficulty and pace --
// is tested without a device.
//
// The questions themselves (`REFLECTION_QUESTIONS` in @tmi/shared) are reused as they are: their
// keys, their wording for the student and for an adult, which are centred, and the words under
// the faces ("Not really" … "Loads!", "Much too easy" … "About right" … "Much too hard").
//
// Two kinds of scale, as in shared:
// - Learned-new and understanding run low to high: more is better, so the chosen face takes the
//   rating ramp, as every other 1-5 score in the app does.
// - Difficulty and pace are CENTRED on 3, "About right"; 1 and 5 are the two ways a lesson can miss.
//   Their faces and tones are symmetric about the middle and never darker for a higher value.
import { REFLECTION_QUESTIONS, type Rating, type ReflectionKey } from '@tmi/shared';

export const FACE_VALUES: readonly Rating[] = [1, 2, 3, 4, 5];

/** The value at the middle of a centred scale: "About right". */
export const CENTRE: Rating = 3;

/** The words under the faces are shared's, so the app, the lesson's detail and the web agree. */
const WORDS = Object.fromEntries(
  REFLECTION_QUESTIONS.map((question) => [question.key, question.labels]),
) as Record<ReflectionKey, Record<Rating, string>>;

/**
 * How a chosen face is coloured. `rating1`…`rating5` is the app's ramp for a score where more is
 * better; on a centred scale it is how far from right the answer is: `right`, `near` or `far`.
 */
export type FaceTone = 'rating1' | 'rating2' | 'rating3' | 'rating4' | 'rating5' | 'right' | 'near' | 'far';

export interface Face {
  value: Rating;
  word: string;
  /** A Material Community Icons name. */
  icon: string;
  tone: FaceTone;
}

const ENGAGEMENT_ICONS: Record<Rating, string> = {
  1: 'emoticon-sad-outline',
  2: 'emoticon-neutral-outline',
  3: 'emoticon-happy-outline',
  4: 'emoticon-outline',
  5: 'emoticon-excited-outline',
};

/** By distance from the centre: the same face either side. */
const CENTRED_ICONS = [
  'emoticon-happy-outline',
  'emoticon-neutral-outline',
  'emoticon-confused-outline',
] as const;
const CENTRED_TONES = ['right', 'near', 'far'] as const;

export function isCentred(key: ReflectionKey): boolean {
  return REFLECTION_QUESTIONS.find((question) => question.key === key)?.centred ?? false;
}

/** 0 for "About right", 1 a step either way, 2 at either end. */
export function distanceFromCentre(value: Rating): 0 | 1 | 2 {
  return Math.abs(value - CENTRE) as 0 | 1 | 2;
}

/** The face standing for `value` on this question's scale. */
export function faceFor(key: ReflectionKey, value: Rating): Face {
  const word = WORDS[key][value];
  if (isCentred(key)) {
    const distance = distanceFromCentre(value);
    return { value, word, icon: CENTRED_ICONS[distance], tone: CENTRED_TONES[distance] };
  }
  return { value, word, icon: ENGAGEMENT_ICONS[value], tone: `rating${value}` as FaceTone };
}

/** The five faces, left to right, in the order of the stored values (1 to 5). */
export function facesFor(key: ReflectionKey): Face[] {
  return FACE_VALUES.map((value) => faceFor(key, value));
}

/** The stored value of the face at this position (0 = leftmost). Null off the row. */
export function valueOfFace(index: number): Rating | null {
  return FACE_VALUES[index] ?? null;
}

/** The position of the face for this stored value, or -1 when unanswered. */
export function faceIndexOf(value: Rating | null): number {
  return value === null ? -1 : FACE_VALUES.indexOf(value);
}

/** The words for an answer, or null when unanswered. */
export function faceWord(key: ReflectionKey, value: Rating | null): string | null {
  return value === null ? null : WORDS[key][value];
}
