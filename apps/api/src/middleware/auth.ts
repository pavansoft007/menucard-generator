import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@gc/shared-types';
import { env } from '../config/env.js';
import { User } from '../models/user.js';
import { HttpError } from '../utils/httpError.js';

export interface AuthPayload {
  sub: number;
  /** Always the role stored in the database right now, never the one baked into the token. */
  role: UserRole;
  tokenVersion: number;
  /** true for the short-lived token handed to the headless browser: it may only read. */
  renderOnly?: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthPayload;
  }
}

interface Snapshot {
  role: UserRole;
  isActive: boolean;
  tokenVersion: number;
}
// A user's state is re-checked on every request (so deactivation, role changes and password resets apply at once),
// with a few seconds of caching to spare the database. Changes made through this server invalidate the entry immediately.
const CACHE_MS = 5000;
const cache = new Map<number, { at: number; user: Snapshot | null }>();
export const invalidateUserCache = (id?: number) => (id === undefined ? cache.clear() : cache.delete(id));

async function loadUser(id: number): Promise<Snapshot | null> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.user;
  const row = await User.findByPk(id, { attributes: ['id', 'role', 'isActive', 'tokenVersion'] });
  const user = row ? { role: row.role, isActive: row.isActive, tokenVersion: row.tokenVersion } : null;
  cache.set(id, { at: Date.now(), user });
  return user;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  let auth: AuthPayload;
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw HttpError.unauthorized();
    let payload: { sub: string; tv?: number; purpose?: string };
    try {
      payload = jwt.verify(header.slice(7), env.JWT_SECRET, { algorithms: ['HS256'] }) as typeof payload;
    } catch {
      throw HttpError.unauthorized('Invalid or expired token');
    }
    const renderOnly = payload.purpose === 'render';
    if (renderOnly && req.method !== 'GET') throw HttpError.forbidden('Render tokens are read-only');
    const user = await loadUser(Number(payload.sub));
    if (!user || !user.isActive || user.tokenVersion !== (payload.tv ?? 0)) throw HttpError.unauthorized('Your session has ended. Please sign in again.');
    auth = { sub: Number(payload.sub), role: user.role, tokenVersion: user.tokenVersion, renderOnly };
  } catch (e) {
    return next(e instanceof HttpError ? e : HttpError.unauthorized());
  }
  req.auth = auth;
  next();
};

/** Like requireAuth, but refuses the read-only render token (used for anything that creates or exports). */
export const requireFullAuth: RequestHandler = (req, res, next) =>
  requireAuth(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (req.auth?.renderOnly) return next(HttpError.forbidden());
    next();
  });

/** Use after requireFullAuth. */
export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth || req.auth.renderOnly || !roles.includes(req.auth.role)) return next(HttpError.forbidden('This action needs an administrator'));
    next();
  };
