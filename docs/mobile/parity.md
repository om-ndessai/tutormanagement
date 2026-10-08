# Web → mobile parity

Every screen and behaviour of the web portal (`apps/web/src`, the tutoring portal: multiple organizations,
the platform console included) and where the app ports it. Status: `todo` · `built` · `tested`
(flow green on iOS and Android). Paths on the mobile side are under `apps/mobile/`.

## Foundation

| Web source | What | Mobile | Flow | Status |
| --- | --- | --- | --- | --- |
| `lib/api-client.ts` | envelope, `ApiRequestError`, `X-Organization`, 401 / org-required events | `src/lib/api-client.ts`, `src/lib/events.ts` | jest | todo |
| `lib/organization.ts` | active org per tab, `withOrg` for downloads | `src/lib/organization.ts`, `src/lib/download.ts` | jest | todo |
| `providers/auth-provider.tsx` | boot, landing org, enter, sign out, `useOrgTimeZone` | `src/providers/auth-provider.tsx`, `src/features/auth/landing.ts` | `smoke/sign-in` | todo |
| `providers/brand-provider.tsx` | brand from org / platform | `src/providers/brand-provider.tsx` | `smoke/brand` | todo |
| `providers/theme-provider.tsx`, `index.css` palettes | light / dark / system, palettes | `src/providers/theme-provider.tsx`, `src/theme/*` | jest | todo |
| `features/auth/*` | sign-in page (Google → Phase 4), RequireAuth | `app/sign-in.tsx`, `app/_layout.tsx` guards | `smoke/sign-in` | todo |
| `features/organizations/require-org.tsx`, `select-organization-page.tsx`, `org-switcher.tsx`, `org-avatar.tsx` | picker, invitations, default ★, switch | `app/select-organization.tsx`, `src/features/organizations/*` | `organizations/*` | todo |
| `components/layout/app-shell.tsx` (`NAV_ITEMS`), `user-menu.tsx`, `page-header.tsx`, `focus-notice.tsx` | shell, nav, user menu | `app/(org)/(tabs)/_layout.tsx`, `app/(org)/(tabs)/more.tsx`, `src/components/*` | `shell/*` | todo |
| `components/layout/tutoring-finance-tabs.tsx` | `?tab=` Tutoring / Finance | `src/components/tutoring-finance-tabs.tsx` | `exposure/*` | todo |
| `components/layout/command-palette.tsx` | ⌘K | `app/(org)/search.tsx` | `search/*` | todo |
| `components/layout/theme-toggle.tsx`, `theme-transition.ts` | theme switch | `app/(org)/profile.tsx` appearance | `profile/*` | todo |

## Features

