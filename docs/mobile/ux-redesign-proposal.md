# Mobile redesign proposal: warmth and workflows

Proposal, 2026-10-14. **Not scheduled**: nothing here is built until the owner chooses a palette
and the workflow pattern, and the work is written into `docs/mobile/progress.md`. The visual
version, with palette swatches and phone mockups, is the artifact "Aimtrue Warmth Redesign" linked
from the session that wrote this.

The owner's brief: "This is an educational family based app. The colour palette should exert warmth
and workflows should be intuitive." The complaint: adding a student (and similar tasks) "launches a
full page web like form that needs scrolling".

## Sources

- **mobile-design** skill (danstrem2/antigravity-master-pack, `skills/mobile-design`, listed on
  mcpmarket as "Mobile App Design & UX Patterns"): SKILL.md, touch-psychology, mobile-navigation,
  mobile-color-system, mobile-design-thinking. Used: thumb zone and Fitts' law, one primary action
  per screen, chunking long forms into steps, smart defaults, Miller's 5±1 on mobile, modal vs push
  ("sheet for quick tasks, full screen for complex forms"), semantic colour rules, emotion in touch.
  Its `scripts/mobile_audit.py` (a read-only regex scan) was run on `apps/mobile/src`.
- **color-palettes** skill (svengraziani/ui-design, listed on mcpmarket as "UI Color Palettes"):
  50–900 ramps, the 80–90% neutral / 5–10% primary / 5–10% supporting proportion, warm grey
  neutrals, semantic red/yellow/green/blue.
- This repo's own `docs/mobile/immersive-design.md` and `docs/mobile/ux-audit.md` (2026-10-10),
  whose non-negotiables still outrank everything here.

## Method

- 226 named screenshots from the Maestro flows (iOS 27, iPhone 17; light and dark), read as tiled
  sheets: every role's Home, the lists, the record screens and all 17 form sheets.
