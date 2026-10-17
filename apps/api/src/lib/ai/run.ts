import {
  AI_PROVIDERS,
  AI_TASKS,
  aiCostMicrodollars,
  containsSsn,
  redact,
  restore,
  withinBudget,
  type AiProvider,
  type AiRunOutcome,
  type AiTask,
  type AiTaskId,
} from '@tmi/shared';
import { z, type ZodType } from 'zod';

import type { Env } from '../../types.js';
import { isProduction } from '../../types.js';
import { ApiError } from '../errors.js';
import { getTaskSettings, insertRun, spend } from '../../repositories/ai.js';

// ---------------------------------------------------------------------------
// runAi: the one way to call a model (Phase 36, docs/ai-platform-plan.md)
// ---------------------------------------------------------------------------
// Consent, redaction, the SSN guard, the switches, the budget and the log are
// decided here once, so a feature cannot forget one. scripts/check-ai-gateway.mjs
// fails the typecheck on a provider call anywhere outside this folder.

const ANTHROPIC_URL = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';
/** A model writing a dozen questions takes a while; past this it has failed. */
const PROVIDER_TIMEOUT_MS = 150_000;
/** One retry, on an unusable reply or a provider's passing failure. */
const ATTEMPTS = 2;
/** Every task together, a month: the backstop behind each task's own caps. */
const DEFAULT_PLATFORM_MONTHLY_CAP_CENTS = 5_000;

export interface RunAiOptions<T> {
  task: AiTaskId;
  system: string;
  prompt: string;
  /** The reply's shape: the model answers by calling this tool, and Zod checks it. */
  tool: { name: string; description: string; schema: ZodType<T> };
  actor: { id: string; full_name: string };
  /** NULL for a platform task. */
  organizationId?: string | null;
  /** Names to swap for tokens before sending (AG2); emails and phones always are. */
  redactNames?: readonly string[];
  /** For a `child_input` task: whether the purpose's parental consent is on file (AG1). */
  consent?: boolean;
  /** What the fake provider answers, locally and in tests. */
  fake: () => unknown;
}

export interface RunAiResult<T> {
  output: T;
  runId: string;
}

/** Which provider answers here: `fake` anywhere but production, unless AI_PROVIDER says otherwise. */
export function effectiveProvider(env: Env, task: AiTask): AiProvider {
  const chosen = env.AI_PROVIDER?.trim();
  if (chosen && (AI_PROVIDERS as readonly string[]).includes(chosen)) return chosen as AiProvider;
  return isProduction(env) ? task.provider : 'fake';
}

interface ProviderReply {
  json: unknown;
  inputTokens: number;
  outputTokens: number;
  /** Why the reply cannot be used, when it cannot. */
  unusable?: string;
}

class ProviderError extends Error {
  constructor(
    readonly detail: string,
    readonly retryable: boolean,
  ) {
    super(detail);
  }
}

function toolSchema(schema: ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema) as Record<string, unknown>;
  return json;
}

async function callAnthropic(
  env: Env,
  task: AiTask,
  system: string,
  prompt: string,
  tool: { name: string; description: string; schema: ZodType },
): Promise<ProviderReply> {
  if (!env.ANTHROPIC_API_KEY) throw new ProviderError('no_api_key', false);
  const base = (env.AI_GATEWAY_URL?.trim() || ANTHROPIC_URL).replace(/\/$/, '');
  let response: Response;
  try {
    response = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: task.model,
        max_tokens: task.max_tokens,
        system,
        messages: [{ role: 'user', content: prompt }],
        tools: [{ name: tool.name, description: tool.description, input_schema: toolSchema(tool.schema) }],
        tool_choice: { type: 'tool', name: tool.name },
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ProviderError(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network', true);
  }
  if (!response.ok) {
    // 429 (rate limit), 529 (overloaded) and 5xx pass; 4xx otherwise is ours to fix.
    throw new ProviderError(`http_${response.status}`, response.status === 429 || response.status >= 500);
  }
  const body = (await response.json()) as {
    content?: { type: string; name?: string; input?: unknown }[];
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const block = body.content?.find((part) => part.type === 'tool_use' && part.name === tool.name);
  return {
    json: block?.input,
    inputTokens: body.usage?.input_tokens ?? 0,
    outputTokens: body.usage?.output_tokens ?? 0,
    unusable: body.stop_reason === 'max_tokens' ? 'max_tokens' : !block ? 'no_tool_call' : undefined,
  };
}

/** Every string in a reply, with the redaction's tokens put back. */
function restoreDeep(value: unknown, tokens: Record<string, string>): unknown {
  if (typeof value === 'string') return restore(value, tokens);
  if (Array.isArray(value)) return value.map((item) => restoreDeep(item, tokens));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, restoreDeep(item, tokens)]));
  }
  return value;
}

