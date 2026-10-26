# Sharing Quest (Phase 56)

Requested by the owner on 2026-10-25: "Follow this by O3 build out" -- stage O3 of
`docs/roadmap/open-to-public.md`, "Sharing Quest on social media". This plan is that section made
concrete. It is the first public page that needs no sign-in, so Turnstile, deferred in Phase 51,
arrives here.

---

## What can be shared

| Moment | The card | From |
| --- | --- | --- |
| A Quest Game result | "Grade 5 · Knockout · 2nd of 5 teams · 9/10" | the reader's own team, no other names |
| A level finished in Question Quest | "Finished BA3 · 120 questions" | the person's own level |
| "Can you solve this?" | one approved question, its level, and "I got it in 40 s" | an `approved` bank question the person answered right |

## Rules (R22)

- **Names.**
  - No child is named on a public page. A child session has no Share button.
  - A parent may share their child's result, as "A Grade 5 player".
  - An adult may show their own first name, chosen at the moment of sharing; the default is none.
  - No other player is named.
- **No free text,** no captions and no comments on the public page. **No space name** unless an
  institute opts in on its Space page.
- **No points for sharing** and **no leaderboard.**
- **Withdrawable:** the maker can withdraw a share, and it then reads "no longer available". Shares
  expire after a year.
- **Answers:** a challenge's key is checked on the server (`checkAnswer`) and its solution shown
  after; answering is rate-limited, and Turnstile stands before an answer.
- **Who may share:** 13 or over (`platform_accounts.age_band`, or a member a space added).

## Data and routes

```sql
CREATE TABLE shares (
  id               TEXT PRIMARY KEY,           -- 12+ random characters, the public link
  organization_id  TEXT NOT NULL REFERENCES organizations (id),
  user_id          TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('game_result', 'level_finished', 'challenge')),
  card             TEXT NOT NULL,              -- JSON snapshot of the numbers shown; no names but the chosen first name
  question_id      TEXT REFERENCES questions (id),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at       TEXT NOT NULL,
  withdrawn_at     TEXT
);
```

- **Making and withdrawing:** `POST /api/shares` (signed in; the card is built on the server from the
  person's own result, never sent by the client), `DELETE /api/shares/:id`, and `GET /api/shares`
  (the person's own).
- **The public page:** `GET /s/:id`, the one new signed-out page.
  - The Worker serves the SPA's `index.html` with `og:title`, `og:description` and `og:image` written
    in by `HTMLRewriter`; the assets get `run_worker_first` for `/s/*`.
  - The read is one primary-key read, cached at the edge.
  - Views are counted in Workers Analytics Engine, never D1.
- **Challenges:** `POST /api/public/challenge/:id/answer`, with Turnstile and rate-limited; it returns
  right or wrong and the worked solution.
- **The preview image:** a few static PNGs per kind and level family, made at build time. A per-share
  image waits for Workers Paid (the free plan's CPU limit).

## The image people post, and the text

- **Web:** the card is drawn on a `<canvas>`, then `navigator.share({ files, text, url })` where files
  are supported, else a download plus "Copy text".
- **App:** `react-native-view-shot` and the system share sheet. This is the only way into Instagram,
  TikTok and Snapchat stories, which take an image but have no share link.
- **Copyable text,** Wordle-style: "Aimtrue Quest · Grade 5 · 9/10 🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩", then the
  link.
- **Direct buttons** where no share sheet exists: X, Facebook, LinkedIn, WhatsApp, Reddit and email.

## Tests and production

- **Tests:**
  - `sharing.spec.ts`: the card carries no names, withdrawing, expiry, the public page's tags, the
    challenge's answer and its limits;
  - an exposure row (R22);
  - Maestro flows under `sharing/`.
- **Production:**
  - `shares`;
  - a Turnstile site key (a var) and secret (a secret);
  - the deploy.
