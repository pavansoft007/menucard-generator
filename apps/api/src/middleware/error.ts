import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ForeignKeyConstraintError } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { env } from '../config/env.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(HttpError.notFound('Route not found'));

const send = (res: Parameters<ErrorRequestHandler>[2], status: number, code: string, message: string, details?: unknown) =>
  res.status(status).json({ success: false, error: { code, message, details } });

// Express identifies error handlers by arity (4 args), so `_next` must stay.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) return void send(res, err.status, err.code, err.message, err.details);
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return void send(res, tooBig ? 413 : 400, tooBig ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR', tooBig ? 'File is too large (max 25 MB)' : err.message);
  }
  if (err instanceof ForeignKeyConstraintError) {
    return void send(res, 409, 'CONFLICT', 'This record is referenced by other data and cannot be changed this way');
  }
  if (err instanceof SyntaxError && 'body' in err) return void send(res, 400, 'BAD_REQUEST', 'Malformed JSON body');
  if (env.NODE_ENV !== 'test' || process.env.DEBUG_ERRORS) console.error(err);
  send(res, 500, 'INTERNAL_ERROR', 'Internal server error');
};