| Web source | What | Mobile | Flow | Status |
| --- | --- | --- | --- | --- |
| `pages/dashboard-page.tsx`, `dashboard/role-dashboards.tsx`, `stat-card.tsx`, `hooks/use-count-up.ts` | four role dashboards, role selector, view-as | `app/(org)/(tabs)/index.tsx`, `src/features/dashboard/*` | `dashboard/*` | tutoring tab tested (13); finance, parent/student, view-as todo |
| `dashboard/sessions-carousel.tsx` | past 5, now, upcoming | `src/features/dashboard/sessions-carousel.tsx` | `dashboard/tutoring` | tested |
| `dashboard/reflections.tsx` | prompts, recent reflections | `src/features/dashboard/reflections.tsx` | `dashboard/student` | recent reflections tested (13); prompts todo |
| `dashboard/monthly-finance.tsx`, `tutor-payments.tsx`, `money-icon.tsx` | finance tab | `src/features/dashboard/*` | `dashboard/finance` | todo |
| `dashboard/year-end-panel.tsx`, `form-1099-dialog.tsx` | 1099 printed on device | `app/(org)/form-1099.tsx`, `src/features/dashboard/form-1099-html.ts` | `year-end/*` | todo |
| `dashboard/user-picker.tsx` | admin view-as | `src/features/dashboard/user-picker.tsx` | `dashboard/view-as` | todo |
| `teaching/sessions-page.tsx` | sessions list, tabs, filters, focus, CSV | `app/(org)/(tabs)/sessions/*` | `sessions/*` | todo |
| `teaching/session-form-dialog.tsx` | record / edit / draft, autosave | `app/(org)/record-session.tsx`, `src/features/teaching/session-form/*` | `sessions/record`, `sessions/autosave` | todo |
| `teaching/drafts-panel.tsx` | own drafts | `src/features/teaching/drafts-panel.tsx` | `sessions/drafts` | todo |
| `teaching/live-session-bar.tsx`, `start-session-button.tsx` | live timer | `src/features/teaching/live-session-banner.tsx`, `start-session.tsx` | `sessions/live` | todo |
| `teaching/session-notes.tsx` | write-up, assessments | `src/features/teaching/session-notes.tsx` | `sessions/notes` | todo |
| `teaching/session-reflection.tsx` | student reflection | `src/features/teaching/session-reflection.tsx` | `sessions/reflection` | todo |
| `teaching/session-money.tsx` | money from the reader's side | `src/features/teaching/session-money.tsx` | `exposure/money` | todo |
| `teaching/assignments-page.tsx`, `assignment-dialog.tsx` | pairings | `app/(org)/pairings.tsx`, `app/(org)/assignment-form.tsx` | `pairings/*` | todo |
| `schedules/*` | weekly schedules, dates, cancel / restore, calendar files, cancelled panel | `app/(org)/(tabs)/schedule/*`, `src/features/schedules/*` | `schedule/*` | todo |
| `progress/*` | list, student page, chart, spotlight, card, assessment / plan dialogs, ratings | `app/(org)/(tabs)/progress/*`, `src/features/progress/*` | `progress/*` | todo |
| `users/*` | directory, table / cards, detail, form (all sections), availability, guardians, payment handles, badges, SSN receipt | `app/(org)/(tabs)/people/*`, `app/(org)/person-form.tsx`, `src/features/users/*` | `people/*` | todo |
| `payments/*` | billing, balances, log, payment dialog, CSV | `app/(org)/billing.tsx`, `app/(org)/payment-form.tsx` | `billing/*` | todo |
| `comments/*` | threads, counts, feed, delete own | `app/(org)/comments.tsx`, `src/features/comments/*` | `comments/*` | todo |
| `audit/*` | activity feed and page | `app/(org)/activity.tsx`, `src/features/audit/*` | `activity/*` | todo |
| `organizations/organization-settings-page.tsx`, `notifications-switch.tsx` | TIN, payer address, notifications and log | `app/(org)/organization.tsx` | `organization/*` | todo |
| `pages/profile-page.tsx` | own detail | `app/(org)/profile.tsx` | `profile/*` | todo |
| `onboarding/*` | wizard, student / tutor flows, confirm details, tour | `app/(org)/onboarding/*`, `src/features/onboarding/*` | `onboarding/*` | todo |
| `platform/*` | console: organizations, branding, logos, admins, people, activity | `app/(platform)/*`, `src/features/platform/*` | `platform/*` | todo |
| `pages/not-found-page.tsx` | unknown route | `app/+not-found.tsx` | — | todo |

## Web-only behaviour and its mobile replacement

| Web | Mobile |
| --- | --- |
| `<a download>` CSV / ICS links with `?org=` | authenticated download into the cache → share sheet → file deleted |
| 1099 printed from a browser window | HTML built on device → `Print.printAsync` (never `printToFileAsync`) |
| `sessionStorage` / cookies for org, tour, theme | in-memory org + AsyncStorage preferences |
| `window` events | typed emitter |
| CSS palettes | generated palette tokens → Paper MD3 theme |
| ⌘K | Search screen |
| `data-tour` coach marks | spotlight overlay over registered refs |
| Google Identity Services | Phase 4: native Google Sign-In → Bearer session |
