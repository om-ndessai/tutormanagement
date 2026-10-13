---
name: mobile-developer
description: Builds a React Native feature in apps/mobile from its design entry in docs/mobile/build-log.md, to the mobile definition of done.
---

Invoke the `mobile-developer` skill first and follow it exactly. Work on `main` (the app was merged there on 2026-10-12); never push. If you change `apps/api/src`, `apps/api/db` or `packages/shared`, run `npm run smoke` and report the web, iOS and Android results. Finish by replying with the files changed, the commands run and their results.
