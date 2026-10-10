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
| `components/layout/tutoring-finance-tabs.tsx` | `?tab=` Tutoring / Finance | `src/components/tutoring-finance-tabs.tsx` | `exposure/*` | tested (36: every Tutoring surface, five readers) |
| `components/layout/command-palette.tsx` | ⌘K | `app/(org)/search.tsx` | `search/*` | tested (33) |
| `components/layout/theme-toggle.tsx`, `theme-transition.ts` | theme switch | `app/(org)/profile.tsx` appearance | `profile/*` | tested (32) |

## Features

| Web source | What | Mobile | Flow | Status |
| --- | --- | --- | --- | --- |
| `pages/dashboard-page.tsx`, `dashboard/role-dashboards.tsx`, `stat-card.tsx`, `hooks/use-count-up.ts` | four role dashboards, role selector, view-as | `app/(org)/(tabs)/index.tsx`, `src/features/dashboard/*` | `dashboard/*` | tutoring tab tested (13); finance tab tested (14); parent and student views tested (15); role selector and view-as tested (16) |
| `dashboard/sessions-carousel.tsx` | past 5, now, upcoming | `src/features/dashboard/sessions-carousel.tsx` | `dashboard/tutoring` | tested |
| `dashboard/reflections.tsx` | prompts, recent reflections | `src/features/dashboard/reflections.tsx` | `dashboard/student`, `dashboard/reflection` | recent reflections tested (13); prompts tested (15) |
| `dashboard/monthly-finance.tsx`, `tutor-payments.tsx`, `money-icon.tsx` | finance tab | `src/features/dashboard/{finance-views,tutor-payments,monthly-finance,money-icon,finance-format}` | `dashboard/finance-*` | tested |
| `dashboard/year-end-panel.tsx`, `form-1099-dialog.tsx` | 1099 printed on device | `app/(org)/form-1099.tsx`, `src/features/dashboard/{form-1099-sheet.tsx, form-1099-html.ts}`; list in `year-end-finance.tsx` | `year-end/*`, `dashboard/finance-*` | tested (14, 28) |
| `dashboard/user-picker.tsx` | admin view-as | `app/(org)/view-as.tsx`, `src/features/dashboard/{user-picker,view-as,view-as-banner,role-selector}` | `dashboard/view-as`, `dashboard/role-selector` | tested |
| `teaching/sessions-page.tsx` | sessions list, tabs, filters, focus, CSV | `app/(org)/(tabs)/sessions/*`, `src/features/teaching/{sessions-screen,session-card,session-detail-screen,sessions-finance-summary,session-filters}.tsx`, `src/lib/download.ts` | `sessions/list-*` | tested (17); Assess and Reflect on cards tested (21); cancelled-lessons panel with 23 |
| `teaching/session-form-dialog.tsx` | record / edit / draft, autosave | `app/(org)/record-session.tsx`, `src/features/teaching/session-form/*` | `sessions/record`, `sessions/record-finance`, `sessions/autosave` | record / edit / delete tested (18); drafts and autosave tested (19) |
| `teaching/drafts-panel.tsx` | own drafts | `src/features/teaching/drafts-panel.tsx` | `sessions/drafts`, `sessions/autosave` | tested |
| `teaching/live-session-bar.tsx`, `start-session-button.tsx` | live timer | `app/(org)/{start-lesson,stop-lesson}.tsx`, `src/features/teaching/{live-session-banner,live-session,start-lesson-sheet,stop-lesson-sheet}.tsx` | `sessions/live` | tested |
| `teaching/session-notes.tsx` | write-up, assessments | `app/(org)/assess-session.tsx`, `src/features/teaching/{session-notes,assess-session-sheet,session-actions}.tsx` | `sessions/assess`, `sessions/list-*` | view parts tested (17); assess sheet, own-only withdraw tested (21) |
| `teaching/session-reflection.tsx` | student reflection | `app/(org)/reflection.tsx`, `src/features/teaching/{reflection-form.tsx,reflection-logic.ts}` | `sessions/reflection-detail`, `dashboard/reflection` | dialog and `mayChangeReflection` tested from the dashboard (15) and from the lesson detail and cards (21) |
| `teaching/session-money.tsx` | money from the reader's side | `src/features/teaching/session-money.tsx` | `exposure/money-*`, `dashboard/parent` | tested (compact form on the parent dashboard, 15; full form by side for five readers, 36) |
| `teaching/assignments-page.tsx`, `assignment-dialog.tsx` | pairings | `app/(org)/pairings.tsx`, `app/(org)/assignment-form.tsx` | `pairings/*` | tested |
| `schedules/*` | weekly schedules, dates, cancel / restore, calendar files, cancelled panel | `app/(org)/(tabs)/schedule/*`, `src/features/schedules/*` | `schedule/*` | tested |
| `progress/*` | list, student page, chart, spotlight, card, assessment / plan dialogs, ratings | `app/(org)/(tabs)/progress/*`, `src/features/progress/*` | `progress/*` | tested (#24: list, student page, full chart with tap/scrub, assessment and plan sheets, topic pickers; compact chart, spotlight, card, RatingPicker in #13/#15) |
| `users/*` | directory, table / cards, detail, form (all sections), availability, guardians, payment handles, badges, SSN receipt | `app/(org)/people/*`, `app/(org)/person-form.tsx`, `src/features/users/*` | `people/*` | tested (14, 25, 26) |
| `payments/*` | billing, balances, log, payment dialog (record and correct), CSV, tax summary | `app/(org)/billing.tsx`, `app/(org)/payment-form.tsx`, `src/features/payments/*` | `billing/*` | tested (27) |
| `comments/*` | threads, counts, feed, delete own | `app/(org)/comments.tsx`, `app/(org)/comments-thread.tsx`, `src/features/comments/*` | `comments/*` | tested |
| `audit/*` | activity feed and page | `app/(org)/activity.tsx`, `src/features/audit/*` | `activity/*` | tested |
| `organizations/organization-settings-page.tsx`, `notifications-switch.tsx` | TIN, payer address, notifications and log | `app/(org)/organization.tsx`, `src/features/organizations/*` | `organization/*` | tested |
| `pages/profile-page.tsx` | own detail | `app/(org)/profile.tsx` | `people/profile` | tested (25) |
| `onboarding/*` | wizard, student / tutor flows, confirm details, tour | `app/(org)/onboarding/*`, `src/features/onboarding/*` | `onboarding/*` | tested |
| `platform/*` | console: organizations, branding, logos, admins, people, activity | `app/(platform)/*`, `src/features/platform/*` | `platform/*` | tested |
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
