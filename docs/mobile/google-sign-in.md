# Google sign-in in the mobile app

**Decided by the owner on 2026-10-10:** Google sign-in comes before TestFlight. Every API
expects a signed-in user, and the app's only way in so far is the developer sign-in, which
works only on servers with sign-in switched off.

## How it works: no API change needed

The Worker already has everything the app needs.

1. The app runs **native Google Sign-In** (`@react-native-google-signin/google-signin`),
   configured with the portal's existing **web client ID** as `webClientId`. Google then issues
   an **ID token whose audience is the web client**, which is exactly what
   `verifyGoogleIdToken` already accepts (`apps/api/src/lib/google.ts`). That function stays
   the only place an email becomes an identity.
2. The app posts the token to the existing **`POST /api/auth/google { credential }`**. The
   Worker answers with the same session it gives the browser: the `tmi_session` cookie
   (HttpOnly, SameSite=Lax, 12 hours, Secure in production).
3. React Native keeps that cookie and sends it on later requests when they use
   `credentials: 'include'`: iOS through URLSession's cookie store, Android through OkHttp's
   cookie jar. The app keeps adding `X-Organization` on every request, as the web does.
4. Signing out calls the existing `POST /api/auth/logout`, which clears the cookie, and
   `GoogleSignin.signOut()`.

So the app can sign in against **production as it stands**: no API edit, no merge, no release.
A Bearer-token session (`Authorization` header, token kept in SecureStore) stays an optional
later hardening. It is no longer a blocker.

What does **not** change:
- The server still matches the Google account's email to a live person. An unknown email gets
  `403 no_account`, an unverified one `403 email_unverified`, and a suspended person is refused
  as on the web.
- `X-Dev-User` is ignored by any server with sign-in on.
- The developer sign-in stays in development and e2e builds, for servers with sign-in off.

---

## A. Owner: Google Cloud (only you can do these)

Use the **same Google Cloud project** as the web client
`866980945062-aoh0gotj6fld07cd9gtkeo7p0hdu9gsa.apps.googleusercontent.com`, under
APIs & Services → Credentials.

> **Renamed on 2026-10-13.** The app's bundle IDs changed from `com.tutorportal.app…` to
> `com.aimtrue.app…` when the platform became Aimtrue. An OAuth client is tied to the bundle ID
> (iOS) or package name (Android) it was created with, so clients made before that date no
> longer match: create new ones for the IDs below and replace the values in
> `apps/mobile/.env.local`. The web client is unchanged.

- [ ] **A1. iOS OAuth clients**, one per bundle ID that should be able to sign in (Create
  credentials → OAuth client ID → iOS):

  | Build | Bundle ID | Needed for |
  | --- | --- | --- |
  | development | `com.aimtrue.app.dev` | trying it now on the simulator and your iPhone |
  | production | `com.aimtrue.app` | TestFlight and the App Store |

  The e2e build (`com.aimtrue.app.e2e`) needs none: its tests use the developer sign-in.
  For each client, send me its **client ID**. Its reversed form (`com.googleusercontent.apps.…`)
  becomes the app's URL scheme.
- [ ] **A2. Android OAuth clients**, one per package and signing key (Create credentials →
  OAuth client ID → Android):

  | Build | Package | SHA-1 |
  | --- | --- | --- |
  | development (debug key on this Mac) | `com.aimtrue.app.dev` | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
  | production | `com.aimtrue.app` | the Play app-signing key's SHA-1 (later, from Play Console) |

  Android needs no client ID inside the app. The client only has to exist, with the right
  package and SHA-1, for Google to issue a token for the web client.
- [ ] **A3. OAuth consent screen.** The scopes are only `openid`, `email` and `profile`, which
  are non-sensitive, so Google needs no verification.
  - If its status is **Testing**, add every Google account that should sign in as a test user.
  - Otherwise publish it (**In production**).

  The web portal already uses this screen, so it's probably set up.
- [ ] **A4. People exist in the portal.** A Google account signs in only if a live person in
  the portal has that email (the same rule as the web). To try it locally, use an account the
  local seed knows. `ndessai@gmail.com` is the seeded platform admin. Alternatively, add your
  account to an organization in the local database.

