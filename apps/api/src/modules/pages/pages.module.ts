import { Router } from 'express';
import { z } from 'zod';
import { Op, fn, col } from 'sequelize';
import { normalizePageSettings, pageInputSchema, type PageDTO, type PageInput } from '@gc/shared-types';
import { MenuBackground, MenuPage, MenuSection, MenuSectionCategory, MenuSectionCombo, MenuSectionItem, MenuTheme, RestaurantLogo } from '../../models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { HttpError } from '../../utils/httpError.js';
import { idParam, parseQuery, queryBool } from '../../utils/query.js';
import { assertIdsExist, nextOrder } from '../../utils/refs.js';
import { reorderSchema } from '@gc/shared-types';
import { toSectionDTOs } from '../sections/sections.service.js';

async function sectionCounts(ids: number[]) {
  if (!ids.length) return new Map<number, number>();
  const rows = (await MenuSection.findAll({ attributes: ['pageId', [fn('COUNT', col('id')), 'n']], where: { pageId: { [Op.in]: ids } }, group: ['pageId'], raw: true })) as unknown as { pageId: number; n: number }[];
  return new Map(rows.map((r) => [r.pageId, Number(r.n)]));
}

async function toDTOs(pages: MenuPage[], withSections: boolean): Promise<PageDTO[]> {
  const counts = await sectionCounts(pages.map((p) => p.id));
  const sections = withSections
    ? await toSectionDTOs(await MenuSection.findAll({ where: { pageId: { [Op.in]: pages.map((p) => p.id) } }, include: [{ association: 'image' }], order: [['displayOrder', 'ASC'], ['id', 'ASC']] }))
    : [];
  return pages.map((p) => ({
    id: p.id,
    title: p.title,
    subtitle: p.subtitle,
    pageType: p.pageType,
    themeId: p.themeId,
    isActive: p.isActive,
    displayOrder: p.displayOrder,
    settings: p.settings,
    layout: p.layout,
    sectionCount: counts.get(p.id) ?? 0,
    updatedAt: p.updatedAt.toISOString(),
    ...(withSections ? { sections: sections.filter((s) => s.pageId === p.id) } : {}),
  }));
}

async function load(id: number) {
  const p = await MenuPage.findByPk(id);
  if (!p) throw HttpError.notFound('Page not found');
  return p;
}

async function validateRefs(input: PageInput) {
  await assertIdsExist(MenuTheme, [input.themeId], 'theme');
  await assertIdsExist(MenuBackground, [input.settings.backgroundId], 'background');
  await assertIdsExist(RestaurantLogo, [input.settings.logo.logoId], 'logo');
}

const values = (i: PageInput) => ({
  title: i.title,
  subtitle: i.subtitle,
  pageType: i.pageType,
  themeId: i.themeId,
  isActive: i.isActive,
  settings: normalizePageSettings(i.settings), // A4 is always exactly 210x297 (swapped for landscape)
  layout: i.layout,
});

export const pagesService = {
  async list(withSections: boolean) {
    return toDTOs(await MenuPage.findAll({ order: [['displayOrder', 'ASC'], ['id', 'ASC']] }), withSections);
  },
  async get(id: number) {
    return (await toDTOs([await load(id)], true))[0]!;
  },
  async create(input: PageInput) {
    await validateRefs(input);
    const p = await MenuPage.create({ ...values(input), displayOrder: await nextOrder(MenuPage) });
    return (await toDTOs([p], true))[0]!;
  },
  async update(id: number, input: PageInput) {
    const p = await load(id);
    await validateRefs(input);
    await p.update(values(input));
    return (await toDTOs([p], true))[0]!;
  },
  async remove(id: number) {
    const p = await load(id);
    // Sections (layout only) go with the page via ON DELETE CASCADE; categories/items/images are untouched.
    await p.destroy();
  },
  /** Copies a page and its sections; the copy sits right after the original. */
  async duplicate(id: number) {
    const src = await load(id);
    const newId = await sequelize.transaction(async (t) => {
      await MenuPage.increment('displayOrder', { by: 1, where: { displayOrder: { [Op.gt]: src.displayOrder } }, transaction: t });
      const copy = await MenuPage.create(
        { title: `${src.title} (copy)`.slice(0, 120), subtitle: src.subtitle, pageType: src.pageType, themeId: src.themeId, isActive: src.isActive, settings: src.settings, layout: src.layout, displayOrder: src.displayOrder + 1 },
        { transaction: t },
      );
      const sections = await MenuSection.findAll({ where: { pageId: id }, order: [['displayOrder', 'ASC']], transaction: t });
      for (const s of sections) {
        const ns = await MenuSection.create(
          { pageId: copy.id, title: s.title, subtitle: s.subtitle, description: s.description, imageMediaId: s.imageMediaId, backgroundId: s.backgroundId, displayOrder: s.displayOrder, config: s.config },
          { transaction: t },
        );
        const [cats, items, combos] = await Promise.all([
          MenuSectionCategory.findAll({ where: { sectionId: s.id }, transaction: t }),
          MenuSectionItem.findAll({ where: { sectionId: s.id }, transaction: t }),
          MenuSectionCombo.findAll({ where: { sectionId: s.id }, transaction: t }),
        ]);
        if (combos.length) await MenuSectionCombo.bulkCreate(combos.map((c) => ({ sectionId: ns.id, comboId: c.comboId, displayOrder: c.displayOrder })), { transaction: t });
        if (cats.length) await MenuSectionCategory.bulkCreate(cats.map((c) => ({ sectionId: ns.id, categoryId: c.categoryId, displayOrder: c.displayOrder })), { transaction: t });
        if (items.length) await MenuSectionItem.bulkCreate(items.map((i) => ({ sectionId: ns.id, itemId: i.itemId, displayOrder: i.displayOrder })), { transaction: t });
      }
      return copy.id;
    });
    return this.get(newId);
  },
  async reorder(ids: number[]) {
    const found = await MenuPage.count({ where: { id: { [Op.in]: ids } } });
    if (found !== new Set(ids).size) throw HttpError.badRequest('Unknown page in the ordering');
    await sequelize.transaction(async (t) => {
      for (const [i, id] of ids.entries()) await MenuPage.update({ displayOrder: i + 1 }, { where: { id }, transaction: t });
    });
  },
};

export const pagesRouter = Router();
pagesRouter.use(requireAuth);
pagesRouter.get('/', asyncHandler(async (req, res) => {
  const q = parseQuery(req, z.object({ withSections: queryBool.optional() }));
  res.json({ success: true, data: await pagesService.list(q.withSections ?? false) });
}));
pagesRouter.post('/', validateBody(pageInputSchema), asyncHandler(async (req, res) => void res.status(201).json({ success: true, data: await pagesService.create(req.body) })));
pagesRouter.patch('/reorder', validateBody(reorderSchema), asyncHandler(async (req, res) => {
  await pagesService.reorder(req.body.ids);
  res.json({ success: true, data: { reordered: true } });
}));
pagesRouter.get('/:id', asyncHandler(async (req, res) => void res.json({ success: true, data: await pagesService.get(idParam(req)) })));
pagesRouter.put('/:id', validateBody(pageInputSchema), asyncHandler(async (req, res) => void res.json({ success: true, data: await pagesService.update(idParam(req), req.body) })));
pagesRouter.post('/:id/duplicate', asyncHandler(async (req, res) => void res.status(201).json({ success: true, data: await pagesService.duplicate(idParam(req)) })));
pagesRouter.delete('/:id', asyncHandler(async (req, res) => {
  await pagesService.remove(idParam(req));
  res.json({ success: true, data: { deleted: true } });
}));
