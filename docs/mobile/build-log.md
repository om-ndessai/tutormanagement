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
