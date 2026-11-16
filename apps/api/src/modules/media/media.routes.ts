import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { mediaCropSchema, mediaUpdateSchema } from '@gc/shared-types';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { HttpError } from '../../utils/httpError.js';
import { idParam, paginationSchema, parseQuery } from '../../utils/query.js';
import * as service from './media.service.js';
import { toMediaDTO } from './media.mapper.js';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 30, fields: 5 },
});

const categoryField = z.string().trim().max(60).optional();
const listQuery = paginationSchema.extend({
  category: z.string().trim().max(60).optional(),
  kind: z.enum(['image', 'svg']).optional(),
});

export const mediaRouter = Router();
mediaRouter.use(requireAuth);

mediaRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parseQuery(req, listQuery);
    const { rows, count, usage } = await service.list(q);
    res.json({
      success: true,
      data: rows.map((r) => toMediaDTO(r, usage.get(r.id) ?? 0)),
      meta: { page: q.page, pageSize: q.pageSize, total: count },
    });
  }),
);

// Resolve many ids at once (layout image elements only store media ids).
mediaRouter.get(
  '/by-ids',
  asyncHandler(async (req, res) => {
    const q = parseQuery(req, z.object({ ids: z.string().regex(/^\d+(,\d+){0,199}$/, 'ids must be a comma separated list of up to 200 ids') }));
    res.json({ success: true, data: (await service.byIds(q.ids.split(',').map(Number))).map((m) => toMediaDTO(m)) });
  }),
);

mediaRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await service.categories() });
  }),
);

mediaRouter.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw HttpError.badRequest('No file received (field name must be "file")');
    const category = categoryField.parse(req.body?.category) || null;
    const media = await service.createFromUpload(req.file, category);
    res.status(201).json({ success: true, data: toMediaDTO(media, 0) });
  }),
);

mediaRouter.post(
  '/bulk-upload',
  upload.array('files', 30),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw HttpError.badRequest('No files received (field name must be "files")');
    const category = categoryField.parse(req.body?.category) || null;
    const uploaded = [];
    const failed: { name: string; error: string }[] = [];
    for (const f of files) {
      try {
        uploaded.push(toMediaDTO(await service.createFromUpload(f, category), 0));
      } catch (e) {
        failed.push({ name: f.originalname, error: e instanceof HttpError ? e.message : 'Upload failed' });
      }
    }
    // 207-style partial success is expressed in the body; the request itself succeeded.
    res.status(failed.length === files.length ? 400 : 201).json(
      failed.length === files.length
        ? { success: false, error: { code: 'BAD_REQUEST', message: failed[0]!.error, details: failed } }
        : { success: true, data: { uploaded, failed } },
    );
  }),
);

mediaRouter.put(
  '/:id',
  validateBody(mediaUpdateSchema),
  asyncHandler(async (req, res) => {
    const m = await service.update(idParam(req), req.body);
    res.json({ success: true, data: toMediaDTO(m) });
  }),
);

mediaRouter.post(
  '/:id/replace',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw HttpError.badRequest('No file received (field name must be "file")');
    const m = await service.replaceFile(idParam(req), req.file);
    res.json({ success: true, data: toMediaDTO(m) });
  }),
);

mediaRouter.post(
  '/:id/crop',
  validateBody(mediaCropSchema),
  asyncHandler(async (req, res) => {
    const m = await service.cropMedia(idParam(req), req.body);
    res.status(201).json({ success: true, data: toMediaDTO(m, 0) });
  }),
);

mediaRouter.get(
  '/:id/usage',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.usageFor(idParam(req)) });
  }),
);

mediaRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await service.remove(idParam(req));
    res.json({ success: true, data: { deleted: true } });
  }),
);
