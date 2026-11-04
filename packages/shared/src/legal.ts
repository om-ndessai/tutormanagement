// ---------------------------------------------------------------------------
// Terms and privacy (Phase 51, docs/open-signup-plan.md)
// ---------------------------------------------------------------------------
// One text, served at /terms and /privacy on the web and opened from the app.
// Written from what the code does. Phase 52 records which version a newcomer
// accepted, so a change of wording is a new version, never an edit in place.

/** The version a newcomer accepts (Phase 52 records it). A wording change gets a new date. */
export const TERMS_VERSION: string = '2026-11-04';
export const PRIVACY_VERSION: string = '2026-11-04';

/**
 * Earlier versions a sign-up may still accept, recorded as sent: an app build already on a phone
 * shows and sends the version it was built with. 2026-10-31 only reworded "organization" as
 * "space" (Phase 59), so 2026-10-29 is still a fair thing to have agreed to; 2026-11-01 only adds
 * playing as a guest and anonymous counts (Phase 63), which take nothing more from an account; 2026-11-04
 * adds the days a person opens a space and how they first came (Phases 68-69).
 */
export const ACCEPTED_LEGAL_VERSIONS: readonly string[] = ['2026-11-04', '2026-11-01', '2026-10-31', '2026-10-29'];

/**
 * While true, both pages say they are a draft. The owner approved version 2026-10-29 on 2026-10-29
 * (docs/stable-release-checklist.md, A3), without a lawyer's review, version 2026-10-31 on 2026-11-01, and
 * version 2026-11-01 (guest play and anonymous counts, Phase 63) on 2026-11-01, and version 2026-11-04 (visit days
 * and arrival, Phases 68-69) on 2026-11-04.
 */
export const LEGAL_DRAFT = false;

/**
 * The next version, a DRAFT shown at /privacy?draft=1 and /terms?draft=1 until the owner approves it.
 * While it equals TERMS_VERSION there is no draft: Phase 69's (2026-11-04) was approved and published.
 */
export const LEGAL_NEXT_VERSION: string = '2026-11-04';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

/** Version 2026-10-31's privacy text, which 2026-11-01 builds on. */
const PRIVACY_SECTIONS_2026_10_31: LegalSection[] = [
  {
    heading: 'Who we are',
    paragraphs: [
      'Aimtrue ("we") is a platform for tutoring, assessment and maths practice. Each space on Aimtrue -- a tutoring business, a club or a family -- decides who belongs to it and what it records.',
    ],
  },
  {
    heading: 'What we keep',
    paragraphs: [
      'About you: your name, your email address and, if you give it, your phone number; when you last signed in; and, for each account you sign in with -- Google and, where offered, Microsoft, Facebook or Apple -- its permanent id and the email it reports. Never your password. You may link more than one of these to yourself.',
      'If you signed up yourself: whether you are 13 to 17 or an adult, and which version of these terms you accepted. Never your date of birth.',
      'What a space records: its people and their roles; for tutoring, lessons, notes, schedules, payments and progress; for assessments, the questions asked, the answers written on the canvas, the PDF made from them and a tutor’s review; for Quest, answers, points and games.',
      'Where a space collects its families’ payments, the name, tax id and payer address it files 1099s under; a tutor’s mailing address, for their 1099. Only the space’s office and that tutor see the address and the tax arrangements.',
    ],
  },
  {
    heading: 'Children',
    paragraphs: [
      'Nobody under 13 may create an account. A child takes part only as a student added to a space by a parent or guardian, or by the administrators of the space they learn in, who confirm they are the parent or guardian or have their permission.',
      'A child’s answers are kept for their parents, their tutors and the space’s administrators. They are never sold, never used for advertising and never sent to an AI provider.',
      'A parent may ask a space’s administrators to see or delete their child’s records.',
    ],
  },
  {
    heading: 'Sharing',
    paragraphs: [
      'You may share a Quest result or a question as a link. Anyone with the link can see what it shows: the result or the question, never a child’s name or another player’s. You can withdraw a link, and it then reads “no longer available”.',
      'Someone answering a shared question without signing in is checked by Cloudflare Turnstile, to tell a person from a program.',
    ],
  },
  {
    heading: 'Who processes it',
    paragraphs: [
      'The account you sign in with -- Google, Microsoft, Facebook or Apple -- to confirm who you are. Cloudflare, which hosts the platform and its database and sends its emails.',
      'Anthropic’s Claude writes and checks questions for the question bank on the platform’s behalf, and reads handwriting in the platform administrators’ own handwriting lab. It is never given a student’s name, answers, handwriting or records.',
      'In the app, dictation runs on your phone. Only if you choose online dictation does your phone’s speech service (Apple’s or Google’s) hear what you say. No recording is kept.',
      'We do not sell personal information and we show no advertising.',
    ],
  },
  {
    heading: 'Cookies',
    paragraphs: [
      'Only what the platform needs: one cookie keeps you signed in, and others remember your space and whether you have seen the tour. No tracking and no analytics.',
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
      'A space’s records for as long as the space exists; deleting a space removes everything it holds, permanently. An account until it is deleted; deleting it removes your name, email, phone and sign-in. The platform’s own log of sign-ins and account changes for as long as the platform runs, without your name once your account is deleted.',
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
      'Ask a space’s administrators to see, correct or remove what it holds about you. You may delete your own account once you belong to no space.',
    ],
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: 'Using Aimtrue',
    paragraphs: [
      'Aimtrue ("we") provides the platform. You may use it if you are 13 or older. To make a space you must be 18 or older.',
      'You are responsible for what you add to a space, and for having permission to add the people you add, children included.',
      'A space’s administrators decide who belongs to it, and may remove people.',
      'Signing in with Google, Microsoft, Facebook or Apple is also covered by that company’s own terms.',
    ],
  },
  {
    heading: 'Your content',
    paragraphs: [
      'What you add stays yours. You let us store and show it to the people your space allows, so the platform can work.',
      'Questions in the bank are the platform’s. When a reviewer marks a question right, it is approved for every space.',
    ],
  },
  {
    heading: 'What is not allowed',
    paragraphs: [
      'Do not use Aimtrue to harass anyone, to collect other people’s information, to share anyone else’s details through a link, or to break the law. We may suspend an account or a space that does.',
    ],
  },
  {
    heading: 'Ending',
    paragraphs: [
      'You may leave a space, and delete your account once you belong to no space. A space’s administrator may delete a space they made; that removes everything it holds and cannot be undone.',
    ],
  },
  {
    heading: 'The service',
    paragraphs: [
      'Aimtrue is provided as it is, while it is in beta, without warranties. Features may change.',
      'To the extent the law allows, we are not liable for indirect losses, or for lost data or records, arising from using Aimtrue.',
      'These terms are governed by the laws of North Carolina, United States.',
      'We may update these terms. The version you accepted is recorded, and a change that matters will be shown to you.',
    ],
  },
];

