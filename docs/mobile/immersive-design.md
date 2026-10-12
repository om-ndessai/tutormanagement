# Immersive mobile design — research and how it applies to the portal app

Research for the mobile app's Phase 2 (UX audit and immersive changes) in `docs/mobile/plan.md`.
Written 2026-10-07 against the stack the plan fixes: **Expo SDK 57, expo-router 57, React Native
0.86, React Native Paper v5 (MD3), Reanimated 4, Gesture Handler, react-native-screens `formSheet`,
`@gorhom/bottom-sheet`, expo-haptics, expo-glass-effect, `@expo/ui`**.

How to read this:

- Each topic gives **what it is**, **current platform guidance**, **the RN/Expo route**, **pitfalls**
  and **accessibility**.
- Bracketed tags such as `[S7]` point to **Sources** at the end. Every source was accessed on
  **2026-10-07**. When a source carries an earlier date, the text says so ("as of 2025-11"). Where
  sources disagree, or only a secondary source makes a claim, it is flagged **(unverified)**.
- "Status" lines say how far each library is from production use in October 2026: *stable*,
  *beta/unstable* (the API may change) or *experimental* (do not ship).
- This document is research. It schedules nothing. Phase 2's audit (`docs/mobile/ux-audit.md`)
  decides what is built, in priority order.

---

## 0. Non-negotiables

These come from the product (`CLAUDE.md`, `docs/data-exposure.md`), and they outrank every pattern
below. Where an immersive pattern conflicts with one of them, the rule wins and the pattern is
changed or dropped.

1. **The Tutoring tab carries no money.** A tutor's phone is on the table during a lesson, and the
   student can see it. No amount, rate, balance or `$` may appear anywhere under Tutoring. That
   includes sheets it opens, toasts (the timer toast gives the *length*, never the pay), previews
   (`Link.Preview`), context menus, skeletons shaped like money, and count-up animations. The
   `showMoney` switch fails closed: if it is missing, the answer is no.
2. **Money is shown only from the reader's side.** It is rendered only through the mobile
   `SessionMoney` (`money_view`: `admin` / `tutor` / `family` / `none`), never as a bare
   `formatCents`. Pay rates and prices are scoped by the server, and the client never re-derives
   the other side.
3. **No SSN is ever stored or sent.** The 1099 is built and printed **on the device**. The number
   typed into the 1099 sheet never reaches the API, logs, AsyncStorage, SecureStore, the query
   cache, crash reports, autofill, the clipboard history the app controls, the app-switcher
   snapshot or a screenshot (`FLAG_SECURE` / `preventScreenCaptureAsync`). Nothing about the
   document persists after the sheet closes.
4. **System surfaces carry no money, notes or student names.** That covers the lock screen,
   notifications, Live Activities and the Dynamic Island, Android Live Updates and status-bar chips,
   home-screen widgets, quick actions, the app-switcher snapshot, Spotlight/App Intents donations,
   share-sheet previews and the print spool title. The only live-lesson text allowed off-app is
   **"Lesson in progress · 0:42"** (a label plus the elapsed time).
5. **Every organization's brand comes from its palette.** Colours come from the generated
   `ORG_PALETTES` tokens. Names come from `brand.short` and marks from the uploaded logo. No
   organization name or colour is hardcoded, and that includes widget, Live Activity and
   notification accent colours, glass tints and splash screens. A system surface that cannot be
   branded per organization at runtime (an iOS widget's static accent colour, the app icon) uses
   the **platform** brand ("Tutor Portal"), never the institute's.
6. **Reduce-motion stills motion.** Every animation goes through Reanimated with
   `ReduceMotion.System` (or checks `useReducedMotion`), and Paper's animation scale follows it.
   Under reduce-motion: springs jump to their end, count-ups show the final number, charts render
   drawn, skeleton shimmer stops (a static block stays), and shared/zoom transitions become
   cross-fades or cuts. **Motion explains a change. It is never decoration.**
7. **Nothing crosses organizations.** Switching organization or signing out clears the query cache
   (`queryClient.clear()`), ends any Live Activity or ongoing notification, clears widget snapshots
   and resets quick actions. There is no on-disk query cache.

---

## 1. Apple HIG 2025–26 and Liquid Glass (iOS 26/27)

**What it is.** Liquid Glass is the material Apple introduced in 2025 (iOS 26). It is translucent
and dynamic: it reflects and refracts what lies beneath it, and it forms "a distinct functional
layer for controls and navigation elements" that floats above the content layer `[S1]`. Standard
bars, sheets, popovers and controls adopt it automatically when an app is built with the current
SDK `[S1]`.

**Current guidance (Apple's adoption guide, © 2026) `[S1]`:**

- **Glass is for navigation and controls, not content.** "Avoid overusing Liquid Glass effects".
  Limit it "to the most important functional elements".
- **Remove custom backgrounds** from navigation bars, tab bars, toolbars and split views, because
  they "might overlay or interfere with Liquid Glass" and with the **scroll edge effect** that keeps
  controls legible over scrolling content.
- **Tab bars** float as an inset capsule. They can **minimize on scroll**
  (`tabBarMinimizeBehavior(.onScrollDown)`), and search is a **semantic search tab**
  (`Tab(role: .search)`) that the system places at the trailing end.
- **Toolbars** group related items on a shared glass background, separated by fixed spacers. Use
  icons rather than text, never mix text and icons inside one group, and give **every icon an
  accessibility label**.
- **Sheets** have a larger corner radius. A half sheet is **inset** from the display edges and turns
  more opaque at full height. Check content near the rounder corners, and remove custom sheet
  backgrounds.
- **Context menus**: "match top menu actions to swipe actions" for the same item.
- **Concentric shapes**: corner radii nest concentrically inside their containers.
- **Controls** use system colours, or custom colours with light, dark *and increased-contrast*
  variants.
- **Test** with Reduce Transparency, Increase Contrast and Reduce Motion. System components adapt
  by themselves, but custom ones must be checked.

**iOS 27 (WWDC 2026).** The sources disagree on the details:

- A secondary report (2026-08-17) describes iOS 27 as a *refinement*: Liquid Glass "diffuse[s]
  complex background content more effectively", and standard components inherit the change with
  no code change `[S3]`.
- Other secondary sources say Xcode 27 removes the `UIDesignRequiresCompatibility` opt-out, and
  that iOS 27 adds a system-wide glass "intensity" slider `[S4]` **(unverified)**. AppleInsider
  (2026-03-26) ran a headline in the same direction `[S5]`, but the article could not be fetched.

**Planning assumption:** the app ships with Liquid Glass. Do not depend on any compatibility
opt-out, and expect the user to be able to change how opaque glass looks.

**RN/Expo route:**

| Need | Library | Status (Oct 2026) |
| --- | --- | --- |
| Native glass tab bar, minimize on scroll, search role, badges | `expo-router/unstable-native-tabs` (`NativeTabs`, `NativeTabs.Trigger`, `Icon sf=… md=…`) `[S7]` | **Beta/unstable** (beta since SDK 55; the import path says so) |
| Glass header and toolbar buttons | `Stack.Toolbar` (SDK 56+), `Stack.Toolbar.Badge` (SDK 57) `[S9][S13]` | Stable options API; `Stack.Header` composition is alpha `[S13]` |
| A custom glass surface (a floating "live lesson" pill) | `expo-glass-effect` `GlassView` / `GlassContainer` `[S6]` | Stable; iOS 26+ only, falls back to a plain `View` |
| SwiftUI-native controls (pickers, menus, `glassEffect()` modifier) | `@expo/ui/swift-ui` inside `<Host>` `[S10]` | Stable since SDK 56 (2026-05-26) |
| Inset glass sheets | expo-router `presentation: 'formSheet'` with a transparent `contentStyle` `[S14]` | Stable |

**Pitfalls:**

- **`GlassView` with opacity below 1** on itself or any parent renders wrongly, and at 0 does not
  render at all. Fade with `glassEffectStyle`'s `animate`/`animationDuration` instead `[S6]`.
- `isInteractive` is fixed at mount. To change it, remount with a new `key` `[S6]`.
- Guard every use with `isGlassEffectAPIAvailable()`, because some iOS 26 betas lack the API and
  crash `[S6]`.
- **Hiding a native tab dynamically remounts the navigator and resets its state** `[S7]`. The
  portal's tabs differ by **role**, so compute the tab set once per (organization, role set) and
  key the navigator on it. Never toggle tabs mid-session.
- **Opaque custom header and tab backgrounds** (a Paper `Appbar` painted in `brand-700`) defeat both
  the glass and the scroll edge effect `[S1]`. On iOS, use native headers and let the brand show
  through the **tint** (icons, active tab) and the content, not through bar fills.
- `NativeTabs` exposes limited styling on each platform `[S7]`. A Paper `BottomNavigation` look on
  iOS is out. Use native tabs on both platforms (Material on Android).

**Accessibility:** Read `AccessibilityInfo.isReduceTransparencyEnabled()`. When it is on, render
custom glass as a solid `surfaceContainer` token `[S6]`. Test Increase Contrast too. Brand tints on
glass must keep 4.5:1 for text and 3:1 for icons in **every** palette, light and dark.

---

## 2. Material 3 Expressive (Android 16+)

**What it is.** M3 Expressive is Google's 2025 update to Material 3. It adds more shape (a library of
35 shapes with built-in morphing), a **physics-based (spring) motion system**, emphasized type
(variable-font weights and sizes) and bolder colour. Google says it rests on 46 studies with more
than 18,000 participants (as of 2025-05) `[S22]`. Wear OS adopted it in 2025-08 `[S23]`.

**Motion physics.** Compose's `MotionScheme` gives each component its springs. There are two
schemes, `standard()` and `expressive()`. Each has **spatial** specs (position, size, shape, where
overshoot is allowed) and **effects** specs (colour and alpha, with no overshoot), in fast, default
and slow speeds. The expressive default spatial spring is **stiffness 380, damping ratio 0.73**
`[S21]`. Use `expressive` for hero moments and `standard` for utilitarian ones `[S21]`.

**Approximating it with Paper v5 + Reanimated.** Paper implements M3 (2021–23), not Expressive.
Its theme has MD3 colour roles, one `roundness` number, MD3 type variants and an `animation.scale`
`[S41]`. To approximate Expressive:

- **Motion tokens** in `src/theme/motion.ts`, mirroring `MotionScheme`. Reanimated `withSpring`
  takes `stiffness` and `dampingRatio`-style configs (or `duration`/`dampingRatio` in Reanimated 4):

  ```ts
  // spatial = may overshoot; effects = never overshoot (colour/opacity)
  export const spring = {
    spatialFast:    { stiffness: 800, damping: 0.6 },  // tuned locally
    spatialDefault: { stiffness: 380, damping: 0.73 }, // M3E expressive defaultSpatial [S21]
    spatialSlow:    { stiffness: 200, damping: 0.8 },
    effects:        { stiffness: 1600, damping: 1.0 }, // critically damped
  } as const; // pass reduceMotion: ReduceMotion.System on every use
  ```

  Only the 380/0.73 pair is sourced. The other values are starting points to tune on a device, and
  they are written in Compose's ratio form, so convert them to Reanimated's `damping` units, or use
  Reanimated 4's `dampingRatio`.
- **Shape:** keep Paper's `roundness` for components. Add a `shape` token scale (xs 4, s 8, m 12,
  l 16, xl 28, full) and, for Expressive emphasis, one *morph*: a selected chip or the active
  carousel card animates its radius from `m` to `xl` with the spatial spring. Do not import the
  whole 35-shape library. Two or three shapes carry the idea.
