// Typecheck the mobile app as part of `npm run typecheck`.
// apps/mobile is an isolated install (Expo pins its own React and TypeScript), so a checkout
// that never ran `npm run mobile:install` skips it with a note rather than failing.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (!existsSync('apps/mobile/node_modules')) {
  console.log('apps/mobile: dependencies not installed (npm run mobile:install); typecheck skipped.');
  process.exit(0);
}
const run = spawnSync('npm', ['--prefix', 'apps/mobile', 'run', 'typecheck'], { stdio: 'inherit' });
process.exit(run.status ?? 1);
