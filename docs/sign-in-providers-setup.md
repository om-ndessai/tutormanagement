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

1. Microsoft Entra admin center → App registrations → New registration.
   - Supported account types: **Accounts in any organizational directory and personal Microsoft
     accounts**.
   - Redirect URI, platform **Web**: each Worker's `/api/auth/microsoft/callback`.
2. Authentication:
   - tick **ID tokens** (the web flow posts an ID token back: `response_mode=form_post`);
   - add the platform **Mobile and desktop applications** with the app's redirect `aimtrue://auth/microsoft`
     (and `aimtrue-test://auth/microsoft` for AimTrue-Test).
3. Token configuration → Add optional claim → ID → `email` and `xms_edov`. `xms_edov` says a work or
   school tenant owns the address's domain; without it such an address is never matched to an
   account (personal accounts are always trusted).
4. Copy the **Application (client) ID** into `MICROSOFT_CLIENT_ID` on each Worker. No secret is
   needed: the ID token is checked against Microsoft's published keys.
5. Add `microsoft` to `AUTH_PROVIDERS`.

## Apple (waits for the paid Apple Developer Program)

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

1. developers.facebook.com → Create app → **Authenticate and request data from users with Facebook
   Login**.
2. Facebook Login → Settings → Valid OAuth Redirect URIs: each Worker's `/api/auth/facebook/callback`,
   and the app's `fb<APP_ID>://authorize`.
3. App Review: the `email` permission needs **Advanced Access** before the public can use it (until
   then only the app's own testers can sign in).
4. On each Worker: `FACEBOOK_APP_ID` in vars, and `wrangler secret put FACEBOOK_APP_SECRET`.
5. Add `facebook` to `AUTH_PROVIDERS`.

A Facebook account may share no email address. It can still sign in once linked to an account (My
profile → Ways to sign in), but it cannot start a sign-up on its own.

## What people see

- The sign-in page shows Google's button and one "Continue with …" per other provider offered.
- My profile → **Ways to sign in** lists the accounts that sign the person in, adds another (sign in
  with it once while signed in) and removes one, never the last.
- A new provider account joins an existing person by email only when the provider says the address is
  verified, it is not an Apple "Hide my email" address, and the person has no account from that
  provider yet. Anything else is refused with "Sign in the way you did before, then add … on My
  profile."
