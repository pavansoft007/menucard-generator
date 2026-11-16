import { Router } from 'express';
import { Op, fn, col } from 'sequelize';
import { themeInputSchema, type ThemeDTO, type ThemeInput } from '@gc/shared-types';
import { MenuPage, MenuTheme } from '../../models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { HttpError } from '../../utils/httpError.js';
import { idParam } from '../../utils/query.js';

async function pageCounts(ids: number[]) {
  if (!ids.length) return new Map<number, number>();
  const rows = (await MenuPage.findAll({ attributes: ['themeId', [fn('COUNT', col('id')), 'n']], where: { themeId: { [Op.in]: ids } }, group: ['themeId'], raw: true })) as unknown as { themeId: number; n: number }[];
  return new Map(rows.map((r) => [r.themeId, Number(r.n)]));
}
const toDTO = (t: MenuTheme, n: number): ThemeDTO => ({ id: t.id, name: t.name, isDefault: t.isDefault, config: t.config, pageCount: n });

async function load(id: number) {
  const t = await MenuTheme.findByPk(id);
  if (!t) throw HttpError.notFound('Theme not found');
  return t;
}

export const themesService = {
  async list() {
    const rows = await MenuTheme.findAll({ order: [['isDefault', 'DESC'], ['name', 'ASC']] });
    const counts = await pageCounts(rows.map((r) => r.id));
    return rows.map((r) => toDTO(r, counts.get(r.id) ?? 0));
  },
  async create(input: ThemeInput) {
    const t = await MenuTheme.create({ name: input.name, config: input.config, isDefault: (await MenuTheme.count()) === 0 });
    return toDTO(t, 0);
  },
  async update(id: number, input: ThemeInput) {
    const t = await load(id);
    await t.update({ name: input.name, config: input.config });
    return toDTO(t, (await pageCounts([id])).get(id) ?? 0);
  },
  async setDefault(id: number) {
    const t = await load(id);
    await sequelize.transaction(async (tx) => {
      await MenuTheme.update({ isDefault: false }, { where: { isDefault: true }, transaction: tx });
      await t.update({ isDefault: true }, { transaction: tx });
    });
    return toDTO(t, (await pageCounts([id])).get(id) ?? 0);
  },
  async remove(id: number) {
    const t = await load(id);
    if (t.isDefault) throw HttpError.conflict('This is the default theme. Make another theme the default before deleting it.');
    const used = (await pageCounts([id])).get(id) ?? 0;
    if (used) throw HttpError.conflict(`This theme is used by ${used} page${used > 1 ? 's' : ''}. Switch those pages to another theme first.`);
    await t.destroy();
  },
};

export const themesRouter = Router();
themesRouter.use(requireAuth);
themesRouter.get('/', asyncHandler(async (_req, res) => void res.json({ success: true, data: await themesService.list() })));
themesRouter.post('/', validateBody(themeInputSchema), asyncHandler(async (req, res) => void res.status(201).json({ success: true, data: await themesService.create(req.body) })));
themesRouter.put('/:id', validateBody(themeInputSchema), asyncHandler(async (req, res) => void res.json({ success: true, data: await themesService.update(idParam(req), req.body) })));
themesRouter.post('/:id/default', asyncHandler(async (req, res) => void res.json({ success: true, data: await themesService.setDefault(idParam(req)) })));
themesRouter.delete('/:id', asyncHandler(async (req, res) => {
  await themesService.remove(idParam(req));
  res.json({ success: true, data: { deleted: true } });
}));
