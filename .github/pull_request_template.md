## What changed

<!-- One paragraph: what and why. -->

## Checklist (CLAUDE.md)

- [ ] `npm run typecheck` is clean
- [ ] Money is shown only from the reader's side, and none on a Tutoring tab
- [ ] No SSN can be typed, stored, logged or sent outside the 1099 dialog
- [ ] Every query or request names its organization; nothing crosses organizations
- [ ] No organization's name or colour hardcoded (brand and tokens only)
- [ ] A data-changing route records an audit event; a new read route is in the exposure spec
- [ ] Schema changes are additive and written into `docs/database.md`
- [ ] Tested locally (web: local Playwright suite; mobile: `npm run e2e:mobile`)
