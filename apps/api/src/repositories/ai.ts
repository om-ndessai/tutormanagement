import {
  AI_TASKS,
  type AiRun,
  type AiRunOutcome,
  type AiTaskId,
  type AiTaskUpdateInput,
} from '@tmi/shared';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

// The AI layer's bookkeeping (Phase 36). Platform tables: no organization reads
// them, and `ai_runs` never holds what was said (AG7).

export interface AiTaskSettings {
  enabled: boolean;
  daily_cap_cents: number;
  monthly_cap_cents: number;
}

export async function getTaskSettings(db: D1Database, task: AiTaskId): Promise<AiTaskSettings> {
  const row = await db
    .prepare('SELECT enabled, daily_cap_cents, monthly_cap_cents FROM ai_task_settings WHERE task = ?')
    .bind(task)
    .first<{ enabled: number; daily_cap_cents: number; monthly_cap_cents: number }>();
  const defaults = AI_TASKS[task];
  return row
    ? { enabled: row.enabled === 1, daily_cap_cents: row.daily_cap_cents, monthly_cap_cents: row.monthly_cap_cents }
    : { enabled: true, daily_cap_cents: defaults.daily_cap_cents, monthly_cap_cents: defaults.monthly_cap_cents };
}

export async function updateTaskSettings(
  db: D1Database,
  task: AiTaskId,
  input: AiTaskUpdateInput,
): Promise<AiTaskSettings> {
  const next = { ...(await getTaskSettings(db, task)), ...input };
  await db
    .prepare(
      `INSERT INTO ai_task_settings (task, enabled, daily_cap_cents, monthly_cap_cents)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (task) DO UPDATE SET enabled = excluded.enabled,
         daily_cap_cents = excluded.daily_cap_cents,
         monthly_cap_cents = excluded.monthly_cap_cents, updated_at = ${NOW}`,
    )
    .bind(task, next.enabled ? 1 : 0, next.daily_cap_cents, next.monthly_cap_cents)
    .run();
  return next;
}

/** Midnight UTC today, and the first of this month, as stored timestamps compare. */
export function spendWindows(now = new Date()): { day: string; month: string } {
  const day = now.toISOString().slice(0, 10);
  return { day: `${day}T00:00:00.000Z`, month: `${day.slice(0, 7)}-01T00:00:00.000Z` };
}

/** Micro-dollars spent today and this month (UTC): one task's, or every task's. */
export async function spend(
  db: D1Database,
  task: AiTaskId | null,
  now = new Date(),
): Promise<{ today: number; month: number }> {
  const { day, month } = spendWindows(now);
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN created_at >= ? THEN cost_microdollars END), 0) AS today,
              COALESCE(SUM(cost_microdollars), 0) AS month
       FROM ai_runs
       WHERE created_at >= ? AND (? IS NULL OR task = ?)`,
    )
    .bind(day, month, task, task)
    .first<{ today: number; month: number }>();
  return { today: row?.today ?? 0, month: row?.month ?? 0 };
}

export interface AiRunRecord {
  organizationId: string | null;
  task: AiTaskId;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicrodollars: number;
  outcome: AiRunOutcome;
  /** An error code or HTTP status. Never text from the model. */
  detail: string | null;
  actorUserId: string | null;
}

export async function insertRun(db: D1Database, run: AiRunRecord): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO ai_runs (id, organization_id, task, provider, model, input_tokens, output_tokens,
                            cost_microdollars, outcome, detail, actor_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      run.organizationId,
      run.task,
      run.provider,
      run.model,
      run.inputTokens,
      run.outputTokens,
      run.costMicrodollars,
      run.outcome,
      run.detail,
      run.actorUserId,
    )
    .run();
  return id;
}

export async function listRuns(db: D1Database, limit: number): Promise<AiRun[]> {
  const result = await db
    .prepare(
      `SELECT r.id, r.task, r.provider, r.model, r.input_tokens, r.output_tokens, r.cost_microdollars,
              r.outcome, r.detail, u.full_name AS actor_name, r.created_at
       FROM ai_runs r LEFT JOIN users u ON u.id = r.actor_user_id
       ORDER BY r.created_at DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<AiRun>();
  return result.results ?? [];
}