- Code: `src/theme/*`, `apps/web/src/index.css` (the palettes' source), the person, session,
  schedule, reflection and assessment forms.
- Contrast: WCAG 2.2 ratios computed for today's indigo and each proposed palette.

## What makes it feel cold

1. **Cool neutrals everywhere.** Each organization palette tints its whites, greys and borders with
   the brand hue. Indigo (the demo organization), slate (the platform) and teal give blue-white
   backgrounds, blue-grey text and white cards on near-white. The brand colour is fine; the 80–90% of
   the screen that is neutral is what reads clinical.
2. **One colour does every job.** The primary is the button, the selected chip, the "Next up" card,
   the big title, the active tab and the progress line. Nothing is warm, celebratory or soft.
3. **Dashboard tone.** Home opens with a 34pt "Home", the person's name, the organization, role chips
   and a tab switch: about 45% of the first screen before any content. Then uppercase stat tiles
   ("STUDENTS 50"). It reads like an admin console, including for a parent or a child.
4. **Small type.** 33 places set text at 10–11pt (stat labels, badges, captions); the guidance floor
   is 12pt. Uppercase micro-labels add to the dashboard feel.
5. **The system font only**, with no warmer display face for headings.

## Why the workflows feel like web forms

1. **Whole-record sheets.** Add or edit a person is one sheet holding every field the web form has:
   name, email, phone, roles, status, tutor details (education, school, area, notes, mailing address,
   virtual, SSN on file, longest session, top-up), student details, availability (15 hour chips per
   day, picked one day at a time), payment handles, guardians with relationship chips. It is several
   screen-heights. Tax and payment setup sit in the same scroll as a child's name.
2. **Errors far from their field.** "Please correct the highlighted fields" appears at the foot, by
   Save, while the field at fault is screens above.
3. **The primary action at the end of the scroll.** Save sits below everything; in the guidance's thumb
   zone terms the main action should be pinned within reach, always visible.
4. **Create actions in the hard-to-reach zone.** "+" sits top-right on Sessions, Users, Billing,
   Schedule. Different per screen, and at full stretch for one-handed use.
5. **Long choice grids.** Availability (7 × 15 hour blocks), topic ratings (a 1–5 row for every topic
   of a level, 20+ rows), duration chips with 6–12 options.
6. **Numbers where words belong.** The student's reflection asks four 1–5 questions with small
   captions under the numbers. A ten-year-old reads "3" as a grade, not as "about right".
7. **Dense list cards.** A session card carries mode, write-up excerpt, homework badge, two score
   squares, "Student reflected", "Too fast" and two actions.

What already works and stays: native date/time pills, segmented choices, duration chips, sheets with
grabbers and unsaved-change guards, haptics, skeletons, pull to refresh, dark mode, the privacy
cover, the tour, the Tutoring/Finance split, money only through `SessionMoney`.

## The audit script

`mobile_audit.py` checked 407 files: 46 "issues", 1,544 "warnings". Most warnings are per-file
heuristics that miss our central theme, safe areas and error handling (224 "no dark mode", 218 "no
SafeArea"). Worth acting on: text under 12pt (33), list keys built from the index in a few lists
(comments, activity, billing, schedules, people), and small targets to verify by hand (comment count
badge, chart points, the live banner's close).

## Colour: two layers

**Layer 1, for every organization: a warm foundation.** Neutrals stop following the brand hue and
become one warm ramp (cream background, warm-grey text and borders). Add a warm accent for
highlights and celebration, and a semantic set that is never the brand colour. Organizations keep
their brand colour for buttons and selection, so the institute's plum and a customer's indigo both
sit on a warm page.

**Layer 2, the platform's own palette (and new organization choices).** Three options. All pass
WCAG AA (figures computed on the proposed hex values):

| | A. Hearth | B. Meadow | C. Sunlit Slate (recommended) |
| --- | --- | --- | --- |
| Primary | terracotta `#B4502A` | sage `#3F6E52` | the logo's slate `#30577D` |
| Accent | honey `#F2A93B` | apricot `#F0956A` | the logo's amber `#F6B740`, coral `#E8765A` for celebrations |
| Background | cream `#FBF6EF` | oatmeal `#F8F6EF` | cream `#FAF6EF` |
| Ink / muted | `#2B211B` / `#6F6157` | `#22261F` / `#626657` | `#26221E` / `#6B635A` |
| White on primary | 5.10 | 5.89 | 7.54 |
| Muted on background | 5.54 | 5.46 | 5.48 |
| Trade-off | warmest; terracotta strays from the slate logo | calm; green primary collides with "success" green, so success moves to teal | keeps the app icon's colours; warmth comes from the ground, amber and coral |

Common to all three: success `#3E7B55`, warning text `#9A6512` on a honey tint, error `#B3321E`,
info blue. A control outline of at least 3:1 (`#968676`-ish), because 1.2:1 hairlines are fine for
dividers but not for an input's edge. Selected-chip text one step darker than the primary where the
tint is light (Hearth's primary on its tint is only 4.32:1). Dark mode: a warm near-black
(`#1C1613`-ish), text at `#F4ECE3`, the primary lightened and desaturated.

Today's indigo, for comparison: muted text on the background is 4.66:1 (passes, barely); the
skill's guidance lists purple/violet as an over-used AI default.

**Type.** Headings in Nunito (rounded, friendly, open licence, `@expo-google-fonts/nunito`), body in
the system font. Nothing under 12pt. Sentence case labels instead of uppercase micro-labels.

**Where it lives.** The app's palettes are generated from `apps/web/src/index.css`
(`scripts/generate-palettes.mjs`), so the warm foundation changes the web portal too, unless it is
split. Recommendation: let the portal warm up with the app.

## Workflows: one rule per kind of surface

| Surface | Use it for | Rules |
| --- | --- | --- |
| **Quick sheet** | one decision or up to 3 inputs: record a payment, cancel a lesson, add a location, start a lesson | never scrolls at default text size; the action is pinned at the bottom; opens with smart defaults from where you came from |
| **Step flow** | anything longer: add a student, add a tutor, schedule a lesson, write up a lesson, a learning plan | full-screen modal; "Step 2 of 5" with a progress bar; one topic and at most 3 inputs per step; Back/Next pinned in the thumb zone; optional steps say Skip; a Review step with edit links; autosaved draft and the unsaved-changes guard |
| **Section edit** | changing an existing record | the record's detail screen has sections (Contact, School & goal, Availability, Lessons & price, Pay & tax, Family); Edit on one opens a quick sheet with that section only. The form already supports `sections`. |
| **Search picker** | choosing a person, a topic, a location | a sheet with search on top, recent and suggested first, large rows |
| **Confirm** | delete, remove, sign out | the platform alert (iOS) or Material dialog (Android); reversible actions use an undo toast instead |
| **Full page** | reading: a person, a lesson, progress | never data entry |

**One create button.** A "+" in the middle of the tab bar (thumb zone) opens an action sheet with
the reader's own actions: Record a lesson, Start a lesson, Schedule a lesson, Add a student, Record a
payment. The scattered top-right "+" buttons go.

## Flows, redesigned

1. **Add a student** (admin): Student (name; email only "if they'll sign in themselves") → Family
   (search existing parents as cards, or "New parent" with name and email) → School & goal (skippable)
   → When can they learn? (a week of Morning / After school / Evening toggles, 21 instead of 105;
   "Fine-tune hours" for the exact grid) → Lessons & price (in person/online, longest lesson, the
   family's rates) → Review → "Sofia is added. Next: assess, plan, pair with a tutor" (the wizard's
   existing next steps). Errors show on the step that owns the field.
2. **Add a tutor**: Basics → Teaching (school, area, online) → Availability → Pay (rate, top-up).
   Mailing address and "SSN on file" move out of creation into a "Finish tax setup" task card on the
   tutor's record, shown to admins until done.
3. **Record a lesson**: from Next up (or the create button) a quick sheet already says "Sofia · today
   4:00–5:00 · Institute, room 2" with "It ran as planned" and "Different times". Then an optional step
   flow for the write-up: four cards (Planned, Covered, Homework, Progress), each skippable, with the
   dictation button large. Tutoring carries no money, as today.
4. **Schedule a lesson**: Who → When (day chips, time wheel, length chips) → Where (location cards,
   in person and online) → Review, written as a sentence: "Every Monday, 4:00–5:00 PM, at Institute,
   room 2, starting Oct 19."
5. **The student's reflection**: one question per card, answers in words with a face scale ("Not
   really · A little · Some · A lot · Loads"), large targets, progress dots, then the homework note
   and a thank-you. The 1–5 stays the stored value; difficulty and pace stay centred on 3.
6. **Assessment**: planned topics first; one topic per row with a five-step pill that shows its word
   ("Getting there") when chosen; levels collapsed until opened.
7. **Record a payment**: quick sheet with a large amount field, who (pre-filled from the screen it was
   opened from), method chips; date and reference under "More details". Finance only, as today.
8. **Home**: a greeting ("Good afternoon, Priya") and Today first ("2 lessons today, next at 4:00 with
   Sofia"), then a compact strip of figures. Role chips move into the account menu. Parents and
   students get child-centred cards: next lesson, this month's progress, a milestone when a topic is
   mastered (a small celebration, stilled by reduce motion).

## Order of work (after the owner's choices)

1. **Foundation**: the warm neutral ramp in every palette, the chosen platform palette, semantic
   tokens, the heading font, the 12pt floor. Web and app together (one CSS source).
2. **Surface kit**: `StepFlow` (progress, pinned footer, draft, guard), `QuickSheet`, section edit on
   the record screens, `SearchPicker`, the create button and its action sheet.
3. **Flows**: Add a student and Record a lesson first (the daily ones), then the reflection, Schedule,
   Add a tutor, payment, assessment.
4. **Homes**: the greeting and Today, the family cards.

Each step keeps its Maestro flows green on iOS and Android (testIDs move with the controls) and the
non-negotiables of `immersive-design.md` §0: no money under Tutoring, nothing personal on a system
surface, nothing across organizations.

## Decisions for the owner

1. Palette: A Hearth, B Meadow or C Sunlit Slate (recommended).
2. Warm the web portal too (recommended), or the app only.
3. Rounded heading font (Nunito): yes or no.
4. Create button: in the middle of the tab bar (recommended) or floating above it.
5. Which flows first (recommended: Add a student, Record a lesson, the reflection).
