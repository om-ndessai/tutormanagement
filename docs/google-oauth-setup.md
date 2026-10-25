# Setting up Google sign-in

Google sign-in is the only way into the portal. This guide creates the Google
credentials it needs and wires them into the app.

You do this once per Google Cloud project. Budget about 15 minutes.

**What you are creating:** an *OAuth 2.0 Client ID* of type *Web application*. The
portal uses Google Identity Services (GIS), which runs in the browser and hands
back an **ID token**. There is no client secret and no redirect URI, because the
portal never performs a server-side code exchange — the Worker verifies the ID
token against Google's public keys instead.

---

## 1. Create or pick a Google Cloud project

1. Go to <https://console.cloud.google.com/>.
2. Use the project picker in the top bar → **New project**.
3. Name it something recognisable, e.g. `tmi-portal`. No billing account is
   required for what we use.

## 2. Configure the consent screen

This is what people see the first time they sign in.

1. In the console, go to **Google Auth Platform** (<https://console.cloud.google.com/auth>).
   In older consoles this lives under **APIs & Services → OAuth consent screen**.
2. Under **Branding**, set:
   - **App name** — `Mathematics Institute of the Triangle` (this is shown on the
     Google consent dialog, so use the public-facing name)
   - **User support email** — an address you monitor
   - **App logo** — optional; `apps/web/public/logo-mark.png` works
   - **Application home page** — `https://trianglemathinstitute.com/`
   - **Developer contact information** — your email
3. Under **Audience**, choose **External**.

   > **Why External?** *Internal* restricts sign-in to a single Google Workspace
   > domain. Tutors, and later students and parents, will use personal Gmail
   > addresses, so Internal would lock them out.

4. Under **Data access**, confirm the scopes are only `openid`, `.../auth/userinfo.email`
   and `.../auth/userinfo.profile`. These are **non-sensitive**, which matters:
   an app using only these can be published without going through Google's
   verification review.

### Testing mode vs published

A new External app starts in **Testing**, where only accounts listed under
**Audience → Test users** can sign in (up to 100). That is fine while you are
setting things up — add your own address as a test user.

When you are ready for real staff to sign in, click **Publish app** under
**Audience**. Because the app only requests the three basic scopes above, this
takes effect immediately; no verification submission is needed.

## 3. Create the OAuth client ID

1. Go to **Google Auth Platform → Clients** → **Create client**.
2. **Application type:** `Web application`.
3. **Name:** `TMI Portal web` (internal label only).
4. **Authorized JavaScript origins** — add every origin the portal is served
   from. This is the setting that actually matters; get it wrong and the Google
   button refuses to load.

   | Origin | When |
   | --- | --- |
   | `http://localhost:5173` | `npm run dev` — the Vite dev server |
   | `http://localhost:8787` | Hitting the Worker directly via `npm run dev:api` |
   | `https://tmi-portal.<your-subdomain>.workers.dev` | After `npm run deploy` |
   | `https://tutoring.om-ndessai.workers.dev` | The tutoring platform (`npm run deploy`) |
   | `https://portal.trianglemathinstitute.com` | If you attach a custom domain |

   Rules Google enforces: scheme + host + port only — **no path and no trailing
   slash**. `http://localhost` and `http://127.0.0.1` count as *different*
   origins, so add whichever you actually browse to.

5. **Authorized redirect URIs** — leave empty. GIS does not use them.
6. **Create**, then copy the **Client ID**. It looks like
   `123456789012-abc...xyz.apps.googleusercontent.com`.

   You can ignore the client secret. This app never uses it.

## 4. Put the client ID in the app

Open `apps/api/wrangler.jsonc` and replace the placeholder:

```jsonc
"vars": {
  "GOOGLE_CLIENT_ID": "123456789012-abc...xyz.apps.googleusercontent.com",
  ...
}
```

The client ID is **not a secret** — it is sent to every browser — so it belongs
in version control alongside the rest of the config. The SPA reads it from
`GET /api/auth/config` at runtime, so changing it needs no rebuild of the
frontend, only a redeploy of the Worker.

## 5. Set the session secret

The Worker signs session cookies with an HMAC key. Without it, nobody can sign
in; with a guessable one, anyone can forge a session.

**Locally:**

```bash
cd apps/api
cp .dev.vars.example .dev.vars
# then replace the value with a real one:
openssl rand -base64 48
```

**In production:**

```bash
cd apps/api
npx wrangler secret put SESSION_SECRET
# it then PROMPTS for the value -- paste the output of `openssl rand -base64 48`
```

> **The name is an argument; the value is a prompt.** `wrangler secret put` takes
> the secret's *name* on the command line and asks for the *value* afterwards.
> Passing the value as the argument creates a secret **named** after your
> credential — which leaves `SESSION_SECRET` unset and prints the credential in
> `wrangler secret list`. Check with:
>
> ```bash
> npx wrangler secret list   # must contain a secret named SESSION_SECRET
> ```

You can ignore the Google **client secret** entirely. This app uses the GIS
ID-token flow, which has no client secret, so there is nothing to store.

Use a *different* value in production than locally. Rotating it signs everyone
out, which is the intended way to force that.

## 6. Bootstrap the first admin

Accounts are created by admins — people cannot self-register. On a fresh
database that leaves nobody able to sign in.

Set `BOOTSTRAP_ADMIN_EMAILS` in `apps/api/wrangler.jsonc` to your own Google
address:

```jsonc
"BOOTSTRAP_ADMIN_EMAILS": "you@gmail.com"
```

While the `users` table contains **no admin**, any address on that list may sign
in and is created as an active admin. The moment one admin exists the list stops
having any effect, so it is safe to leave in place — though clearing it once you
are set up is tidier.

Alternatively, insert the row yourself and skip the list entirely:

```bash
cd apps/api
npx wrangler d1 execute tmi-portal-db --remote --command="
  INSERT INTO users (id, email, full_name, role, status)
  VALUES (lower(hex(randomblob(4))) || '-0000-4000-8000-000000000000',
          'you@gmail.com', 'Your Name', 'admin', 'active')"
```

## 7. Verify

```bash
npm run db:reset   # local schema + sample staff
npm run dev
```

Open <http://localhost:5173>. You should be redirected to the login screen and
see a **Continue with Google** button. Signing in lands you on **My profile**,
showing the portal's record for the matched email.

Note that the sample staff in `apps/api/db/seed.sql` use
`@trianglemathinstitute.com` addresses. Unless those are real Google accounts
you control, sign in with an address on `BOOTSTRAP_ADMIN_EMAILS`, or add your own
address through the Users screen once you are in.

---

## Turning authentication off



For building later phases without signing in every time, set in
`apps/api/wrangler.jsonc`:

```jsonc
"AUTH_ENABLED": "false",
"DEV_USER_EMAIL": "admin@trianglemathinstitute.com"
```

Every API request then runs as that user and the SPA skips the login screen. A
banner on the profile page makes the state obvious so it cannot ship unnoticed.
Leave `DEV_USER_EMAIL` empty to run as the first admin in the table.

Only an explicit `"false"` disables auth — any other value leaves it on, so a typo cannot
quietly open up the API.

**Never deploy with this set to `false`** — it makes the portal public to anyone with the URL.

---

## Troubleshooting

**"The given origin is not allowed for the given client ID"**
The origin you are browsing from is not in **Authorized JavaScript origins**.
Check the scheme and port exactly, and remember `localhost` ≠ `127.0.0.1`.
Changes can take a few minutes to propagate.

**The Google button never appears**
Either the client ID is still the placeholder — the login page says so
explicitly — or the GIS script was blocked. Check the browser console and any
tracking blockers.

**"You are not authorized to access this portal"**
Sign-in with Google worked; there is simply no live `users` row with that
email. Add the person through the Users screen, or use the bootstrap list
above. Remember the match is on **email**, so it must be the same address as
the Google account they signed in with.

**"Your account has been suspended"**
The matching user row has `status = 'suspended'`, or was deactivated. Restore
them from the Users screen.

**"That Google sign-in could not be verified"**
The Worker rejected the ID token. Almost always a mismatch between the client ID
Google issued the token for and `GOOGLE_CLIENT_ID` in `wrangler.jsonc`. Restart
`wrangler dev` after changing it.

**500, or "Sign-in is unavailable: this deployment has no valid SESSION_SECRET"**
`SESSION_SECRET` is not set for that environment. Run `npx wrangler secret list`
and confirm a secret named exactly `SESSION_SECRET` exists. See the warning in
step 5.

**500 with "no such column" in the Worker logs**
The deployed database is older than `apps/api/db/schema.sql`. See
[database.md](database.md#keeping-production-in-step) — production has real data
now, so this needs a hand-written `ALTER TABLE`, not a rebuild.

**Signed in, then immediately signed out again**
`SESSION_SECRET` is missing, shorter than 32 characters, or changed between
requests. Check `apps/api/.dev.vars` locally and `wrangler secret list` in
production.

## The tutoring deployments

`tutoring` (sign-in on) uses the same OAuth client, so its origin must be on the list too:

```
https://tutoring.om-ndessai.workers.dev
```

`tutoring-test` has sign-in off and needs nothing. Its database starts empty, so
`BOOTSTRAP_ADMIN_EMAILS` (`ndessai@gmail.com`) is what lets the first admin in, once the tables exist.

## The test Worker

`tutoring-test` (`https://tutoring-test.tmi-api.workers.dev`, in the TEST Cloudflare account)
runs with sign-in OFF, so it needs no origin on the OAuth client. If sign-in is ever turned on
there, add that origin first, or Google refuses with `origin_mismatch` before the portal is
involved. No redirect URI is needed either way -- the portal uses Google Identity Services in the
browser and posts the ID token to `/api/auth/google`.

Two old test origins can be removed from the OAuth client: their Workers were deleted on
2026-10-06/07.

```
https://tmi-portal-test.om-ndessai.workers.dev
https://tutoring-test.om-ndessai.workers.dev
```

`tutoring-test` reads `tutoring-test-db`, seeded with two fictional organizations and
`ndessai@gmail.com` as platform admin (`db/platform-admin.sql`).

## The mobile app

The iOS and Android app (`apps/mobile`, branch `mobile-app`) signs in through the **same**
`POST /api/auth/google` and gets the **same** `tmi_session` cookie as the browser. Nothing on the
Worker changes: the app runs native Google Sign-In configured with this project's **web** client
ID, so Google issues the ID token for the web client -- exactly the audience
`verifyGoogleIdToken` already checks. Full plan: [mobile/google-sign-in.md](mobile/google-sign-in.md).

What the owner does, in the same Google Cloud project as the web client
(`866980945062-aoh0gotj6fld07cd9gtkeo7p0hdu9gsa.apps.googleusercontent.com`), under
APIs & Services → Credentials:

> **Renamed on 2026-10-13.** The app's bundle IDs changed from `com.tutorportal.app…` to
> `com.aimtrue.app…` when the platform became Aimtrue. An OAuth client is tied to the bundle ID
> (iOS) or package name (Android) it was created with, so clients made before that date no
> longer match: create new ones for the IDs below and replace the values in
> `apps/mobile/.env.local`. The web client is unchanged.

1. **iOS OAuth clients** (Create credentials → OAuth client ID → iOS), one per bundle ID:

   | Build | Bundle ID | Put its client ID in |
   | --- | --- | --- |
   | development | `com.aimtrue.app.dev` | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_DEV` |
   | production | `com.aimtrue.app` | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` |

   The e2e build (`com.aimtrue.app.e2e`) needs none: its tests use the developer sign-in.
   The values go in `apps/mobile/.env.local` (gitignored; see `apps/mobile/.env.example`) or
   the build's environment. The app derives the URL scheme Google returns to (the reversed ID,
   `com.googleusercontent.apps.…`) itself. After setting one, run a native rebuild
   (`npx expo prebuild --no-install`, then `npx expo run:ios`). Without one the build still
   succeeds and the sign-in screen says "Google sign-in not configured for this build".
2. **Android OAuth clients** (Create credentials → OAuth client ID → Android), one per package
   and signing key:

   | Build | Package | SHA-1 |
   | --- | --- | --- |
   | development (the debug key on the build Mac) | `com.aimtrue.app.dev` | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
   | production | `com.aimtrue.app` | the Play app-signing key's SHA-1, from Play Console |

   Android needs no client ID inside the app; the client only has to exist for Google to issue
   a token for the web client. Until it does, a tap on the button fails with "Google sign-in
   failed" (Google's `DEVELOPER_ERROR`).
3. **Consent screen.** The app asks only for `openid`, `email` and `profile`. If the screen is in
   **Testing**, every Google account that should sign in must be a test user; otherwise publish it.
4. **People.** As on the web, a Google account gets in only if a live person in the portal has
   that email; anyone else sees "You are not authorized to access this portal".

No JavaScript origin or redirect URI is needed for the app. The production build talks to
`EXPO_PUBLIC_PRODUCTION_API_URL` (default `https://tutoring.om-ndessai.workers.dev`, never
`tmi-portal`). To try it locally, set `AUTH_ENABLED=true` in the uncommitted
`apps/api/.dev.vars`, restart `npm run dev:api`, sign in on the simulator or emulator, then put
`.dev.vars` back (the mobile e2e runner refuses a Worker with sign-in on).



## The test portal and AimTrue-Test (Phase 53)

`tutoring-test` has Google sign-in on since Phase 53 (`docs/test-environment-plan.md`), and admits only
the people on its invited list. Two things in Google Cloud (the same project and web client):

1. **Web:** add `https://tutoring-test.tmi-api.workers.dev` to the web client's **Authorised JavaScript
   origins** (Google Auth Platform -> Clients -> the web client).
2. **The test app on iPhone:** create an **iOS** OAuth client for the bundle id `com.aimtrue.app.test`,
   and put its client ID in `apps/mobile/.env.local` as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_TEST`. Without
   it the test app builds, but hides the Google button on iOS.
3. **Optional, Android:** an **Android** OAuth client for the package `com.aimtrue.app.test` and the
   signing key's SHA-1 (the emulator's debug key: see "The mobile app" above).

Then add people: `npm run test:invite -- add you@example.com` (or `'*@yourdomain.com'`).