- **Emphasized type:** add `display*Emphasized` / `title*Emphasized` variants (one weight step
  heavier) to the Paper fonts config. Use them only on the dashboard's Analytics numbers and screen
  titles.
- **Colour:** Paper colour roles come from the organization's palette (generated from OKLCH into
  hex). **Do not use Material You dynamic colour** (`expo-material3-theme` `[S41]`). The
  organization's palette is the brand, and wallpaper colours would override it, which breaks
  non-negotiable 5.

**Pitfalls:** Expressive's bounce on *every* element is noise. Keep overshoot to direct-manipulation
and hero moments (a card snapping into place, a FAB morphing), and use effects springs for colour
and opacity. Paper's `Appbar` and `BottomNavigation` are pre-Expressive. On Android, native tabs
already give Material 3 tab visuals.

**Accessibility:** Emphasized weights help legibility. Shape morphs are spatial motion, so they are
stilled under reduce-motion. Colour still has to meet 4.5:1 and 3:1 in every palette.

---

## 3. Edge-to-edge, predictive back and safe areas

**Guidance:**

- Apps that target **Android 15 (API 35)** are edge-to-edge by default, with an opt-out. Apps that
  target **Android 16 (API 36)** cannot opt out: `windowOptOutEdgeToEdgeEnforcement` is deprecated
  and disabled `[S16]`.
- For apps that target API 36 on Android 16 devices, the **predictive back** system animations are
  on by default, `onBackPressed` is no longer called and `KEYCODE_BACK` is no longer dispatched.
  The temporary opt-out is `android:enableOnBackInvokedCallback="false"` `[S16][S17]`.

**RN/Expo route:**

- Expo SDK 54+ is always edge-to-edge on Android. The old `edgeToEdgeEnabled` setting does nothing,
  and React Native carries edge-to-edge itself (as of 2025-08) `[S15]`. SDK 57's React Native 0.86
  brings further edge-to-edge fixes, and `expo-navigation-bar` now styles RN `<Modal>` windows
  `[S9]`.
- **Safe areas:** use `react-native-safe-area-context` everywhere, and build a `Screen` component
  that applies insets once. Scroll content runs **under** the status bar and the gesture bar, and
  only the content padding respects the insets. A sticky live-lesson banner sits above the bottom
  inset, and a FAB clears it plus the native tab bar.
- **Predictive back:** in SDK 54 Expo turned it off by default (`android.predictiveBackGestureEnabled`
  enables it) `[S15]`. react-native-screens had **not** shipped fragment-level predictive back as of
  2026-09 (the maintainers said "next major", "months away", in 2025-07) `[S18]`.
  **Recommendation:** leave predictive back **off** (the manifest opt-out) until react-native-screens
  supports it. Then test **hardware and gesture back** on the API 37 AVD on every stack, sheet and
  `BackHandler` user (unsaved-changes guards in the record-lesson sheet especially).

**Pitfalls:**

- Translucent system bars over light content need `expo-status-bar` style switching per screen
  (dark text on a light surface, light text on the brand header).
- A 3-button navigation bar has a scrim. A gesture bar does not.
- Keyboard: use `KeyboardAvoidingView` or react-native-keyboard-controller inside sheets. Edge-to-edge
  changes the IME insets.

**Accessibility:** Edge-to-edge must not push targets under the gesture area. Keep 48 dp clear of
the bottom inset. With TalkBack on, check that focus order does not land on content hidden under the
bars.

---

## 4. Large titles and collapsing, scroll-linked headers

**Guidance.** On iOS, a top-level screen opens with a **large title** that collapses into the
inline bar as the content scrolls, and Liquid Glass adds a scroll edge effect under the bar `[S1]`.
On Android, M3 uses medium/large top app bars that collapse on scroll.

**RN/Expo route:**

- **iOS:** set native stack `headerLargeTitle` (expo-router: `headerLargeTitleEnabled`) with
  `headerTransparent`, `headerLargeTitleShadowVisible: false` and `headerBlurEffect` left to the
  system on iOS 26+ `[S13]`. The title collapses only when the first child is a `ScrollView`,
  `FlatList` or FlashList (with `contentInsetAdjustmentBehavior="automatic"`).
  `headerSearchBarOptions` gives a native search field (People, Sessions) `[S13]`.
- **Android:** the native stack has **no collapsing header** `[S13]`. Build one: a Reanimated
  `useAnimatedScrollHandler` drives `interpolate(scrollY, [0, 64], [largeSize, titleSize],
  Extrapolation.CLAMP)` on an `Animated.Text`, with the bar's background moving from `surface` to
  `surfaceContainer` (an *effects* animation, no overshoot).
- Use large titles on the **tab roots** (Dashboard, Sessions, Schedule, Progress, People). Pushed
  detail screens use inline titles.

**Pitfalls:**

