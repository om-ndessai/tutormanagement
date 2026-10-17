#!/usr/bin/env node
/**
 * Every model call goes through runAi (Phase 36, docs/ai-platform-plan.md).
 *
 * Fails when code in apps/api/src outside lib/ai/ names a provider's address,
 * reads the Anthropic key, or touches a Workers AI binding: consent, redaction,
 * the SSN guard, the caps and the run log live in runAi, and a direct call
 * would skip all of them. Run by `npm run typecheck`. A heuristic, like
 * check-org-scope.mjs: it makes the easy mistake fail loudly.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('../apps/api/src/', import.meta.url).pathname;
const ALLOWED = join(ROOT, 'lib', 'ai') + sep;
const FORBIDDEN = [
  /api\.anthropic\.com/,
  /gateway\.ai\.cloudflare\.com/,
  /api\.openai\.com/,
  /ANTHROPIC_API_KEY/,
  /\benv\.AI\b/,
  /\bx-api-key\b/i,
];

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : [];
  });
}

const problems = [];
for (const file of files(ROOT)) {
  if (file.startsWith(ALLOWED) || file.endsWith(`${sep}types.ts`)) continue;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (FORBIDDEN.some((re) => re.test(line))) problems.push(`${relative(process.cwd(), file)}:${index + 1}`);
    });
}

if (problems.length > 0) {
  console.error('ai-gateway: a model provider is called outside apps/api/src/lib/ai (use runAi):');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log('ai-gateway: every model call goes through runAi.');
