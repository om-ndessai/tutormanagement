---
name: mobile-developer
description: Build a feature of the React Native app in apps/mobile from its design entry in docs/mobile/build-log.md. Use whenever writing or changing code under apps/mobile; holds the conventions, the porting rule, the money/SSN/organization rules and the definition of done.
---

# Mobile developer

Build exactly what the design entry says. If the design is wrong, fix the entry first (a line
under it saying what changed and why), then the code.

## Where things go

- `app/` holds expo-router routes, and they stay **thin**: params in, a screen component out.
  Groups:
  - `(org)` needs an organization
  - `(org)/(tabs)` holds the role tabs
  - `(platform)` holds the console
  - `(dev)` holds developer-only screens
  - Forms are routes presented as `formSheet`.
- `src/features/<feature>/` mirrors `apps/web/src/features/<feature>/`. It holds `api.ts`,
  components and screens.
- `src/components/` holds app-wide pieces: Screen, Section, StatCard, Panel, EmptyState,
  ErrorState, Skeleton, TutoringFinanceTabs, OrgAvatar.
- `src/lib/` holds the api client, events, storage, download and query strings.
  `src/providers/` holds auth, brand, theme and query. `src/theme/` holds generated palettes,
  the Paper theme and tokens.

## Porting from the web app

- Copy, don't move. A ported file starts with
  `// Ported from apps/web/src/<path> @ <short sha of main>` and keeps names, query keys,
  invalidation sets and copy (labels, sentences) **identical** unless the design says otherwise.
- Import every type, schema, label and helper from `@tmi/shared`. Never redefine one.
  Validation is the shared Zod schema, `safeParse` on submit, with server `fieldErrors` shown
  under the field.
- The api client is `src/lib/api-client.ts` (`api.get/post/patch/put/delete`). Never call
  `fetch` directly, except for downloads in `src/lib/download.ts`.

## Rules (the lint and `scripts/check-mobile-rules.mjs` enforce some of them; all are mandatory)

- **Money**
  - Render it only through `SessionMoney` (`src/features/teaching/session-money.tsx`) or the
    finance components. `formatCents` appears nowhere else.
  - Anything reachable from a Tutoring tab passes `showMoney={false}`, and the prop defaults to
    false.
- **SSN**
  - It is typed only in the 1099 sheet. It lives in component state: no param, no store, no log,
    no query.
  - Use `Print.printAsync({ html })` only. **Never `printToFileAsync`.**
  - Screen capture is prevented while the sheet is open.
- **Organization**
  - Never write an organization's name. Use `useBrand().short`.
  - The client adds `X-Organization`. Clear the query client on a switch or sign-out.
  - Never persist the query cache.
- **Colours**
  - Use `useAppTheme()` tokens only. No hex or rgb literal outside `src/theme/`.
- **Dates and times**
  - On the organization's clock: `useOrgTimeZone()` + `zonedClockParts`. Never read UTC parts.
- **Downloads**
  - `downloadAndShare()` deletes the file after the share sheet closes.

## Every interactive element

- `testID` follows the design: `screen-<route>` on each screen root, `<feature>-<element>[-<id>]`
  elsewhere. `SessionMoney`'s root is `session-money`.
- `accessibilityLabel` on icon-only controls. Targets ≥ 44pt, using Paper's `IconButton` or
  `hitSlop`.
- Respect reduce motion: `useReducedMotion()` from Reanimated stills every animation.
- Haptics come from `src/lib/haptics.ts` (the semantic map), never ad-hoc.

## Commands (from the repo root)

```sh
npm run mobile:install            # deps (isolated install)
npm run mobile:typecheck          # tsc + palette check + rules
npm run mobile:lint
npm run mobile:test               # jest
npm run mobile:ios / mobile:android
npm run mobile:export             # bundle both platforms (catches Metro errors)
```

## Definition of done

1. Typecheck, lint and jest are green. `mobile:export` bundles.
2. The design's flows are written and green on the iOS simulator and the Android emulator,
   run by the tester.
3. The `parity.md` row and the `progress.md` line are updated.
4. One commit: `Mobile: <Feature> — <what>`. The body lists the web sources ported, the
   endpoints, the exposure rules kept and the flows. It ends with the session trailers.
   Never commit to `main`.
