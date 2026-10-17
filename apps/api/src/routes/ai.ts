import { Hono } from 'hono';
import { z } from 'zod';
import {
  AI_TASKS,
  AI_TASK_IDS,
  aiTaskUpdateSchema,
  formatMicrodollars,
  type AiRun,
  type AiTaskStatus,
  type ApiOk,
} from '@tmi/shared';

import type { AppEnv, Env } from '../types.js';
import { effectiveProvider } from '../lib/ai/run.js';
import { recordAudit } from '../lib/audit.js';
import { zValidator } from '../lib/validate.js';
import { getTaskSettings, listRuns, spend, updateTaskSettings } from '../repositories/ai.js';

// The AI page of the platform console (Phase 36): each task's switch, caps and
// spend, and the recent runs -- outcomes and tokens, never content (AG7).

const taskParam = z.object({ task: z.enum(AI_TASK_IDS) });
const runsQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });

async function taskStatus(env: Env, id: (typeof AI_TASK_IDS)[number]): Promise<AiTaskStatus> {
  const task = AI_TASKS[id];
  const [settings, spent] = await Promise.all([getTaskSettings(env.DB, id), spend(env.DB, id)]);
  return {
    ...task,
    ...settings,
    spent_today_microdollars: spent.today,
    spent_month_microdollars: spent.month,
    effective_provider: env.AI_ENABLED === 'false' ? 'fake' : effectiveProvider(env, task),
  };
}

export const aiRoutes = new Hono<AppEnv>()
  .get('/tasks', async (c) => {
    const tasks = await Promise.all(AI_TASK_IDS.map((id) => taskStatus(c.env, id)));
    return c.json<ApiOk<AiTaskStatus[]>>({ data: tasks });
  })

  .patch('/tasks/:task', zValidator('param', taskParam), zValidator('json', aiTaskUpdateSchema), async (c) => {
    const person = c.get('person');
    const { task } = c.req.valid('param');
    const next = await updateTaskSettings(c.env.DB, task, c.req.valid('json'));
    await recordAudit(c.env.DB, person, 'platform', {
      action: 'ai.task_updated',
      description: `${person.full_name} set “${AI_TASKS[task].label}” ${next.enabled ? 'on' : 'off'}, capped at ${formatMicrodollars(
        next.daily_cap_cents * 10_000,
      )} a day and ${formatMicrodollars(next.monthly_cap_cents * 10_000)} a month.`,
      entity_type: 'ai_task',
      entity_id: task,
    });
    return c.json<ApiOk<AiTaskStatus>>({ data: await taskStatus(c.env, task) });
  })

  .get('/runs', zValidator('query', runsQuery), async (c) => {
    return c.json<ApiOk<AiRun[]>>({ data: await listRuns(c.env.DB, c.req.valid('query').limit) });
  });
