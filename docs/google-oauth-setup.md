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

**This is the current state of the project.** `AUTH_ENABLED` is `"false"` in
`apps/api/wrangler.jsonc`, deliberately, so later phases can be built without signing in. The
deployed portal is reachable by anyone with the URL. Everything below describes how that works
and how to reverse it.


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

**Before the portal holds anything real, set this back to `"true"`.** Google sign-in,
`GOOGLE_CLIENT_ID` and `SESSION_SECRET` are all already configured, so re-enabling is a
one-line change and a deploy.

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

**"No portal account matches that Google address"**
Sign-in worked; there is simply no live `users` row with that email. Add the
person through the Users screen, or use the bootstrap list above. Remember the
match is on **email**, so it must be the same address as the Google account.

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
