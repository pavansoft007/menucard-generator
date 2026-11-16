import { Op, type Transaction, type WhereOptions } from 'sequelize';
import type { ItemDTO, ItemInput, VariantInput } from '@gc/shared-types';
import { MediaAsset, MenuCategory, MenuItem, MenuItemMedia, MenuItemVariant } from '../../models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { HttpError } from '../../utils/httpError.js';
import { assertExist } from '../media/media.service.js';
import { toMediaDTO, toMediaOrNull } from '../media/media.mapper.js';

const include = [
  { model: MenuCategory, as: 'category', attributes: ['id', 'name'] },
  { model: MediaAsset, as: 'mainMedia' },
  { model: MediaAsset, as: 'gallery', through: { attributes: ['displayOrder'] } },
  { model: MenuItemVariant, as: 'variants', include: [{ model: MediaAsset, as: 'media' }] },
];

function toDTO(i: MenuItem): ItemDTO {
  return {
    id: i.id,
    categoryId: i.categoryId,
    category: i.category ? { id: i.category.id, name: i.category.name } : null,
    name: i.name,
    shortDescription: i.shortDescription,
    description: i.description,
    dietType: i.dietType,
    isBestseller: i.isBestseller,
    isSpicy: i.isSpicy,
    isNew: i.isNew,
    isFeatured: i.isFeatured,
    isAvailable: i.isAvailable,
    isActive: i.isActive,
    displayOrder: i.displayOrder,
    mainMedia: toMediaOrNull(i.mainMedia),
    gallery: [...(i.gallery ?? [])]
      .sort((a, b) => (a.MenuItemMedia?.displayOrder ?? 0) - (b.MenuItemMedia?.displayOrder ?? 0))
      .map((m) => toMediaDTO(m)),
    variants: [...(i.variants ?? [])]
      .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
      .map((v) => ({
        id: v.id,
        label: v.label,
        quantity: v.quantity,
        unit: v.unit,
        price: v.price,
        discountPrice: v.discountPrice,
        displayOrder: v.displayOrder,
        isActive: v.isActive,
        media: toMediaOrNull(v.media),
      })),
  };
}

export async function load(id: number) {
  const item = await MenuItem.findByPk(id, { include });
  if (!item) throw HttpError.notFound('Menu item not found');
  return item;
}

export const get = async (id: number) => toDTO(await load(id));

export interface ItemQuery {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: number;
  isActive?: boolean;
  dietType?: 'veg' | 'non_veg';
}

export async function list(q: ItemQuery) {
  const and: WhereOptions<MenuItem>[] = [];
  if (q.search) and.push({ [Op.or]: [{ name: { [Op.like]: `%${q.search}%` } }, { shortDescription: { [Op.like]: `%${q.search}%` } }] });
  if (q.categoryId) and.push({ categoryId: q.categoryId });
  if (q.isActive !== undefined) and.push({ isActive: q.isActive });
  if (q.dietType) and.push({ dietType: q.dietType });

  // Page over item ids first (hasMany joins would otherwise break LIMIT), then hydrate.
  const { rows: idRows, count } = await MenuItem.findAndCountAll({
    attributes: ['id'],
    where: and.length ? { [Op.and]: and } : {},
    include: [{ model: MenuCategory, as: 'category', attributes: [], required: true }],
    order: [[{ model: MenuCategory, as: 'category' }, 'displayOrder', 'ASC'], ['displayOrder', 'ASC'], ['id', 'ASC']],
    limit: q.pageSize,
    offset: (q.page - 1) * q.pageSize,
    subQuery: false,
  });
  const ids = idRows.map((r) => r.id);
  const items = ids.length ? await MenuItem.findAll({ where: { id: { [Op.in]: ids } }, include }) : [];
  const byId = new Map(items.map((i) => [i.id, i]));
  return { items: ids.map((id) => toDTO(byId.get(id)!)), total: count };
}