/**
 * Calls a task's model and returns its validated reply. Throws an ApiError
 * that says why when the call is refused or fails; every attempt, refused ones
 * included, is a row in `ai_runs`.
 */
export async function runAi<T>(env: Env, options: RunAiOptions<T>): Promise<RunAiResult<T>> {
  const task = AI_TASKS[options.task];
  const provider = effectiveProvider(env, task);
  const record = (outcome: AiRunOutcome, detail: string | null, tokens = { input: 0, output: 0 }) =>
    insertRun(env.DB, {
      organizationId: options.organizationId ?? null,
      task: task.id,
      provider,
      model: task.model,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      // The fake costs nothing real, but is priced as its model so the caps can be tested.
      costMicrodollars: aiCostMicrodollars(task.model, tokens.input, tokens.output),
      outcome,
      detail,
      actorUserId: options.actor.id,
    });

  if (env.AI_ENABLED === 'false' || !(await getTaskSettings(env.DB, task.id)).enabled) {
    await record('refused_disabled', null);
    throw new ApiError(503, 'ai_disabled', `“${task.label}” is switched off.`);
  }
  // AG1. No consent can be on file until F7 is built, so every such task is refused.
  if (task.child_input && options.consent !== true) {
    await record('refused_consent', null);
    throw new ApiError(403, 'ai_consent_required', 'This needs a parent’s consent for AI processing.');
  }

  const names = options.redactNames ?? [];
  const system = redact(options.system, names);
  const prompt = redact(options.prompt, names);
  const tokens = { ...system.tokens, ...prompt.tokens };
  if (containsSsn(system.text) || containsSsn(prompt.text)) {
    await record('refused_ssn', 'prompt');
    throw new ApiError(422, 'ai_refused', 'The request contains something shaped like a Social Security number.');
  }

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const settings = await getTaskSettings(env.DB, task.id);
    const platformCap = Number(env.AI_MONTHLY_CAP_CENTS) || DEFAULT_PLATFORM_MONTHLY_CAP_CENTS;
    const [taskSpend, allSpend] = await Promise.all([spend(env.DB, task.id), spend(env.DB, null)]);
    if (
      !withinBudget(taskSpend, settings) ||
      !withinBudget(allSpend, { daily_cap_cents: Number.MAX_SAFE_INTEGER, monthly_cap_cents: platformCap })
    ) {
      await record('refused_budget', null);
      throw new ApiError(429, 'ai_budget_exhausted', `“${task.label}” has reached its spending cap. Raise it on the AI page, or wait.`);
    }

    let reply: ProviderReply;
    try {
      reply =
        provider === 'fake'
          ? { json: options.fake(), inputTokens: 1_000, outputTokens: 2_000 }
          : await callAnthropic(env, task, system.text, prompt.text, options.tool);
    } catch (error) {
      const failure = error instanceof ProviderError ? error : new ProviderError('unexpected', false);
      await record('provider_error', failure.detail);
      if (failure.detail === 'no_api_key') {
        throw new ApiError(503, 'not_configured', 'No Anthropic API key is set on this Worker (ANTHROPIC_API_KEY).');
      }
      if (failure.retryable && attempt < ATTEMPTS) continue;
      throw new ApiError(502, 'ai_failed', `The model could not be reached (${failure.detail}). Try again shortly.`);
    }

    const usage = { input: reply.inputTokens, output: reply.outputTokens };
    const parsed = reply.unusable ? null : options.tool.schema.safeParse(restoreDeep(reply.json, tokens));
    if (!parsed?.success) {
      await record('invalid_output', reply.unusable ?? 'schema', usage);
      if (attempt < ATTEMPTS) continue;
      throw new ApiError(502, 'ai_failed', 'The model’s reply could not be used, twice. Try again.');
    }
    if (containsSsn(JSON.stringify(parsed.data))) {
      await record('refused_ssn', 'reply', usage);
      throw new ApiError(422, 'ai_refused', 'The reply contained something shaped like a Social Security number, and was discarded.');
    }
    const runId = await record('ok', null, usage);
    return { output: parsed.data, runId };
  }
  // Unreachable: the loop returns or throws.
  throw new ApiError(502, 'ai_failed', 'The model could not be reached.');
}
