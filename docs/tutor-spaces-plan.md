# Tutor spaces and organizations (Phase 54)

Requested by the owner on 2026-10-25 (stage O5 of `docs/roadmap/open-to-public.md`, reshaped):

> Some of the spaces will be purely managed by the tutors. So the amount paid by the parents will be
> paid directly to tutors. The space admins will not have any cut for the organization associated with
> the space. So now, let's add ability to have an organization to the space. That's the one that will
> have TIN etc associated with it. A single tutor space will not have any organization, the payments
> will be for tutors only.

**Owner's decisions (2026-10-25):**
1. **Tutors in a space without an organization:** one or more, each paid directly by the families of
   their own lessons.
2. **Organizations:** shared. One organization (its name, TIN and payer address) may run several
   spaces.
3. **Who makes a tutor space:** platform admins only, from the console. Newcomers still make
   Assessment-only spaces (Phase 52).
4. **A space may gain or lose its organization later.** The change applies from that day on;
   recorded lessons and payments keep the model they were recorded under.

"Organization" is the word on screen for the new record. In the code a space is already
`organizations`, so the new record is a **business** (`businesses`), the same way "space" is
`organization`.

---

## Two ways a space is paid

| | **Run by an organization** (today's model) | **Paid directly** (new) |
| --- | --- | --- |
| A space with... | an organization (`organizations.business_id` set) | no organization |
| Families pay | the organization | each lesson's tutor, directly |
| Tutors are paid | by the organization, on their own rates; advances and top-ups | not by anybody in the portal: what families pay them is their income |
| A lesson's money | two rates, frozen: the family's price and the tutor's pay; the margin is the organization's | one price, frozen: what the family pays the tutor; no margin, nobody's cut |
| Payments recorded | `from_parent` (to the organization), `to_tutor` | `from_parent` with the tutor who received it (`payee_user_id`); no `to_tutor` |
| Balances | a family's balance with the organization; a tutor's earned vs paid | a family's balance with each tutor; nothing between tutor and space |
| 1099 | the organization issues them (its TIN, payer address) | none issued by the space; each tutor gets a year-end summary of what families paid them |
| TIN on the Space page | the organization's, editable by the space's admins | none: there is no payer |

The price in a paid-directly space is the pairing's rate: the pairing's own, else the tutor's
default. The family's price per hour on the student (`student_profiles.charge_rate_*`) belongs to the
organization model and is hidden there.

---

## Data (additive)

```sql
-- An organization in the money sense: who families pay and who files the 1099s. Several spaces may
-- point at one (decision 2). Platform admins make and link them; the admins of a linked space edit
-- its payer details, as they edit the TIN today.
CREATE TABLE businesses (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  tin                 TEXT,
  payer_address_line1 TEXT,
  payer_address_line2 TEXT,
  payer_city          TEXT,
  payer_state         TEXT CHECK (payer_state IS NULL OR (length(payer_state) = 2 AND payer_state = upper(payer_state))),
  payer_postal_code   TEXT,
  archived_at         TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

ALTER TABLE organizations ADD COLUMN business_id TEXT REFERENCES businesses (id);
-- Frozen on each lesson and payment when it is recorded (decision 4: a switch applies going forward).
ALTER TABLE sessions ADD COLUMN paid_directly INTEGER NOT NULL DEFAULT 0 CHECK (paid_directly IN (0, 1));
ALTER TABLE payments ADD COLUMN payee_user_id TEXT REFERENCES users (id);
```

- **Backfill (production).** Every existing organization gets a business of its own, carrying its
  name and today's TIN and payer address, and is linked to it. Nothing about how they work changes.
  Today's TIN columns on `organizations` stay (additive) and are no longer read.
- **Rules the database keeps:**
  - a paid-directly lesson has `tutor_rate_cents = charge_rate_cents`;
  - a paid-directly payment is `from_parent` and names its payee, a tutor of the space;
  - a `to_tutor` payment never exists in a paid-directly space.

  These are triggers, plus the API's checks.

## API

- **Recording a lesson** (every path: typed, live, the cron's auto-stop, a draft posted) reads the
  space's model at that moment. Paid directly: one rate, `paid_directly = 1`.
- **Payments.** Paid directly:
  - a family payment names its tutor;
  - a tutor records payments made to them, and admins may record any;
  - `to_tutor`, advances, top-ups and the tutor-payments panel are refused (409) or hidden.
- **Balances** (`GET /payments/balances`). Paid directly, a family's balance is kept per tutor:
  that tutor's paid-directly lessons for the student, minus that family's payments to that tutor.
  Lessons and payments from an organization period keep the organization balance.
- **The year end.** No 1099 for paid-directly income. The tutor's year-end summary (CSV) lists what
  families paid them.
- **Console** (`/platform`):
  - an **Organizations** list (create, edit, archive);
  - on a space, its organization: **"Paid directly (no organization)"** or one to choose.

  Changing it is logged in the space as `organization.business_set` /
  `organization.business_cleared`. The create-space form gets the same choice; Tutoring stays
  the platform admin's to allow (Phase 50).
- **The Space page:** the organization's name and payer details (editable by the space's admins, the
  edit logged in that space), or "Families pay each tutor directly".

## Exposure

**R24 (new).** In a paid-directly space:
- a lesson's price reaches the family and the tutor who taught it;
- a payment reaches the family who made it, the tutor who received it, and the space's admins;
- no tutor sees another tutor's lessons' money or payments;
- nobody sees a margin, because there is none.

An organization's TIN and payer address reach the admins of the spaces linked to it, never another
space. Crawled by `exposure-money.spec.ts`, which gains a paid-directly space with two tutors.

## Screens (web and app together)

- **Finance tabs:** a paid-directly space shows each family's balance per tutor, a "Record a payment
  you received" action for tutors, and no tutor pay, advances or 1099s.
- **The dashboard's Finance tab** and the tutor's Home follow.
- **The console:** Organizations, and the organization choice on a space.

## Seed and tests

- **Seed:** a paid-directly tutor space `solo` (two tutors, three families, lessons and payments in
  each direction they allow), and the existing spaces linked to businesses.
- **Tests:**
  - `tutor-spaces.spec.ts`: recording, balances per tutor, refusals, the switch going forward;
  - R24 in the exposure crawl;
  - `@compat`: spaces made before Phase 54 have their own organization and work as before;
  - Maestro flows under `tutor-spaces/`.

## Production

The SQL above, the backfill (one business per organization, linked), then the deploy. Every existing
space keeps working exactly as today.
