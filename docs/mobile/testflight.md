# Getting the iOS app onto TestFlight

**Decided by the owner on 2026-10-10:** putting the app in testers' hands comes before the
rest of Phase 2 (B6–B8) and Phase 3 (dictation).

This checklist pulls forward what TestFlight needs: the iOS half of Phase 4 (Google sign-in) and
the iOS half of Phase 5 (signing, store records, builds). Android follows the same path later
(see the end).

> **Update (2026-10-10):** Google sign-in comes first. See [google-sign-in.md](google-sign-in.md).
> The app signs in through the existing `/auth/google` route and its session cookie, so **no API
> change and no production release are needed**. Items 2–3 below, A10, and B1's API part fall
> away.

## The one dependency that shapes everything

**A TestFlight user can't sign in to today's app.** Its only way in is the developer sign-in,
which:
- works only against a server with sign-in switched off (the local Worker, the demo);
- is compiled out of the production build.

Production (`tutoring`) has sign-in on. So "users can use it" means three things together:
1. **Google sign-in in the app.** This is Phase 4, iOS part.
2. **An additive API change**: the session as a Bearer token for the app, plus a native sign-in
   route. No schema change.
3. **That API change deployed to production** through the normal approved release, with both
   production Workers deployed together.

Everything else in this list is configuration, artwork, accounts and paperwork.

---

## A. Owner: accounts and decisions (only you can do these)

Start A1 today; it has the longest lead time.

- [ ] **A1. Apple Developer Program** ($99/year), at https://developer.apple.com/programs/enroll/
  - **Individual:** your legal name shows as the seller. Usually approved in 1–2 days.
  - **Organization:** the institute's or a company's name shows. Needs a D-U-N-S number and
    legal-entity checks, which can take one to two weeks.

  Decide which name testers (and later the App Store) should see. When it's done, tell me the
  **Team ID** (10 characters, under Membership).
- [ ] **A2. Bundle ID and app name.** These are permanent once the app record exists.
  - The plan uses `com.tutorportal.app` and the name "Tutor Portal", the platform's own name,
    because the app serves every organization.
  - Store names must be unique, so "Tutor Portal" may be taken. A suffix such as
    "Tutor Portal — Lessons" is fine.
  - Alternatively, use a reverse domain you own, e.g. `com.trianglemathinstitute.tutorportal`.
- [ ] **A3. App Store Connect app record**, at https://appstoreconnect.apple.com → Apps → +:
  name, bundle ID (from A2, registered under Identifiers), SKU (any string), primary language.
- [ ] **A4. Google Cloud: an iOS OAuth client**, in the same project as the web client
  `866980945062-…`. Go to APIs & Services → Credentials → Create credentials → OAuth client
  ID → iOS, with the bundle ID from A2.
  - Send me the **iOS client ID**. Its reversed form, `com.googleusercontent.apps.…`, becomes
    the app's URL scheme.
  - The OAuth consent screen must be **In production**, or limited to listed test users. Only
    test users can sign in until it's published.
- [ ] **A5. Expo account** (free) at https://expo.dev, for EAS Build and Submit.
  - The free plan includes a monthly allowance of iOS builds, which is enough for a beta.
  - Alternatively, I build locally with Xcode 27 and upload, which needs no Expo account.
- [ ] **A6. App Store Connect API key**, so builds can be uploaded without your password:
  Users and Access → Integrations → App Store Connect API → +, with the App Manager role.
  - Keep the `.p8` file; I need the Key ID and Issuer ID.
  - Alternatively, you sign in once interactively with `! npx eas-cli submit`.
- [ ] **A7. Privacy policy URL and support URL** (any public page). TestFlight external testing
  and the App Privacy section ask for them. Since students are often minors, say what is
  collected (name, email, lesson records), who sees it, and how to ask for deletion.
- [ ] **A8. Who tests first**
  - **Internal testers:** up to 100 people added in App Store Connect, no review, available
    as soon as a build is processed. They need to be App Store Connect users.
  - **External testers:** up to 10,000, by email or a public link. The first build of each
    version goes through Beta App Review, usually about a day.
- [ ] **A9. A reviewer's way in (external testing only).** Sign-in is Google-only, so Apple's
  reviewer needs a Google account that belongs to an organization.
  - Recommended: a **"Demo" organization in production**, created from the platform console,
    holding fictional people and lessons only.
  - Add a dedicated Google account (e.g. `tutorportal.review@gmail.com`) as its admin, and put
    those credentials in Beta App Review information.
  - Never give the reviewer access to a real organization.
- [ ] **A10. Approve the production release of the Phase 4 API change**, and choose how it
  reaches `main`:
  - **(a)** You review and merge `mobile-app` into `main`, then the normal release runs.
  - **(b)** I cherry-pick only the API commit onto `main` and release that, leaving the app on
    its branch.

  Production Workers deploy from `main`'s code, and both deploy together.

