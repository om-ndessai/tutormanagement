/**
 * The seeded roster, by role. Mirrors apps/api/db/seed.sql -- the suite runs
 * against a database rebuilt from that file, so these are stable.
 *
 * Chosen to cover the combinations the plan calls out rather than to look like
 * a plausible institute.
 */
export const PEOPLE = {
  /** Owner. Also tutors, so she exercises the admin+tutor overlap. */
  admin: { email: 'priya.raghavan@gmail.com', name: 'Priya Raghavan' },
  /** Pure tutor: two assigned students, no other role. */
  tutor: { email: 'alex.chen.math@gmail.com', name: 'Alex Chen' },
  /** Parent of Sofia, and a tutor herself. */
  parentTutor: { email: 'maria.okafor@gmail.com', name: 'Maria Okafor' },
  /** Pure parent: one child, Sanjay. */
  parent: { email: 'anita.patel.nc@gmail.com', name: 'Anita Patel' },
  /** Pure student. */
  student: { email: 'sofia.okafor@gmail.com', name: 'Sofia Okafor' },
  /** Tutors younger children AND is taught himself. */
  studentTutor: { email: 'sanjay.patel.nc@gmail.com', name: 'Sanjay Patel' },
} as const;

export type PersonKey = keyof typeof PEOPLE;
