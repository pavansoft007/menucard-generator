import { Router } from 'express';
import { z } from 'zod';
import { categoryInputSchema, reorderSchema } from '@gc/shared-types';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { idParam, parseQuery, queryBool } from '../../utils/query.js';
import * as service from './categories.service.js';

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

categoriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parseQuery(req, z.object({ search: z.string().trim().max(100).optional(), isActive: queryBool.optional() }));
    res.json({ success: true, data: await service.list(q) });
  }),
);

categoriesRouter.post(
  '/',
  validateBody(categoryInputSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await service.create(req.body) });
  }),
);

// Declared before '/:id' so "reorder" is never parsed as an id.
categoriesRouter.patch(
  '/reorder',
  validateBody(reorderSchema),
  asyncHandler(async (req, res) => {
    await service.reorder(req.body.ids);
    res.json({ success: true, data: { reordered: true } });
  }),
);

categoriesRouter.put(
  '/:id',
  validateBody(categoryInputSchema),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.update(idParam(req), req.body) });
  }),
);

categoriesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await service.remove(idParam(req));
    res.json({ success: true, data: { deleted: true } });
  }),
);
