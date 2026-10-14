# Push notifications on the current stack

Analysis, 2026-10-14. **Not scheduled**: like everything in `docs/roadmap/`, this becomes work only
once the owner writes it into `docs/plan.md` as a phase. Facts about third-party services below are
as I understand them on this date; the ones marked *check* should be confirmed against the provider's
current documentation before building.

## The short answer

Push can be added without new infrastructure: the Worker decides who to notify (it already does, for
email), stores each person's device tokens in D1, and hands the message to a push service over HTTPS.
The constraint that matters is not Cloudflare. It is Apple:

| Channel | What it needs | Cost | Ready on today's setup? |
| --- | --- | --- | --- |
| **Android app** | Firebase Cloud Messaging (via Expo's push service) | free | yes |
| **iPhone app** | Apple Push Notification service, which needs the **paid Apple Developer Program** | $99/year | **no**: a free Personal Team cannot sign the push entitlement (`docs/mobile/real-devices.md`) |
| **Web portal** (desktop browsers, Android Chrome, iPhone if added to the Home Screen) | Standard Web Push with VAPID keys | free | yes |

So on the free tier you can have push today on Android and on the web portal. Push on the iPhone
app waits on the same paid account TestFlight is already waiting on.

## How it fits what already exists

Phase 32 built most of the machinery. `notify()` in `apps/api/src/lib/email.ts`:

- runs after the response, in `waitUntil`, and never fails the action;
- picks recipients with `recipientsFor` (live members of this organization, the people a thing
  concerns, minus the person who acted, each once);
- describes the event through `NotificationEvent` / `describe`, which carry no money, notes or scores
  (rule R15 in `docs/data-exposure.md`);
- logs every attempt in `notification_log`, ids and outcome only.

Push is a **second channel on the same event**, not a second system. The four actions that email
today (person added, plan or assessment, schedule, recorded lesson) would push with no new trigger
code; only the delivery step is new.

One rule is stricter for push than for email: `apps/mobile/CLAUDE.md` says system surfaces
(notifications, Live Activities, widgets) carry **no money, notes or student names**. A lock screen
is read by whoever picks the phone up, so a push says "A lesson was recorded" and links to it; it
does not say "Sofia's lesson with Alex". The email can keep its names.

## The design

### 1. Storing devices (D1)

```sql
CREATE TABLE push_devices (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('expo', 'webpush')),
  token         TEXT NOT NULL,          -- Expo push token, or the Web Push endpoint
  keys_json     TEXT,                   -- Web Push only: p256dh and auth
  platform      TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (kind, token)
);
CREATE INDEX push_devices_user ON push_devices (user_id);
```

- **Per person, not per organization.** A phone belongs to a person; which organization a message
  is about is decided at send time by `recipientsFor`, as for email. This passes the repo's test
  ("could two organizations sensibly disagree about this?": no). The org-scope check script will need
  an `org-scope:` comment on the send-time lookup, which reads devices across organizations by user.
- **Preferences are per organization**: a `push_notifications` flag beside `email_notifications` on
  `organizations` (the admin's switch), and optionally a per-person mute later.
- `notification_log` gains a `channel` column (`email`, `push`), additive:
  `ALTER TABLE notification_log ADD COLUMN channel TEXT NOT NULL DEFAULT 'email'`.

### 2. API routes

| Route | What it does |
| --- | --- |
| `POST /api/devices` | The signed-in person registers this device's token (upsert on `kind, token`, refreshing `last_seen_at`). |
| `DELETE /api/devices/:id` | Unregister (also called on sign-out). |
| `GET /api/push/vapid-key` | The portal's public VAPID key, for the browser to subscribe with. Public, like `/api/auth/config`. |

Both mutating routes need an `AUDIT_ACTIONS` entry (`device.registered`, `device.removed`) and the
exposure spec must show a person can only ever see or delete their own devices.

### 3. Sending

`notify()` grows a `push()` beside `mail()`. For each recipient it reads their devices from D1 and
sends one message per device:

- **App devices → Expo Push Service.** One `POST https://exp.host/--/api/v2/push/send` with up to 100
  messages; Expo forwards to FCM (Android) and APNs (iOS). No server SDK, no HTTP/2, no certificates
  in the Worker. Free. *Check* current limits; they have been generous (hundreds per second).
- **Browsers → Web Push directly from the Worker.** Each message is encrypted for the browser
  (RFC 8291, `aes128gcm`) and signed with the VAPID key (RFC 8292, an ES256 JWT). Both are possible
  with the Worker's WebCrypto; a small library or about 150 lines of code. The private VAPID key is a
  Worker secret (`wrangler secret put VAPID_PRIVATE_KEY`).
- **Why not APNs or FCM directly?** FCM's HTTP v1 API works from a Worker (a service-account JWT
  signed with WebCrypto), but it is more code than Expo for the same result on Android. APNs only
  speaks HTTP/2, and as far as I know a Worker's outbound `fetch` does not use HTTP/2 to arbitrary
  origins (*check*), so going through Expo or FCM is the practical route for iPhones too.

**Cleaning up dead tokens.** Expo returns a ticket per message; a later call returns a receipt, and a
`DeviceNotRegistered` receipt means the app was uninstalled. Web Push answers `404`/`410` for a dead
subscription immediately. The existing 15-minute cron on `tutoring` can fetch Expo receipts and
delete dead rows. Tickets to check can wait in a small D1 table or in a Queue (below).

### 4. The app (`apps/mobile`)

- Add `expo-notifications` (`npx expo install expo-notifications`) and its config plugin. The app
  needs an EAS project ID for `getExpoPushTokenAsync` (a free Expo account; *check*).
- **Ask at a good moment**, not at first launch: after sign-in, on the dashboard, with a sentence
  saying what will arrive. iOS asks once; Android 13+ also asks.
- Register the token with `POST /api/devices` after sign-in and on every launch (tokens can change);
  delete it on sign-out, beside clearing the query cache.
- **Tapping a notification** opens the deep link it carries (`aimtrue://sessions/<id>`), through the
  same router the Live Activity already uses. The organization must travel in the link
  (`?org=<slug>`), because a person may be in several and the app must switch first, then show the
  record, which `requireOrg` re-checks.
- Android: one notification channel ("Lessons and plans"), so people can mute it in Settings.
- The **personal build cannot receive push on iPhone** (no entitlement on a free team), so on the
  current three phones it can be built and tested only on Android and the web.

### 5. The web portal

- A service worker (`apps/web/public/sw.js`) that shows the notification and opens the link on
  click, registered by the SPA; Vite serves it as a static asset.
- An "Allow notifications" control on the person's own settings, not a prompt on page load (browsers
  now penalise prompts with no user gesture).
