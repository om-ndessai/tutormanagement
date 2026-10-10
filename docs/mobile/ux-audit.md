# Mobile UX audit (Phase 2, item 37)

Audited 2026-10-10 on branch `mobile-app` at `ad55802`, after the Phase 1 gate. This audit
decides what Phase 2 builds and in what order. It changes no app code. Each fix batch in
[Fix batches](#fix-batches) becomes one commit and one unchecked item in
[progress.md](progress.md).

The research behind the fixes is [immersive-design.md](immersive-design.md). Its non-negotiables
(§0) outrank every finding here. Nothing below adds money to the Tutoring tab, puts a name on a
system surface, or lets anything cross organizations.

## Method

**Heuristics.** Each screen was scored against:

- Nielsen's ten heuristics, cited as H1 to H10:
  - H1 visibility of status
  - H2 match with the real world
  - H3 user control and freedom
  - H4 consistency and standards
  - H5 error prevention
  - H6 recognition rather than recall
  - H7 flexibility and efficiency
  - H8 minimalist design
  - H9 error recovery
  - H10 help
- The HIG and Material checklist in immersive-design.md §17, cited as "§17 <group>".
- The research sections it rests on, cited as §1 to §16.
- Platform minimums:
  - targets of 44 pt on iOS and 48 dp on Android
  - contrast of 4.5:1 for text and 3:1 for UI
  - Dynamic Type at AX5 and Android font scale 2.0

**How the walk was done.**

1. **Screens on the devices.** A generated Maestro walk signed in as each persona with the dev
   link (`tour=seen`) and opened every route by deep link. It waited for loading to end, then
   took a screenshot. Forms were opened and dismissed. The flows and screenshots are in the
   session scratchpad and are not committed. Screenshots are cited as
   `<platform>/<pass>-<persona>-<nn>-<route>`, where the pass is:
   - L: light
   - D: system dark
   - A: in-app Dark while the system is light
   - X: largest text

   Every screenshot was read back. Gate artifacts in `apps/mobile/.maestro/out/` (gitignored)
   were used where they already show a state, such as a toast over the tab bar.
2. **Code.** A static read of `apps/mobile/src` for:
   - target sizes, haptics, reduce motion and pull-to-refresh
   - loading and empty states, toasts and privacy
   - header colour scheme, gestures and Dynamic Type
   - screen-reader roles, lists, offline and form guards

   Evidence is given as `file:line`.
3. **What SDK 57 can do.** Checked against the published SDK 57 packages (`npm pack`; `.d.ts`,
   config plugins, CHANGELOGs) and docs.expo.dev v57, on 2026-10-10. See
   [Platform facts](#platform-facts-sdk-57-checked-2026-10-10).
4. **The three intermittent gate flows.** Diagnosed from their own failure artifacts: log,
   screenshot and view hierarchy.

**Coverage.**

| Persona | Org | iOS 27 (iPhone 17) | Android 37 (Medium Phone) |
| --- | --- | --- | --- |
| Priya, admin + tutor | chmi | L (all 23 routes, 4 forms), D, A, X | L (all 23 routes, 4 forms), D, X |
| Alex, tutor | chmi | L (14 routes + Start/Record), D, X | L, D, X |
| Anita, parent | chmi | L, D | L, D |
| Sofia, student | chmi | L, X | L, X |
| Maria, parent + tutor | chmi | L | L |
| Rosa, org-B admin | riverside | L (palette switch) | L |
| Nav, platform admin | none | L (console: organizations, people, admins, activity, form) | L |

The core jobs were walked end to end from the existing self-cleaning flows:
- `sessions/record`, `sessions/live`
- `schedule/cancel-restore`, `billing/admin`
- `search/admin`, `shell/navigation`

Device settings were put back afterwards: appearance light, content size `large`, font scale
1.0, the local DB reset.

## Measured

### Tap counts for the core jobs

Counted from a cold Home with the data in place. Typing is counted as one step per field.
"Ideal" is the target the fixes aim at.

| Job | Persona | Path today | Taps | Ideal | Where the time goes |
| --- | --- | --- | --- | --- | --- |
| Start a live lesson | Alex | Sessions tab → Start a lesson → student → Start now | 4 | 2 | Not on Home, although Home's "Next up" card already knows the student. No quick action. |
| Stop a live lesson | Alex | banner Stop → Stop | 2 | 2 | Good. The banner is on every screen. |
| Record a lesson | Alex | Sessions tab → Record a session → student → length → (homework, notes) → Save | 5 + typing | 3 | Not on Home. The student list is expanded but nothing is preselected, even for a tutor with two students. Save sits at the end of a long sheet. |
| Cancel one date | Priya | Schedule → scroll to the series → Dates → the date's ✕ → Cancel lesson | 4 + scroll | 2 | Two levels of disclosure. The ✕ is a 36 pt icon (`schedule-dates.tsx:236`). No swipe, no menu. |
| Restore a cancelled date | Priya | Schedule → Dates → Restore (or the Cancelled lessons panel on Sessions) | 3 | 1 (Undo) | No Undo on the cancel toast. |
| Record a payment | Priya | More → Billing → Record a payment → party search + type → party → amount + type → method → Save | 7 + 2 typing | 4 | Only reachable from Billing under More. No entry from a family's or tutor's balance row. |
| Find a person | Priya | header search → type → result | 2 + typing | 2 | Good. The field focuses itself. People under More adds two taps. |
| Switch organization | Priya | account button → organization | 2 | 2 | Good. The 32 pt account button is the weak point. |

### Targets under 44 pt / 48 dp

Paper's `IconButton` is `size + 16` with a built-in hitSlop of 6 (iOS) and 10 (Android). So most
icon buttons pass on hit area but fail visibly, and fail outright where neighbours' slops
overlap. The worst:

- **Header**, on every tab root:
  - The account button is 32×32 with `hitSlop={8}` (`account-button.tsx:32-37`).
  - Search and view-as are 38 pt (`search-button.tsx:10`, `dashboard-screen.tsx:41`).
  - The three sit 4 pt apart (`account-button.tsx:55`).
- **34 pt (size 18):**
  - the topic ladder's move up, move down and remove (`topic-pickers.tsx:259,271,283`)
  - the tour offer's close (`onboarding-provider.tsx:267`)
- **36 pt (size 20):**
  - the live banner's Discard ✕ (`live-session-banner.tsx:206`)
  - delete comment (`comment-delete-button.tsx:64`)
  - cancel a date (`schedule-dates.tsx:236`)
- **40 pt (default 24):**
  - the four icons on each schedule card (`schedule-card.tsx:85-102`)
  - the three on each pairing (`pairings-screen.tsx:96,200,207`)
  - payment edit and delete (`payment-log.tsx:134,141`)
  - the people row ⋯ (`user-card.tsx:116`)
  - the header + buttons on Sessions, Users, Schedule and Billing
- **32 pt chips with no hitSlop:**
  - every filter row: sessions range, people roles, comments, progress, activity
  - activity's chip close ✕, which is smaller still
- **Session cards** are `accessible={false}` (`session-card.tsx:76`). For a screen reader, the
  only target on a card is a 20 pt chevron.
- **Picker rows in sheets** measure about 44 dp on Android (`android/L-priya-20-record-session`,
  `-21-payment-form`), under Material's 48.

### Contrast

- **iOS header buttons in dark mode: the worst contrast in the app.** It shows in system Dark
  (`ios/D-priya-00-landing`, `-03-sessions`, `-06-schedule`, `-10-people`, `-13-billing`). It
  also shows in in-app Dark while the system is light, the case noted in #25 and #33
  (`ios/A-priya-*`).
  - **On tab roots**, the glass capsule behind view-as, search and + renders pale grey. The
    icons on it are painted in the app's dark-theme colours (`onSurfaceVariant` for search and
    view-as, `search-button.tsx:7-14`; `primary` for +), so they are close to invisible.
  - **On pushed screens**, the + on Users and Billing almost disappears into its grey circle,
    and the back chevron is weak.
  - **Likely cause:** the app has no navigation `ThemeProvider` (said in `stack-options.ts`'s
    own comment), so the native stack is told it is light while the page is dark. The app also
    never calls `Appearance.setColorScheme`, so the in-app choice never reaches the native
    trait.
  - **The tab bar** takes the system trait. It is right in system Dark, but in in-app Dark it
    keeps its light material, with the app's pale labels on it (`ios/A-priya-01`).
  - **Android draws its own header and is fine** (`android/D-*`).

- **Everything else reads clearly** in every screenshot, on both palettes (chmi indigo,
  riverside teal), light and dark. This is judged by eye; no contrast tool was run.
  - Status tints such as Past due, Behind and On track are tinted fills with dark ink.
  - The Next up card is white on `primary` in light, and dark ink on a pale `primary` in dark.
  - Muted secondary text holds up on `background`.
  - Measuring the tokens (every palette, plus iOS Increase Contrast, which has no simulator CLI
    toggle) goes on B3's checklist.

### Largest text (iOS AX5, Android 2.0)

The worst-scoring area of the audit; see F-12. Text scales everywhere (nothing sets
`allowFontScaling={false}`), but almost nothing adapts to it:
- The Tutoring/Finance switch and the primary buttons truncate ("Tutor… / Fina…", "Record a
  ses…").
- Stat grids stay two columns. Labels cut to "SESS…" and values wrap word by word.
- The week strip breaks day names letter by letter.
- The account button's initials are clipped.
- Icons do not scale.
- Page intros fill the first screen.
- Carousel cards and the live banner are fixed sizes.

### Loading, refresh, empty

- **Skeletons:** on 11 data screens.
- **Spinner instead of a skeleton:**
  - Home's first load, the most-seen wait (`dashboard-screen.tsx:155`, "Loading your
    dashboard…")
  - session detail, person detail, profile, Organization, the platform screens and every form
    sheet
- **Pull-to-refresh:** on every tab root and list. Missing on:
  - the comment thread
  - the view-as picker
  - Search
  - the organization picker (memberships and invitations)
- **No empty state:**
  - the tutor and student ledgers on Billing (`billing-ledgers.tsx:122,154,187`)
  - the platform admins list
  - dashboard sections other than the spotlight

### Haptics

Every action the brief lists has one, mostly through the toast (`toast.tsx:30-31`). Three
problems:

1. **About 15 call sites fire twice:** a direct `haptics.success()` or `error()` followed by a
   toast of the same tone. Examples:
   - `payment-form-sheet.tsx:171-172,186-187`
   - `payment-log.tsx:43-44`
   - `organization-settings.tsx:126-127`
   - `comment-delete-button.tsx:42-44`
   - `use-confirm-delete.ts:22-27`
   - `record-session-sheet.tsx:221-222`
2. **The cancel sheet fires warning then success** back to back (`cancel-lesson-sheet.tsx:107,112`).
3. **There is no Haptics switch** in Profile, which §7 and Apple ask for (`storage.ts:9-16`,
   `profile-screen.tsx:55-57`).

### Motion

- **App animations** all check `useReducedMotion`:
  - count-up, chart, skeleton pulse, the banner pulse
  - autosave fade, tour, theme fade, the activity filter sheet
- **Paper's `theme.animation.scale` is never set** (`paper-theme.ts:56-107`), so Snackbar,
  Menu, SegmentedButtons and the TextInput label animate under Reduce Motion.
- **Count-up re-renders the StatCard on every integer step for 900 ms**
  (`use-count-up.ts:27-31`). Harmless on iOS. On Android, it adds JS-thread work during the
  slow first paint.

### Performance (Android Intl, lists)

- **Per-screen settle time.** Measured from the deep link to the screenshot. A fixed Maestro
  overhead of about 3.5 s is in every figure.
- **Most screens settle at the same time** on both platforms: 3.5-4.4 s.
- **Android is slower on:**

  | Screen | Android | iOS |
  | --- | --- | --- |
  | session detail | 6.2 s | 3.7 s |
  | a student's progress (chart) | 7.5 s | 3.9 s |
  | Billing | 6.5 s | 4.9 s |

  Each of these formats many dates or amounts in one render. That matches the Intl finding:
  Hermes on Android formats 30-45x slower, and `intl-cache.ts` helps repeats, not first
  renders.
- **Home's carousel re-renders every card every 30 s** (`sessions-carousel.tsx:41`). Each card
  calls `toLocaleDateString` (`carousel-model.ts:26`).
- **Lists built with `.map` inside a ScrollView** that grow with the data:
  - Billing ledgers and the payment log
  - Pairings, Schedule and the Progress list
  - the comment thread, Search results and the platform lists

  Sessions, People, Activity and Comments use FlashList.
- **Not measured: cold start in a Release build** (§17 "Perceived performance"). The dev build
  loads JS from Metro, so its numbers mean nothing. Measuring it is on B4's checklist.
- **Android first paint.** The first dashboard paint still stalls 20-90 s on a long-running or
  one-core emulator (progress.md notes). That is an environment cause, not an app one.

## Findings

Severity:
- **P1**: breaks a rule, loses data, or hurts a core job every day.
- **P2**: friction on a core job, or a platform convention missed.
- **P3**: polish.

Effort is S (under 2 h), M (half a day) or L (a day or more, or a native module).

### P1

**F-1. The app switcher shows Finance, Billing, the parent's money and the 1099 on iOS.**
- **Screens:** Home Finance tab, Sessions Finance tab, Billing, payment form, 1099, Organization
  (TIN), the parent's Home (amounts at the top: `ios/L-anita-01-dashboard`).
- **Platform:** iOS, always. Android protects Finance, Billing and the payment form in the
  production variant only; it never protects the parent's Home or Organization.
- **Evidence:**
  - **Seen on the simulator.** Priya on Home Finance; then backgrounded by launching Settings.
    The snapshot iOS wrote for the app switcher, in the app's container under
    `Library/SplashBoard/Snapshots/sceneID:…/*.ktx` (converted with `sips`), shows every
    figure on the screen:
    - Owed to tutors $3,962.74, Owed by families $5,059.75
    - Billed $20,623.75, Kept $5,073.50
    - Maria Okafor's top-up row

    The image also sits on disk until the next snapshot replaces it.
  - `enableAppSwitcherProtectionAsync` is never called.
  - `SecureMoney` (`secure-money.tsx:14`) applies FLAG_SECURE only when Android and
    `APP_VARIANT === 'production'`.
  - The 1099's AppState clearing (`form-1099-sheet.tsx:107-120`) is a React state update. It is
    not guaranteed to land before the iOS snapshot, and the amount stays.
- **Rule:** non-negotiable §0.4 and §13 ("use the native API, not a JS overlay"); §17 "Money and
  privacy".
- **Fix:**
  - iOS: `enableAppSwitcherProtectionAsync(1.0)` while signed in to an organization;
    `disableAppSwitcherProtectionAsync` on sign-out. This is a full-strength blur, the only
    option expo-screen-capture 57 has. A branded cover would need a native module (§13 prefers
    a cover, but notes that the blur can leave large text legible). Verify the way this audit
    found it, by reading the SplashBoard snapshot after backgrounding on Finance, at AX5
    too.
  - Android, production variant: extend FLAG_SECURE to the Organization screen (TIN) and to the
    parent and student Home, whose money has no Tutoring/Finance split.
- **Effort:** S. No native rebuild (expo-screen-capture is installed).
- **Batch:** B1

**F-2. Toasts cover the tab bar and swallow the next tap. Under a sheet they are not seen at
all.**
- **Screens:** every tab, and every form sheet.
- **Platform:** both.
- **Evidence:**
  - "Session recorded: 3:00 AM–3:15 AM" sits on the tab labels in
    `.maestro/out/ios/2026-10-10_012251/live/takeScreenshot/live-stopped.png` and
    `.maestro/out/android/2026-10-10_033213/live/takeScreenshot/live-stopped.png`.
  - #35 found that "a toast over the tab bar swallows a tab tap until it goes".
  - The host is one Paper Snackbar at the root (`toast.tsx:47-58`), bottom 0 plus the safe area.
    It has no tab-bar or banner offset, though `TAB_BAR_ABOVE_INSET` exists
    (`live-session.ts:39`).
  - Toasts raised from a sheet render under it (`record-session-sheet.tsx:161`,
    `comment-thread.tsx:102`).
- **Rule:** H1 and H3; §17 "Layout and system" ("FAB and live banner clear the … tab bar").
- **Fix:**
  - A toast offset hook. On a tab, add `TAB_BAR_ABOVE_INSET`; with the live banner, add
    `BANNER_HEIGHT + BANNER_GAP` (the `LiveBannerInsetContext` value).
  - Render the Snackbar in a Portal host that sits above native sheets. On iOS that is
    react-native-screens' `FullWindowOverlay`; on Android a root Portal.
  - Keep the 6 s duration for toasts with an action.
- **Effort:** M.
- **Batch:** B3

**F-3. Swipe-down closes a half-filled form and loses it.**
- **Screens:** the payment, person, schedule, assignment, assessment, plan, reflection, cancel,
  1099 and organization sheets. Record a lesson is protected by its autosaved draft.
- **Platform:** both. Android back does the same.
- **Evidence:**
  - No `usePreventRemove`, `beforeRemove` or `gestureEnabled` anywhere.
  - No dirty tracking (`src/app/(org)/_layout.tsx:24-165`).
- **Rule:** H5 and H3; §5 ("Forms with unsaved changes set `gestureEnabled: false` once dirty,
  or intercept the dismiss and offer Keep editing / Discard").
- **Fix:**
  - A `useDirtyGuard(dirty)` hook. It sets `gestureEnabled: false` while dirty, and uses
    expo-router's `usePreventRemove` to confirm "Discard changes?" on back or Cancel.
  - A `warning` haptic on the prompt.
- **Effort:** M.
- **Batch:** B5

**F-4. iOS header buttons are close to invisible in dark mode.**
- **Screens:** every tab root's header (view-as, search, +, account) and pushed screens' back and
  + buttons.
- **Platform:** iOS.
- **When:** system Dark, and in-app Dark while the system is light.
- **Evidence:** `ios/D-priya-00-landing`, `-06-schedule`, `-10-people`, `-13-billing`; Contrast
  above; #25 and #33 notes.
- **Rule:** §1 ("controls use system colours, or custom colours with light, dark and
  increased-contrast variants"); WCAG 3:1 for UI; H4.
- **Fix:**
  - Wrap the stacks in expo-router's `ThemeProvider` with a navigation theme built from the
    Paper theme: `dark` from the app's resolved mode, colours from tokens. This also lets the
    small-bar background hack in `stack-options.ts` go.
  - Call `Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode)` when the
    appearance setting changes, so the native header, glass and tab bar take the app's trait.
  - Then move the header buttons to native `Stack.Toolbar` items, or give them `onSurface` tints
    checked at 3:1 on both materials.
  - Screenshot the D and A passes again.
- **Effort:** S-M.
- **Batch:** B3

**F-5. Header and inline icon targets are under 44 pt / 48 dp.**
- **Screens:** see [Targets](#targets-under-44-pt--48-dp).
- **Platform:** both.
- **Evidence:** the file:line list above.
- **Rule:** §12 and §17 "Accessibility"; HIG 44 pt; Material 48 dp; WCAG 2.5.8.
- **Fix:**
  - Header buttons: a 44×44 hit frame (visible 36, `hitSlop` to 44, 8 pt apart).
  - Icon buttons at size 18-20: size 24 and `MIN_TARGET` frames.
  - Chips: `minHeight: MIN_TARGET` hit frames through hitSlop.
  - Make the whole session card the button (`accessible`), with the chevron decorative.
  - Picker rows: 48 dp on Android.
  - Add a Jest check that sizes `IconButton`s against `MIN_TARGET`.
- **Effort:** M.
- **Batch:** B3

**F-6. The tutor's main job, starting the lesson that is about to happen, is four taps and
off Home.**
- **Screens:** Home (tutor), Sessions, the Start sheet.
- **Platform:** both.
- **Evidence:**
  - `ios/L-alex-01-dashboard`: the Next up card says "Today · 10:00 AM, Ben Whitfield" and has no
    action.
  - The Start sheet preselects nobody (`ios/L-alex-13-start-lesson`).
- **Rule:** H7 (accelerators); plan.md Phase 2 "quick actions (Start/Record lesson)".
- **Fix:**
  - A **Start** button on the Next up card, shown when the card is within the start window and
    the reader is its tutor. It opens `start-lesson?student=<id>&mode=<schedule mode>`, with
    both preselected, so it is 2 taps.
  - Record a session from a past carousel card prefills that pairing and date.
  - Also expose Start/Record as quick actions (F-17).
  - No money is involved; the Start sheet already has none.
- **Effort:** M.
- **Batch:** B6

**F-7. Three gate flows are intermittent.** All three fail on flow timing, and two also point at
an app fix.
- **`sessions/list-tutor` (iOS):**
  - **What fails:** the tap on `sessions-range-this-month` lands on the status bar.
  - **Why:** after "Your pay" and back, the chip row sits under the transparent bar, which
    scrolls the list to the top instead. See `list-tutor.yaml:122-127`, and the failure
    screenshot `step-078` showing "All time" still selected.
  - **Fix:** scroll up to the chip with `centerElement: true` before the tap.
- **`people/delete-restore` (iOS):**
  - **What fails:** the simulator keyboard drops keys in the confirm-name field ("jae x").
  - **Why:**
    - The field is controlled, so it re-renders on every key.
    - It has `autoCapitalize="words"` while the flow types lower case.
    - The dialog moves with the keyboard height (`hard-delete-dialog.tsx:42,53-63`).
  - **Fix (app):** `autoCapitalize="none"`, `spellCheck={false}`, `autoComplete="off"`, and an
    uncontrolled input.
  - **Fix (flow):** `waitForAnimationToEnd` before typing, `eraseText: 30`, three retries.
- **`people/edit` (Android):**
  - **What fails:** the email error is below the fold.
  - **Why:** Save fails, and the error block is inserted above the button
    (`person-form.tsx:480-489`), so the second message drops below the fold.
  - **Fix (flow):** `scrollUntilVisible` the email message.
  - **Fix (app):** scroll the form to its error block on a failed save. That helps every user
    (H9).
- **Effort:** S.
- **Batch:** B2

**F-12. The largest text sizes break the layouts on every main screen.**
- **Screens:** Home, Sessions, Schedule, Progress, More, Users, Billing, the sheets.
- **Platform:** both.
- **Evidence:** `ios/X-priya-*`, `ios/X-sofia-*`, `ios/X-alex-*` (AX5) and `android/X-*`
  (font scale 2.0). What breaks:
  - **The Tutoring/Finance switch** reads "Tutor… / Fina…". The main control of the two-tab rule
    becomes unreadable (`X-priya-01`, `X-sofia-02`).
  - **Buttons are cut off:**
    - "Record a ses…", "Schedule a s…", "Add all to cal…", "Record a pay…" (`X-priya-03`,
      `-06`, `-13`)
    - "Comme…" on More (`X-priya-09`)
    - the Users search placeholder runs off the field
  - **Stat cards:**
    - labels truncate to "SESS…", "TIME…", "STU…" (`stat-card.tsx:95` `numberOfLines={1}`)
    - values wrap a number word by word: "2 / hr / 30 / min" (`X-sofia-01`)
    - the grid stays two columns (`stat-card.tsx:161-176`)
  - **The week strip** breaks its day names letter by letter, "S u", "M o" (`X-sofia-03`,
    `week-strip.tsx`).
  - **The account button's initials** are clipped to an unreadable fragment, because the button
    is a fixed 32×32 (`account-button.tsx:35-36`).
  - **Names truncate** in Progress ("Sofi…", `X-sofia-04`).
  - **Icons stay at their base size** beside text two to three times larger, so leading icons
    turn into specks.
  - **Intro sentences and the dashboard header fill the first screen.** At AX5, Home shows the
    name, organization, role chips and the switch, and no data
    (`X-priya-00`, `X-priya-03` and `-10` pages open on a paragraph).
  - **The carousel and the live banner are fixed sizes:**
    - card widths (`carousel-model.ts:52-56`)
    - `CARD_HEIGHT 150` (`sessions-carousel.tsx:143,237`)
    - `BANNER_HEIGHT 64`, used as a fixed content inset while the banner grows
      (`live-session-banner.tsx:31,90,159`)
  - **Android at 2.0** (`android/X-priya-01`, `-03`, `-21`, `X-sofia-03`) is milder than AX5
    but breaks the same places:
    - the week strip's "Mo / n", "We / d"
    - the carousel's "NO / W" marker
    - "TIME TAU…" and "SESSIONS …" labels
    - the selected tab label truncates to "Sessi…", "Sche…"
    - "Received from parent" overflows its segmented button on the payment sheet
    - the account initials outgrow their circle
  - **At the default size too:** "EXPECTED BY TOD…" (`ios/L-priya-08-progress_…`) and
    "231 hr 15 / min" (`ios/L-priya-03-sessions`).
- **Rule:**
  - §12: support 200%, no truncation; StatCard rows wrap to one column, and "the one-height
    rule yields to legibility".
  - §17 "Accessibility".
  - HIG Dynamic Type; WCAG 1.4.4.
- **Fix:**
  - **A `useLargeText()` hook** (`fontScale >= 1.35`) that the layouts switch on.
  - **Switches and stats:**
    - the Tutoring/Finance switch and other segmented controls stack vertically, or drop their
      icons and allow two lines
    - `StatGrid` goes to one column; stat labels take two lines
    - values use `adjustsFontSizeToFit` with a floor, and never break inside a number
  - **Buttons:** wrap (no `numberOfLines={1}`) and stack full width.
  - **Week strip:** one-letter day names and the count, or a horizontally scrolling strip with
    fixed minimum widths.
  - **Account button:** sizes from the font scale (`minWidth: MIN_TARGET`), or shows one
    initial.
  - **Icons:** scale to the font (`size * Math.min(fontScale, 1.6)`).
  - **Intros:** page-intro sentences collapse into an info button, or are hidden under large
    text.
  - **Carousel:** card widths scale (capped at the screen width minus gutters), with
    `minHeight`.
  - **Banner:** its height is measured with `onLayout` and published through
    `LiveBannerInsetContext`.
  - **Header chrome:** cap `maxFontSizeMultiplier` (about 1.5) only on fixed chrome (tab labels,
    chips), as §12 allows.
- **Effort:** M-L.
- **Batch:** B4

### P2

**F-8. No swipe actions or long-press menus anywhere. Every card carries three or four 40 pt
icons instead.**
- **Screens:**
  - schedule cards (comment, calendar, edit, delete) and schedule dates (cancel)
  - pairings (comment, edit, remove)
  - payments (edit, delete)
  - people rows (⋯ menu only)
  - session cards (Assess, chevron)
  - comments (delete own)
- **Platform:** both.
- **Evidence:**
  - `ios/L-priya-06-schedule`, `-12-pairings`, `-13-billing`.
  - No `ReanimatedSwipeable`, `Link.Menu` or `onLongPress` in `src`.
- **Rule:** H7 and H8; §8 ("match top menu actions to swipe actions"; destructive swipes run with
  an Undo snackbar; every swipe also an accessibility action).
- **Fix:**
  - **A shared `SwipeRow` component** (`ReanimatedSwipeable` from gesture-handler 2.32: leading
    and trailing actions, `failOffsetY`, a `warn` haptic past the threshold) and a
    `RowMenu`:
    - iOS: expo-router `Link.Menu`, where a row is a Link.
    - Android: a Paper `Menu` on long press with a `grab` haptic.
    - Both offer the same verbs, and the same `accessibilityActions`.
  - **Rows:**
    - **Schedule date:** swipe to cancel, which still opens the cancel sheet because the note
      matters; on a cancelled date, swipe to Restore.
    - **Payment:** Edit, Delete with Undo.
    - **Pairing:** Edit, Remove.
    - **Person:** Edit, Deactivate.
    - **Comment:** Delete (own only).
    - **Session card:** Assess, Edit, and Delete where `can_delete`.
  - **Permissions:** the server's `can_delete`, `can_restore` and `mayCancelOn` decide which
    actions exist; nothing widens.
  - **Swipe peek:** once per device, never under reduce motion (§14).
  - **Inline icons:** keep only the one primary action per card.
- **Effort:** L.
- **Batch:** B7

**F-9. A cancel has no Undo, and nothing is optimistic.**
- **Screens:** Schedule (cancel and restore a date), comment post, the default-organization star.
- **Platform:** both.
- **Evidence:** the toast after a cancel has no action (`cancel-lesson-sheet.tsx:107-112`).
  Restore is a separate three-tap path.
- **Rule:** H3; §9 ("optimism only where the server cannot change the outcome … cancel and
  restore a date, post a comment, star the default organization").
- **Fix:**
  - Cancel and restore with TanStack `onMutate` (snapshot, strike-through, rollback on error
    with an announced "Couldn't cancel — restored").
  - The cancel toast gets **Undo**, which deletes the cancellation row.
  - The same for the star and a comment post ("Sending…").
  - Never for money.
- **Effort:** M.
- **Batch:** B7

**F-10. No live lesson on the lock screen, the Dynamic Island or the Android status bar.**
- **Screens:** the live lesson.
- **Platform:** both.
- **Evidence:** the banner is in-app only (`live-session-banner.tsx`); no expo-widgets and no
  notifications module.
- **Rule:** plan.md Phase 2; §10 (content contract "Lesson in progress · 0:42" only; ended on
  stop, auto-stop, sign-out and organization switch).
- **Fix:**
  - **iOS:** `expo-widgets` 57 `createLiveActivity('LiveLesson', …)`.
    - **Props:** `{ startedAtMs }` only.
    - **Banner and compact views:** "Lesson in progress" plus `<Text date={start}
      dateStyle="timer">` from `@expo/ui/swift-ui`. The system ticks it; the app never updates
      it.
    - **Accent and icon:** neutral system colour; platform glyph.
    - **Lifecycle:** start on Start; `end('immediate')` on Stop, the auto-stop reconcile on
      foreground, sign-out and organization switch.
  - **Android:** a small local Expo module (Kotlin, `NotificationCompat`) for one ongoing
    notification.
    - **Calls:** `setOngoing(true)`, `setUsesChronometer(true)`, `setWhen(startedAt)`,
      `setRequestPromotedOngoing(true)` on API 36+.
    - **Contents:** title "Lesson in progress", no names. A Stop action opens the stop sheet
      and never stops silently.
    - **Permissions:** `POST_NOTIFICATIONS`, asked at the first Start, plus
      `POST_PROMOTED_NOTIFICATIONS`.
    - **Why a module:** expo-notifications 57 has `sticky` but no chronometer or promotion.
  - **Same end rules on both.**
  - **iOS 26+:** `NativeTabs.BottomAccessory` can carry the in-app pill instead of the
    hand-offset banner (the "Next" step in risks).
- **Effort:** L. Native rebuild on both platforms.
- **Batch:** B8

**F-11. Home's first load is a spinner.** Several detail screens and every sheet are too.
- **Screens:** Home ("Loading your dashboard…"), session detail, person detail, profile,
  Organization, the platform screens, all form sheets.
- **Platform:** both. It matters most on Android, where the first paint is slowest.
- **Evidence:** `dashboard-screen.tsx:155`, and the spinner list in
  [Loading, refresh, empty](#loading-refresh-empty).
- **Rule:** §9 ("the skeleton mirrors the real layout"; "never a blank brand screen"); H1.
- **Fix:**
  - A Home skeleton per section: Analytics StatCard heights, the carousel card, the spotlight.
    It carries no money shape on Tutoring.
  - Detail-screen skeletons.
  - Sheets keep their form and show inline skeleton rows for their pickers.
  - Cross-fade with the `effects` timing.
- **Effort:** M.
- **Batch:** B4

**F-14. Android tab labels show only on the selected tab.**
- **Screens:** the tab bar.
- **Platform:** Android.
- **Evidence:** `android/L-priya-01-dashboard`: only "Home" is labelled. The rest are bare icons:
  a book, a calendar, a trend line, an ellipsis.
- **Rule:** H6; Material 3 navigation bar (labels on every destination with three to five
  destinations).
- **Fix:** `labelVisibilityMode="labeled"` on `NativeTabs` (`src/app/(org)/(tabs)/_layout.tsx`).
- **Effort:** S.
- **Batch:** B3

**F-15. Lists' header chrome pushes the content below the fold.**
- **Screens:** Users, Sessions, Home, Progress.
- **Platform:** both.
- **Evidence:**
  - **Users** (`ios/L-priya-10-people`): the first person is at 55% of the screen, under a
    title, a sentence, Add user (which duplicates the header +), search, five role chips,
    status, sort and the "Show deactivated" switch.
  - **Sessions** (`ios/L-priya-03-sessions`): the first lesson is at 65%.
  - **Home** (`ios/L-priya-00-landing`): the first figure is at 40%, under the person's name,
    the organization, role chips and tabs.
  - A parent's and a student's **Progress** carry a "Find a student" search and filter chips
    for one child (`ios/L-anita-04-progress`, `ios/L-sofia-04-progress`).
- **Rule:** H8; §4 (native search in the header, large titles); §5 (filters in a sheet).
- **Fix:**
  - **People:** `headerSearchBarOptions` (iOS) and the field pinned in the list header
    (Android).
  - **Filters:** move into one "Filters" button with a count badge, opening a gorhom sheet (the
    Activity screen already does this).
  - **Duplicates:** drop the in-page Add, Record and Schedule button where the header + does
    the same. Keep the in-page button only for the empty state.
  - **One-student readers** (parent of one, student): hide search and filters below two
    students.
  - **Home:** fold the name and organization into the large title's subtitle row.
- **Effort:** M.
- **Batch:** B4

**F-16. No offline state.** Saves fail late, with a generic error.
- **Screens:** all. It matters most in Record, payment and schedule.
- **Platform:** both.
- **Evidence:**
  - `expo-network` is a dependency but is never imported.
  - `query-provider.tsx:9-11` never pauses.
  - No banner.
- **Rule:** §15 ("slim, non-modal Offline banner; saving a lesson disabled offline with an
  explanation; autosave says Not saved — offline").
- **Fix:**
  - `useNetworkState()` from expo-network drives an `OfflineBanner` under the header, an
    `onlineManager` binding for TanStack, and a disabled Save with the reason.
  - Autosave reports "Not saved — offline" and retries.
- **Effort:** M.
- **Batch:** B5

**F-17. No home-screen quick actions.**
- **Screens:** the app icon.
- **Platform:** both.
- **Evidence:** not installed.
- **Rule:** plan.md Phase 2; §11.
- **Fix:**
  - `expo-quick-actions` 6.0.2 (community; peer `expo: "*"`; runtime check on SDK 57 at
    build time). `setItems` on entering an organization, by role:
    - "Start lesson" (tutor)
    - "Record a lesson" (tutor or admin)
    - "Schedule" (everyone)
  - Cleared on sign-out.
  - `useQuickActionRouting` in the `(org)` layout. The route re-checks the role.
  - Generic titles, no names.
- **Effort:** S. Native rebuild.
- **Batch:** B6

**F-18. "Add to calendar" is an .ics through the share sheet.**
- **Screens:** Schedule ("Add all to calendar", the per-card calendar icon).
- **Platform:** both.
- **Evidence:** `download.ts:7-57` (`Sharing.shareAsync` with `public.calendar-event`). On
  Android, the share sheet offers apps that do not take .ics.
- **Rule:** plan.md Phase 2; §16 Schedule row.
- **Fix:**
  - `expo-calendar` 57. SDK 57 made the object API the root import, and the old root names
    throw.
  - Per card: legacy `createEventInCalendarAsync` from `expo-calendar/legacy`. It shows the
    system editor, asks no permission on iOS 17+, and is an intent on Android. Prefill the
    recurrence (`recurrenceRule` weekly, until `ends_on`) and the generic title "Lesson" (§16:
    no names unless the reader opts in).
  - "Add all" keeps the .ics share as the bulk path.
  - Config plugin `writeOnlyAccess: true`; block READ/WRITE_CALENDAR on Android
    (`android.blockedPermissions`), since the intent needs none.
- **Effort:** M. Native rebuild.
- **Batch:** B6

**F-19. Paper ignores Reduce Motion.** There is no Haptics switch, and haptics fire twice.
- **Screens:** all.
- **Platform:** both.
- **Evidence:** [Haptics](#haptics) and [Motion](#motion).
- **Rule:** §0.6, §6 and §7.
- **Fix:**
  - `animation: { scale: reduced ? 0 : 1 }` in `paper-theme.ts`, from `useReducedMotion` plus a
    `reduceMotionChanged` listener.
  - A Profile "Haptics" switch (`STORAGE_KEYS.haptics`) gating the wrapper.
  - Remove the direct calls that a same-tone toast repeats.
  - Map `haptics.ts` to §7's semantic names (`commit`, `stop`, `warn`, `fail`, `tick`, `grab`).
  - Android `performAndroidHapticsAsync`.
- **Effort:** S.
- **Batch:** B3

**F-20. Screen-reader roles.**
- **Screens:** the Tutoring/Finance switch, the week strip, session cards, the tour offer.
- **Platform:** both.
- **Evidence:**
  - The switch is Paper `SegmentedButtons` (role button, `checked`), not tabs
    (`tutoring-finance-tabs.tsx:31-42`).
  - The week strip's children are buttons under a `tablist` (`week-strip.tsx:30,47-49`).
  - Session cards are `accessible={false}` (`session-card.tsx:76`).
  - An unlabelled decorative IconButton (`onboarding-provider.tsx:255-260`).
- **Rule:** §12 ("the Tutoring/Finance switch is a tablist … `selected`"); §17 "Accessibility".
- **Fix:**
  - Role `tab` with `selected` on both switches.
  - The card is one labelled button ("Lesson with Sofia Okafor, Tuesday 15 September, 4 PM,
    1 hr 30 min"), its actions exposed as `accessibilityActions`.
  - The decorative icon becomes an `Icon`.
- **Effort:** S.
- **Batch:** B3

**F-21. Rows are not tappable to act.**
- **Screens:** the Billing ledgers; the Home tutor payments panel.
- **Platform:** both.
- **Evidence:** `ios/L-priya-13-billing`.
- **Rule:** H7.
- **Fix:**
  - A ledger row opens `payment-form` prefilled with that party (and child), so a payment from
    a balance is three taps.
  - Admin only, as the form already is.
- **Effort:** S.
- **Batch:** B7

**F-22. Form errors are off-screen after a failed save.**
- **Screens:** person form and the long sheets (record, schedule).
- **Platform:** both.
- **Evidence:** `people/edit` failure screenshot (F-7); `person-form.tsx:480-489`.
- **Rule:** H9.
- **Fix:**
  - Scroll to the first field error (or the error block) on a failed save.
  - `fail` haptic once.
  - Announce the message.
- **Effort:** S.
- **Batch:** B5

**F-23. The record sheet makes a tutor with two students search a list.**
- **Screens:** Record a session, Start.
- **Platform:** both.
- **Evidence:** `android/L-priya-20-record-session` (expanded list with a search field for 51
  pairings; for Alex, 2); the Start sheet with radio rows (`ios/L-alex-13-start-lesson`).
- **Rule:** H7 and H8.
- **Fix:**
  - When there are at most four pairings, show them as a chip row with the next-up pairing
    preselected.
  - Keep the search list for the office.
  - Record defaults the date and times to the most recent scheduled lesson not yet recorded.
- **Effort:** M.
- **Batch:** B6

### P3

**F-24. Raw ISO dates in prose.**
- **Where:**
  - "from 2026-09-01, ongoing" on schedule cards (`ios/L-priya-06-schedule`)
  - "on the 2026-09-15 session" in comment targets (`ios/L-priya-14-comments`)
  - "Sofia Okafor 2026-09-15" in Student Reflections (`ios/L-alex-01-dashboard`)
- **Fix:** format on the organization's clock ("from Sep 1"). These strings come from shared
  helpers the web also uses, so check `@tmi/shared` first and change the mobile call sites only.
- **Effort:** S.
- **Batch:** B4

**F-25. Copy that doesn't match the reader.**
- **Where:**
  - The Sessions subtitle on the Tutoring tab reads "Every lesson taught, and what it earned" and
    "Lessons you have taught, and what you have earned". For Maria (tutor and parent, with no
    students of her own) it sits above her daughter's lessons (`ios/L-maria-02-sessions`).
  - "1 sessions" on the parent's Home (`ios/L-anita-01-dashboard`).
  - Maria sees "Start a lesson" with no students to start one with.
- **Fix:**
  - The Tutoring subtitle names teaching only.
  - Pluralise.
  - Hide Start when the reader has no pairing as tutor; the Start sheet already lists none.
- **Effort:** S.
- **Batch:** B4

**F-26. The progress chart has no draw-on or scrub, and the compact chart is mostly empty early
in a plan.**
- **Where:** `ios/L-sofia-01-dashboard`.
- **Rule:** plan.md Phase 2 ("animated, scrubbable progress chart"); §8 scrubbing.
- **Fix:**
  - Draw-on once (still under reduce motion).
  - Long-press then pan to scrub with a `tick` haptic per point.
  - `accessibilityRole="adjustable"`.
- **Effort:** M.
- **Batch:** deferred (P3, see Not scheduled).

**F-27. `.map` lists that grow with the data.**
- **Where:** the Billing ledgers, the payment log, Pairings, Schedule, the Progress list, Search,
  and the platform lists (Performance).
- **Fix:** FlashList where the list can pass about 50 rows: payment log, ledgers, Progress.
- **Effort:** M.
- **Batch:** B4 (only the three named)

**F-28. Pull-to-refresh is missing** on the comment thread, Search, the view-as picker and the
organization picker; and **empty states are missing** on the tutor and student ledgers, the
platform admins list and the dashboard sections.
- **Evidence:** [Loading, refresh, empty](#loading-refresh-empty).
- **Effort:** S.
- **Batch:** B4

**F-29. Shared-element session cards** (plan.md Phase 2).
- Reanimated's shared transitions are still experimental and behind a flag in 4.5 (§6).
  `Link.AppleZoom` exists in expo-router 57 on iOS 18+.
- **Fix:** iOS `Link.Trigger withAppleZoom` from a session card to its detail, behind a check.
  Android keeps the stack push.
- **Effort:** S.
- **Batch:** B7 (with the row Links)

### What already passes

- **Money and privacy:**
  - No `session-money` and no `$` under Tutoring for any persona, sheets included (exposure
    flows and the walk).
  - Finance shows only the reader's side: Alex sees Earned, Paid to you and Advance held; never
    the institute totals.
  - The 1099 sheet blocks capture in every variant and keeps the SSN in state only.
- **Brand:**
  - Switching to riverside recolours the tabs, tints, the Next up card and the buttons
    (`ios/L-rosa-*`).
  - No organization name or colour in code (rules script).
  - The platform console wears the platform brand.
- **Native chrome:**
  - iOS large titles collapse.
  - Glass tab bar and native back.
  - Android M3 bar and native back.
  - The tab set is the same for everyone, so it never remounts.
- **Stop:** two taps, from any screen. The stop toast gives the length, not the pay.
- **Search:** two taps to a person, with pages and actions in one place.
- **Empty states:** the ones that exist name the next step, for the roles that may take it
  (Maria's "No lessons recorded or scheduled yet.").

## Platform facts (SDK 57, checked 2026-10-10)

| Need | Package | Available | Native rebuild | Notes |
| --- | --- | --- | --- | --- |
| App-switcher blur | `expo-screen-capture` 57.0.4 (installed) | yes | no | `enableAppSwitcherProtectionAsync(intensity 0-1)`, iOS only. No custom cover. Android protection comes only from FLAG_SECURE. |
| Live Activity | `expo-widgets` 57.0.23 + `@expo/ui` 57.0.22 | yes, iOS 16.2+ | yes (adds `ExpoWidgetsTarget`) | `createLiveActivity(name, component)` → `.start(props, url?)`, `.update`, `.end('immediate')`. `Text date dateStyle="timer"` ticks by itself. The plugin writes `NSSupportsLiveActivities` and the App Group. It also always writes `aps-environment`, which device builds must allow. |
| Android ongoing notification | `expo-notifications` 57.0.22 | partly | yes | Has `sticky` (ongoing) only. No chronometer, no `setRequestPromotedOngoing`, so a local Kotlin module is needed. |
| Quick actions | `expo-quick-actions` 6.0.2 (community) | likely | yes | Peer `expo: "*"`, built against SDK 56. `setItems`, `useQuickActionRouting` from `expo-quick-actions/router`. Static items are iOS only. |
| Native calendar | `expo-calendar` 57.0.5 | yes | yes | The SDK 57 root API is object-based. Legacy root names throw, so use `expo-calendar/legacy` `createEventInCalendarAsync` for the system editor with no permission, or `calendar.addEventWithForm` with write-only access. |
| Swipe rows | gesture-handler 2.32 `ReanimatedSwipeable` (installed) | yes | no | `renderLeftActions` / `renderRightActions`, ref `close` / `openLeft` / `openRight`. |
| Context menus and previews | expo-router 57 `Link.Menu` / `Link.Preview` / `Link.AppleZoom` | iOS only | no | Render `null` on Android, so use a Paper `Menu` on long press there. |
| Toolbar, tabs | expo-router 57 `Stack.Toolbar` (now on Android too), `NativeTabs.BottomAccessory` (iOS 26+), `labelVisibilityMode` | yes | no | NativeTabs still imports from `unstable-native-tabs` in 57. The tab bar height can't be measured, so keep the per-platform constant. |

## Fix batches

Ordered by value: privacy and stability first, because every later batch is verified by the
flows. Then daily friction, then new system surfaces. Each batch is one commit, with its flows
green on both platforms.

| # | Commit | Findings | Effort | Native rebuild |
| --- | --- | --- | --- | --- |
| B1 | Mobile UX: privacy cover and secure screens | F-1 | S | no |
| B2 | Mobile tests: the three intermittent flows | F-7 | S | no |
| B3 | Mobile UX: toasts above the tab bar, contrast and target sizes | F-2, F-4, F-5, F-14, F-19, F-20 | M | no |
| B4 | Mobile UX: large text, skeletons, pull-to-refresh and empty states | F-12, F-11, F-15, F-24, F-25, F-27, F-28 | M-L | no |
| B5 | Mobile UX: forms that keep your work — unsaved-changes guard, errors in view, offline | F-3, F-16, F-22 | M | no |
| B6 | Mobile UX: start from Home — Next-up Start, quick actions and native calendar | F-6, F-17, F-18, F-23 | M-L | yes (expo-quick-actions, expo-calendar) |
| B7 | Mobile UX: swipe actions, context menus and undo | F-8, F-9, F-21, F-29 | L | no |
| B8 | Mobile UX: live lesson on the lock screen — Live Activity and Android ongoing notification | F-10 | L | yes (expo-widgets; a local Expo module) |

### What each batch must prove

- **B1:**
  - **iOS:** the switcher snapshot (`Library/SplashBoard/Snapshots`, read back as in F-1) shows
    the blur with no amount legible. Check after backgrounding on Home Finance, Billing, the
    parent's Home and the 1099, at default size and at AX5.
  - **Android (production variant):** recents is blank on the same screens plus Organization.
  - **Flows:** dev and e2e builds stay screenshottable. The blur shows only while the app is
    inactive, so flows are unaffected.
- **B2:**
  - The three flows pass 5/5 alone and inside `npm run e2e:mobile -- both sessions people`.
  - The person form scrolls to its errors.
  - The delete-confirm field is uncontrolled.
- **B3:**
  - A toast never overlaps the tab bar or the live banner, and shows over a sheet.
  - A Jest test on the offset.
  - In-app Dark on iOS gives dark header and tab materials (screenshot, A pass).
  - Every header and inline icon target is at least 44 pt / 48 dp: Jest checks `IconButton`
    sizes and `hitSlop`.
  - Android tabs are labelled.
  - Paper animations are still under Reduce Motion.
  - The Haptics switch silences everything.
  - TalkBack and VoiceOver announce Tutoring/Finance as tabs.
- **B4:**
  - Home shows a skeleton, not a spinner.
  - Every data screen has pull-to-refresh and an empty state.
  - At AX5 and 2.0, no stat label or value is truncated, stat rows are one column, the carousel
    cards grow, and the banner inset follows its height.
  - Users shows the first person in the first half of the screen.
  - The Release-build cold start to the first dashboard paint is measured and recorded here.

- **B5:**
  - Swipe-down on a dirty payment, person or schedule sheet asks "Discard changes?"; Android back
    asks the same.
  - Offline (Network Link Conditioner or `adb shell svc wifi disable`): banner shown, Save
    disabled with the reason, autosave says "Not saved — offline".
  - New flow: `forms/unsaved-guard`.
- **B6:**
  - Alex: Home → Start on Next up → Start now = 2 taps (a flow asserts it).
  - The Start sheet shows no `$`.
  - Quick actions are set on entering an organization and cleared on sign-out. Their titles carry
    no names.
  - A schedule card opens the system event editor, titled "Lesson", weekly.
  - The Live Activity and quick-action content contracts hold.
- **B7:**
  - Swipe and long-press on a schedule date, payment, pairing, person, comment and session give
    the same verbs as the old icons, gated by the server's flags.
  - Each is also an accessibility action.
  - Undo restores a cancelled date.
  - The swipe peek runs once and never under reduce motion.
  - Flows use the menu path, because swipes are flaky in Maestro.
- **B8:**
  - Start shows "Lesson in progress" plus a ticking time on the lock screen, the Dynamic Island
    and the Android status chip, and nothing else.
  - Stop, auto-stop (on the next foreground), sign-out and organization switch end it.
  - The Android Stop action opens the stop sheet.
  - Exposure flow `exposure/live-surfaces` extended to read the notification text
    (`adb shell dumpsys notification`).

### Not scheduled (P3, for the owner)

- **F-26:** the animated, scrubbable progress chart. It is in plan.md's list, but nothing in the
  walk made it urgent; schedule it after B8 if wanted.
- **Home-screen widgets:** §11 rates them P3 with a strict contract.
- **A branded switcher cover instead of the blur:** needs a native module; only if the blur fails
  the B1 AX5 check.
- **Predictive back on Android:** stays off until react-native-screens supports it (§3).
