import { Router } from 'express';
import { z } from 'zod';
import { backgroundInputSchema, backgroundKinds, type BackgroundDTO, type BackgroundInput } from '@gc/shared-types';
import { MediaAsset, MenuBackground, MenuPage, MenuSection } from '../../models/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { HttpError } from '../../utils/httpError.js';
import { idParam, parseQuery } from '../../utils/query.js';
import { assertExist } from '../media/media.service.js';
import { toMediaOrNull } from '../media/media.mapper.js';

const include = [{ model: MediaAsset, as: 'media' }];
const toDTO = (b: MenuBackground): BackgroundDTO => ({ id: b.id, name: b.name, kind: b.kind, media: toMediaOrNull(b.media), config: b.config });

async function load(id: number) {
  const b = await MenuBackground.findByPk(id, { include });
  if (!b) throw HttpError.notFound('Background not found');
  return b;
}

export const backgroundsService = {
  async list(kind?: string) {
    const rows = await MenuBackground.findAll({ where: kind ? { kind: kind as BackgroundDTO['kind'] } : {}, include, order: [['kind', 'ASC'], ['name', 'ASC']] });
    return rows.map(toDTO);
  },
  async create(input: BackgroundInput) {
    await assertExist([input.mediaId]);
    const b = await MenuBackground.create(input);
    return toDTO(await load(b.id));
  },
  async update(id: number, input: BackgroundInput) {
    const b = await load(id);
    await assertExist([input.mediaId]);
    await b.update(input);
    return toDTO(await load(id));
  },
  async remove(id: number) {
    const b = await load(id);
    const [sections, pageRows] = await Promise.all([
      MenuSection.count({ where: { backgroundId: id } }),
      // Pages keep their background id inside the settings JSON, so check it in code (page counts are small).
      MenuPage.findAll({ attributes: ['id', 'settings'] }),
    ]);
    const pages = pageRows.filter((p) => p.settings.backgroundId === id).length;
    if (sections + pages > 0) {
      throw HttpError.conflict(`This background is used by ${pages} page${pages === 1 ? '' : 's'} and ${sections} section${sections === 1 ? '' : 's'}. Pick another background for them first.`);
    }
    await b.destroy();
  },
};

export const backgroundsRouter = Router();
backgroundsRouter.use(requireAuth);
backgroundsRouter.get('/', asyncHandler(async (req, res) => {
  const q = parseQuery(req, z.object({ kind: z.enum(backgroundKinds).optional() }));
  res.json({ success: true, data: await backgroundsService.list(q.kind) });
}));
backgroundsRouter.post('/', validateBody(backgroundInputSchema), asyncHandler(async (req, res) => void res.status(201).json({ success: true, data: await backgroundsService.create(req.body) })));
backgroundsRouter.put('/:id', validateBody(backgroundInputSchema), asyncHandler(async (req, res) => void res.json({ success: true, data: await backgroundsService.update(idParam(req), req.body) })));
backgroundsRouter.delete('/:id', asyncHandler(async (req, res) => {
  await backgroundsService.remove(idParam(req));
  res.json({ success: true, data: { deleted: true } });
}));
