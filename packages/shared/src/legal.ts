// ---------------------------------------------------------------------------
// Terms and privacy (Phase 51, docs/open-signup-plan.md)
// ---------------------------------------------------------------------------
// One text, served at /terms and /privacy on the web and opened from the app.
// Written from what the code does. Phase 52 records which version a newcomer
// accepted, so a change of wording is a new version, never an edit in place.

/** The version a newcomer accepts (Phase 52 records it). A wording change gets a new date. */
export const TERMS_VERSION = '2026-10-24';
export const PRIVACY_VERSION = '2026-10-24';

/**
 * Until the owner (and ideally a lawyer) approves the wording, both pages say they are a draft.
 * Phase 52's release needs this false.
 */
export const LEGAL_DRAFT = true;

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: 'Who we are',
    paragraphs: [
      'Aimtrue is a platform for tutoring, assessment and maths practice. Each space on Aimtrue -- a tutoring business, a club or a family -- decides who belongs to it and what it records.',
    ],
  },
  {
    heading: 'What we keep',
    paragraphs: [
      'About you: your name, your email address and, if you give it, your phone number; the permanent id of the Google account you sign in with (never your password); and when you last signed in.',
      'If you signed up yourself: whether you are 13 to 17 or an adult, and which version of these terms you accepted. Never your date of birth.',
      'What a space records: its people and their roles; for tutoring, lessons, notes, schedules, payments and progress; for assessments, the questions asked, the answers written on the canvas, the PDF made from them and a tutor’s review; for Quest, answers, points and games.',
    ],
  },
  {
    heading: 'Children',
    paragraphs: [
      'Nobody under 13 may create an account. A child takes part only as a student added to a space by a parent or guardian, or by the organization they learn with, who confirms they are the parent or guardian or have their permission.',
      'A child’s answers are kept for their parents, their tutors and the space’s administrators. They are never sold, never used for advertising and never sent to an AI provider.',
      'A parent may ask a space’s administrators to see or delete their child’s records.',
    ],
  },
  {
    heading: 'Who processes it',
    paragraphs: [
      'Google, to confirm who you are when you sign in. Cloudflare, which hosts the platform and its database.',
      'Anthropic’s Claude writes and checks questions for the question bank on the platform’s behalf. It is never given a person’s name, answers or records.',
      'We do not sell personal information and we show no advertising.',
    ],
  },
  {
    heading: 'Email',
    paragraphs: [
      'A space may switch on email notices, such as a lesson recorded or a schedule made. They say what happened and to whom it concerns -- never money, notes or scores.',
    ],
  },
  {
    heading: 'How long we keep it',
    paragraphs: [
      'A space’s records for as long as the space exists. An account until it is deleted; deleting it removes your name, email, phone and sign-in. The platform’s own log of sign-ins and account changes for as long as the platform runs, without your name once your account is deleted.',
    ],
  },
  {
    heading: 'Security',
    paragraphs: [
      'Every request is signed in and checked against your membership of the space it names, and every change is written to that space’s activity log. No Social Security number is ever stored.',
    ],
  },
  {
    heading: 'Your choices and questions',
    paragraphs: [
      'Ask a space’s administrators to correct or remove what it holds about you. For anything else, write to the platform’s support address.',
    ],
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: 'Using Aimtrue',
    paragraphs: [
      'You may use Aimtrue if you are 13 or older. To make a space you must be 18 or older.',
      'You are responsible for what you add to a space, and for having permission to add the people you add, children included.',
      'A space’s administrators decide who belongs to it, and may remove people.',
    ],
  },
  {
    heading: 'What is not allowed',
    paragraphs: [
      'Do not use Aimtrue to harass anyone, to collect other people’s information, or to break the law. We may suspend an account or a space that does.',
    ],
  },
  {
    heading: 'The service',
    paragraphs: [
      'Aimtrue is provided as it is, while it is in beta, without warranties. Features may change.',
      'We may update these terms. The version you accepted is recorded, and a change that matters will be shown to you.',
    ],
  },
];
