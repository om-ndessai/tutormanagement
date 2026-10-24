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

  // --- organization B, Riverside Tutoring (docs/multi-organization.md) ------
  /** Riverside's admin; belongs to Riverside alone. */
  orgBAdmin: { email: 'rosa.delgado.tutoring@gmail.com', name: 'Rosa Delgado' },
  /** Riverside's own tutor. */
  orgBTutor: { email: 'kwame.mensah.math@gmail.com', name: 'Kwame Mensah' },
  // --- organization C, an Assessment-only space (Phase 50) --------------------
  /** C's admin, and the parent of its one student, Noor (no address). */
  assessAdmin: { email: 'ines.ferreira.assess@gmail.com', name: 'Ines Ferreira' },
  /** C's second parent. */
  assessParent: { email: 'omar.haddad.assess@gmail.com', name: 'Omar Haddad' },
  /** Creates organizations and their admins; belongs to neither. */
  platformAdmin: { email: 'ndessai@gmail.com', name: 'Nav Dessai' },
} as const;

/**
 * The two seeded organizations, by slug. The cast above belongs to A; Priya,
 * Alex, Anita and Sanjay belong to B as well, in other roles.
 */
export const ORGS = {
  a: { slug: 'chmi', name: 'Chapel Hill Math Institute', short: 'CHMI' },
  b: { slug: 'riverside', name: 'Riverside Tutoring', short: 'Riverside' },
  /** Phase 50: allowed the Assessment set alone, as every self-serve space will be. */
  c: { slug: 'assess', name: 'Ferreira Family Practice', short: 'Ferreira' },
} as const;

export type PersonKey = keyof typeof PEOPLE;
