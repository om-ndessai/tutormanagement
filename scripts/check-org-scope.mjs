#!/usr/bin/env node
/**
 * Every query against an organization's data must name the organization.
 *
 * Scans each `.prepare(...)` call in apps/api/src. When its SQL reads or
 * writes a table that belongs to an organization -- directly, or through one
 * of the SELECT_* fragments that do -- the call's own text must also carry the
 * organization: an `organization_id` condition, or one of the scope fragments
 * that always include it (scope.sql, filter.sql, whereSql, ...).
 *
 * A query that legitimately reads across organizations (the sweep that closes
 * every organization's overrunning lessons, sign-in, the platform console)
 * says so with an `org-scope:` comment inside the call, which is the
 * allow-list: a reviewer sees the reason next to the SQL.
 *
 * Run by `npm run typecheck`. Heuristic, not a parser -- it exists to make a
 * forgotten organization fail loudly, and the database triggers and the R13
 * crawl catch what a heuristic cannot.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../apps/api/src/', import.meta.url).pathname;

const ORG_TABLES = [
  'assignments', 'sessions', 'scheduled_sessions', 'session_drafts', 'active_sessions',
  'payments', 'comments', 'assessments', 'learning_plans', 'audit_events',
  'user_roles', 'tutor_profiles', 'student_profiles', 'payment_handles',
  'availability_slots', 'guardianships', 'org_members',
];

const TABLE_RE = new RegExp(
  `\\b(?:FROM|JOIN|INTO|UPDATE)\\s+(?:${ORG_TABLES.join('|')})\\b`,
  'i',
);
/** The SELECT_* fragments that read organization tables without a WHERE of their own. */
const FRAGMENT_RE =
  /\$\{\s*SELECT_(?:SESSION|ASSIGNMENT|PAYMENT|SCHEDULE|CANCELLATION|DRAFT|ASSESSMENT|PLAN|PROGRESS_SESSIONS|ACTIVE|USER|COMMENT|EVENT)\b/;
const SCOPED_RE =
  /organization_id|scope\.sql|filter\.sql|whereSql|where\.join|narrow|children_sql|MEMBERS_WITH_ROLE|org-scope:/;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : [];
  });
}

/** The text of a call's argument list, from the opening paren to its match. */
function argumentsAt(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return source.slice(open + 1);
}

const problems = [];

for (const file of files(ROOT)) {
  const source = readFileSync(file, 'utf8');
  const re = /\.prepare\(/g;
  let match;
  while ((match = re.exec(source))) {
    const args = argumentsAt(source, match.index + '.prepare'.length);
    const touches = TABLE_RE.test(args) || FRAGMENT_RE.test(args);
    if (touches && !SCOPED_RE.test(args)) {
      const line = source.slice(0, match.index).split('\n').length;
      problems.push(`${relative(process.cwd(), file)}:${line}`);
    }
  }
}

if (problems.length > 0) {
  console.error(
    'Queries on organization tables without an organization (add an organization_id ' +
      'condition, or an `org-scope:` comment saying why it reads across organizations):',
  );
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log('org-scope: every query on organization data names the organization.');