async function validateRefs(input: ItemInput) {
  if (!(await MenuCategory.count({ where: { id: input.categoryId } }))) throw HttpError.badRequest('The selected category does not exist');
  await assertExist([input.mainMediaId, ...input.galleryMediaIds, ...input.variants.map((v) => v.mediaId)]);
}

async function writeVariants(itemId: number, variants: VariantInput[], t: Transaction) {
  const existing = await MenuItemVariant.findAll({ where: { itemId }, transaction: t });
  const existingIds = new Set(existing.map((v) => v.id));
  const keep = new Set<number>();
  for (const [index, v] of variants.entries()) {
    const values = {
      label: v.label,
      quantity: v.quantity,
      unit: v.unit,
      price: v.price,
      discountPrice: v.discountPrice,
      mediaId: v.mediaId,
      isActive: v.isActive,
      displayOrder: index + 1,
    };
    if (v.id !== undefined) {
      if (!existingIds.has(v.id)) throw HttpError.badRequest('A price option does not belong to this item');
      await MenuItemVariant.update(values, { where: { id: v.id }, transaction: t });
      keep.add(v.id);
    } else {
      keep.add((await MenuItemVariant.create({ ...values, itemId }, { transaction: t })).id);
    }
  }
  const drop = existing.filter((v) => !keep.has(v.id)).map((v) => v.id);
  if (drop.length) await MenuItemVariant.destroy({ where: { id: { [Op.in]: drop } }, transaction: t });
}

async function writeGallery(itemId: number, mediaIds: number[], t: Transaction) {
  await MenuItemMedia.destroy({ where: { itemId }, transaction: t });
  const unique = [...new Set(mediaIds)];
  if (unique.length) {
    await MenuItemMedia.bulkCreate(unique.map((mediaId, i) => ({ itemId, mediaId, displayOrder: i + 1 })), { transaction: t });
  }
}

const scalar = (i: ItemInput) => ({
  categoryId: i.categoryId,
  name: i.name,
  shortDescription: i.shortDescription,
  description: i.description,
  mainMediaId: i.mainMediaId,
  dietType: i.dietType,
  isBestseller: i.isBestseller,
  isSpicy: i.isSpicy,
  isNew: i.isNew,
  isFeatured: i.isFeatured,
  isAvailable: i.isAvailable,
  isActive: i.isActive,
});

export async function create(input: ItemInput) {
  await validateRefs(input);
  const id = await sequelize.transaction(async (t) => {
    const max = ((await MenuItem.max('displayOrder', { where: { categoryId: input.categoryId }, transaction: t })) as number | null) ?? 0;
    const item = await MenuItem.create({ ...scalar(input), displayOrder: max + 1 }, { transaction: t });
    await writeVariants(item.id, input.variants, t);
    await writeGallery(item.id, input.galleryMediaIds, t);
    return item.id;
  });
  return get(id);
}

export async function update(id: number, input: ItemInput) {
  const item = await load(id);
  await validateRefs(input);
  await sequelize.transaction(async (t) => {
    const moved = item.categoryId !== input.categoryId;
    const order = moved
      ? (((await MenuItem.max('displayOrder', { where: { categoryId: input.categoryId }, transaction: t })) as number | null) ?? 0) + 1
      : item.displayOrder;
    await item.update({ ...scalar(input), displayOrder: order }, { transaction: t });
    await writeVariants(id, input.variants, t);
    await writeGallery(id, input.galleryMediaIds, t);
  });
  return get(id);
}

export async function remove(id: number) {
  const item = await load(id);
  await item.destroy(); // soft delete – variants/gallery rows stay for restore / version history
}

/** Reorders items within one category. */
export async function reorder(ids: number[]) {
  const items = await MenuItem.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'categoryId'] });
  if (items.length !== new Set(ids).size) throw HttpError.badRequest('Unknown item in the ordering');
  if (new Set(items.map((i) => i.categoryId)).size > 1) throw HttpError.badRequest('Items can only be reordered within one category');
  await sequelize.transaction(async (t) => {
    for (const [i, id] of ids.entries()) await MenuItem.update({ displayOrder: i + 1 }, { where: { id }, transaction: t });
  });
}
