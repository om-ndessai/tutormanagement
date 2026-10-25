# A test environment that behaves like production (Phase 53)

Requested by the owner on 2026-10-25:

> I want to create a test environment and mobile test app to mimic the production app and portal. So
> in the test suite we will enable authentication and no longer keep it open. [...] The test database
> will have a table called invited users -- this will have whitelisted email ids or social logins. The
> signin experience will remain the same but a random user whose social login is not in the
> whitelisted email/login will not be allowed to get into the test portal. This table should not be in
> production. Similarly create test app called AimTrue-Test that will point to the test worker.

**Decided by the owner (2026-10-25):**
1. **Matching:** an email or a Google id, either one, with **wildcards**: `*` stands for any run of
   characters, so `*@trianglemathinstitute.com` lets a whole domain in.
2. **Managing the list:** a command-line script, plus the owner's own SQL straight on the table. No
   screen.
3. **Seeding:** a test-only automation key.
4. **The test app:** on the simulators and on the owner's own devices too.

---

## What changes

| | Today | After Phase 53 |
| --- | --- | --- |
| `tutoring-test` (TEST account) | An open demo: sign-in off, anyone walks in as anyone | Google sign-in on, exactly as production; only people on the invited list get in |
| Sign-in on test | None | The production experience: Google, then (for a newcomer) the age question and the terms, then the Welcome page |
| Who may sign in on test | Everyone | Only an email or Google account on `invited_users`; anyone else sees "This test portal is by invitation." |
| The app | Variants: development, e2e, production, personal | Plus **test**: "AimTrue-Test", bundle id `com.aimtrue.app.test`, pointed at `tutoring-test` |
| Local development and the local suites | Sign-in off, `X-Dev-User` | Unchanged: the release gate stays the local suite |
| Production | -- | Unchanged: no `invited_users` table, no allowlist code path taken |

---

## 1. The invited list (test only)

```sql
-- db/test-only.sql: loaded by db:reset:test after the schema, NEVER part of schema.sql, never run
-- on production. The test portal lets in only the people on it.
CREATE TABLE invited_users (
  id          TEXT PRIMARY KEY,
  -- One of the two, or both: a verified email (lower-cased), or a social login's permanent id.
  email       TEXT,                      -- an address, or a pattern: '*@example.com', 'jane.*@gmail.com'
  provider    TEXT CHECK (provider IN ('google')),
  subject     TEXT,
  note        TEXT,                      -- who and why, free text for the owner
  added_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (email IS NOT NULL OR (provider IS NOT NULL AND subject IS NOT NULL))
);
CREATE UNIQUE INDEX invited_users_email ON invited_users (lower(email)) WHERE email IS NOT NULL;
-- Matching: lower(<verified email>) GLOB lower(email) -- an exact address matches itself, and `*` (any
-- run) and `?` (one character) are wildcards. The list is small, so it is read whole.
CREATE UNIQUE INDEX invited_users_login ON invited_users (provider, subject) WHERE subject IS NOT NULL;
```

- **Why not in `schema.sql`:** production must never have it. A separate file, loaded only by the
  test reset, keeps it out of every production path. `scripts/compat-schema.mjs` compares
  `schema.sql` builds only, so the test-only table never reaches the compatibility test either.
- **The Worker:** a new var `SIGNIN_ALLOWLIST` is `"true"` on `tutoring-test` only.
  - **With it on:** `POST /api/auth/google` checks the verified identity against `invited_users`
    (the email, or `google` plus the Google `sub`) BEFORE anything else: before finding the person,
    before sign-up, before any log line names them.
  - **Not on the list:** 403 `not_invited`, "This test portal is by invitation. Ask the owner to add
    you."
  - **On the list:** sign-in carries on exactly as in production. A known person signs in; an
    unknown one goes through the sign-up steps (sign-up is open on test).
  - **Without the var** (production), the table is never read, so its absence there is harmless.
- **The session:** every request on test re-checks the list too. Removing someone from it ends
  their access on their next request, as suspension does today.
- **Managing the list (decision 2):** `npm run test:invite -- add <email> [note]`,
  `-- add-google <sub> [note]`, `-- remove <email>`, `-- list`. These are wrangler commands against
  `tutoring-test-db` in the TEST account only; the script refuses any other database or account,
  like `scripts/check-test-account.mjs`.

