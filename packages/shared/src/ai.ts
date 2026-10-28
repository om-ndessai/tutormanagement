import { z } from 'zod';

// ---------------------------------------------------------------------------
// The AI layer (Phase 36, roadmap F11)
// ---------------------------------------------------------------------------
// Every model call goes through the Worker's `runAi`, and every AI feature is a
// task here: what it is, which provider and model, whether a child's own work
// is in it, and what it may spend. docs/ai-platform-plan.md holds the rules
// (AG1-AG10 in docs/roadmap/future-ai.md).

/** The allowlist (AG3). `fake` answers locally and in tests, and costs nothing real. */
export const AI_PROVIDERS = ['anthropic', 'fake'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_MODELS = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'] as const;
export type AiModel = (typeof AI_MODELS)[number];

/**
 * Price per million tokens, in micro-dollars (input, output). Check against
 * Anthropic's pricing page when a model changes; AI Gateway's dashboard is the
 * cross-check on what was really spent.
 */
export const AI_MODEL_PRICES: Record<AiModel, { input: number; output: number }> = {
  'claude-sonnet-5-5': { input: 3_000_000, output: 15_000_000 },
  'claude-opus-5-5': { input: 5_000_000, output: 25_000_000 },
  // Phase 54: the handwriting reader. Checked against the pricing table on 2026-10-28.
  'claude-haiku-5-5': { input: 100_000, output: 500_000 },
};

export const AI_TASK_IDS = ['question_bank.draft', 'question_bank.check', 'handwriting.read_line'] as const;
export type AiTaskId = (typeof AI_TASK_IDS)[number];

export interface AiTask {
  id: AiTaskId;
  label: string;
  description: string;
  /**
   * True when anything a child produced (answers, photos, voice, writing) is in
   * the input. Such a task is refused until parental consent (F7) exists (AG1).
   */
  child_input: boolean;
  provider: Exclude<AiProvider, 'fake'>;
  model: AiModel;
  max_tokens: number;
  /** Defaults, until a platform admin changes them. */
  daily_cap_cents: number;
  monthly_cap_cents: number;
  /**
   * How the reply's tool is asked for: `tool` forces it (Phase 36's tasks), `auto` names it in
   * the instructions instead, for a model that runs with thinking on and refuses a forced tool
   * (Phase 54). Unset means `tool`.
   */
  tool_choice?: 'tool' | 'auto';
  /** How hard the model thinks, where the model takes it; unset leaves the model's default. */
  effort?: 'low' | 'medium' | 'high';
}

export const AI_TASKS: Record<AiTaskId, AiTask> = {
  'question_bank.draft': {
    id: 'question_bank.draft',
    label: 'Write questions',
    description: 'Writes maths questions for one standard, from its code, name and summary.',
    child_input: false,
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    max_tokens: 12_000,
    daily_cap_cents: 500,
    monthly_cap_cents: 2_500,
  },
  'question_bank.check': {
    id: 'question_bank.check',
    label: 'Solve questions blind',
    description: 'A second model solves each question without its answer, and judges it.',
    child_input: false,
    provider: 'anthropic',
    model: 'claude-opus-5-5',
    max_tokens: 16_000,
    daily_cap_cents: 500,
    monthly_cap_cents: 2_500,
  },
  // Phase 54 (AI-13 stage 0): the Handwriting lab's reader. Adults' handwriting only -- the lab
  // is the platform console's -- so no child's work is in it; reading a student's canvas will be
  // its own task, with child_input set, once consent for AI processing exists (AG1).
  'handwriting.read_line': {
    id: 'handwriting.read_line',
    label: 'Read handwriting',
    description: 'Transcribes one handwritten line of maths from its picture, blind: no question, no answer, no other line.',
    child_input: false,
    provider: 'anthropic',
    model: 'claude-haiku-5-5',
    max_tokens: 2_000,
    daily_cap_cents: 100,
    monthly_cap_cents: 500,
    tool_choice: 'auto',
    effort: 'low',
  },
};

/** What became of a call. Never what was said (AG7). */
export const AI_RUN_OUTCOMES = [
  'ok',
  'invalid_output',
  'provider_error',
  'refused_disabled',
  'refused_consent',
  'refused_budget',
  'refused_ssn',
] as const;
export type AiRunOutcome = (typeof AI_RUN_OUTCOMES)[number];

export const AI_RUN_OUTCOME_LABELS: Record<AiRunOutcome, string> = {
  ok: 'Done',
  invalid_output: 'Unusable reply',
  provider_error: 'Provider error',
  refused_disabled: 'Refused: switched off',
  refused_consent: 'Refused: no consent',
  refused_budget: 'Refused: over budget',
  refused_ssn: 'Refused: SSN-shaped text',
};

/** Micro-dollars a call cost, from the tokens the provider reported. */
export function aiCostMicrodollars(model: AiModel, inputTokens: number, outputTokens: number): number {
  const price = AI_MODEL_PRICES[model];
  return Math.ceil((inputTokens * price.input + outputTokens * price.output) / 1_000_000);
}

export const microdollarsToCents = (micro: number) => micro / 10_000;

export function formatMicrodollars(micro: number): string {
  return `$${(micro / 1_000_000).toFixed(micro > 0 && micro < 10_000 ? 4 : 2)}`;
}

/** Whether a task may spend more: under both its caps (AG9). */
export function withinBudget(
  spent: { today: number; month: number },
  caps: { daily_cap_cents: number; monthly_cap_cents: number },
): boolean {
  return (
    microdollarsToCents(spent.today) < caps.daily_cap_cents &&
    microdollarsToCents(spent.month) < caps.monthly_cap_cents
  );
}

// ---------------------------------------------------------------------------
// Redaction (AG2)
// ---------------------------------------------------------------------------
// No task in Phase 36 carries a person: catalog text has none. Built now so the
// first task that does cannot skip it.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

export interface Redaction {
  text: string;
  /** token -> original, to put back into the reply. */
  tokens: Record<string, string>;
}

/**
 * Swaps the given names, and every email and phone number, for tokens. Longer
 * names go first, so "Sofia Okafor" is one token rather than "Sofia" plus a
 * stray surname.
 */
export function redact(text: string, names: readonly string[] = []): Redaction {
  const tokens: Record<string, string> = {};
  let count = 0;
  const swap = (original: string, kind: string) => {
    const existing = Object.entries(tokens).find(([, value]) => value === original);
    if (existing) return existing[0];
    count += 1;
    const token = `[${kind}_${count}]`;
    tokens[token] = original;
    return token;
  };
  let out = text.replace(EMAIL_RE, (match) => swap(match, 'EMAIL')).replace(PHONE_RE, (match) => swap(match, 'PHONE'));
  for (const name of [...names].filter((n) => n.trim().length > 1).sort((a, b) => b.length - a.length)) {
    const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), (match) => swap(match, 'PERSON'));
  }
  return { text: out, tokens };
}

/** Puts the originals back into a reply. */
export function restore(text: string, tokens: Record<string, string>): string {
  return text.replace(/\[(?:EMAIL|PHONE|PERSON)_\d+\]/g, (token) => tokens[token] ?? token);
}

// ---------------------------------------------------------------------------
// The console's view
// ---------------------------------------------------------------------------

export interface AiTaskStatus extends AiTask {
  enabled: boolean;
  spent_today_microdollars: number;
  spent_month_microdollars: number;
  /** Which provider would answer here: `fake` everywhere but production, unless set. */
  effective_provider: AiProvider;
}

export interface AiRun {
  id: string;
  task: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_microdollars: number;
  outcome: AiRunOutcome;
  detail: string | null;
  actor_name: string | null;
  created_at: string;
}

export const aiTaskUpdateSchema = z
  .object({
    enabled: z.boolean(),
    daily_cap_cents: z.number().int().min(0).max(100_000),
    monthly_cap_cents: z.number().int().min(0).max(1_000_000),
  })
  .partial();
export type AiTaskUpdateInput = z.infer<typeof aiTaskUpdateSchema>;