## B. Engineering (I do these, on `mobile-app`)

### B1. Phase 4 for iOS: Google sign-in

- [ ] **API** (additive, no schema change):
  - `sessionTokenFrom(c)` reads `Authorization: Bearer` first, then the cookie. `requireAuth`,
    `/auth/enter` and `/auth/logout` use it.
  - New `POST /api/auth/google/native`. It verifies the ID token with the existing
    `verifyGoogleIdToken` (audience is the existing web client id, so it is unchanged) and
    returns `{ token, expires_at, session }` without setting a cookie. It is audited as a
    sign-in from the mobile app.
  - CORS allows `Authorization`.
  - Database notes go in `docs/database.md` (none expected).
- [ ] **App:**
  - `@react-native-google-signin/google-signin`, configured with `webClientId` (the existing
    web client) and the iOS client ID from A4.
  - The token is stored in SecureStore and sent as Bearer. A 401 tries a silent re-sign-in,
    then falls back to the sign-in screen.
  - The production variant points at `https://tutoring.om-ndessai.workers.dev`, the
    multi-organization address, never `tmi-portal`.
- [ ] **Placeholders** for anything not yet supplied (`.env.example`, `app.config.ts`). The
  Google button stays hidden until they're filled.
- [ ] **Tests:**
  - The curl matrix on the local Worker with sign-in on (Bearer 200, missing 401, bad 401).
  - The full **web** Playwright suite on the local Worker, to show the web is unchanged.
  - A real Google sign-in on the simulator against the local Worker, with sign-in switched on
    locally.
- [ ] **CLAUDE.md:** one line saying a session token travels as the cookie on the web or as
  Bearer in the app, and is identity only.

### B2. A production build that's fit to ship

Done in T1 (2026-10-10) except where marked.

