# More ways to sign in: Microsoft, Apple, Facebook (Phase 55)

Requested by the owner on 2026-10-25 (stage O4 of `docs/roadmap/open-to-public.md`):

> Build support for Microsoft, Apple, Facebook/Instagram. Put a config for each. By default only Google
> still be the auth provider. I will pay for iOS account later but let's build it and put off behind
> flag. No magic links.

**Instagram.** Meta retired the Instagram Basic Display API (the "Log in with Instagram" for
ordinary people) in December 2024. Its successor, "Instagram API with Instagram Login", serves only
business and creator accounts. So **Facebook Login** is the one Meta sign-in: Instagram users nearly
always have the Facebook account it uses.

**No magic links** (owner).

---

## Configuration: one switch per provider

- **Which providers are on:** `AUTH_PROVIDERS` in each Worker's vars, a comma list. Default
  `"google"` everywhere. A provider is offered only while it is listed AND configured. Its ids go in
  vars, its secrets in `wrangler secret`. The test Worker can turn one on before production does.

| Provider | Vars | Secrets | Owner's setup |
| --- | --- | --- | --- |
| `google` | `GOOGLE_CLIENT_ID` (today) | -- | done |
| `microsoft` | `MICROSOFT_CLIENT_ID` | -- (the ID token is verified with Microsoft's public keys) | an Entra app registration ("personal and work/school accounts"), the portal's redirect URI, the app's |
| `apple` | `APPLE_SERVICES_ID` (web), `APPLE_BUNDLE_IDS` (app), `APPLE_TEAM_ID`, `APPLE_KEY_ID` | `APPLE_PRIVATE_KEY` (for revoking tokens on deletion) | **the paid Apple Developer Program** (owner: later). Until then `apple` stays off |
| `facebook` | `FACEBOOK_APP_ID` | `FACEBOOK_APP_SECRET` | a Meta app with Facebook Login; the `email` permission's Advanced Access (App Review) before the public uses it |

- **What clients read:** `/api/auth/config` gains `providers: [{ id, label, client_id? }]` for the
  ones on. The web's sign-in page and the app's sign-in screen show a button per provider, Google
  first.

## One person, several ways in

```sql
CREATE TABLE user_identities (
  provider      TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'apple', 'facebook')),
  subject       TEXT NOT NULL,     -- google: sub; microsoft: tid:oid; apple: sub; facebook: app-scoped id
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  email_at_link TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at  TEXT,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX user_identities_user_idx ON user_identities (user_id);
-- Backfill: every pinned Google account.
INSERT INTO user_identities (provider, subject, user_id) SELECT 'google', google_sub, id FROM users WHERE google_sub IS NOT NULL;
```

- **Sign-in looks up `(provider, subject)` first.** Matching a new identity to a person by email is
  allowed only when all three hold:
  - the provider says the email is verified;
  - it is not an Apple private-relay address;
  - that person has no identity from that provider yet.

  This is today's `pinnedToAnother` rule, for every provider. Otherwise it is a newcomer, and
  Phase 52's sign-up follows.
- **Linking.** My profile gains **"Ways to sign in"**: add another provider (sign in with it once
  while signed in), or remove one. The last way in cannot be removed. Logged on the platform log.
- **The test portal's invited list** gains `provider IN ('google', 'microsoft', 'apple', 'facebook')`,
  with `db/test-only.sql` rebuilding that small table and keeping its rows.

## Each provider's verification (each its own file, nothing else turns a token into a person)

- **`lib/microsoft.ts`:**
  - the ID token from the OpenID Connect flow is checked against Microsoft's published keys, its
    audience, and an issuer of the form `login.microsoftonline.com/{tid}/v2.0`;
  - the identity is `tid` plus `oid`, never the email, which a work or school tenant's own admins can
    set (the "nOAuth" class);
  - the email counts as verified only for personal accounts (the consumers tenant) or where
    Microsoft marks the domain verified (`xms_edov`).
- **`lib/apple.ts`:**
  - the ID token is checked against Apple's keys; its audience is the Services ID (web) or a bundle id
    (app);
  - the email and name come only the first time, so they are stored then;
  - a relay address never matches an invitation;
  - deleting an account revokes Apple's tokens (Apple's rule), which needs the client secret, an ES256
    JWT signed with `APPLE_PRIVATE_KEY`;
  - a public endpoint, `POST /api/auth/apple/notifications`, takes Apple's server-to-server notices
    (consent withdrawn, account deleted). It sits in `publicRoutes` on purpose.
- **`lib/facebook.ts`:**
  - the web flow returns an access token: the Worker checks it with Graph's `debug_token` (app id,
    validity), then reads `/me?fields=id,name,email`;
  - on iOS, Facebook's Limited Login returns an OpenID token, checked against Meta's keys;
  - the identity is the app-scoped id;
  - Facebook's email counts as verified (Meta confirms it before releasing it), but it may be missing,
    and then sign-up asks the person for no email (Phase 52's steps need none).

## The web and the app

- **Web:**
  - Google keeps Google Identity Services;
  - Microsoft and Apple use their redirect flows (OpenID Connect with PKCE) through
    `/api/auth/<provider>/start` and `/callback`;
  - Facebook uses its JavaScript SDK.
  - The answer from each goes to `POST /api/auth/<provider>`, which returns what `/auth/google`
    returns: a session, or the `signup` start of Phase 52.
- **App:**
  - **Microsoft:** `expo-auth-session` (PKCE, the system browser).
  - **Apple:** `expo-apple-authentication`. It needs the paid team's capability, so it is behind
    `EXPO_PUBLIC_APPLE_SIGN_IN` and off.
  - **Facebook:** `react-native-fbsdk-next` (native; Limited Login on iOS).
  - New native modules mean the development, e2e, personal and test builds are rebuilt.
- **Rate limits** and the test portal's invited list apply to every provider alike. So does the
  `SIGNUP_OPEN` switch.

## Tests

- **Unit:** each verifier against signed test tokens (a local key pair standing in for the
  provider's).
- **The linking rules,** and the routes:
  - local, with sign-in off: a test-only verifier (`fake`) behind `AUTH_FAKE_PROVIDERS`, never in
    production, lets the suite sign in "with Microsoft" and walk linking, refusal and sign-up;
  - the real providers by hand on the test portal, once each is configured.
- **The app:** jest for the buttons shown per `providers`; a Maestro flow through the fake.

## Production

`user_identities` and its backfill, then the deploy. `AUTH_PROVIDERS` stays `"google"` until the owner
configures and turns on each provider.