## 2. Turning sign-in on for `tutoring-test`

- **Config:** in `wrangler.jsonc`'s `tutoring-test` block, `AUTH_ENABLED` goes to `"true"` and
  `SIGNIN_ALLOWLIST` to `"true"`; `SIGNUP_OPEN` stays `"true"`. `ENVIRONMENT` stays `"development"`,
  so cookies are not Secure-only and the limits stay loose.
  - **Owner action:** in Google Cloud, add `https://tutoring-test.tmi-api.workers.dev` to the web
    client's authorised JavaScript origins (`docs/google-oauth-setup.md`).
- **Secrets on the TEST account's Worker:** `SESSION_SECRET` (a fresh random value, never
  production's), set with `wrangler secret put SESSION_SECRET --env tutoring-test`.
- **Scripts that need sign-in off are retired or changed:**
  - `scripts/e2e.sh` (the remote suite) already refuses a Worker with sign-in on. It is retired
    with a clear message, since the local suite has been the gate since 2026-10-07.
  - `db:reset:test` and `seed:scenarios -- --demo` act through `X-Dev-User`, which sign-in on no
    longer honours. Decision 3 below.
- **Docs:** `CLAUDE.md` (Deployments, "The test Worker is open"), `docs/testing.md`,
  `docs/google-oauth-setup.md` and the memory notes are all brought up to date.

## 3. The test app: "AimTrue-Test"

- **Variant:** a fifth `APP_VARIANT`, `test`, in `apps/mobile/app.config.ts`:
  - name `AimTrue-Test`;
  - bundle id and package `com.aimtrue.app.test`;
  - the URL scheme `aimtrue-test` (its own, so it never answers the production app's links);
  - the API pointed at `https://tutoring-test.tmi-api.workers.dev`;
  - Google sign-in only, with no developer sign-in, as in production;
  - "TEST" on its icon and splash, so it is never mistaken for the real app.
- **At runtime it is production in every way** except its server, so testing it is testing
  production's behaviour.
- **Google sign-in for the app (owner action):**
  - **iOS:** a new iOS OAuth client for `com.aimtrue.app.test` (its client ID goes in
    `apps/mobile/.env.local` as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_TEST`).
  - **Android:** an Android OAuth client for the package and the debug or upload key's SHA-1.
  - The docs give the exact steps.
- **Building:** `APP_VARIANT=test` through the existing scripts (`npm run mobile:ios:test` /
  `mobile:android:test`). Installing on real phones happens only when the owner asks (decision 4).

## 4. Tests

- **Local, sign-in still off:** the allowlist's code path is exercised with the var on (a local
  `.dev.vars` override in a dedicated spec run).
  - On the list, or not: the sign-up token is refused before anything is written.
  - Removal mid-session ends access.
- **A check script** fails if `invited_users` ever appears in `schema.sql` or a production SQL block
  in `docs/database.md`.
- **The app's variant:** a jest test of `app.config.ts` for the test variant (the name, the bundle
  id, the scheme, the API URL, no developer sign-in).
- **On the deployed test portal, by hand, once:** the owner (on the list) signs in with Google, and
  a Google account not on the list is refused with the invitation message.

## Production

No change: no new table, no new code path taken, no SQL to apply. The Worker code that reads
`invited_users` runs only where `SIGNIN_ALLOWLIST` is `"true"`.

---

## Decisions for the owner

1. **What the list matches:** a verified email, or a Google account's permanent id, either one
   (recommended).
2. **How people are added:** a command-line script against the test database (recommended to start),
   or a page in the test portal's console.
3. **Seeding the test portal now that it needs sign-in:**
   - (a) **Recommended:** a test-only automation key. The test Worker accepts `X-Dev-User` only with
     a secret header that lives as a wrangler secret on the TEST Worker alone, so the reset and the
     newer-feature seed keep working.
   - (b) Seed with SQL only, which loses the API-made assessments, Quest answers and games.
4. **The test app on phones:** simulators and the emulator only for now (recommended), or install on
   the owner's devices too.