/**
 * Version 2026-11-01 (Phase 63, P15): 2026-10-31's with the cookies paragraph changed and a section on
 * playing as a guest added after "What we keep". The terms are unchanged.
 */
const PRIVACY_SECTIONS_2026_11_01: LegalSection[] = PRIVACY_SECTIONS_2026_10_31.flatMap((section) => {
  if (section.heading === 'Cookies') {
    return [
      {
        heading: 'Cookies and counts',
        paragraphs: [
          'Only what the platform needs: one cookie keeps you signed in, and others remember your space and whether you have seen the tour.',
          'We count how Aimtrue is used, anonymously -- for example how many quests are started and how many people sign up -- to learn what helps. The counts carry no cookie, no identifier and no IP address, and no third-party analytics or advertising code is used.',
        ],
      },
    ];
  }
  if (section.heading === 'What we keep') {
    return [
      section,
      {
        heading: 'Playing as a guest',
        paragraphs: [
          'You may play some quests and try an assessment without an account. Your answers are marked on your device and are never sent to us. Your device remembers your grade, the free questions it has played and your best scores; nothing about a guest is stored by us.',
        ],
      },
    ];
  }
  return [section];
});
/**
 * The published privacy text, version 2026-11-04 (Phases 68-69, docs/member-home-plan.md H4, H12; approved by
 * the owner 2026-11-04): 2026-11-01's with the days a person opens a space and how they first came, and how
 * long those are kept. Publishing it is what lets the console switch on recording visits (`visitsMayRecord`).
 * The terms are unchanged.
 */
export const PRIVACY_SECTIONS: LegalSection[] = PRIVACY_SECTIONS_2026_11_01.map((section) => {
  if (section.heading === 'What we keep') {
    return {
      ...section,
      paragraphs: [
        ...section.paragraphs.slice(0, 2),
        'How you use Aimtrue, in outline: which days you open each space, and whether on the web or in the app -- one line a day, never what you looked at or did there. If you signed up yourself, how you first came: after playing as a guest, after trying the guest assessment, or neither.',
        ...section.paragraphs.slice(2),
      ],
    };
  }
  if (section.heading === 'Cookies and counts') {
    return {
      ...section,
      paragraphs: [
        ...section.paragraphs,
        'The platform’s administrators see the days people open their spaces only as totals over groups of at least five people -- for example how many come back each week -- to learn what helps people keep learning. Never one person’s days, and never a space’s administrators.',
      ],
    };
  }
  if (section.heading === 'How long we keep it') {
    return {
      ...section,
      paragraphs: [...section.paragraphs, 'The days you opened a space for 120 days, then they are deleted; they are deleted at once with your account or the space.'],
    };
  }
  return section;
});
/** No draft: the next version is the published one. */
export const PRIVACY_SECTIONS_NEXT: LegalSection[] = PRIVACY_SECTIONS;
export const TERMS_SECTIONS_NEXT: LegalSection[] = TERMS_SECTIONS;
