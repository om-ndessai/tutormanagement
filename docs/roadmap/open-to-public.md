# Opening Aimtrue to the public: anyone signs in, more ways in, and sharing Quest

Written 2026-10-23, after Phases 1-48 (Phase 20 not built). This is an analysis, not a schedule: like
everything in `docs/roadmap/`, a stage below is built only once the owner writes it into
[`docs/plan.md`](../plan.md) as a phase. Figures were checked on this date; re-check them before
relying on them. Nothing here is legal advice: the children's-privacy points need a lawyer's read
before the door opens.

---

## The short answer

1. **Opening sign-in is a small code change, but what a stranger lands IN is the real decision.**
   Today `POST /api/auth/google` refuses anyone who is not already a person in an organization.
   Removing that refusal takes an afternoon. A stranger then needs somewhere to go, and every rule
   in the portal assumes everybody inside an organization was put there by its admins.
2. **Recommended: self-serve "spaces", not one public room.** A newcomer either joins an
   organization with a code its admins gave out, or starts their own small organization: a
   **family space** (a parent and their children, practising with Quest and Assessments) or, later,
   a **tutor space** (a tutor's own practice). Every existing rule (R1-R20, the organization scoping,
   the exposure crawl) keeps working, because each space is just another organization. A single
   public "commons" that everyone joins would put strangers' children in one room, and would leave
   Quest's answers with nobody to review them.
