import { HTTPException } from 'hono/http-exception';
import type { ErrorHandler, NotFoundHandler } from 'hono';
import type { ApiErrorBody } from '@tmi/shared';
import type { AppEnv } from '../types.js';
import { ApiError } from '../lib/errors.js';

export const onError: ErrorHandler<AppEnv> = (error, c) => {
  if (error instanceof ApiError) {
    return c.json(error.toBody(), error.status);
  }

  // Raised by Hono itself, e.g. a malformed JSON body.
  if (error instanceof HTTPException) {
    const body: ApiErrorBody = {
      error: {
        code: error.status === 404 ? 'not_found' : 'bad_request',
        message: error.message || 'The request could not be processed.',
      },
    };
    return c.json(body, error.status);
  }

  console.error('Unhandled API error', error);

  const body: ApiErrorBody = {
    error: {
      code: 'internal_error',
      message: 'Something went wrong. Please try again.',
    },
  };
  return c.json(body, 500);
};

export const onNotFound: NotFoundHandler<AppEnv> = (c) => {
  const body: ApiErrorBody = {
    error: {
      code: 'not_found',
      message: `No API route matches ${c.req.method} ${new URL(c.req.url).pathname}.`,
    },
  };
  return c.json(body, 404);
};
