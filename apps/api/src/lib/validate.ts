import { validator } from 'hono/validator';
import type { ZodType, z } from 'zod';
import { ApiError } from './errors.js';

type Target = 'json' | 'query' | 'param';

/**
 * Bridges Zod into Hono's validator so routes get typed, parsed input via
 * `c.req.valid(target)` and every failure produces the same error envelope.
 */
export function zValidator<T extends ZodType, Tg extends Target>(target: Tg, schema: T) {
  return validator(target, (value): z.output<T> => {
    const result = schema.safeParse(value);

    if (!result.success) {
      const details: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.length > 0 ? issue.path.join('.') : '_';
        (details[key] ??= []).push(issue.message);
      }
      throw ApiError.validation('Please correct the highlighted fields.', details);
    }

    return result.data;
  });
}
