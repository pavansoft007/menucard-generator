import { Router } from 'express';
import { logoCreateSchema, logoUpdateSchema } from '@gc/shared-types';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { idParam } from '../../utils/query.js';
import * as service from './logos.service.js';

export const logosRouter = Router();
logosRouter.use(requireAuth);

logosRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await service.list() });
  }),
);

logosRouter.post(
  '/',
  validateBody(logoCreateSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await service.create(req.body) });
  }),
);

logosRouter.put(
  '/:id',
  validateBody(logoUpdateSchema),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.update(idParam(req), req.body) });
  }),
);

logosRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await service.remove(idParam(req));
    res.json({ success: true, data: { deleted: true } });
  }),
);
