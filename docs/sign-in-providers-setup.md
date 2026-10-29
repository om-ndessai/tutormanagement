# Setting up Microsoft, Apple and Facebook sign-in (Phase 55)

Google stays the only way in until each provider below is set up and switched on. Everything is
built: switching one on is configuration, never code. Plan: `docs/social-login-plan.md`.

## The switch

Each Worker lists the providers it offers in `AUTH_PROVIDERS` (`apps/api/wrangler.jsonc`, restated
for `tmi-portal`, `tutoring` and `tutoring-test`):

```jsonc
"AUTH_PROVIDERS": "google,microsoft",
```

A listed provider is offered only once it is also configured (its ids in `vars`, its secrets with
`wrangler secret put`). Turn one on for `tutoring-test` first, try it by hand there, then production.
The two production Workers deploy together, so set both.

Each Worker's callback address must be registered with the provider:

| Worker | Callback base |
| --- | --- |
| `tmi-portal` | the institute's address |
| `tutoring` | `https://tutoring.om-ndessai.workers.dev` |
| `tutoring-test` | `https://tutoring-test.tmi-api.workers.dev` |

The callback for a provider is `<base>/api/auth/<provider>/callback`, for example
`https://tutoring.om-ndessai.workers.dev/api/auth/microsoft/callback`.

## Microsoft (personal and work or school accounts)

Step by step (2026-10-29), at https://entra.microsoft.com → Applications → App registrations →
**New registration**:

1. **Name:** Aimtrue.
2. **Supported account types:** "Accounts in any organizational directory and personal Microsoft accounts".
3. **Redirect URI:** platform **Web**, `https://tutoring-test.tmi-api.workers.dev/api/auth/microsoft/callback`.
   Register.
4. **Authentication** (the new app's page):
   - add two more **Web** redirect URIs:
     - `https://tutoring.om-ndessai.workers.dev/api/auth/microsoft/callback`
     - `https://tmi-portal.om-ndessai.workers.dev/api/auth/microsoft/callback`
   - tick **ID tokens** (the web flow posts an ID token back: `response_mode=form_post`);
   - **Add a platform → Mobile and desktop applications**, custom redirects `aimtrue://auth/microsoft` and
     `aimtrue-test://auth/microsoft` (AimTrue-Test).
5. **Token configuration → Add optional claim → ID →** tick `email` and `xms_edov`. `xms_edov` says a work or
   school tenant owns the address's domain; without it such an address is never matched to an account
   (personal accounts are always trusted).
6. Copy the **Application (client) ID** from Overview into `MICROSOFT_CLIENT_ID` on each Worker
   (`apps/api/wrangler.jsonc`). No secret is needed: the ID token is checked against Microsoft's published
   keys.
7. Add `microsoft` to `AUTH_PROVIDERS`: the demo first, signed in by hand there on the web and in the app,
   then the production pair.

Until the app's publisher is verified with Microsoft (Branding & properties → Publisher verification, which
needs a Microsoft Partner Network id), the consent screen marks it "unverified". Sign-in still works.

## Apple (waits for the paid Apple Developer Program)

**Off, and untested (owner, 2026-10-29).** The code is merged and released switched off: `apple` is in no
Worker's `AUTH_PROVIDERS`, and the app is built without `EXPO_PUBLIC_APPLE_SIGN_IN`. Nothing of it has run
against Apple yet; the first real test comes with the paid account. Expect fixes then.

1. Certificates, Identifiers & Profiles:
   - on the App ID (`com.aimtrue.app`, and the test app's), enable **Sign in with Apple**;
   - make a **Services ID** for the web (e.g. `com.aimtrue.web`), enable Sign in with Apple on it,
     and add each Worker's domain and `/api/auth/apple/callback` as return URLs;
   - make a **Key** with Sign in with Apple, and download the `.p8` once.
2. Server-to-server notification endpoint: `<base>/api/auth/apple/notifications`.
3. On each Worker:
   - `APPLE_SERVICES_ID` (the Services ID), `APPLE_BUNDLE_IDS` (`com.aimtrue.app,com.aimtrue.app.test`),
     `APPLE_TEAM_ID`, `APPLE_KEY_ID`;
   - `wrangler secret put APPLE_PRIVATE_KEY` (the `.p8`'s text). It signs the client secret that
     exchanges and revokes Apple's tokens: Apple requires revoking them when someone deletes their
     account.
4. The app: build with `EXPO_PUBLIC_APPLE_SIGN_IN=true` (off by default) under the paid team.
5. Add `apple` to `AUTH_PROVIDERS`.

## Facebook (the one Meta sign-in)

Instagram's consumer login (the Basic Display API) was retired in December 2024; Facebook Login is
what is left for ordinary people.

Step by step (2026-10-29), at https://developers.facebook.com → My Apps → **Create app**:

1. Use case: **Authenticate and request data from users with Facebook Login**.
2. **Facebook Login → Settings → Valid OAuth Redirect URIs**, one per Worker:
   - `https://tutoring-test.tmi-api.workers.dev/api/auth/facebook/callback`
   - `https://tutoring.om-ndessai.workers.dev/api/auth/facebook/callback`
   - `https://tmi-portal.om-ndessai.workers.dev/api/auth/facebook/callback`
   - and, once the App ID is known, the app's `fb<APP_ID>://authorize`.
3. **App settings → Basic**:
   - **Privacy Policy URL:** `https://tutoring.om-ndessai.workers.dev/privacy`
   - **Terms of Service URL:** `https://tutoring.om-ndessai.workers.dev/terms`
   - **User data deletion:** the privacy URL (it says how to delete an account).
   Facebook will not let the app go Live without them.
4. **App roles → Testers:** add yourself (and anyone trying it). Until the `email` permission has
   **Advanced Access** (App Review), only these people can sign in.
5. On each Worker: the **App ID** into `FACEBOOK_APP_ID` in vars; the **App Secret** as a secret, typed by the
   owner, never pasted into a chat or a file:

   ```bash
   cd apps/api
   npx wrangler secret put FACEBOOK_APP_SECRET --env tutoring-test   # the demo
   npx wrangler secret put FACEBOOK_APP_SECRET                       # tmi-portal
   npx wrangler secret put FACEBOOK_APP_SECRET --env tutoring        # tutoring
   ```
6. The app: build with `EXPO_PUBLIC_FACEBOOK_APP_ID=<APP_ID>` (`apps/mobile/.env.local`), which adds the
   `fb<APP_ID>` link scheme.
7. Add `facebook` to `AUTH_PROVIDERS`: the demo first, then the production pair.
8. **App Review** for `email` (Advanced Access), and switch the app to **Live**, before the public can use it.

A Facebook account may share no email address. It can still sign in once linked to an account (My
profile → Ways to sign in), but it cannot start a sign-up on its own.

## Trying a provider on the demo

The demo admits only invited people (`npm run test:invite -- add <email>`). Invite the address the
Microsoft or Facebook account reports before trying it there.

## What people see

- The sign-in page shows Google's button and one "Continue with …" per other provider offered.
- My profile → **Ways to sign in** lists the accounts that sign the person in, adds another (sign in
  with it once while signed in) and removes one, never the last.
- A new provider account joins an existing person by email only when the provider says the address is
  verified, it is not an Apple "Hide my email" address, and the person has no account from that
  provider yet. Anything else is refused with "Sign in the way you did before, then add … on My
  profile."