- **iPhone and iPad:** Safari delivers Web Push only to a site added to the Home Screen, on iOS 16.4
  or later, and the site needs a web app manifest. That is a usable free route to iPhone users today,
  with a step for them to take.

## Other free Cloudflare services worth using

| Service | Use here | Needed? |
| --- | --- | --- |
| **Cron Triggers** (already used) | Lesson reminders (for example 30 minutes before a scheduled lesson, computed by `expandUpcoming`), Expo receipt checks. Only `tutoring` runs the cron, so nothing is sent twice. | yes, already there |
| **`waitUntil`** (already used) | Sending after the response, as email does. Enough for a handful of recipients per action. | yes, already there |
| **Queues** | Decouple sending from the request: the action enqueues one message per recipient, a consumer sends and retries with backoff. Worth it once a single action can notify dozens of people, or when the push service is briefly down. *Check* free-plan availability and its daily operation limit. | later |
| **Durable Objects (SQLite-backed)** | An exact-time alarm per scheduled reminder instead of a 15-minute cron granularity. *Check* free-plan availability. | probably not: 15-minute resolution is fine for reminders |
| **Workers KV** | Caching the VAPID public key or rate-limit counters. Its free tier allows few writes per day, so not for tokens. | no |
| **D1** | Devices, preferences, the log. Reads per send are small (one indexed query per recipient). | yes |

**Quota.** D1's free plan allows 5 million rows read a day (the limit that once took production
down, `docs/database.md`). A notification costs a few indexed reads per recipient, and a reminder
sweep every 15 minutes reads the next hour's lessons. That is thousands of rows a day, not millions.
Workers' free plan allows 100,000 requests a day; outbound sends do not count as requests.

## What to notify about

Start with the four events that already email, then the ones that are only worth sending as push:

| Event | Who | Push text (no names, no money) |
| --- | --- | --- |
| Lesson in 30 minutes *(new, cron)* | the student, their guardians, the tutor | "A lesson starts at 4:00 PM." |
| Lesson recorded | the student, their guardians | "A lesson was recorded. Tap to see it." |
| Reflection asked for *(new)* | the student | "How did today's lesson go?" |
| New plan or assessment | the student, their guardians | "A new learning plan was added." |
| Schedule added or a date cancelled | the student, their guardians, the tutor | "A lesson date changed." |
| Live lesson stopped at its limit *(new)* | the tutor | "A lesson was stopped at its time limit." |

## Order of work

1. **Web Push for the portal**: VAPID secret, `push_devices`, the two routes, the service worker, the
   sending code, the log column. Free, testable on desktop browsers immediately.
2. **Android app**: `expo-notifications`, registration on sign-in, deep-link handling, Expo sending
   and receipt clean-up. Testable on the Android emulator (with Google Play services) and real phones.
3. **Lesson reminders** from the cron, for both channels.
4. **iPhone app** once the paid Apple account exists: enable the push entitlement, upload an APNs key
   to Expo, build through TestFlight. No server change.

Each step follows the usual release rules: additive schema written into `docs/database.md`, a
row in `docs/data-exposure.md` for the new surface (extending R15 to push), the exposure spec
covering `/api/devices`, and `npm run smoke` on both clients.

## Costs

Everything above is free except the Apple Developer Program ($99 a year), which only the iPhone app
needs and which TestFlight and the App Store need anyway.
