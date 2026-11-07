import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * SQL on the LOCAL D1 database, for a state the API can no longer make -- an account from before a release, say
 * (Phase 80: a Post-approved sign-up that waited with a personal space). Use the API for everything else.
 *
 * It runs the same command as the API's `db:*` scripts, from apps/api with no `--env` and no `--persist-to`:
 *
 *   npx wrangler d1 execute tutoring-db --local --json --command "<sql>"
 *
 * so it reads and writes the `.wrangler/state` that `npm run dev:api` (`wrangler dev` in apps/api) serves.
 *
 * LOCAL ONLY. It refuses unless E2E_BASE_URL is set and names this machine: `tutoring-db` is also production's
 * database name, so this file never passes `--remote` and never runs while the suite targets anything else. An unset
 * E2E_BASE_URL is refused too: the Playwright config then defaults to the remote demo, which does not read this
 * database.
 *
 * wrangler has no bind parameters, so `?` placeholders are replaced here by quoted SQL literals (strings with their
 * single quotes doubled), outside quoted text only. Pass test-made values; the arguments go to wrangler as an argv
 * array (execFileSync, no shell), so nothing is interpolated into a shell command.
 */

export type SqlValue = string | number | boolean | null;

const API_DIR = fileURLToPath(new URL('../../apps/api/', import.meta.url));
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function assertLocalTarget(): void {
  const base = process.env.E2E_BASE_URL;
  let host = '';
  try {
    host = base ? new URL(base).hostname : '';
  } catch {
    host = '';
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `localSql runs only against the local Worker's database: E2E_BASE_URL must name localhost (got ${base ?? 'nothing'}).`,
    );
  }
}

function literal(value: SqlValue): string {
  if (value === null) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`localSql: ${value} is not a number SQL can hold.`);
    return String(value);
  }
  if (value.includes('\0')) throw new Error('localSql: a value holds a NUL character.');
  return `'${value.replaceAll("'", "''")}'`;
}

/** Replaces each `?` outside quoted text ('...', "...") with the next value, as a literal. */
function bindLiterals(sql: string, params: readonly SqlValue[]): string {
  let out = '';
  let next = 0;
  let quote: "'" | '"' | null = null;
  for (const ch of sql) {
    if (quote) {
      // A doubled quote inside quoted text closes and reopens it, which this toggle follows.
      if (ch === quote) quote = null;
      out += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
    } else if (ch === '?') {
      if (next >= params.length) throw new Error(`localSql: more placeholders than values in: ${sql}`);
      out += literal(params[next++]!);
    } else {
      out += ch;
    }
  }
  if (next !== params.length) throw new Error(`localSql: ${params.length} values for ${next} placeholders in: ${sql}`);
  return out;
}

/**
 * Runs one statement on the local database and returns its rows (an UPDATE's are none). With several statements
 * separated by `;`, the last one's rows.
 */
export function localSql<T = Record<string, unknown>>(sql: string, params: readonly SqlValue[] = []): T[] {
  assertLocalTarget();
  const command = bindLiterals(sql, params);
  let out: string;
  try {
    out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'tutoring-db', '--local', '--json', '--command', command], {
      cwd: API_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    });
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string; message?: string };
    const said = `${failed.stdout ?? ''}\n${failed.stderr ?? ''}`.trim() || failed.message;
    throw new Error(`localSql failed: ${command}\n${said?.slice(0, 1200)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(out);
  } catch {
    throw new Error(`localSql: expected JSON from wrangler, got:\n${out.slice(0, 600)}`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`localSql: unexpected output from wrangler:\n${out.slice(0, 600)}`);
  }
  const last = parsed[parsed.length - 1] as { results?: T[]; success?: boolean };
  if (last.success === false) throw new Error(`localSql: the statement did not succeed: ${command}\n${out.slice(0, 600)}`);
  return last.results ?? [];
}
