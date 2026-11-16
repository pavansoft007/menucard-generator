import { Router } from 'express';
import { z } from 'zod';
import { itemInputSchema, reorderSchema } from '@gc/shared-types';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { idParam, paginationSchema, parseQuery, queryBool } from '../../utils/query.js';
import * as service from './items.service.js';

const listQuery = paginationSchema.extend({
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
  categoryId: z.coerce.number().int().positive().optional(),
  isActive: queryBool.optional(),
  dietType: z.enum(['veg', 'non_veg']).optional(),
});

export const itemsRouter = Router();
itemsRouter.use(requireAuth);

itemsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parseQuery(req, listQuery);
    const { items, total } = await service.list(q);
    res.json({ success: true, data: items, meta: { page: q.page, pageSize: q.pageSize, total } });
  }),
);

itemsRouter.post(
  '/',
  validateBody(itemInputSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await service.create(req.body) });
  }),
);

itemsRouter.patch(
  '/reorder',
  validateBody(reorderSchema),
  asyncHandler(async (req, res) => {
    await service.reorder(req.body.ids);
    res.json({ success: true, data: { reordered: true } });
  }),
);

itemsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.get(idParam(req)) });
  }),
);

itemsRouter.put(
  '/:id',
  validateBody(itemInputSchema),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.update(idParam(req), req.body) });
  }),
);

itemsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await service.remove(idParam(req));
    res.json({ success: true, data: { deleted: true } });
  }),
);