Until A1 arrives, the app is built and tested with the IDs as placeholders. The Google button
stays hidden while they're missing.

## B. Engineering (I do these, on `mobile-app`)

- [ ] **B1. The library.**
  - Install `@react-native-google-signin/google-signin` (16.x, peer `expo >= 52`) with
    `npx expo install`.
  - Add its config plugin with `iosUrlScheme` from the reversed iOS client ID, per variant.
  - Do a native rebuild of both apps.
- [ ] **B2. Configuration** (`app.config.ts`, `.env.example`; values come from the
  environment, never hard-coded beyond the public web client ID):
  - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_DEV` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (production).
  - The web client ID comes from `GET /api/auth/config` (`google_client_id`) at runtime, with
    a fallback to `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
  - `EXPO_PUBLIC_PRODUCTION_API_URL=https://tutoring.om-ndessai.workers.dev`, the
    multi-organization address, never `tmi-portal`.
- [ ] **B3. The API client.** `credentials: 'include'` so the session cookie is stored and sent.
  It no longer adds `X-Dev-User` once a Google session exists.
- [ ] **B4. The auth provider**, matching the web's `signInWithGoogle`:
  - **Sign in:** `GoogleSignin.signIn()`, then the ID token, then `POST /auth/google`, then
    load the session. Landing, organization choice and `POST /auth/enter` work as they do now.
  - **Boot:** when the server reports `auth_enabled`, `GET /auth/session` with the stored
    cookie decides whether the person is signed in or signed out.
  - **401 mid-use** (the 12-hour session ended): try `GoogleSignin.signInSilently()`, then
    exchange the token again and retry once. Otherwise go to sign-in.
  - **Sign out:** `POST /auth/logout`, `GoogleSignin.signOut()`, clear the query cache and the
    organization.
  - **Errors in the web's words** (`AUTH_ERROR_CODES`): no account, unverified email,
    suspended, cancelled by the person (no error shown), Play Services missing (Android).
- [ ] **B5. The sign-in screen.**
  - A Google button (Google's branding rules: the "G" mark and "Sign in with Google") when the
    server has sign-in on and the IDs are configured.
  - The developer sign-in when the server has sign-in off (development and e2e builds only).
  - A plain message when neither applies.
- [ ] **B6. The production variant** points at the production URL. Its server picker shows
  production only, with no developer sign-in.
- [ ] **B7. Tests:**
  - **Jest:** the auth provider with a mocked GoogleSignin (success, `no_account`, cancelled,
    a silent re-sign-in after a 401, sign-out clears everything) and the API client's
    credentials.
  - **The existing Maestro suite stays on the developer sign-in.** The runner keeps the local
    Worker's sign-in off. Re-run smoke and a sample of flows on both platforms.
  - **By hand, once A1 and A2 are done:**
    1. Switch the local Worker's sign-in on: `AUTH_ENABLED=true` in the uncommitted
       `apps/api/.dev.vars`, and restart `npm run dev:api`.
    2. On the simulator and the emulator, sign in with your Google account.
    3. Check landing and an organization's screens, then sign out.
    4. Put `.dev.vars` back.
- [ ] **B8. Docs:** a mobile section in `docs/google-oauth-setup.md`, and one line in
  CLAUDE.md: the app signs in through the same `/auth/google` route and carries the same
  session cookie, identity only.

## C. Checked against production (after A1 and B)

- [ ] **C1. Against production, no deploy needed:** a development build with the server set to
  production signs in with your account, enters your organization, and reads (doesn't edit)
  real screens. Then sign out. Do this only with your approval, since it uses real data.

## Order

| Step | Who | Time |
| --- | --- | --- |
| A1–A3 Google Cloud clients and consent screen | you | about 20 minutes |
| B1–B6 build | me | a few hours, plus a native rebuild |
| B7 tests (Jest and Maestro now; the real sign-in once A1 and A2 arrive) | me, with you for the Google account | about an hour |
| C1 production check | you approve | 15 minutes |

With sign-in done, [testflight.md](testflight.md) shrinks: its API-change and production-release
steps fall away, leaving Apple's accounts, the icon, the privacy manifest, the build and the
upload.
