# Everything on main and in production, stably (owner, 2026-10-29)

The owner wants every piece of open work on `main` and released, so the next stretch can go to the AI
canvas (`docs/think-aloud-plan.md`). Worked one step at a time, in this order; tick each when done.

Decisions already made (2026-10-29):
- `sharing` holds **Phases 54-56** (tutor spaces with organizations, more ways to sign in, sharing Quest) and
  keeps its numbers. The Handwriting lab (`claude/great-turing-em8i3e`, called Phase 54 there) becomes
  **Phase 57**.
- Each sign-in provider is switched on only after its setup is done: it is offered by a Worker only while it is
  in that Worker's `AUTH_PROVIDERS` AND its ids are configured. Each one is added to the demo first, then to
  the production pair, then ticked here.
- **Apple stays off**, Apple sign-in and the paid Apple Developer account both: the code is merged, and it is
  untested until the account exists (`AUTH_PROVIDERS` without `apple`; the app built without
  `EXPO_PUBLIC_APPLE_SIGN_IN`).

## A. Terms and privacy

- [x] A1. The owner reviews the current wording (`packages/shared/src/legal.ts`, version 2026-10-24) and the
      gaps listed for it, and answers the open questions (who "we" is, the contact address, governing law,
      a lawyer's review).
- [x] A2. New wording, version 2026-10-29, covering what Phases 54-57 add: other sign-in providers,
      public share cards and Turnstile, the Handwriting lab's use of Claude, dictation, cookies, spaces paid
      directly. `LEGAL_DRAFT` stays true.
- [x] A3. The owner approves the final text, and `LEGAL_DRAFT` goes false. Sign-up stays closed until G.

  Done 2026-10-29. The owner's answers: "we" is Aimtrue alone, no person or company named; no contact
  address yet (people ask a space's administrators; a platform address later is a new version); North
  Carolina law; a child's work is "never sent to an AI provider" until parental consent for AI exists (then a
  new version); the owner's approval stands without a lawyer's review. It reaches production with the next
  deploy (C3).

## B. Phases 54-56 (`sharing`) onto main

- [x] B1. `sharing` pushed to GitHub (2026-10-29; it existed only on the Mac).
- [x] B2. Merge `main` into `sharing` (33 commits behind): `docs/plan.md`, `docs/database.md`, `CLAUDE.md`,
      the shared package and the app's routes are the likely conflicts. `RELEASE_PHASE` to 56.
- [x] B3. Gates: `npm run typecheck`; the full local web suite; the app's Jest; the app's new flows and
      `npm run smoke -- mobile` on iOS and Android (release builds); `npm run test:compat` against
      `release-20261029-qb`.
- [x] B4. Apple off and recorded as untested in `docs/plan.md` and `docs/sign-in-providers-setup.md`.

  Done 2026-10-29: the merge conflicted only in two app flows, which both sides had fixed the same way
  (main's kept). Gates: web 291 passed; Jest 1,038 (after the terms' new date reached `spaces.js`); smoke
  and the eight new flows on iOS and Android; `test:compat` green. Two iOS flows were fixed for
  flakiness, with no check loosened: `assess-home` closes its sheet by the backdrop, not a swipe; `sign-up`
  no longer fails when iOS will not hide the year search's keyboard.
- [x] B5. Merged into `main`, pushed (2026-10-29, a8a6441).

## C. Phases 54-56 into production

- [x] C1. Back up `tutoring-db`.
- [x] C2. Apply the `release=phase-54`, `-55` and `-56` blocks from `docs/database.md`; read-only checks of the
      new queries.
- [x] C3. `npm run deploy` (both Workers), `AUTH_PROVIDERS` "google"; smoke both addresses. Public answers to a
      shared question are refused until Turnstile is set up (E5).
- [x] C4. The demo: `npm run deploy:test` and the same SQL there. Tag `release-YYYYMMDD`.

  Released 2026-10-29, tag `release-20261029-p56`: backup
  `~/tmi-portal-backups/tutoring-db-20261029-144747-pre-phase54-56.sql` (52 MB); none of the new objects existed
  beforehand; the three blocks applied in one file (57 rows written: 3 spaces each given their own organization,
  6 Google sign-ins carried into `user_identities`, 5 triggers); both Workers deployed (`tmi-portal` a07341db,
  `tutoring` e5005c3a); both addresses answer health, the SPA and `/privacy`, 401 on data routes without a
  session, `/s/<unknown>` "no longer available"; providers `google` only, sign-up closed.

  The demo went first, on 2026-10-29, so the providers can be tried there (E): the phase-54-56 SQL and
  `db/test-only.sql` applied (3 spaces, 3 organizations linked; 5 triggers), then deployed. Wrangler reported
  the SQL import as failed while it had in fact applied: check what exists before re-running a block.

## D. The Handwriting lab as Phase 57

- [ ] D1. Renumber on its branch: the plan, its `docs/database.md` block (`release=phase-57`), the app's build
      log, progress and parity rows, and code comments.
- [ ] D2. Merge `main` in; the same gates as B3.
- [ ] D3. Release as C (backup, its SQL, deploy, smoke, tag). Platform admins only; `ANTHROPIC_API_KEY` is
      already a secret on the production pair.

## E. Sign-in providers and Turnstile, one at a time

For each: the setup in `docs/sign-in-providers-setup.md` → the ids on the demo Worker, then added to its
`AUTH_PROVIDERS` → signed in on the demo, web and app → the same on the production pair → ticked.

- [x] E1. Google (on since Phase 1).
- [ ] E2. Microsoft (personal and work or school accounts).
  - 2026-10-29: Entra app registered (client ID `58cbca0a-7c76-4734-ae71-7fd76fd85e67`, in `MICROSOFT_CLIENT_ID`
    on all three Workers). **On the demo** (`AUTH_PROVIDERS` "google,microsoft,facebook", version ccf71d5e):
    `/api/auth/config` offers it, `/api/auth/microsoft/start` redirects to Microsoft with the demo's callback.
    The app needs no rebuild for it (its client ID comes from the server, its `aimtrue-test://auth/microsoft`
    return is the scheme it already has). Still owed: a sign-in on the web and in the app, then production.
- [ ] E3. Facebook, including App Review for the `email` permission before the public can use it.
  - 2026-10-29: Meta app made (App ID `2103586157027324`, in `FACEBOOK_APP_ID` on all three Workers; the
    App Secret set on all three by the owner). **On the demo** (`AUTH_PROVIDERS` "google,facebook",
    version 374c98e5): `/api/auth/config` offers it, `/api/auth/facebook/start` redirects to Facebook with
    the demo's callback. The AimTrue-Test app (built with `EXPO_PUBLIC_FACEBOOK_APP_ID`) is on the iPad and Nav's iPhone.
    **First Facebook sign-in, 2026-10-29 22:01 UTC, in the app:** `POST /api/auth/facebook` 200, a
    `facebook` row in `user_identities` joined by email to the owner's existing account (beside Google),
    audit "Nav Dessai signed in with Facebook". Meta needed three fixes on the way: the iOS platform with the
    bundle ids, the redirect list, and the `email` permission added to the use case. Still owed: a sign-in
    on the web, then the production pair, then App Review.
- [ ] E4. Apple: **later**, with the paid Apple Developer account. Off until then.
- [ ] E5. Turnstile (Phase 56): a site in Cloudflare, `TURNSTILE_SITE_KEY` in vars and `TURNSTILE_SECRET` as a
      secret, on the demo, then production.

## F. Other setup

- [ ] F1. Google Cloud: the demo's address on the web client; an iOS OAuth client for `com.aimtrue.app.test`
      (AimTrue-Test); confirm the Android client signs in with the renamed app.
- [ ] F2. Email notices: a sender on a domain of the production account (`EMAIL_FROM`), or leave them off.
- [ ] F3. Om's iPhone: today's build installed.
- [ ] F4. Questions: 50,068 `checked` and none approved (2026-10-29); approving goes on in the console.

## G. Open sign-up

- [ ] G1. After A3 and the owner's word: `SIGNUP_OPEN` "true" on the production pair, deploy, smoke.

## H. Tidy up

- [ ] H1. With the owner's OK, delete the merged and superseded branches: `open-signup`, `social-login`, `p50`,
      `p51`, `p52`, `mobile-app`, `orgsupport`, `ui-enhancements`, `phase34-main`, `phase35*`, the
      `worktree-agent-*` branches and the merged `claude/*` branches.

Then: the AI canvas.
