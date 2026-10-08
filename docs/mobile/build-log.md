# Mobile build log

The `mobile-architect` skill writes a design entry here before each feature is built. Each entry
covers scope, web sources, endpoints, screens, exposure checks, testIDs, flows and risks. The
`mobile-tester` skill adds what it verified underneath. Together the entries record that every
feature was designed, built and tested by the three skills.

## 11. Organization picker, invitations and default organization — design (2026-10-07)
**Scope:** the web `/select-organization` page: active memberships, suspended ones (shown, not enterable), invitations (accept / decline), the starred default, the platform console entry, sign out. The web's auto-enter for a single membership lives in `decideLanding` (auth provider), so the screen never renders for it.
**Web sources:** `features/organizations/select-organization-page.tsx`, `api.ts`, `org-avatar.tsx`.
**Endpoints:** `POST /auth/invitations/:slug/accept|decline` — `useAnswerInvitation` — any signed-in person (their own); `PUT /auth/default-organization` — `useSetDefaultOrganization` — own, organizations they may enter; `GET /auth/session` re-read after each.
**Screens & routes:** `src/app/select-organization.tsx` (signed-in guard). Entering calls `chooseOrganization` (cache cleared, session re-read inside it) then `router.replace('/dashboard')`.
**Components:** `OrgAvatar` (uploaded logo / institute artwork / initials on the organization's palette hex — data, since a list shows several organizations at once), `ToastProvider`, `haptics`.
**Interaction & motion:** star = selection haptic; toasts confirm with the web's sentences; ripple rows; ≥44pt star target.
**Exposure checks:** R13 — the query cache is cleared on entering; no organization's name in code (names come from memberships); the star only offered with somewhere else to land.
**testIDs:** `screen-select-organization`, `org-<slug>`, `org-default-<slug>`, `invitation-<slug>`, `invitation-accept-<slug>`, `invitation-decline-<slug>`, `select-platform-console`, `select-sign-out`.
**Tests:** `organizations/picker.yaml` (Priya: both organizations, star and clear the default, enter); `organizations/invitation.yaml` (Dana accepts).
**Verified (2026-10-07):** picker green on iOS 27 (iPhone 17) and Android 37; invitation green on iOS (mutates the seed; the runner resets before each run).

## 12. App shell — tabs, More, account sheet and organization switcher — design (2026-10-07)
**Scope:** the web AppShell: sidebar NAV_ITEMS, OrgSwitcher, UserMenu, theme toggle. The live lesson banner hooks into this shell with feature 20; ⌘K becomes the Search screen (33).
**Web sources:** `components/layout/app-shell.tsx`, `user-menu.tsx`, `theme-toggle.tsx`, `features/organizations/org-switcher.tsx`.
**Endpoints:** `PUT /auth/default-organization` (star), `GET /auth/session` (switch).
**Screens & routes:** `(org)/(tabs)` native tabs — Home `/dashboard`, `/sessions`, `/schedule`, `/progress`, More — the same four for every role: the web shows every page to everyone and the server scopes the data, and native tabs remount if their set changes (immersive-design.md). Every other NAV_ITEM is a stack screen over the tabs reached from More: `/people`, `/pairings`, `/billing`, `/comments`, `/activity`, `/profile`, `/organization` (admins), `/search`. `(org)/account` is a form sheet. The `(org)` stack is keyed on the organization: a switch remounts every screen (R13).
**Interaction & motion:** iOS large titles collapsing into the system bar, Liquid Glass tab bar and back button drawn by the system; Material 3 bar on Android; selection haptic on switching and appearance.
**Exposure checks:** Organization item admin-only (as the web); no organization's name in code; cache cleared and tree remounted on switching.
**testIDs:** `screen-home|sessions|schedule|progress|more|account`, `more-<tourId>`, `account-button`, `account-org-<slug>`, `account-default-<slug>`, `account-all-organizations`, `appearance-light|dark|system`, `account-sign-out`.
**Tests:** `shell/navigation.yaml` — every tab, a More page and back, the account sheet, switching organization (roles shown for the new one).
**Verified (2026-10-07):** green on iOS 27 and Android 37; screenshots reviewed (large titles, glass tab bar, palette changes from indigo to teal on switching to the second organization).
