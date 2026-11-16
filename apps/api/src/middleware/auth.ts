import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@gc/shared-types';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

export interface AuthPayload {
  sub: number;
  role: UserRole;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthPayload;
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(HttpError.unauthorized());
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as unknown as { sub: string; role: UserRole };
    req.auth = { sub: Number(payload.sub), role: payload.role };
    next();
  } catch {
    next(HttpError.unauthorized('Invalid or expired token'));
  }
};

export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) return next(HttpError.forbidden());
    next();
  };
