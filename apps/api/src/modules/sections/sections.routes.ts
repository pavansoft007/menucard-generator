import { Router } from 'express';
import { z } from 'zod';
import { sectionInputSchema } from '@gc/shared-types';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { idParam, parseQuery } from '../../utils/query.js';
import { sectionsService } from './sections.service.js';

const reorderSchema = z.object({ pageId: z.number().int().positive().nullable(), ids: z.array(z.number().int().positive()).min(1).max(500) });

export const sectionsRouter = Router();
sectionsRouter.use(requireAuth);

sectionsRouter.get('/', asyncHandler(async (req, res) => {
  const q = parseQuery(req, z.object({ pageId: z.union([z.literal('none'), z.coerce.number().int().positive()]).optional() }));
  res.json({ success: true, data: await sectionsService.list(q.pageId) });
}));
sectionsRouter.post('/', validateBody(sectionInputSchema), asyncHandler(async (req, res) => void res.status(201).json({ success: true, data: await sectionsService.create(req.body) })));
sectionsRouter.patch('/reorder', validateBody(reorderSchema), asyncHandler(async (req, res) => {
  await sectionsService.reorder(req.body.pageId, req.body.ids);
  res.json({ success: true, data: { reordered: true } });
}));
sectionsRouter.get('/:id', asyncHandler(async (req, res) => void res.json({ success: true, data: await sectionsService.get(idParam(req)) })));
sectionsRouter.put('/:id', validateBody(sectionInputSchema), asyncHandler(async (req, res) => void res.json({ success: true, data: await sectionsService.update(idParam(req), req.body) })));
sectionsRouter.post('/:id/duplicate', asyncHandler(async (req, res) => void res.status(201).json({ success: true, data: await sectionsService.duplicate(idParam(req)) })));
sectionsRouter.delete('/:id', asyncHandler(async (req, res) => {
  await sectionsService.remove(idParam(req));
  res.json({ success: true, data: { deleted: true } });
}));