- A large title plus a custom `headerRight` built from Paper buttons breaks the glass grouping. Use
  `Stack.Toolbar` items `[S13]`.
- The organization name is **not** the large title. The title names the screen ("Sessions"), and
  the brand appears in the organization switcher avatar.
- A collapsing header that drives layout on the JS thread janks, so keep it on the UI thread
  (worklets).

**Accessibility:** Large titles scale with Dynamic Type, so test at the largest accessibility size.
The custom Android header must expose `accessibilityRole="header"`. Under reduce-motion it snaps
between two states without interpolating.

---

## 5. Bottom sheets and detents: `formSheet` vs `@gorhom/bottom-sheet`

**Guidance.** iOS sheets have **detents** (medium/large or custom). The half sheet is inset with
glass and goes opaque when expanded to full height `[S1]`. Material has standard (non-modal) and
modal bottom sheets with a drag handle.

**RN/Expo route:**

| | Native `formSheet` (react-native-screens via expo-router) | `@gorhom/bottom-sheet` v5 |
| --- | --- | --- |
| What | A **route** presented as a sheet: `presentation: 'formSheet'`, `sheetAllowedDetents: [0.5, 1]`, `sheetGrabberVisible`, `sheetInitialDetentIndex`, `sheetLargestUndimmedDetentIndex` `[S14]` | An **in-screen** component (Reanimated + RNGH) |
| Look | System: Liquid Glass inset sheet on iOS 26+ (with a transparent `contentStyle`) `[S14]`; Android supports up to 3 detents, corner radius and elevation (as of RNS 4.0) | Custom, so it must be themed by hand |
| Back/dismiss | Native swipe-down and Android back | Must wire `BackHandler`; `enablePanDownToClose` |
| Deep link / URL | Yes (it is a route) | No |
| Control | Limited: no custom footers or animations `[S14]` | Full: footers, scrollables, keyboard modes (`keyboardBehavior`, `enableBlurKeyboardOnGesture` since 5.1, 2025-02) `[S40]` |

**Recommendation (matches the plan):**

- Every **form** is a `formSheet` route: record lesson, person, payment, schedule, assignment,
  assessment, plan and 1099. That gives native glass, native dismiss and back, and deep links.
- `@gorhom/bottom-sheet` is for **in-screen** pickers and filters (session filters, organization
  switcher, the "cancel this date" confirmation with a reason field) where the sheet belongs to
  the screen, not to the router.
- Forms with unsaved changes set `gestureEnabled: false` once the form is dirty, or intercept the
  dismiss and offer "Keep editing / Discard". The record-lesson sheet's autosave makes discarding
  less frightening, but it still asks.

**Pitfalls:**

- Opaque sheet backgrounds hide the glass `[S14]`.
- Do not stack a gorhom sheet on top of a formSheet (z-order, and the gestures fight).
- Do not put money in a sheet that a Tutoring screen opens unless `showMoney` is true.
- `@expo/ui`'s SwiftUI `BottomSheet` was beta as of 2025-11 `[S14]`. Even though Expo UI went stable
  in SDK 56 `[S10]`, it is not needed here.

**Accessibility:** Moving focus into the sheet, dismissing it by means other than a gesture (a
visible Close/Cancel button and Android back), and hiding the background from the screen reader are
the floor for any sheet `[S40]`. For gorhom under reduce-motion, set `animateOnMount={!reduced}`
and use `ReduceMotion.System` in `animationConfigs` `[S40]`.

---

## 6. Motion: spring tokens, layout animations, shared elements