- [x] **App icon and splash.** A brand-neutral mark: the platform's π on the platform primary.
  - Sources in `apps/mobile/assets/source/*.svg`; `apps/mobile/scripts/render-icons.sh`
    (needs `brew install librsvg`) renders the PNGs.
  - iOS: an Icon Composer bundle, `assets/TutorPortal.icon` (Liquid Glass on iOS 26+, the
    system's dark/clear/tinted looks; Xcode renders the flat icon for older iOS).
  - `assets/images/icon.png`: 1024×1024, RGB, no alpha.
  - Android: adaptive foreground (inside the 66dp safe zone), a solid background and a
    monochrome icon.
  - The splash shows the π on the platform primary.
- [x] **Names.** `CFBundleName` and `CFBundleDisplayName` both follow the variant: "Tutor Portal",
  "Tutor Portal (dev)", "Tutor Portal (e2e)". Google's prompt reads "“Tutor Portal” Wants to Use
  “accounts.google.com” to Sign In". It used to read "TutorPortaldev", which was the product name.
- [x] **Info.plist:**
  - `ITSAppUsesNonExemptEncryption = false` (`ios.config.usesNonExemptEncryption`).
  - ATS: `NSAllowsLocalNetworking` in development and e2e only, and in a production build only
    when `EXPO_PUBLIC_PRODUCTION_API_URL` is `http://localhost…`, for the local check. Otherwise
    it is `NSAllowsArbitraryLoads = false` and nothing else.
  - Only the photo-library string (the console's logo upload). The camera, microphone and Face ID
    strings are gone, and Android blocks CAMERA and RECORD_AUDIO.
  - Dev-launcher leftovers in production: its local-network string is stripped in Release by its
    own build phase. `NSBonjourServices` (`_expo._tcp`) and the `exp+tutor-portal` scheme stay.
    Both are harmless.
- [x] **Privacy manifest** (`ios.privacyManifests` in `app.config.ts`):
  - No tracking and no tracking domains.
  - Collected, linked and for app functionality only: name, email, phone, physical address,
    user ID, other user content, other financial info, photos.
  - Required reasons: UserDefaults CA92.1, FileTimestamp C617.1, SystemBootTime 35F9.1,
    DiskSpace E174.1. These are checked against the pods' own PrivacyInfo files.
  - The App Privacy answers in App Store Connect must match.
- [x] **Versioning.** `version` 0.1.0. The build number belongs to EAS (`appVersionSource: remote`,
  `autoIncrement` on `production`).
- [~] **Production-only checks:**
  - No server picker, no developer sign-in, Google only (screenshot checked).
  - The `(dev)` routes, the `X-Dev-User` header name and the persona list are still **in** the
    production bundle. They are gated at runtime (`DEV_TOOLS`, and `devUser()` returns null in
    production), not compiled out. The server ignores `X-Dev-User` with sign-in on anyway.
  - Compiling them out is an optional hardening for later.
- [x] **`eas.json`.** Profiles `development`, `e2e` (simulator), `preview` (internal, production
  variant) and `production` (store, auto-increment). `submit.production.ios` holds empty
  `appleTeamId` and `ascAppId`.
- [x] **Release build check on the simulator.** The production variant was built in Release, with
  `EXPO_PUBLIC_PRODUCTION_API_URL=http://localhost:8787` and local sign-in on. It launches without
  Metro, the home-screen icon and name are right, and the sign-in screen shows Google only. A tap
  opens Google's prompt, which was cancelled. A full sign-in was already done in G2.
- [ ] **Crash reports.** TestFlight's own crash logs and screenshot feedback for the beta.
  Sentry can be added later if needed.
- [ ] **Optional: over-the-air updates** (EAS Update, on a `beta` channel). Not decided. It needs
  `expo-updates` inside the build, so decide before the first build.

### What T2 needs from the owner

T2 is deferred until there is a paid Apple account.

1. **Apple Team ID** (A1): 10 characters. It goes in `eas.json` → `submit.production.ios.appleTeamId`.
2. **App Store Connect app record** (A3) for bundle ID `com.tutorportal.app`. Its numeric Apple
   ID is the **`ascAppId`** in `eas.json`.
3. **Expo login** (A5) for `npx eas-cli build`, or an `EXPO_TOKEN`. After logging in, run
   `npx eas-cli init` once to link the project (it adds `extra.eas.projectId`), and run
   `npx eas-cli build:version:set` if a build number already exists.
4. **App Store Connect API key** (A6): Key ID, Issuer ID and the `.p8` file. Or sign in once
   interactively during `eas-cli submit`.
5. **EAS environment variable** `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` for the `preview` and
   `production` environments. `.env.local` is not uploaded, and without the variable the build
   hides the Google button.
6. Optional before external testing: A7 (privacy policy and support URLs) and A9 (the reviewer's
   demo organization).
7. **The Live Activity's extension (#45)** needs the team too. `expo-widgets` adds a second target,
   `ExpoWidgetsTarget` (bundle ID `com.tutorportal.app.ExpoWidgetsTarget`), and an App Group
   `group.com.tutorportal.app` shared by both; on a device both bundle IDs need provisioning
   profiles with that App Group, and the plugin always writes `aps-environment` (so the App ID needs
   Push Notifications enabled, though the app sends no pushes). EAS creates the profiles from the
   plugin's `extra.eas` entry once the team is known. The simulator needs none of this: it runs the
   activity unsigned, which is how #45 was checked.

### B3. Ship

- [ ] **Release the API** (A10): local suite green, then the normal release:
  1. Back up.
  2. Deploy both production Workers together.
  3. Smoke both addresses.
  4. Confirm the new route answers there.
- [ ] **Build and upload:** `npx eas-cli build -p ios --profile production`, then
  `npx eas-cli submit -p ios`, or archive with Xcode and upload with Transporter.
- [ ] **App Store Connect → TestFlight.** Once the build is processed (about 10–30 minutes):
  1. Add a "What to test" note.
  2. Add the internal group and invite yourself first.
  3. Install it on your iPhone and sign in with Google into your real organization.
- [ ] **Smoke on a real iPhone:**
  - sign in;
  - choose an organization;
  - Home on Tutoring and Finance;
  - record a lesson and check it on the web;
  - start and stop a live lesson;
  - switch organization;
  - sign out;
  - the privacy cover in the switcher.
- [ ] **External testing (if A8 says so):** fill in Beta App Review information (A9's demo
  account), submit the build for review, then invite testers or turn on the public link.

## C. Android, the same path afterwards

- [ ] **Google Play Console** ($25 one-time). On a new personal account, Google requires 12
  testers for 14 days on closed testing before production access. Internal testing is open
  immediately.
- [ ] **Signing.** An upload keystore, with Play App Signing on. Production builds also need
  FLAG_SECURE on the money screens, which is already in place.
- [ ] **An Android OAuth client** in Google Cloud: package name and the SHA-1 of the Play
  app-signing key. Add the debug SHA-1 for local builds.
- [ ] **The Data safety form**, a privacy policy, and an internal-testing release from
  `npx eas-cli build -p android --profile production` (an AAB).

## Order and rough timing

| Step | Who | Lead time |
| --- | --- | --- |
| A1 Apple enrollment | you | 1–2 days (individual) to 1–2 weeks (organization) |
| A2–A4 bundle ID, record, iOS OAuth client | you | under an hour once A1 is done |
| B1 Google sign-in plus API, with tests | me | about a day of work |
| B2 icon, plist, privacy manifest, `eas.json`, release check | me (art from you, optional) | half a day |
| A10 plus B3 API release | you approve, I run it | an hour |
| First TestFlight build to internal testers | me with A5/A6 | about an hour, plus Apple's processing |
| External testers | you (A7–A9), then Apple review | about 1 day of review |

**What I can start before A1 finishes:** all of B1 and B2. Only the Team ID, the iOS client ID
and the upload need your accounts.
