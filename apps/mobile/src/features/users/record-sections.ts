// A person's record in sections, each with its own Edit (UI upgrades U5; docs/ui-upgrades-spec.md):
// Contact, School and goal (a tutor's Background), Availability, Lessons and price (a tutor's
// Teaching), Pay and tax (a parent's Payment), Family. Pure, so which sections a reader gets is
// tested on its own.
//
// A section shows only when it applies to the person's roles AND has something for this reader:
// the server has already blanked what they may not see (R4-R7), and a section that would only say
// "Not set" to a family is left out. Edit is the office's (`requireAdmin`), on a live record, and
// opens the person form scoped to that section's blocks (`sections`): the form still saves the whole
// record, so a scoped edit never clears another section's fields.
import type { UserDetail, UserRole } from '@tmi/shared';

import { seesTutorPay } from './people-model';
import type { UserFormSection } from './person-form-model';

export const RECORD_SECTION_KEYS = [
  'contact',
  'background',
  'school',
  'availability',
  'teaching',
  'lessons',
  'pay',
  'payment',
  'family',
] as const;
export type RecordSectionKey = (typeof RECORD_SECTION_KEYS)[number];

export interface RecordSectionDef {
  key: RecordSectionKey;
  /** The section's heading on the record. */
  title: string;
  icon: string;
  /** The person form's blocks its Edit opens. */
  form: UserFormSection[];
  /** The scoped form's line under its title. */
  editDescription: string;
}

export const RECORD_SECTIONS: Record<RecordSectionKey, RecordSectionDef> = {
  contact: {
    key: 'contact',
    title: 'Contact',
    icon: 'card-account-phone-outline',
    form: ['contact'],
    editDescription: 'Their name, the Google address they sign in with, and a phone number.',
  },
  background: {
    key: 'background',
    title: 'Background',
    icon: 'school-outline',
    form: ['tutor-background'],
    editDescription: 'Their education, school and the area they live in, for matching families.',
  },
  school: {
    key: 'school',
    title: 'School and goal',
    icon: 'book-open-page-variant-outline',
    form: ['student-school'],
    editDescription: 'Where they are at school, and what this year is for.',
  },
  availability: {
    key: 'availability',
    title: 'Availability',
    icon: 'calendar-clock-outline',
    form: ['availability'],
    editDescription: 'The hours each week they could have a lesson.',
  },
  teaching: {
    key: 'teaching',
    title: 'Teaching',
    icon: 'human-male-board',
    form: ['tutor-lessons'],
    editDescription: 'Whether they teach online, and the longest lesson they take.',
  },
  lessons: {
    key: 'lessons',
    title: 'Lessons and price',
    icon: 'timer-outline',
    form: ['student-lessons'],
    editDescription: 'Online or in person, the longest lesson, and what the family is charged.',
  },
  pay: {
    key: 'pay',
    title: 'Pay and tax',
    icon: 'wallet-outline',
    form: ['tutor-financials', 'payment-handles'],
    editDescription:
      'Their pay rates, the advance kept above, how they are paid, and their 1099 details — the SSN as a tick, never the number.',
  },
  payment: {
    key: 'payment',
    title: 'Payment',
    icon: 'wallet-outline',
    form: ['payment-handles'],
    editDescription: 'How this parent is billed.',
  },
  family: {
    key: 'family',
    title: 'Family',
    icon: 'account-heart-outline',
    form: ['guardians'],
    editDescription: 'Their parents and guardians, and who is the primary contact.',
  },
};

/** `?section=` on the person form -> its definition, or undefined. */
export function recordSection(param: string | undefined): RecordSectionDef | undefined {
  return (RECORD_SECTION_KEYS as readonly string[]).includes(param ?? '')
    ? RECORD_SECTIONS[param as RecordSectionKey]
    : undefined;
}

export interface RecordReader {
  id: string;
  roles: readonly UserRole[];
}

export interface ShownSection {
  key: RecordSectionKey;
  /** The reader may edit it here: Edit opens the scoped form. */
  editable: boolean;
}

type Person = Pick<
  UserDetail,
  | 'id'
  | 'roles'
  | 'deleted_at'
  | 'tutor_profile'
  | 'student_profile'
  | 'availability'
  | 'payment_handles'
  | 'guardians'
  | 'dependents'
>;

/** The record's sections for this reader, in order, and which of them they may edit. */
export function recordSections(person: Person, reader: RecordReader | null, { compact = false } = {}): ShownSection[] {
  const isAdmin = reader?.roles.includes('admin') ?? false;
  // Pay is between a tutor and the office; the server blanks it for anyone else (R4).
  const seesPay = seesTutorPay(reader, person.id);
  const editable = isAdmin && !compact && !person.deleted_at;
  const tutor = person.tutor_profile;
  const student = person.student_profile;
  const teachesOrLearns = Boolean(tutor || student);
  const isParent = person.roles.includes('parent');

  const shown: ShownSection[] = [{ key: 'contact', editable }];
  if (tutor) shown.push({ key: 'background', editable });
  if (student) shown.push({ key: 'school', editable });
  // Empty hours are worth a section only to someone who could fill them in.
  if (teachesOrLearns && (person.availability.length > 0 || Boolean(tutor?.availability_notes) || editable)) {
    shown.push({ key: 'availability', editable });
  }
  if (tutor) shown.push({ key: 'teaching', editable });
  if (student) shown.push({ key: 'lessons', editable });
  if (tutor && seesPay) shown.push({ key: 'pay', editable });
  // A parent's payment ids, when they are not a tutor (whose ids sit with their pay).
  if (isParent && !tutor && (person.payment_handles.length > 0 || editable)) {
    shown.push({ key: 'payment', editable });
  }
  // Guardians are edited on the record of the one they look after (a student's, or a tutor's); a
  // parent's children are read here and changed on each child's record.
  const guardianEditable = editable && teachesOrLearns;
  if (person.guardians.length > 0 || person.dependents.length > 0 || (student && editable)) {
    shown.push({ key: 'family', editable: guardianEditable });
  }
  return shown;
}
