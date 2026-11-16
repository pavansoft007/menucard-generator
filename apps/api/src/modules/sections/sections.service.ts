import { Op, type Transaction } from 'sequelize';
import type { SectionDTO, SectionInput } from '@gc/shared-types';
import {
  MediaAsset,
  MenuBackground,
  MenuCategory,
  MenuCombo,
  MenuSectionCombo,
  MenuItem,
  MenuPage,
  MenuSection,
  MenuSectionCategory,
  MenuSectionItem,
} from '../../models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { HttpError } from '../../utils/httpError.js';
import { assertIdsExist, nextOrder } from '../../utils/refs.js';
import { assertExist } from '../media/media.service.js';
import { toMediaOrNull } from '../media/media.mapper.js';

const include = [{ model: MediaAsset, as: 'image' }];

/** Builds DTOs for many sections with two extra queries (category + item links), no N+1. */
export async function toSectionDTOs(sections: MenuSection[]): Promise<SectionDTO[]> {
  if (!sections.length) return [];
  const ids = sections.map((s) => s.id);
  const [cats, items, combos] = await Promise.all([
    MenuSectionCategory.findAll({ where: { sectionId: { [Op.in]: ids } }, order: [['displayOrder', 'ASC']] }),
    MenuSectionItem.findAll({ where: { sectionId: { [Op.in]: ids } }, order: [['displayOrder', 'ASC']] }),
    MenuSectionCombo.findAll({ where: { sectionId: { [Op.in]: ids } }, order: [['displayOrder', 'ASC']] }),
  ]);
  // Links to categories / items that were soft-deleted are hidden rather than shown as dangling ids.
  const liveCats = new Set((await MenuCategory.findAll({ attributes: ['id'], where: { id: { [Op.in]: [...new Set(cats.map((c) => c.categoryId))] } } })).map((c) => c.id));
  const liveItems = new Set((await MenuItem.findAll({ attributes: ['id'], where: { id: { [Op.in]: [...new Set(items.map((i) => i.itemId))] } } })).map((i) => i.id));
  return sections.map((s) => ({
    id: s.id,
    pageId: s.pageId,
    title: s.title,
    subtitle: s.subtitle,
    description: s.description,
    displayOrder: s.displayOrder,
    image: toMediaOrNull(s.image),
    backgroundId: s.backgroundId,
    categoryIds: cats.filter((c) => c.sectionId === s.id && liveCats.has(c.categoryId)).map((c) => c.categoryId),
    itemIds: items.filter((i) => i.sectionId === s.id && liveItems.has(i.itemId)).map((i) => i.itemId),
    comboIds: combos.filter((c) => c.sectionId === s.id).map((c) => c.comboId),
    config: s.config,
  }));
}

async function load(id: number) {
  const s = await MenuSection.findByPk(id, { include });
  if (!s) throw HttpError.notFound('Section not found');
  return s;
}
const one = async (id: number) => (await toSectionDTOs([await load(id)]))[0]!;

async function validateRefs(input: SectionInput) {
  if (input.pageId !== null && !(await MenuPage.count({ where: { id: input.pageId } }))) throw HttpError.badRequest('The selected page does not exist');
  await assertExist([input.imageMediaId]);
  await assertIdsExist(MenuBackground, [input.backgroundId], 'background');
  await assertIdsExist(MenuCategory, input.categoryIds, 'category');
  await assertIdsExist(MenuItem, input.itemIds, 'menu item');
  await assertIdsExist(MenuCombo, input.comboIds, 'combo');
}

async function writeLinks(sectionId: number, categoryIds: number[], itemIds: number[], comboIds: number[], t: Transaction) {
  await MenuSectionCategory.destroy({ where: { sectionId }, transaction: t });
  await MenuSectionItem.destroy({ where: { sectionId }, transaction: t });
  await MenuSectionCombo.destroy({ where: { sectionId }, transaction: t });
  const cats = [...new Set(categoryIds)];
  const items = [...new Set(itemIds)];
  if (cats.length) await MenuSectionCategory.bulkCreate(cats.map((categoryId, i) => ({ sectionId, categoryId, displayOrder: i + 1 })), { transaction: t });
  if (items.length) await MenuSectionItem.bulkCreate(items.map((itemId, i) => ({ sectionId, itemId, displayOrder: i + 1 })), { transaction: t });
  const combos = [...new Set(comboIds)];
  if (combos.length) await MenuSectionCombo.bulkCreate(combos.map((comboId, i) => ({ sectionId, comboId, displayOrder: i + 1 })), { transaction: t });
}

const scalar = (i: SectionInput) => ({
  pageId: i.pageId,
  title: i.title,
  subtitle: i.subtitle,
  description: i.description,
  imageMediaId: i.imageMediaId,
  backgroundId: i.backgroundId,
  config: i.config,
});

export const sectionsService = {
  async list(pageId?: number | 'none') {
    const where = pageId === undefined ? {} : { pageId: pageId === 'none' ? null : pageId };
    const rows = await MenuSection.findAll({ where, include, order: [['pageId', 'ASC'], ['displayOrder', 'ASC'], ['id', 'ASC']] });
    return toSectionDTOs(rows);
  },
  get: one,
  async create(input: SectionInput) {
    await validateRefs(input);
    const id = await sequelize.transaction(async (t) => {
      const s = await MenuSection.create({ ...scalar(input), displayOrder: await nextOrder(MenuSection, { pageId: input.pageId }, t) }, { transaction: t });
      await writeLinks(s.id, input.categoryIds, input.itemIds, input.comboIds, t);
      return s.id;
    });
    return one(id);
  },
  async update(id: number, input: SectionInput) {
    const s = await load(id);
    await validateRefs(input);
    await sequelize.transaction(async (t) => {
      const moved = s.pageId !== input.pageId; // moving to another page appends it at the end there
      await s.update({ ...scalar(input), displayOrder: moved ? await nextOrder(MenuSection, { pageId: input.pageId }, t) : s.displayOrder }, { transaction: t });
      await writeLinks(id, input.categoryIds, input.itemIds, input.comboIds, t);
    });
    return one(id);
  },
  async remove(id: number) {
    await (await load(id)).destroy();
  },
  async duplicate(id: number) {
    const src = (await one(id));
    const copy = await this.create({
      pageId: src.pageId,
      title: `${src.title} (copy)`.slice(0, 120),
      subtitle: src.subtitle,
      description: src.description,
      imageMediaId: src.image?.id ?? null,
      backgroundId: src.backgroundId,
      categoryIds: src.categoryIds,
      itemIds: src.itemIds,
      comboIds: src.comboIds,
      config: src.config,
    });
    return copy;
  },
  /** Orders the sections of ONE page (or the parked ones when pageId is null). */
  async reorder(pageId: number | null, ids: number[]) {
    const rows = await MenuSection.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'pageId'] });
    if (rows.length !== new Set(ids).size) throw HttpError.badRequest('Unknown section in the ordering');
    if (rows.some((r) => r.pageId !== pageId)) throw HttpError.badRequest('All sections must belong to the same page');
    await sequelize.transaction(async (t) => {
      for (const [i, sid] of ids.entries()) await MenuSection.update({ displayOrder: i + 1 }, { where: { id: sid }, transaction: t });
    });
  },
};
