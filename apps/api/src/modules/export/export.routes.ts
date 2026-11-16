import { Router } from 'express';
import { exportOptionsSchema } from '@gc/shared-types';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireFullAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { idParam } from '../../utils/query.js';
import { findChrome } from './browser.js';
import { createExport, deleteExport, getExportFile, listExports } from './export.service.js';

export const exportRouter = Router();
exportRouter.use(requireFullAuth);

/** Lets the UI explain a missing browser / unreachable web app before the user waits on a failed export. */
exportRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const chrome = findChrome();
    let renderReachable = false;
    try {
      renderReachable = (await fetch(env.RENDER_BASE_URL, { signal: AbortSignal.timeout(2500) })).ok;
    } catch {
      renderReachable = false;
    }
    res.json({ success: true, data: { chromeFound: !!chrome, chromePath: chrome, renderBaseUrl: env.RENDER_BASE_URL, renderReachable } });
  }),
);

exportRouter.get('/', asyncHandler(async (_req, res) => void res.json({ success: true, data: await listExports() })));

exportRouter.post('/pdf', validateBody(exportOptionsSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await createExport('pdf', req.body, req.auth!.sub, req.auth!.role, req.auth!.tokenVersion) });
}));

exportRouter.post('/image', validateBody(exportOptionsSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await createExport('png', req.body, req.auth!.sub, req.auth!.role, req.auth!.tokenVersion) });
}));

exportRouter.get('/:id/download', asyncHandler(async (req, res) => {
  const { row, full } = await getExportFile(idParam(req));
  res.download(full, row.filename, { headers: { 'Content-Type': row.mime } });
}));

exportRouter.delete('/:id', asyncHandler(async (req, res) => {
  await deleteExport(idParam(req));
  res.json({ success: true, data: { deleted: true } });
}));
