/**
 * The seeded people a developer sign-in offers (mirrors e2e/support/people.ts and
 * apps/api/db/seed.sql). Names and what each one exercises -- never a space's name:
 * where they belong comes from their memberships, at runtime.
 */
export const PERSONAS = [
  { email: 'priya.raghavan@gmail.com', name: 'Priya Raghavan', hint: 'Admin and tutor · two spaces' },
  { email: 'alex.chen.math@gmail.com', name: 'Alex Chen', hint: 'Tutor (a parent elsewhere)' },
  { email: 'maria.okafor@gmail.com', name: 'Maria Okafor', hint: 'Tutor and parent' },
  { email: 'anita.patel.nc@gmail.com', name: 'Anita Patel', hint: 'Parent · two spaces' },
  { email: 'sofia.okafor@gmail.com', name: 'Sofia Okafor', hint: 'Student' },
  { email: 'sanjay.patel.nc@gmail.com', name: 'Sanjay Patel', hint: 'Tutor and student' },
  { email: 'rosa.delgado.tutoring@gmail.com', name: 'Rosa Delgado', hint: 'Admin of another space' },
  { email: 'kwame.mensah.math@gmail.com', name: 'Kwame Mensah', hint: 'Tutor of another space' },
  {
    email: 'ines.ferreira.assess@gmail.com',
    name: 'Ines Ferreira',
    hint: 'Admin and parent · a self-serve space',
  },
  // Phase 54: a tutor space paid directly -- families pay each tutor.
  {
    email: 'hannah.brooks.tutor@gmail.com',
    name: 'Hannah Brooks',
    hint: 'Admin and tutor · a space paid directly',
  },
  { email: 'diego.ramos.tutor@gmail.com', name: 'Diego Ramos', hint: 'Tutor · paid directly by families' },
  { email: 'sam.okafor.family@gmail.com', name: 'Sam Okafor', hint: 'Parent · pays two tutors directly' },
  { email: 'grace.kim.family@gmail.com', name: 'Grace Kim', hint: 'Parent · pays one tutor directly' },
  { email: 'nina.newcomer@example.com', name: 'Nina Newcomer', hint: 'Adult · no space' },
  { email: 'theo.teen@example.com', name: 'Theo Teen', hint: '13-17 · asked to join a space' },
  { email: 'ndessai@gmail.com', name: 'Nav Dessai', hint: 'Platform admin · no space' },
] as const;
