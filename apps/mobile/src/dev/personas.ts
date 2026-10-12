/**
 * The seeded people a developer sign-in offers (mirrors e2e/support/people.ts and
 * apps/api/db/seed.sql). Names and what each one exercises -- never an organization's name:
 * where they belong comes from their memberships, at runtime.
 */
export const PERSONAS = [
  { email: 'priya.raghavan@gmail.com', name: 'Priya Raghavan', hint: 'Admin and tutor · two organizations' },
  { email: 'alex.chen.math@gmail.com', name: 'Alex Chen', hint: 'Tutor (a parent elsewhere)' },
  { email: 'maria.okafor@gmail.com', name: 'Maria Okafor', hint: 'Tutor and parent' },
  { email: 'anita.patel.nc@gmail.com', name: 'Anita Patel', hint: 'Parent · two organizations' },
  { email: 'sofia.okafor@gmail.com', name: 'Sofia Okafor', hint: 'Student' },
  { email: 'sanjay.patel.nc@gmail.com', name: 'Sanjay Patel', hint: 'Tutor and student' },
  { email: 'rosa.delgado.tutoring@gmail.com', name: 'Rosa Delgado', hint: 'Admin of another organization' },
  { email: 'kwame.mensah.math@gmail.com', name: 'Kwame Mensah', hint: 'Tutor of another organization' },
  { email: 'ndessai@gmail.com', name: 'Nav Dessai', hint: 'Platform admin · no organization' },
] as const;