**Principle (already the web portal's):** *motion explains a change*. It shows where something came
from, where it went, or what caused it. The theme switch is the one decorative transition the web
allows. Page changes on mobile use the native stack transitions.

**Reanimated 4 (SDK 57 bundles 4.5) `[S9]`:**

- **CSS-style transitions and animations** (`transitionProperty`, `animationName` keyframes in
  styles) run on the UI thread `[S26]`. They suit state-driven styling: a pressed state, a selected
  card, the autosave dot.
- **Layout animations** (`entering`, `exiting`, `layout={LinearTransition.springify()}`) explain
  inserts and removals: a session appears in the list after recording, a cancelled date strikes
  through, a comment arrives.
- **Shared element transitions** are **experimental behind a feature flag
  (`enable_shared_element_transitions`), "not recommended for production use yet", native stack
  only, with no tab navigator support** `[S25]`. A secondary article says they are stable in v4
  **(contradicted by the official docs, so treat as wrong)**.
  **Recommendation:** the plan's "shared-element session cards" should ship as a **fallback**: on
  iOS, a native zoom transition if expo-router exposes one (check at implementation; the Link
  Preview docs do not mention it `[S12]`); elsewhere, the card's layout animation plus the stack
  push. Put the real shared element behind a dev flag only.

**Reduce motion (Reanimated) `[S24]`:**

- `ReduceMotion.System` is the default. Under the setting, `withSpring` and `withTiming` jump to
  their target, `withDelay` skips its delay, `withRepeat` runs once or not at all, entering
  animations reach their end instantly, and **exiting and shared transitions are skipped**.
- `useReducedMotion()` reports the setting **at app start**. Pair it with an
  `AccessibilityInfo` `reduceMotionChanged` listener if the app must react without a restart.
- Paper's `theme.animation.scale` should be set to `0` under reduce-motion. It respects device
  settings by default `[S41]`, but verify that.

**Token table (proposal):**

| Token | Use | Spec |
| --- | --- | --- |
| `spatialDefault` | card snap, sheet-like moves, carousel settle | spring 380 / 0.73 `[S21]` |
| `spatialFast` | press feedback, chip select | stiffer spring, little overshoot |
| `effects` | colour, opacity, skeleton → content cross-fade | critically damped, about 150–200 ms |
| `countUp` | Analytics numbers | about 600 ms ease-out; **final value immediately** under reduce-motion |
| `drawOn` | progress chart path | about 700 ms; drawn immediately under reduce-motion |

**Pitfalls:** Animating `height` on the JS thread. Several simultaneous entering animations on a
long list (cap the stagger at the first screenful). Spring overshoot on numbers: a count-up must
never overshoot, because 41 → 43 → 42 reads as wrong data.

**Accessibility:** A count-up's accessible value is the **final** number, set at once and never
announced while it ticks (`accessibilityLiveRegion="none"`). Motion is never the only signal: a
saved state also shows text ("Saved").

---

## 7. Haptics: a semantic map

**Guidance:**

- Apple: use haptics consistently, to complement visual and audio feedback, not to replace them;
  avoid overuse; let the system decide whether to play them; and don't check device type or state
  `[S28]`. **Selection** feedback communicates "movement through a series of discrete values, not
  making or confirming a selection". **Notification** feedback covers success, warning and error.
  **Impact** (light to heavy) is a physical metaphor `[S28]`.
- Android: "clear haptics", meaning one sharp effect per discrete event and no buzzy vibration
  `[S30]`. The constants are `CONFIRM`, `REJECT`, `CLOCK_TICK`, `SEGMENT_TICK`, `LONG_PRESS`,
  `GESTURE_START` and `GESTURE_END`, with toggle on/off on newer releases `[S29][S30]`.

**RN route: expo-haptics `[S27]`.**

- `selectionAsync()`, `notificationAsync(Success|Warning|Error)`,
  `impactAsync(Light|Medium|Heavy|Rigid|Soft)`, and on Android `performAndroidHapticsAsync(type)`
  with 18 system types (`Confirm`, `Reject`, `Clock_Tick`, `Segment_Tick`, `Long_Press`, …).
- `VIBRATE` is added automatically.
- iOS stays silent in Low Power Mode, with the camera active or during dictation. That matters for
  Phase 3: no haptic confirms anything while the dictation mic is live.

Wrap it in one `haptics.ts` with **semantic** names, so a screen never picks a raw style:

| Semantic event | iOS | Android | Portal uses |
| --- | --- | --- | --- |
| `tick` (discrete value passes under a finger) | `selectionAsync` | `Segment_Tick` / `Clock_Tick` | chart scrub crossing a data point, week-strip day change, carousel snap, duration stepper by 15 min |
| `toggle` | `selectionAsync` | `Toggle_On` / `Toggle_Off` | Tutoring/Finance tab switch, switches |
| `commit` (a deliberate action succeeded) | `notificationAsync(Success)` | `Confirm` | lesson recorded, payment saved, schedule saved, timer **started** |
| `stop` (end of a timed thing) | `impactAsync(Medium)` | `Confirm` | live timer stopped |
| `warn` (reversible/destructive pending) | `notificationAsync(Warning)` | `Reject`-lite (`Long_Press`) | swipe past the cancel threshold, "discard draft?" |
| `fail` | `notificationAsync(Error)` | `Reject` | validation refused on submit, network failure on save |
| `grab` | `impactAsync(Light)` | `Long_Press` / `Drag_Start` | long-press context menu, start of a scrub |

**Rules:** at most one haptic per user action; never on scroll, on load or on a timer tick; none
for events the user did not cause (an incoming comment); and a **Haptics** switch in Profile
(off → no-op), as Apple asks for them to be optional `[S28]`.

**Accessibility:** Haptics never replace a visible or announced result. Under VoiceOver, success is
announced (`AccessibilityInfo.announceForAccessibility`) as well.

---

## 8. Gestures: swipe actions, context menus, previews, scrubbing

**Swipe actions.**

- Route: Gesture Handler `ReanimatedSwipeable` (`renderLeftActions` / `renderRightActions`,
  `openLeft` / `openRight` / `close` / `reset`) `[S38]`.
- Guidance: "match top menu actions to swipe actions" `[S1]`. The same verbs, in the same order,
  appear in the long-press menu.
- Destructive swipes never act on release alone. A full swipe reveals the action, and the action
  runs with an **Undo snackbar** (Paper `Snackbar`, about 5 s) and an optimistic update (§9).
- Pitfall: swipeable rows inside a horizontally paging carousel conflict. Set `failOffsetY` /
  `activeOffsetX` and do not nest them.

**Context menus and previews (iOS).**

- expo-router `Link.Trigger` + `Link.Preview` (peek and pop) + `Link.Menu` / `Link.MenuAction`
  (`title`, SF `icon`, `destructive`, nested menus) `[S12]`.
- **iOS only, SDK 54+.** Not supported with `replace`. Preview animations can misbehave inside JS
  tabs or slots, which is another reason for native tabs. Use `useIsPreview()` to render a lighter
  preview `[S12]`.
- **Android route:** a long-press opens a Paper `Menu` or a gorhom action sheet with the same
  actions, with a `Long_Press` haptic. Optionally use `@expo/ui/jetpack-compose` menus `[S10]`.
- **Privacy:** a preview of a session from a Tutoring list must render the **Tutoring** variant
  (no money). Pass `?tab=tutoring` into the preview route and let `showMoney` fail closed.

**Scrubbing charts.**

- A `Gesture.Pan()` (activated after a short `Gesture.LongPress()` so vertical scroll still works)
  drives a shared value. The nearest data point is computed in a worklet, `runOnJS(haptics.tick)`
  fires only when the index **changes**, and a tooltip shows the value of that point.
- With react-native-svg, animate an `x` cursor line via `useAnimatedProps`.

**Accessibility:**

- Every swipe action is also exposed as an **accessibility action**:
  `accessibilityActions=[{name:'cancel', label:'Cancel lesson'}]` + `onAccessibilityAction`.
  The swipe itself is invisible to VoiceOver and TalkBack users, and a WCAG 2.5.1 alternative to
  path gestures is needed.
- A scrubbable chart must also be `accessibilityRole="adjustable"` (increment and decrement move
  the cursor point by point and announce "BA3.10, 4 of 5, 12 March"), or offer a list fallback.

---

## 9. Perceived performance: skeletons, optimistic UI, pull-to-refresh, lists

- **Skeletons vs spinners.** NN/g: a skeleton previews the layout and suits content whose structure
  matters (dashboards, feeds, lists). Spinners suit short blocking actions. Use percent-done past
  about 10 s. Skeletons "aren't a silver bullet" and work best for short waits in familiar
  interfaces `[S36]`. **Portal rules:**
  - The skeleton mirrors the real layout (`StatCard` heights, carousel card size), so nothing jumps
    when the content arrives (cross-fade with the `effects` token).
  - No skeleton is shaped like money on Tutoring. The Finance skeleton may show amount-shaped bars.
  - The shimmer stops under reduce-motion.
- **Optimistic UI.** TanStack Query v5 offers two routes `[S37]`:
  - render `mutation.variables` in place, for one screen, with no rollback needed;
  - `onMutate`: cancel queries, snapshot, write the cache, return the rollback context to
    `onError`, and invalidate in `onSettled`.
  - **Use optimism only where the server cannot change the outcome in a way the user would mind:**
    cancel and restore a date, post a comment, star the default organization, mark a reflection.
  - **Never** optimistically show money. Amounts, durations and prices are derived by the server
    (CLAUDE.md), so a recorded lesson shows "Saving…" until the server answers, then the server's
    row.
- **Pull-to-refresh:** `RefreshControl` tinted with the brand `primary` on every list and dashboard
  tab. Refreshing invalidates only the queries on that screen.
- **Lists:** FlashList **v2** is New Architecture only, needs no `estimatedItemSize`, and has a
  `masonry` prop (as of 2025) `[S39]`. Use it for sessions, people, activity, comments and the
  payments history. Keep `keyExtractor` stable and memoised item components, and keep
  `getItemType` separate for "day header" vs "session row".
- **Cold start:** the splash holds until the session and organization are known, then the dashboard
  skeleton appears, never a blank brand screen. Measure it in Phase 2 (the plan's audit metric).

**Accessibility:** Loading regions say so (`accessibilityState={{busy:true}}`, "Loading sessions").
Optimistic rows are announced once they are confirmed, and a rollback is announced ("Couldn't cancel
— restored").

---

## 10. Live Activities, the Dynamic Island and Android 16 Live Updates

**iOS guidance (HIG Live Activities):**

- Not for tasks longer than **8 hours**. End the activity immediately when the task ends. The system
  keeps an ended activity on the Lock Screen for up to 4 hours unless you dismiss it sooner.
- **"Avoid displaying sensitive information"**, because it is visible on the Lock Screen. Show a
  general summary and let a tap open the app `[S32]`.

**Android guidance (Live Updates, Android 16):**

- A Live Update is a **promoted ongoing** notification. It qualifies only with a standard,
  `BigTextStyle`, `CallStyle`, `ProgressStyle` or `MetricStyle` notification; with
  `POST_PROMOTED_NOTIFICATIONS` declared; with `setRequestPromotedOngoing(true)`, `setOngoing(true)`
  and a content title; and with **no** custom `RemoteViews`, `setColorized(true)`, group summary or
  `IMPORTANCE_MIN` channel `[S20]`.
- It is appropriate when the activity is **ongoing, user-initiated and time-sensitive**. It is
  inappropriate for ads, chat, alerts, *upcoming events*, ambient info and past activities `[S20]`.
  A running lesson the tutor started qualifies. "Your next lesson is at 4 pm" does **not**, so it
  stays an ordinary notification, if anything.
- The **status-bar chip** (96 dp max) shows `setShortCriticalText` and/or a chronometer
  (`setUsesChronometer(true)`, `setWhen(start)`) `[S20]`.
- `ProgressStyle` (segments, points, a tracker icon) is for journeys `[S19]`. A lesson with a known
  maximum length (`effectiveMaxSessionMinutes`) *could* use it, but elapsed time is enough.
- Don't repost a dismissed Live Update, and watch `setDeleteIntent` `[S20]`.

**RN routes:**

- **iOS:** `expo-widgets` (stable since SDK 56) builds Live Activities as React components from
  `@expo/ui/swift-ui`: `createLiveActivity(name, component).start(props, url)`, `.update(props)`,
  `.end(policy, finalProps)`; push tokens for server updates. Widget code runs in an isolated
  runtime (no hooks, no async). It is iOS only and needs a dev build `[S11]`. Use the system's
  self-updating timer text (SwiftUI `Text(timerInterval:)`) so the clock ticks **without** app
  updates (no `NSSupportsLiveActivitiesFrequentUpdates` needed). Confirm at implementation that
  `@expo/ui` exposes a timer-style `Text`. If it does not, use a small Swift view via
  `@bacons/apple-targets`.
- **Android:** there is no Expo library. Write a small **Expo module** (Kotlin) that posts a
  `NotificationCompat` ongoing notification with `setRequestPromotedOngoing(true)`,
  `setUsesChronometer(true)`, `setWhen(startedAt)`, `setShortCriticalText("0:42")` (or the
  chronometer alone), a content title "Lesson in progress", and a **Stop** action that opens the app
  to the stop confirmation (it never stops silently). Below API 36 the same notification is an
  ordinary ongoing one. Request `POST_NOTIFICATIONS` at the moment of the first live lesson, not at
  launch.

**Portal content contract (non-negotiable 4):**

```
Title:      Lesson in progress
Time:       0:42  (system chronometer from started_at)
Icon:       platform glyph (monochrome), no organization logo on the lock screen
Accent:     a neutral system colour (an org palette cannot be passed reliably; never the institute's)
Tap:        opens /sessions?tab=tutoring with the live banner
Never:      student name, tutor name, organization name, rate, amount, notes, max-length countdown
```

- `VISIBILITY_PUBLIC` is acceptable **only because** the content is already non-sensitive. Set
  `setPublicVersion` to the same content as a belt-and-braces measure `[S33]`.
- End or remove it when the lesson stops, when the cron auto-stops it (the next app foreground or
  push reconciles this; iOS uses `end(…, 'immediate')`), on sign-out and on organization switch.

**Pitfalls:**

- The app's JS clock must not drive the displayed time. Use the system timer, or Doze and iOS
  throttling will freeze it.
- Live Activities are iOS 16.1+. Remote start through push-to-start is iOS 17.2+ `[S11]`, and the
  portal has no reason to start one remotely.

**Accessibility:** System-rendered timers are read by VoiceOver and TalkBack. Give the Stop action a
full label ("Stop lesson timer").

---

## 11. Home-screen widgets, App Shortcuts and quick actions

**Widgets:**

- iOS: `expo-widgets` timelines (`updateSnapshot`, `updateTimeline`, an App Group shared container)
  `[S11]`.
- Android: `react-native-android-widget` (JSX widgets, an Expo config plugin, New Architecture)
  `[S43]`, or a Glance module.

**Portal verdict: P3, with a strict contract.** A widget sits on an unlocked home screen and in the
iOS Lock Screen/StandBy families, so it shows **counts and times only**: "Next lesson 4:00 pm",
"3 lessons today", "Lesson in progress · 0:42". It never shows names, money or notes. It never shows
the organization name either (a parent in two organizations), unless the user picks the
organization in the widget's configuration and the brand mark is its logo. Widgets read a snapshot
the app writes **after** a fetch. That snapshot contains no names or money, and it is cleared on
sign-out and organization switch. A tutor's "upcoming" count comes from `expandUpcoming` data the
app already holds, never from a widget-side fetch with a credential.

**Quick actions / App Shortcuts:** `expo-quick-actions` (iOS Home Screen Quick Actions plus Android
App Shortcuts; `useQuickActionRouting` from `expo-quick-actions/router` turns `params.href` into a
route; SF Symbol icons via `symbol:`). It is compatible with Expo 56 / 6.0.2 as of its listing
`[S42]`, so check for a 57-compatible release. **P2.**

- Actions are role-gated and labelled generically: **"Start lesson"** (tutor), **"Record a lesson"**
  (tutor/admin), **"Schedule"**.
- Set them on sign-in and organization choice, and clear them on sign-out.
- The route still re-checks the organization and role. A quick action is only a deep link.

---

## 12. Accessibility

- **Dynamic Type / font scale:** support scaling to at least 200%. Avoid light weights (Regular
  minimum) and truncation at large sizes `[S44]`. In RN: never set `allowFontScaling={false}` on
  body text; cap `maxFontSizeMultiplier` only on fixed-height chrome (tab labels, chips, at about
  1.5); lay `StatCard` rows out to **wrap** to one column at large sizes (the "one height" rule
  yields to legibility); and test at iOS AX5 and Android 200%.
- **Screen readers:** every icon-only control has an `accessibilityLabel` `[S1]`. Each `StatCard` is
  one element ("Lessons this week, 12"). Carousel cards are buttons with a full label ("Lesson with
  [student], Tuesday 4 pm, upcoming"). Names are fine **in-app**, for the reader who may see them.
  The Tutoring/Finance switch is a tablist (`accessibilityRole="tab"`, `selected`).
- **Targets:** iOS 44×44 pt, Android 48×48 dp. WCAG 2.2 SC 2.5.8 (AA) is 24×24 CSS px or equivalent
  spacing, and 2.5.5 (AAA) is 44×44 `[S34][S35]`. Use `hitSlop` to reach the platform minimum on
  small icons, and assert it in the Phase 2 audit.
- **Contrast:** 4.5:1 text, 3:1 large text and UI components (WCAG). Check **every org palette**,
  light and dark, plus iOS Increase Contrast. A palette that fails gets a darker `on-` token
  generated, never a per-screen literal.
- **Reduced motion and transparency:** §6 for motion. `isReduceTransparencyEnabled` → solid
  surfaces instead of glass `[S6]`.
- **Bold text / Button shapes (iOS)** and **Remove animations (Android)** map to the same settings.
- **Haptics are optional** (§7).

---

## 13. Privacy-aware immersion

Immersion leaks most in the places the app does not draw itself. Each system surface and its rule:

| Surface | Risk | Control |
| --- | --- | --- |
| **App switcher snapshot** | iOS snapshots the last frame (a Finance tab, a 1099 sheet) | `expo-screen-capture` `enableAppSwitcherProtectionAsync(blur)` (iOS) for the whole app while signed in; it blurs on inactive (switcher, Control Center, calls) `[S31]`. Prefer a branded **cover** (the org-neutral platform mark on `surface`) to a blur if blur leaves amounts legible at large type. Check this at audit |
| Android recents | Same | `FLAG_SECURE` via `preventScreenCaptureAsync` shows a blank in recents `[S31]`. Apply it **app-wide on Finance, billing, 1099 and person forms with tax details**, not globally, because it also blocks the user's own legitimate screenshots of schedules |
| **Screen capture / recording** | 1099 SSN field, payments | `usePreventScreenCapture('form-1099')` while the 1099 sheet is mounted (iOS 13+ screenshots, iOS 11+ recordings; Android FLAG_SECURE) `[S31]`. Optionally `addScreenshotListener` to warn on Finance (needs `READ_MEDIA_IMAGES` on Android ≤ 13, so **skip it** there) `[S31]` |
| **Notifications** (Phase 32 email-like events, if push is ever added) | Lock screen shows the body | Generic body ("A lesson was recorded"), `VISIBILITY_PRIVATE` plus a `setPublicVersion` with no detail `[S33]`; iOS `hiddenPreviewsBodyPlaceholder` |
| **Live Activity / Live Update** | Lock screen and status bar | §10 contract: "Lesson in progress · 0:42" only |
| **Widgets** | Home and Lock Screen, StandBy | §11: counts and times only |
| **Quick actions** | Visible on long-press of the icon | Generic verbs only |
| **Print spool / share sheet** | The 1099 PDF title, file names | `expo-print` builds the 1099 **from HTML in memory**, opens the system print dialog with a generic job name ("1099-NEC"), never writes a file to the documents directory or cache, never offers `expo-sharing` for it. CSV exports are named by the server (no SSN ever exists to leak) |
| **Clipboard / autofill** | SSN field | `textContentType="none"`, `autoComplete="off"`, `importantForAutofill="no"`, `secureTextEntry` toggle, no copy menu on the field; cleared from React state on unmount |
| **Speech (Phase 3)** | Audio and transcripts | On-device recognition preferred; never stored; no dictation in the 1099 sheet |
| **Spotlight / Siri suggestions** | Indexed activities | Donate nothing with names; do not index people or sessions |

**Pitfalls:** A blur on iOS can be too light at high Dynamic Type sizes, which is why the cover is
preferred. FLAG_SECURE on the root activity also blanks **screen sharing** for remote support, so
apply it per screen. The app-switcher snapshot is taken **before** any JS `AppState` handler
reliably runs, so use the native API, not a JS overlay.

---

## 14. Onboarding: coach marks and progressive disclosure

- **Guidance:** about 20% of users finish a multi-screen tour, so teach in context instead `[S45]`.
  A spotlight overlay dims everything but one element and should be kept for genuinely non-obvious
  interactions `[S45]`. Progressive disclosure shows advanced options when they are needed, with a
  visible cue that more exists `[S46]`.
- **Portal mapping:** the web welcome wizard (Phase 26) only ever opens the portal's own dialogs.
  The mobile version does the same, opening the **same sheet routes** (person form preset and scoped
  to `sections`, assessment, plan, assignment) and never a second copy of a form. The **tour**
  becomes 3–5 coach marks anchored to `testID`/`data-tour` equivalents (the native tab items, the
  Tutoring/Finance switch, the record-lesson FAB, Getting started). Each is dismissible, with "Skip
  tour" always visible.
- `user_onboarding` (server) decides whether the tour has been seen. The per-device convenience is
  an AsyncStorage flag (the mobile stand-in for `tmi_tour_seen`). The e2e fixture sets it, as on the
  web.
- **Swipe-action discovery:** the first time a list with swipe actions renders, peek-animate one row
  open by about 40 px and close it (once, never under reduce-motion). The long-press menu is the
  always-available path.

**Accessibility:** Coach marks are modal for the screen reader (focus is trapped and Close is
labelled). The tour can be read without the spotlight, because each step's text names the control.

---

## 15. Empty states, error states and offline

- **Empty states** teach the next action. "No lessons yet — Record a lesson" carries the primary
  action, for roles that may take it. A parent sees "No lessons recorded yet", with no button.
  Illustrations are monochrome glyphs tinted with `primary`, so they follow the org palette.
- **Errors** use the API envelope `{ error: { code, message } }`:
  - field errors go inline;
  - `shared_fields_locked` (409) explains that a platform admin must change it;
  - a **404 for a row the reader may not see** renders "Not found", never "Forbidden" (matching the
    server's deliberate 404, R-rules);
  - 401 → back to sign-in with the organization remembered;
  - 503 `not_configured` → "Server isn't configured" (dev).
- **Offline:** watch NetInfo. Show a slim, non-modal "Offline — showing what was loaded" banner, and
  keep the in-memory cache. **There is no on-disk cache** (the plan's rule), so a cold start offline
  shows the offline empty state, not stale data. Mutations are **not** queued offline: a lesson is a
  billing record, so the save button is disabled offline with an explanation. The record-lesson
  **draft** autosave (server-side) shows "Not saved — offline" and retries when the network comes
  back. The live timer keeps running locally (it is two instants), and the stop is sent when the
  connection is back. The server derives the length, so the cap is still enforced.

---

## 16. Applying it to the portal

Priorities: **P1** belongs in Phase 2's first wave (high value, low risk, stable libraries). **P2**
follows if the audit supports it. **P3** is deferred, or experimental. "Privacy" restates the rule
that matters most for the row.

| Feature | Patterns | Library / API | Pri | Privacy note |
| --- | --- | --- | --- | --- |
| **Sign-in & organization picker** | Address-branded sign-in (platform brand unless the server names a default organization); picker as a list of org cards with logo + `brand.short`; star = default (optimistic, `toggle` haptic); on choose, a **brand transition**: the chosen card's logo scales into the header while the palette cross-fades (`effects` spring) | expo-router stack; Reanimated layout + `interpolateColor`; Paper theme swap via `BrandProvider` | P1 | Never show the last organization's brand before a choice (`tmi_last_org` rule); `queryClient.clear()` on switch; under reduce-motion a straight cut |
| **App shell & role tabs** | Native tabs (iOS glass capsule, minimize `onScrollDown`; Android M3 bar), tab set computed per (org, roles) and **keyed** so it never toggles live; large titles on tab roots; org switcher as avatar in the toolbar | `expo-router/unstable-native-tabs`, `Stack.Toolbar`, `headerLargeTitleEnabled` | P1 | Tab icons and labels generic; badges are counts only |
| **Dashboard — Tutoring tab** | Four sections in order (Analytics, Tutoring Sessions, [tutor: Student Reflections], Progress, Recent Activity). **Stat count-up** (ease-out, final value immediately for screen readers and reduce-motion); **sessions carousel** with `snapToInterval`/paging, "now" card centred, highlighted "next" (first non-cancelled), `tick` haptic on snap; **progress spotlight** with compact chart draw-on; activity as a 5-item timeline; skeletons per section; pull-to-refresh | Reanimated (`useDerivedValue` + `AnimatedText`), FlashList horizontal or `ScrollView` paging, react-native-svg | P1 | **No money, anywhere**: count-ups are counts and hours only, carousel cards and their `Link.Preview` carry no rate, skeletons not money-shaped; tutor's carousel passes own `tutor_user_id` |
| **Dashboard — Finance tab** | Tutor payments panel first (admin), `SessionMoney` cards, deep link `?tab=finance`; **no** count-up on money (a moving amount invites misreading) | Paper cards; FLAG_SECURE on Android for this tab; app-switcher cover | P1 | Only reader's side; Finance skeleton may be amount-shaped; leaving Finance clears it from the switcher snapshot (cover) |
| **Sessions list** | Tutoring/Finance tabs (`?tab=`); FlashList v2 with day headers; **swipe** (edit / delete-with-undo where allowed) mirrored by **long-press menu** (`Link.Menu` iOS, Paper `Menu` Android) and accessibility actions; `Link.Preview` peek (iOS); native search bar; filters in a gorhom sheet | RNGH `ReanimatedSwipeable`, expo-router `Link.Preview/Menu`, `headerSearchBarOptions`, `@gorhom/bottom-sheet` | P1 (swipe/menu), P2 (preview) | Preview from Tutoring renders Tutoring variant; menus show no amounts; delete is optimistic only for the row's presence, never totals |
| **Record a lesson** | `formSheet` with detents `[0.6, 1]` → full when the keyboard opens; write-up parts as collapsible sections (progressive disclosure); **autosave indicator** ("Saving… / Saved 12:04 / Not saved — offline", `effects` fade, no haptic on autosave); `commit` haptic on post; unsaved-close guard; later a **dictation mic** button per text field (Phase 3) | expo-router formSheet, Reanimated, expo-haptics, `expo-speech-recognition` (Phase 3) | P1 (sheet, autosave), P2 (dictation in Phase 3) | Tutoring-opened sheet: `showMoney=false`, so no price preview; the server prices at posting; dictation on-device, never stored, never in a notification |
| **Live lesson timer** | Sticky **glass pill/banner** above the tab bar ("Lesson in progress · 0:42", tap → session, Stop); `commit` haptic on start, `stop` on stop; toast gives the **length**; then **iOS Live Activity / Dynamic Island** and **Android ongoing → Live Update** with system chronometer | `expo-glass-effect` (iOS) / Paper `Surface` (Android, and Reduce Transparency); `expo-widgets` Live Activity; custom Expo module (Kotlin) for promoted ongoing notification | P1 (banner), P2 (Live Activity / Live Update) | System surfaces show **exactly** "Lesson in progress · 0:42"; no names/org/money; ended on stop, auto-stop, sign-out, org switch; ≤ 8 h by HIG, and the max-length cap ends it well before |
| **Schedule** | Horizontal **week strip** (snap, `tick` per day), agenda list per day; **cancel a date**: swipe or menu → gorhom sheet with optional note → optimistic strike-through + **Undo** snackbar (restore = delete the cancellation row); cancelled stays in list, flagged; `.ics` / **native calendar export** | FlashList, RNGH, `@gorhom/bottom-sheet`, TanStack `onMutate` rollback, `expo-calendar` | P1 (strip, cancel+undo), P2 (calendar export) | Cancellation note reaches the schedule's audience only, never a notification or calendar event body; exported events titled generically ("Lesson") unless the user opts in |
| **Progress** | Chart **draw-on** (path length animation) when it enters view, once; **scrub** with long-press→pan, `tick` haptic per data point, tooltip with topic code + score + date; adjustable a11y role; level/topic list as progressive disclosure | react-native-svg + Reanimated `useAnimatedProps`, RNGH | P2 | No notes or assessment text in tooltips beyond what the screen already shows; drawn instantly under reduce-motion |
| **People directory & person form** | Large title + native search; sectioned FlashList by role; swipe/menu: Edit, Suspend, Delete (soft) with undo; person form as `formSheet` scoped by `sections` (same component the wizard uses); guardian picker in-sheet | expo-router, FlashList, formSheet, Paper `TextInput` | P1 | Pay rates and prices only through scoping helpers; email shown via `EmailOrNone` (no `mailto:` for absent); tutor mailing address only for admin + self; shared-field 409 explained |
| **Billing / payments** | Finance-only screen; payment form sheet with numeric keypad, server-derived amounts echoed back; history list; `commit` haptic | formSheet, FlashList | P1 | Android FLAG_SECURE; iOS switcher cover; reader's side only; no optimistic money |
| **1099** | **Secure screen**: `usePreventScreenCapture('form-1099')`; SSN field `secureTextEntry`, no autofill/copy, state cleared on unmount; document assembled as HTML in memory → `expo-print` system dialog | expo-screen-capture, expo-print | P1 | **Nothing persisted, nothing sent**: no request, no file, no log, no cache, no share sheet, no dictation, generic print job name |
| **Comments** | Chat-style thread: inverted FlashList, sticky composer above keyboard (`KeyboardAvoidingView` / keyboard-controller), optimistic post with "Sending…", long-press → Delete (author only) | FlashList, TanStack variables-optimism | P2 | No push for comments with text; global feed honours server scope; never in notifications or widgets |
| **Activity** | Vertical **timeline** (dot + line), grouped by day, relative times; new items enter with a short layout animation on refresh only | FlashList, Reanimated `entering` | P2 | Server descriptions only (never amounts); payment and onboarding lines left out of dashboard Recent Activity as on web |
| **Organization settings** | Grouped form (`@expo/ui` `FieldGroup` on iOS or Paper list sections); palette picker shows live preview of the theme (cross-fade); logo upload via image picker with byte-type check feedback; email-notification switch; notification log list | `@expo/ui`, expo-image-picker/manipulator, Paper | P2 | TIN field runs through `optionalText` SSN guard; FLAG_SECURE while TIN visible; palette preview from `ORG_PALETTES` only |
| **Welcome tour** | 3–5 coach marks on native anchors, skippable; wizard opens the real sheets in sequence; swipe peek once | Reanimated overlay + measured anchors (`measureInWindow`) | P2 | Server `user_onboarding` is truth; no tour text names an organization other than `brand.short` |
| **Platform console** | Plain stack, platform brand always (`usePlatformBrand`); org list with archive via menu + confirm; brand editor with live palette preview | expo-router, Paper | P3 (polish) | Never reads an organization's people, lessons or money; no glass/brand of any org |

---

## 17. Phase 2 audit checklist

Run per screen, per persona (admin, tutor, parent, student, parent+tutor, student+tutor, org-B admin,
platform admin), on the iPhone 17 / iOS 27 simulator and the API 37 AVD, in light and dark. Record
the results in `docs/mobile/ux-audit.md`.

**Money and privacy**

- [ ] Tutoring tab and everything it opens (sheets, previews, menus, toasts, skeletons) has no
      `session-money` testID and no `$` for every persona.
- [ ] Every amount on screen is inside `SessionMoney` and shows the reader's side only.
- [ ] App switcher: Finance, billing, 1099 and person-with-tax screens show the cover/blur (iOS) or
      blank (Android).
- [ ] 1099: screenshot and recording blocked; after closing, no SSN in React DevTools state,
      AsyncStorage, SecureStore, the query cache, `FileSystem.cacheDirectory` or the device log; the
      print job name is generic.
- [ ] Live Activity, Live Update, status chip, widget, quick actions and notifications show no
      name, organization, note or amount; the live text is exactly "Lesson in progress · 0:42".
- [ ] Sign-out and organization switch end the Live Activity / ongoing notification, clear widget
      snapshots and quick actions, and clear the query cache.

**Brand**

- [ ] Switch between two seeded organizations: every tint, glass tint, chart colour, empty-state
      glyph and status-bar style follows the palette; grep finds no hex literal or organization
      name in `apps/mobile/src`.
- [ ] Sign-in on the local server shows the platform brand (no default organization in the seed).

**Motion**

- [ ] With Reduce Motion on (iOS) and Remove animations on (Android), count-ups show final values,
      the chart is drawn, the shimmer is still, sheets and transitions cut or fade, the swipe peek
      does not run, and there are no exiting animations.
- [ ] Each animation on the screen answers "what change does this explain?"; anything decorative
      is removed.
- [ ] No count-up on money; no overshoot on numbers.

**Haptics**

- [ ] Every haptic maps to a semantic event in `haptics.ts`; at most one per action; none on load,
      scroll or timer tick; the Profile switch silences all of them.

**Layout and system**

- [ ] Edge-to-edge: nothing under the status bar or gesture bar that should not be; FAB and live
      banner clear the bottom inset and the tab bar; 3-button and gesture navigation both checked.
- [ ] Hardware/gesture back on Android closes sheets, then pops stacks, and respects the
      unsaved-changes guard; it never exits the app from a pushed screen.
- [ ] iOS: native glass bars with no custom opaque background; large title collapses on scroll;
      the scroll edge effect keeps the toolbar legible.
- [ ] The tab set never changes while the screen is open (no remount reset).

**Accessibility**

- [ ] Targets ≥ 44 pt / 48 dp (measure `hitSlop`-inclusive frames).
- [ ] Contrast ≥ 4.5:1 text and 3:1 UI in every palette, light, dark and Increase Contrast.
- [ ] Largest accessibility text size: no truncated labels or values; stat rows wrap; sheets scroll.
- [ ] VoiceOver and TalkBack: every icon labelled; tabs announced as tabs with a selected state;
      every swipe action available as an accessibility action; chart adjustable; focus moves into
      sheets and coach marks and back out; loading regions announced as busy.
- [ ] Reduce Transparency: glass surfaces become solid tokens.

**Perceived performance**

- [ ] Cold start to the first meaningful dashboard paint measured (Release build); a skeleton
      matches the final layout (no jump).
- [ ] Long lists (sessions, people, activity) scroll without dropped frames on the AVD (FlashList
      v2, memoised rows).
- [ ] Optimistic actions roll back visibly and are announced on failure; nothing monetary is
      optimistic.
- [ ] Pull-to-refresh on every list and dashboard tab, tinted `primary`.

**States**

- [ ] Empty, error (including a 404 for a hidden row and a 409 for shared fields) and offline
      states exist and name the next step only for roles that can take it.
- [ ] Offline: saving a lesson is disabled with an explanation; autosave reports "Not saved —
      offline"; the live timer survives and stops correctly on reconnect.

---

## Sources

All accessed **2026-10-07**. Dates in parentheses are the source's own publication date where one
was shown. "(secondary)" marks a non-vendor source used only where the vendor's page could not be
read.

- **[S1]** Apple, *Adopting Liquid Glass* (Technology Overviews, © 2026) —
  https://developer.apple.com/tutorials/data/documentation/technologyoverviews/adopting-liquid-glass.md
- **[S2]** Apple, WWDC25 session 323, *Build a SwiftUI app with the new design* (2025-06) —
  https://developer.apple.com/videos/play/wwdc2025/323/
- **[S3]** MacMyths, *WWDC 2026: Apple refines Liquid Glass…* (2026-08-17, secondary) —
  https://macmyths.com/wwdc-2026-apple-refines-liquid-glass-across-its-next-generation-operating-systems/
- **[S4]** Noqta, *Apple Liquid Glass iOS 27 developer adoption guide* (2026, secondary; claims about
  the opt-out removal and an intensity slider unverified) —
  https://noqta.tn/en/blog/apple-liquid-glass-ios-27-developer-adoption-guide-2026
- **[S5]** AppleInsider, *Stop holding out hope: Liquid Glass will be mandatory in iOS 27*
  (2026-03-26; headline only, page returned 403) —
  https://appleinsider.com/articles/26/03/26/stop-holding-out-hope-liquid-glass-will-be-mandatory-in-ios-27
- **[S6]** Expo docs, *GlassEffect* (SDK 57) — https://docs.expo.dev/versions/v57.0.0/sdk/glass-effect/
- **[S7]** Expo docs, *Native tabs* (SDK 57) — https://docs.expo.dev/versions/v57.0.0/sdk/router/native-tabs.md
  and https://docs.expo.dev/router/advanced/native-tabs/
- **[S8]** Expo blog, *Expo Router v6: A new era of native feel* (2025) — https://expo.dev/blog/expo-router-v6
- **[S9]** Expo changelog, *SDK 57* (2026-06-30) — https://expo.dev/changelog/sdk-57
- **[S10]** Expo blog, *Expo UI is stable in SDK 56* (2026-05-26) — https://expo.dev/blog/expo-ui-stable-sdk-56
- **[S11]** Expo docs, *Widgets* (SDK 57) — https://docs.expo.dev/versions/v57.0.0/sdk/widgets.md ;
  Expo blog, *Home screen widgets and Live Activities in Expo* —
  https://expo.dev/blog/home-screen-widgets-and-live-activities-in-expo
- **[S12]** Expo docs, *Link preview* — https://docs.expo.dev/router/reference/link-preview/
- **[S13]** Expo docs, *Stack* (headers, large titles, `Stack.Toolbar`) — https://docs.expo.dev/router/advanced/stack.md
- **[S14]** Expo blog, *How to create Apple Maps style liquid glass sheets in Expo* (2025-11-25) —
  https://expo.dev/blog/how-to-create-apple-maps-style-liquid-glass-sheets ; Expo docs, *Modals* —
  https://docs.expo.dev/router/advanced/modals.md ; Software Mansion, *Introducing react-native-screens
  4.0.0* (2024) — https://swmansion.com/blog/introducing-react-native-screens-4-0-0-1b833ff98a55
- **[S15]** Expo changelog, *SDK 54* (2025-09) — https://expo.dev/changelog/sdk-54 ; Expo blog,
  *Edge-to-edge display, now streamlined for Android* — https://expo.dev/blog/edge-to-edge-display-now-streamlined-for-android
- **[S16]** Android Developers, *Behavior changes: apps targeting Android 16* —
  https://developer.android.com/about/versions/16/behavior-changes-16
- **[S17]** Android Developers, *Add support for the predictive back gesture* —
  https://developer.android.com/guide/navigation/predictive-back-gesture
- **[S18]** react-native-screens, Discussion #2540 *Predictive back gesture support on Android*
  (comments 2024-11 to 2026-09) — https://github.com/software-mansion/react-native-screens/discussions/2540
- **[S19]** Android Developers, *Progress-centric notifications* (Android 16) —
  https://developer.android.com/about/versions/16/features/progress-centric-notifications
- **[S20]** Android Developers, *Live Updates* — https://developer.android.com/develop/ui/views/notifications/live-update
- **[S21]** Android Developers, `androidx.compose.material3.MotionScheme` reference —
  https://developer.android.com/reference/kotlin/androidx/compose/material3/MotionScheme
- **[S22]** Dezeen, *Google ushers in age of expressive interfaces with Material Design update*
  (2025-05-28) — https://www.dezeen.com/2025/05/28/google-ushers-in-age-of-expressive-interfaces-with-material-design-update/
- **[S23]** Android Developers Blog, *Introducing Material 3 Expressive for Wear OS* (2025-08) —
  https://android-developers.googleblog.com/2025/08/introducing-material-3-expressive-for-wear-os.html
- **[S24]** Software Mansion, Reanimated docs, *Accessibility* (ReduceMotion, useReducedMotion) —
  https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/
- **[S25]** Software Mansion, Reanimated docs, *Shared Element Transitions — overview* —
  https://docs.swmansion.com/react-native-reanimated/docs/shared-element-transitions/overview/
- **[S26]** Software Mansion blog, *Introducing Reanimated 4.2.0* (2025–26) —
  https://swmansion.com/blog/introducing-reanimated-4-2-0-71eea21ca861/
- **[S27]** Expo docs, *Haptics* (SDK 57) — https://docs.expo.dev/versions/v57.0.0/sdk/haptics/
- **[S28]** Apple HIG, *Playing haptics* — https://developer.apple.com/design/human-interface-guidelines/playing-haptics ;
  Apple, *Playing haptic feedback in your app* —
  https://developer.apple.com/tutorials/data/documentation/applepencil/playing-haptic-feedback-in-your-app.md
- **[S29]** Android Developers, `HapticFeedbackConstants` —
  https://developer.android.com/reference/android/view/HapticFeedbackConstants
- **[S30]** Android Open Source Project, *UX foundation for haptic framework* —
  https://source.android.com/docs/core/interaction/haptics/haptics-ux-foundation
- **[S31]** Expo docs, *ScreenCapture* (SDK 57) — https://docs.expo.dev/versions/v57.0.0/sdk/screen-capture/
- **[S32]** Apple HIG, *Live Activities* —
  https://developer.apple.com/design/human-interface-guidelines/live-activities ; OneSignal, *Live
  Activities best practices* (secondary) — https://documentation.onesignal.com/docs/live-activities-best-practices
- **[S33]** Notification lock-screen visibility (`VISIBILITY_PRIVATE`, `setPublicVersion`), summarised
  from Android API behaviour (secondary) — https://gurubase.io/g/android/configure-lock-screen-visibility-notifications-android
- **[S34]** Smashing Magazine, *Getting to the bottom of minimum WCAG-conformant interactive element
  size* (2024-07) — https://smashingmagazine.com/2024/07/getting-bottom-minimum-wcag-conformant-interactive-element-size/
- **[S35]** Deque University, axe rule *target-size* — https://dequeuniversity.com/rules/axe/4.7/target-size
- **[S36]** Nielsen Norman Group, *Skeleton Screens vs. Progress Bars vs. Spinners* (video) —
  https://www.nngroup.com/videos/skeleton-screens-vs-progress-bars-vs-spinners/
- **[S37]** TanStack Query v5, *Optimistic Updates* —
  https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates
- **[S38]** Software Mansion, Gesture Handler docs, *ReanimatedSwipeable* —
  https://docs.swmansion.com/react-native-gesture-handler/docs/components/reanimated_swipeable/
- **[S39]** Shopify Engineering, *FlashList v2* (2025) — https://shopify.engineering/flashlist-v2
- **[S40]** gorhom, *React Native Bottom Sheet* docs — https://gorhom.dev/react-native-bottom-sheet/ ;
  v5 types (5.1.8) — https://app.unpkg.com/@gorhom/bottom-sheet@5.1.8/files/src/components/bottomSheet/types.d.ts ;
  reduce-motion discussion — https://github.com/gorhom/react-native-bottom-sheet/issues/1560 ;
  sheet accessibility floor (secondary) — https://vp0.com/blogs/in-bottom-sheet-modal-ui-react-native-template
- **[S41]** Callstack, React Native Paper, *Theming* — https://oss.callstack.com/react-native-paper/docs/guides/theming
- **[S42]** Expo blog, *Save users from deleting your app with expo-quick-actions* —
  https://expo.dev/blog/expo-quick-actions ; npm *expo-quick-actions* — https://npmjs.com/package/expo-quick-actions
- **[S43]** *react-native-android-widget* — https://saleksovski.github.io/react-native-android-widget/
- **[S44]** Apple HIG accessibility summary: Dynamic Type to 200%, weights, contrast (secondary skill
  digest of the HIG) — https://skills.sh/fotescodev/ios-agent-skills/axiom-hig ; Perkins, *Font
  adjustment* — https://www.perkins.org/resource/accessibility-overview-workbook-series-6-font-adjustment
- **[S45]** Dolfy, *Feature discovery: tooltips and coach marks in mobile apps* (secondary) —
  https://www.dolfy.ai/blog/feature-discovery-tooltips-coachmarks-mobile-apps ; *Onboarding &
  progressive disclosure* reference —
  https://cdn.jsdelivr.net/npm/@hegemonart/get-design-done@1.60.4/reference/onboarding-progressive-disclosure.md
- **[S46]** UX Planet, *Design patterns: progressive disclosure for mobile apps* —
  https://uxplanet.org/design-patterns-progressive-disclosure-for-mobile-apps-f41001a293ba
- **[S47]** releases.sh, *Expo SDK 57 upgrades to React Native 0.86 with no breaking changes*
  (2026-06-29) — https://releases.sh/release/rel_aH7NaXbDXMlY2_I-Ak0D0