3. **Seven things must be fixed before the door opens**, and some of them are live risks today
   (see [Before the door opens](#before-the-door-opens-blockers)). The most urgent:
   - **The free D1 plan now fails queries past its daily limit** (since 2026-09-01), and production
     shares one database with the institute. A burst of strangers would take the institute down.
     The $5/month Workers Paid plan is a precondition.
   - **A first sign-in auto-accepts every invitation.** Once strangers run organizations, anyone
     could add your email to theirs and you would land in it.
   - **Adding an existing email answers with that person's real name and phone number.** With
     self-serve organizations, that becomes a lookup tool for any address.
   - **One "Question is right" in any organization approves a question for every organization.**
     That is safe only while every reviewer is a vetted tutor.
4. **Children need a parent-first design.** An adult (18+) owns each account. Children are profiles
   under a parent, with no email, playing on the parent's device ("Continue as", roadmap F1), with
   the parent's consent recorded (a slice of F7). Under-13s never create accounts.
5. **Other sign-in methods.** **Sign in with Apple becomes required** for the iOS app once it offers
   Google sign-in to the general public (App Store guideline 4.8). After that, **Microsoft** (schools
   and Outlook users) and **email magic links** (people without either) are the useful additions.
   Facebook adds little and is not recommended. Each needs a `user_identities` table, because a
   person is matched today on one Google id.
6. **Sharing Quest.** The safe and cheap design:
   - **What is shared.** A result card (level, score, rank, no other players' names, no child's
     name), as copyable text in the Wordle style and as an image made in the browser or the app.
   - **The link.** A public share page with link previews.
   - **"Can you solve this one?"** A one-question challenge page that a visitor can answer without
     signing in. This is the growth loop.
   - **What is never shared.** Public leaderboards, captions or free text, and points for sharing.

---

## Where it stands today

From the code on 2026-10-23:

- **Sign-in refuses strangers twice.** `routes/auth.ts`, `POST /google`:
  1. "no portal account" when `resolveSignIn` finds no person with that Google id or email;
  2. "no organization" when the person has no membership, no invitation and is not a platform
     admin.

  Both are logged `auth.denied` and answer 403 `no_account`.
- **Identity is one Google id.** `users.google_sub` is pinned on first sign-in, and sign-in refuses
  an email match whose pinned id differs (`pinnedToAnother`). There is no table of identities, so a
  second provider has nowhere to go.
- **Organizations are created only by platform admins.** Through the console (`routes/platform.ts`)
  or, with sign-in off, the dev fallback in `middleware/auth.ts`.
- **First sign-in accepts every invitation.** In `recordSignIn` (`repositories/people.ts`), someone
  who has never signed in becomes `active` in every organization that invited them ("there is
  nothing of theirs elsewhere to protect"). That reasoning holds only while every organization is
  trusted.
- **Adding a person who already has an account.** `createUser` (`repositories/users.ts`) invites
  them, and `POST /api/users` answers 201 with `getUserDetail`. That detail carries **their stored
  name and phone, not what the admin typed**, so the "answered exactly like created" promise leaks
  whether the address has an account, and whose it is. Their shared fields are also now locked
  (`shared_fields_locked`) in their real organization, because they belong to two.
- **Quest approves for the whole platform.** In `repositories/quest.ts`, "Question is right" sets
  `status = 'approved', approved_via = 'quest'` on the bank question for every organization.
- **Children can sign in only if they have their own Google account.** Students without an email
  never sign in. F1 ("Continue as" on a parent's session, or a lesson code) is planned, not built.
- **No consent records exist.** `runAi` refuses every `child_input` task until F7 exists.
- **The address.** Production runs on `workers.dev` addresses. The Google consent screen was set up
  under the institute's name (`docs/google-oauth-setup.md`).
- **The mobile app is not in the public stores.** It runs on a personal-team build and on
  TestFlight.

---

## The decision that shapes everything: where does a stranger land?

| Option | What it is | For | Against |
| --- | --- | --- | --- |
| **A. One public commons** | Every newcomer joins a platform-run organization ("Aimtrue Open") as a student and plays Quest there | Simplest to explain; one room for public games | Strangers' children in one organization, which is exactly the Epic/Fortnite pattern. Quest's answers have no tutor to review them. One huge organization strains every per-organization list. An admin of it sees every child. |
| **B. Self-serve spaces** (recommended) | A newcomer starts their own organization: a family space, or a tutor space | Every existing rule holds unchanged: R13 keeps spaces apart and the exposure crawl already covers it. A parent is the natural consent-giver and reviewer. Matches how Beast Academy Online and Khan Academy handle families | More to build (a creation flow, kinds, limits). Children in different families cannot play together without new work. |
| **C. Join by code only** | Sign-in opens, but a newcomer can only join an organization that gave them a code or approves their request | Smallest and safest; no new kinds of organization | Opens the door without giving a stranger anything to do. Useful as the first step, not as the destination. |

**Recommendation:** C first, as the door (Stage O1), then B's family space (Stage O2), then B's
tutor space (Stage O5). A stays out: playing with friends across families is a later, consent-gated
feature (see [Later](#later-not-in-these-stages)).

---

## Before the door opens (blockers)

Each item is needed for any of the options.

### 1. Quota: the free plan would take the institute down

- **The free plan's limits are now enforced.** Workers Free gives D1 5 million rows read and
  100,000 written a day per account. Since 2026-09-01, queries past that **fail until midnight
  UTC** (Cloudflare changelog).
- **The institute shares that database.** `tutoring-db` holds every organization, so strangers'
  traffic spends the institute's budget. The 2026-10-06 outage, when three test runs exhausted the
  day, shows how close this already is.
- **Every request reads too.** Each request re-reads the person and the membership (deliberately:
  see the Gotchas in `CLAUDE.md`), so reads grow with every new user.
- **Workers Paid fixes it for $5/month.** It includes 25 billion rows read and 50 million written a
  month, 10 million requests, and a much higher CPU limit per request. CPU also matters for share
  images; see [Sharing](#sharing-quest-on-social-media).
- **It is a precondition, not an option.** Keep the read discipline anyway (indexed seeks, no
  polling, cached reads of the bank).

### 2. A first sign-in must not join strangers' organizations

`recordSignIn`'s auto-accept stays for organizations the platform created (institutes), and stops
for self-serve ones: an invitation from a self-serve organization is always answered by the person,
on the picker, as an existing account's is today. Store `organizations.created_via`
(`console` | `self_serve`) and check it in that UPDATE.

### 3. Adding an email must not reveal who owns it

- **What leaks.** For an existing account, `POST /api/users` (and the user detail an admin then
  reads) shows that person's stored name and phone, and locks their shared fields elsewhere.
- **What to change, for self-serve organizations at least:**
  - show what the admin typed until the person accepts;
  - leave the phone off until they accept;
  - do not lock the shared fields while the membership is only `invited`;
  - cap invitations per organization per day.
- **Possibly for every organization.** The fix is arguably right for institutes too, and is cheap
  to apply everywhere.

### 4. Quest approvals from strangers must not reach every organization

- **The rule today.** A tutor's "Question is right" approves a bank question for every
  organization (owner's decision, 2026-10-20). That was right while every tutor was vetted.
- **The risk.** With self-serve spaces, any parent holding a tutor role in their own family space
  could approve questions for the whole platform.
- **Proposed rule:**
  - only organizations a platform admin marks as trusted (`organizations.quest_trusted`) approve
    for everyone;
  - everywhere else, "Question is right" goes to the console's queue as a suggested approval;
  - optionally, a question is promoted automatically once reviewers in two or more independent
    organizations confirm it.
- **Flags.** These already go to the console, so they need no change.

### 5. Email and AI must not become free for abuse

- **Email.** A self-serve organization's email notifications start off. The invitation email (when
  there is one) is capped per organization and per day, so the portal cannot be used to send spam
  under its own sender.
- **AI.** Self-serve spaces get no AI tasks: every AI feature costs money per call, and the
  `child_input` ones are refused anyway until F7.

### 6. Abuse controls on the public routes

- **Turnstile and rate limits.** Put Cloudflare Turnstile (free) on space creation, join-code
  redemption and the public share pages' answer button. Add rate limits on `/api/auth/*`, join
  codes and share pages (Workers' rate-limiting binding, or a small Durable Object counter).
- **Limits per person:** spaces created, invitations sent, children added.
- **Reserved names.** Self-serve spaces cannot take an existing organization's name or slug, words
  like "institute" or "official", or a built-in logo. Their logos are seen only by their own
  members, because the sign-in page wears only `DEFAULT_ORGANIZATION` or the platform (that rule
  already holds).
- **Stopping a bad space.** A platform admin can archive a space from the console. Archiving
  exists already.

### 7. The legal pages and duties

- **Pages.** A public product needs a privacy policy, terms of use and a children's privacy notice,
  linked from the sign-in page, the consent screens and the store listings.
- **COPPA as amended (fully enforceable since 22 April 2026).** It asks for:
  - a written information-security programme;
  - a published retention schedule (keeping data indefinitely is prohibited);
  - the third parties named in the notice;
  - verifiable parental consent before collecting from a child.
- **Account deletion** that the person can do themselves. Apple requires it in-app for any app that
  creates accounts. Today deletion is an admin's soft delete within one organization; a person
  erasing their own account across every organization is new (and ties to roadmap A3, retention).
- **A support contact and a way to report a problem.**

### Also before a public launch, though not blocking

- **A real domain.** For example `aimtrue.com`, or whatever the owner holds.
  - Sign in with Apple on the web needs registered domains and return addresses.
  - Link previews and trust are better on a real domain than on `*.workers.dev`.
  - Cookies stay first-party.
  - The institute keeps its own address.
- **The Google consent screen.** It should say **Aimtrue**, not the institute, with brand
  verification done. The app asks only for `openid`, `email` and `profile`, which need no security
  review.
  - Each address (the institute's and the public one) can keep its own OAuth client if the owner
    wants the institute's name shown on the institute's address.

---

## Design: the door and the spaces

### What a newcomer sees (Stage O1)

A person who signs in with no membership and no invitation gets a **Welcome** page instead of the
403. Nothing is written until they choose:

1. **"I have a code."** They type or open a join code or link that an organization's admins issued.
   It names the organization and the role (parent, student, tutor), may expire or have a use limit,
   and either joins them at once or files a **join request** the admins approve.
2. **"Practise at home."** Start a family space (Stage O2).
3. **"I teach."** Start a tutor space (Stage O5; until then, "coming soon" or a waitlist).

**The age question.** On this page, before anything is stored, the newcomer is asked for their
birth month and year. The question is neutral and gives no hint of the cut-off.

| Age | What follows |
| --- | --- |
| Under 13 | "Ask a parent to set up a family space for you." Nothing is stored. |
| 13-17 | They may join with a code. They may not start a space or share publicly. |
| 18 and over | Everything. |

Only the band and the date it was confirmed are kept, never the birth date. People already in an
organization are never asked: their organization vouched for them.

### Data (additive, all of it)

Following the rule that a `users` row is sign-in and contact only, the new person-level facts go in
their own platform tables:

```sql
-- Who a person may sign in as (Stage O4 fills it with more providers; O1 backfills Google).
CREATE TABLE user_identities (
  provider     TEXT NOT NULL CHECK (provider IN ('google', 'apple', 'microsoft', 'email')),
  subject      TEXT NOT NULL,               -- the provider's permanent id (Google sub, Apple sub, Microsoft oid+tid)
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  email_at_link TEXT,                       -- what the provider said when linked; never used to match later
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at TEXT,
  PRIMARY KEY (provider, subject)
);
INSERT INTO user_identities (provider, subject, user_id)
  SELECT 'google', google_sub, id FROM users WHERE google_sub IS NOT NULL;

-- A self-registered account's standing on the platform: age band and the terms accepted.
CREATE TABLE platform_accounts (
  user_id          TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  age_band         TEXT NOT NULL CHECK (age_band IN ('13-17', 'adult')),
  age_confirmed_at TEXT NOT NULL,
  terms_version    TEXT NOT NULL,
  terms_accepted_at TEXT NOT NULL
);

ALTER TABLE organizations ADD COLUMN kind TEXT NOT NULL DEFAULT 'institute'
  CHECK (kind IN ('institute', 'family', 'studio'));
ALTER TABLE organizations ADD COLUMN created_via TEXT NOT NULL DEFAULT 'console'
  CHECK (created_via IN ('console', 'self_serve'));
ALTER TABLE organizations ADD COLUMN quest_trusted INTEGER NOT NULL DEFAULT 0
  CHECK (quest_trusted IN (0, 1));
UPDATE organizations SET quest_trusted = 1;   -- every organization today was made by the platform

CREATE TABLE join_codes (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL REFERENCES organizations (id),
  role             TEXT NOT NULL CHECK (role IN ('parent', 'student', 'tutor')),
  code_hash        TEXT NOT NULL UNIQUE,      -- stored hashed, never plain (as F1's lesson codes)
  needs_approval   INTEGER NOT NULL DEFAULT 1 CHECK (needs_approval IN (0, 1)),
  max_uses         INTEGER,
  uses             INTEGER NOT NULL DEFAULT 0,
  expires_at       TEXT,
  created_by       TEXT NOT NULL REFERENCES users (id),
  revoked_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
```

- **Join requests** are `org_members` rows in a new status `requested`. The CHECK on `status` cannot
  be altered in place, so it needs either a table rebuild done by hand in production, or a separate
  `join_requests` table. The separate table is the additive choice.
- **Consent** uses the `consents` table from F7, with a first purpose `child_account`.
- **Triggers.** The new organization-rooted table (`join_codes`) gets the same `BEFORE INSERT`
  membership trigger and `BEFORE UPDATE OF organization_id` guard as the other root tables.
- **The scope check.** `scripts/check-org-scope.mjs` learns the new tables.

### The family space (Stage O2)

- **Who.** A parent creates it, and is its admin and the guardian of every child in it. A second
  parent is invited by email: an explicit accept (blocker 2).
- **Children** are student profiles with no email, as today, which keeps the guardian rule
  intact. Adding the first child asks for the parent's consent (`child_account`), worded with the
  lawyer.
- **How a child plays: on the parent's device.** "Continue as Sofia" (F1) issues a child session
  that acts as the student. It records the guardian for the audit, cannot reach Finance or any
  money, and has no share button.
- **Consent method.** For a free product, the "email plus" method (for internal use only, with a
  confirming email to the parent) is the usual low-cost route. A card check is stronger and comes
  with paid plans. The lawyer decides which.
- **What it offers.** By default: Question Quest, Assessments (approved bank questions only),
  progress against a curriculum the parent picks, and Quest Games inside the family.
  - The tutoring, money and 1099 pages are hidden for `kind = 'family'`. The roles still exist, so
    nothing in the data model changes.
- **Who reviews Quest answers.** The parent holds the tutor role in their own space, so Quest's
  review screen works. Their approvals become suggestions (blocker 4).
- **Limits.** For example up to 2 adults and 6 children per family space, 3 spaces per person, and
  no AI. These are tunable.

### The tutor space (Stage O5)

- **What it is.** The portal as it is today, for a solo tutor or a small club: their own students
  and families, lessons, money, Quest.
- **What it brings.** The product side the funding plan already notes: self-serve trial, limits,
  and eventually billing.
- **Approvals.** It starts untrusted for Quest approvals, until a platform admin trusts it.
- **Why later.** The most valuable door, but also the one that invites strangers to type other
  people's children into the portal. It needs blockers 2-5, F7, and a deletion and retention policy
  in place first.

### Exposure

- **New rules.** The spaces add no new kind of row a non-admin can read across organizations, but
  they need rules of their own: R21 for join codes and requests, R22 for public share pages.
- **What the crawl adds.**
  - A family-space persona (parent, and a child session).
  - A stranger signed in with no organization, who must read nothing but their own Welcome page.
  - A check that an invitation from a self-serve space never reveals the invitee's stored name.

---

## Other sign-in methods

| Method | Why | Cost and effort | Watch out for | Verdict |
| --- | --- | --- | --- | --- |
| **Google** (today) | Most families and tutors have one | Done | Publish the consent screen under Aimtrue with brand verification | Keep |
| **Apple** | Required on iOS (guideline 4.8) once a public app offers Google sign-in. The exemption for "an education, enterprise, or business app" with an existing account stops fitting once anyone may sign up. Also iPhone families without Gmail | Apple Developer Program, $99/year (a free personal team cannot use the capability), and a Services ID for the web | Covered below | **Needed before the app goes to the public App Store**; web at the same time, for parity |
| **Microsoft** | Schools on Microsoft 365, Outlook and Hotmail users | Free Entra app registration; tokens verified with `jose` like Google's | Match on the token's `oid` plus `tid`, never on `email`: in a work or school tenant the email claim can be set by the tenant's own admins (the "nOAuth" class of takeover). Treat it as verified only for personal accounts, or where Microsoft marks the domain verified | Worth it for schools; second wave |
| **Email magic link** | Anyone without Google, Apple or Microsoft; grandparents; work addresses | Needs an email sender that reaches ANY address. Today's `send_email` binding reaches only verified destinations, so this needs Cloudflare's paid email sending or a provider such as Postmark or Resend | Link expiry and single use (store the hash only); rate limits and Turnstile; the address is the identity, so it is verified by the click | Worth it; second wave |
| **Passkeys** | The best second factor and a fast return sign-in | WebAuthn in the browser; the app needs native modules | Recovery when the device is lost goes back to email or Google | Later, as an addition to an account, not a way to create one |
| **Facebook** | Some parents | Meta app review; teen restrictions | Little reach among students; Meta's own child-safety issues; one more privacy policy to name | Not recommended |
| **Clever / ClassLink** | Schools (the C-series in the Canvas analysis) | Partner programmes and district agreements | FERPA "school official" duties | Only with a partner school |

### Sign in with Apple, specifically

- **Email.** Apple sends the name and email **only on the first authorization**. Store them then,
  or they are gone.
- **Hide My Email.** A person who chooses it gives a `privaterelay.appleid.com` address. Such an
  address will never match an invitation sent to their real address, so linking (below) is how they
  join an organization that invited them. Mail to relay addresses is delivered only from sending
  domains registered with Apple.
- **Deleting an account.** It must revoke the person's Apple tokens through Apple's REST API.
  That means keeping the refresh token, or asking them to sign in again at deletion. It also means
  a `client_secret`: a JWT signed with the developer key, which WebCrypto in the Worker can make.
- **Server-to-server notifications** (email changed, consent withdrawn, account deleted) should
  reach a public endpoint. That endpoint belongs in `publicRoutes`, deliberately.

### Linking identities, and the rule that keeps it safe

- **Every provider id is a row.** Sign-in looks it up by `(provider, subject)` first, as it does
  with `google_sub` today.
- **Matching a new identity by email** is allowed only when:
  1. the provider says the email is verified;
  2. the email is not an Apple relay address;
  3. the matching person has no identity from that provider yet.

  This is today's `pinnedToAnother` rule, generalised.
- **Linking while signed in.** "Add another way to sign in" in the person's profile attaches a
  second provider to the same person. It is logged on the platform log, as `auth.*` is today.
- **Unlinking.** The last way in cannot be unlinked.
- **The boundary.** `verifyGoogleIdToken` stays the only place a Google token becomes an identity.
  Each provider gets its own verifier beside it (`lib/apple.ts`, `lib/microsoft.ts`,
  `lib/email-link.ts`), and nothing else may turn a token into a person.
- **The app.** It signs in through the same endpoints, each provider with its native SDK, and keeps
  the same `tmi_session` cookie.

---

## Sharing Quest on social media

### What is worth sharing

| Moment | The card says | Built from |
| --- | --- | --- |
| A Quest Game result (Phase 46-48) | "Grade 5 · Knockout · 2nd of 5 teams · 9/10" | The reader's own team's result, never teammates' names |
| A level finished in Question Quest (Phase 42) | "Finished Algebra Level 3 · 120 questions" | The person's own level and count |
| A milestone (Phase 44, when built) | "Four weeks in a row" | Weekly cadence, as the research recommends, not daily streaks |
| **"Can you solve this?"** | One approved question, its level, and "I got it in 40 seconds" | A bank question, `approved` only |

The fourth is the one that brings people in. A visitor answers it on a public page without signing
in, sees the worked solution, and is offered "Play more on Aimtrue", which leads to the Welcome page.

### Rules for what a share may carry

These follow the COPPA notes already in `research_notes/` and the 2026-10-21 gamification report.

- **No child is ever named on a public page.**
  - A child session has no share button.
  - A parent may share their child's result as "A Grade 5 player".
  - An adult may show their own first name, chosen at the moment of sharing; the default is none.
- **No other player is named,** whatever their age: a game result shows the sharer's own team only.
- **No free text.** No caption, no comment, no reply on the public page. A page with no
  user-written text is not user-generated content: nothing to moderate, nothing for Apple's
  guideline 1.2 to ask about. The person adds their own words in the app they share into.
- **No organization name by default.** An institute may choose to show its own name on its members'
  cards; a family space never does.
- **No leaderboard, and no points for sharing.** Rewarding a share is against both Apple's
  guidelines and Meta's, and is the social-pressure pattern Vermont's proposed rules name.
- **Revocable.** A share is a row its maker can withdraw, after which the page answers "no longer
  available". Shares expire after, for example, a year.
- **Keys stay hidden until answered.** A challenge page checks the visitor's answer on the server
  (`checkAnswer`), shows the solution afterwards, and is rate-limited, so the bank cannot be scraped
  through share links.
- **No age restriction is needed for viewing.** The pages are public and contain no personal
  information. Making a share needs a 13+ account (adult for a child's result).

### How it works

1. **The share row.** `shares` (id: 12+ random characters; organization, maker, kind, a JSON
   snapshot of the card's numbers, created, expires, revoked).
   - The snapshot is taken when the share is made, so the page never re-reads the game or the
     person.
   - Viewing the page costs one primary-key read, cached at the edge.
   - View counts go to Workers Analytics Engine, not D1: a write per view would spend the daily
     write limit.
2. **The public page.** `GET /s/:id`, the only new public read, added to `publicRoutes` on purpose.
   - The Worker serves the SPA's `index.html` with the card's `og:title`, `og:description` and
     `og:image` written in by `HTMLRewriter`. The assets need `run_worker_first` for `/s/*`.
   - Why server-side: X, Facebook, LinkedIn, WhatsApp, iMessage, Slack and Discord read those tags
     without running JavaScript.
3. **The preview image** (`og:image`).
   - **First:** a small set of static PNGs per kind (and per level family), made at build time.
     The numbers go in the title and description.
   - **Later:** a per-share image from `satori` with `resvg` as WASM (`workers-og`), cached in R2
     or the Cache API. That needs Workers Paid: rendering takes far more than the free plan's 10 ms
     of CPU per request.
4. **The image people post.** Made on the device, not the server.
   - **Web:** draw the card onto a `<canvas>`, `toBlob`, then `navigator.share({ files, text, url })`
     where `navigator.canShare` says files are supported (mobile Safari and Chrome do), else
     download the image and copy the text.
   - **App:** `react-native-view-shot` and the system share sheet.
   - This is the only route into Instagram, TikTok and Snapchat stories, which take an image but
     have no web share link.
5. **Copyable text.** Wordle style: "Aimtrue Quest · Grade 5 · 9/10 🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩", plus
   the link. It costs nothing and works in every chat app and in Discord.
6. **Direct buttons**, as a fallback where the system share sheet is missing (desktop):
   - X: `x.com/intent/post?text=&url=`
   - Facebook: `facebook.com/sharer/sharer.php?u=`, which takes the URL only and reads the rest
     from the page's tags
   - LinkedIn: `linkedin.com/sharing/share-offsite/?url=`
   - WhatsApp: `wa.me/?text=`
   - Reddit
   - email
7. **Game invitations stay inside an organization.** A Quest Game's join code is found only in its
   own organization (R20). A shared game link therefore works only for members, and says
   "ask the host to add you" to anyone else. Public cross-organization games come later
   (see below).
8. **Audit.** "Shared a Quest result" or "Withdrew a share", in the organization's log, without the
   numbers, as answers and scores are kept out of the log today.

### Parity

The share button, the card and the system share sheet ship on web and app together. The public
page is web only by nature, since it is what a link opens. A link opened on a phone with the app
installed can open the app instead (universal links and app links on the real domain).

---

## Costs

| Item | Cost | When |
| --- | --- | --- |
| Workers Paid | $5/month (includes D1, Workers, Durable Objects allowances far above today's use) | Before Stage O1 |
| Domain | about $10-15/year | Before Stage O1 (link previews, Apple on the web) |
| Turnstile | Free | O1 |
| Apple Developer Program | $99/year | Before the app's public release or Sign in with Apple |
| Google Play developer account | $25 once | Before the Android public release |
| Email to any address (magic links, invitations) | Free tier of a provider, or Cloudflare's paid sending | O4 |
| A lawyer's review: privacy policy, children's notice, consent wording, terms | Unknown; the largest item | Before O2 (children); ideally before O1 |
| AI | Nothing new: self-serve spaces have no AI tasks | — |

---

## Proposed stages

Sizes are S, M and L, as in the roadmap. Each stage ships on web and app together unless the owner
says otherwise.

| Stage | What | Needs | Size |
| --- | --- | --- | --- |
| **O0 · Groundwork** | No visible change. Workers Paid. Fix blockers 2-5: auto-accept only from platform-made organizations; no stored name or phone for an invitee before they accept; Quest's trusted flag; email caps. Rate limits and Turnstile on the auth routes. Privacy policy, terms, the children's notice; a person can delete their own account. | Owner's decisions 1, 4, 5 | M |
| **O1 · The door** | Anyone with a Google account signs in. Welcome page, age question, `platform_accounts`, `user_identities` (Google backfilled), join codes and join requests. The domain and the Aimtrue consent screen. | O0 | M |
| **O2 · Family spaces** | Self-serve family organizations; children without email; "Continue as" (F1's first half); the `child_account` consent (F7's first slice); defaults and limits per kind. | O1, the lawyer's wording | L |
| **O3 · Sharing** | Share rows, the public page with link previews, the result card as text and image, "Can you solve this?", withdrawal. | O0 (public routes need the rate limits); most useful after O2 | M |
| **O4 · More ways in** | Sign in with Apple (web and iOS), Microsoft, email magic links; linking and unlinking. | O1; the Apple Developer Program; an email sender | M |
| **O5 · Tutor spaces** | Self-serve studios: the full portal for a solo tutor or club, with limits and an upgrade path. | O2, F7 complete, retention (A3) | L |
| **App store release** | The app goes to the public App Store and Play Store. Sign in with Apple, in-app account deletion, the privacy labels, the age rating, and age signals: Apple's Declared Age Range and Google Play's Age Signals APIs, which Texas's law now leans on. | O4's Apple half | M |

Suggested order: **O0 → O1 → O2 → O3 → O4 → O5**. O3 can move ahead of O2 if the institute's own
families are to share first. The app's public release waits for O4's Apple half. Until then, the
app stays for invited organizations, and the web is the public door.

### Later, not in these stages

- **Games between friends in different families.** This needs a guardian's consent per child
  (`cross_org_competition`, already proposed in the 2026-10-23 challenge-platform report), no chat
  of any kind, and first names or handles only. It is the step that most resembles the cases the
  FTC has pursued, so it comes last.
- **Open challenges across the platform.** Platform-run events with divisions by level, as in the
  same report's Phase C.
- **Passkeys; Clever and ClassLink** for partner schools.

---

## Decisions for the owner

1. **Where a stranger lands.** Join by code, then family spaces, then tutor spaces (recommended)?
   Or tutor spaces first, as the product to sell?
2. **Minimum age for one's own account.** Recommended: 18 to start a space or share; 13 to join
   with a code; under 13 only as a child in a parent's space.
3. **Web first?** Recommended: the public door opens on the web, and the app follows at its
   store release with Sign in with Apple. That would be a recorded exception to feature parity,
   for the sign-up flow only; the parity rule needs the owner's word for it.
4. **Workers Paid at $5/month.** Required before O1.
5. **A lawyer's review** of the privacy policy, the children's notice and the consent wording:
   before O1, or at least before O2.
6. **Quest approvals from self-serve spaces.** Suggestions to the console only (recommended), or
   approved once two independent organizations agree?
7. **Free, or free with limits and a paid tier?** This shapes O5 and the consent method: a card
   check is a stronger consent method and comes with paid plans.
8. **Names on shares.** Recommended: none for children, ever; an adult's own first name only when
   they choose it.
9. **The public domain,** and whether the institute's address keeps the institute's name on Google's
   consent screen.
10. **The invite fix for institutes too.** Showing an invitee's stored name to an admin before they
    accept arguably should stop everywhere, not only in self-serve spaces.

---

## Sources

Checked 2026-10-23.

- **Cloudflare**
  - [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
  - [D1 free-tier limit enforcement, 2026-09-01](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)
  - [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
  - [Dynamic OG images on Workers](https://developers.cloudflare.com/workers/tutorials/generate-dynamic-og-images-using-workers)
  - [workers-og](https://cdn.jsdelivr.net/npm/workers-og@0.0.27/README.md)
- **Apple**
  - [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): 4.8, 5.1.1(v), 1.2 and 5.1.4
  - [Guideline 4.8 rejections, forum](https://developer.apple.com/forums/thread/765145)
  - [Revoking Sign in with Apple tokens on account deletion, TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple.md)
  - [Revoke tokens REST API](https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens.md)
  - [Forum: revoking with the REST API](https://developer.apple.com/forums/thread/707364)
- **Microsoft**
  - [Claims validation, Microsoft identity platform](https://learn.microsoft.com/lt-lt/Entra/identity-platform/claims-validation)
- **Age signals**
  - [Apple and Google age-signal APIs under the app store accountability acts (Lexology)](https://www.lexology.com/library/detail.aspx?g=fe0111a4-bee7-4171-981f-dbc344bf1cb4)
  - [Age verification laws for apps (Median)](https://median.co/blog/new-age-verification-laws-2026)
  - [App store age verification (Aptoide)](https://connect.aptoide.com/blog/app-store-age-verification)

  These are secondary sources; check Apple's and Google's own documentation before building.
- **Google**
  - [Family Link: children signing into third-party apps (2021)](https://www.androidpolice.com/2021/06/10/google-accounts-for-kids-can-now-finally-sign-into-third-party-apps/)
  - [Create a Google Account for your child](https://support.google.com/families/answer/7103338?hl=en)
  - `docs/google-oauth-setup.md` (basic scopes need no verification review)
- **Web Share API**
  - [web.dev: Web Share](https://web.dev/articles/web-share)
- **Children's privacy**
  - `research_notes/Math challenge platforms market/market_business_regulation.md`, section 4 (COPPA as amended, Epic, Apple and Google Play family rules)
  - `reports/Question Quest gamification market.md` (persuasive design, Vermont)
  - Roadmap [F1](feature-plans.md#f1--students-who-have-no-email-can-still-take-part) and [F7](feature-plans.md#f7--consent-and-privacy-centre)
