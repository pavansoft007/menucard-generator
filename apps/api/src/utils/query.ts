import type { Request } from 'express';
import { z } from 'zod';
import { HttpError } from './httpError.js';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(24),
  search: z.string().trim().max(100).optional(),
});

export { bool as queryBool };

export function parseQuery<T extends z.ZodTypeAny>(req: Request, schema: T): z.infer<T> {
  const r = schema.safeParse(req.query);
  if (!r.success) throw HttpError.badRequest('Invalid query parameters', r.error.flatten());
  return r.data;
}

export function idParam(req: Request, name = 'id'): number {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n < 1) throw HttpError.badRequest(`Invalid ${name}`);
  return n;
}
