import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { changePasswordSchema, loginSchema } from '@gc/shared-types';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth, requireFullAuth } from '../../middleware/auth.js';
import * as service from './auth.service.js';

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

export const authRouter = Router();

authRouter.post(
  '/login',
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await service.login(req.body.email, req.body.password);
    res.json({ success: true, data: result });
  }),
);

// JWTs are stateless: the client discards the token. Endpoint kept for API parity / a future denylist.
authRouter.post('/logout', requireAuth, (_req, res) => {
  res.json({ success: true, data: { loggedOut: true } });
});

authRouter.post(
  '/change-password',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }),
  requireFullAuth,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.changePassword(req.auth!.sub, req.body.currentPassword, req.body.newPassword) });
  }),
);

authRouter.get(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.getProfile(req.auth!.sub) });
  }),
);
