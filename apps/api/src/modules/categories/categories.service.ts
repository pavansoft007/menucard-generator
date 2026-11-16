import { Op, fn, col } from 'sequelize';
import type { CategoryDTO, CategoryInput } from '@gc/shared-types';
import { MediaAsset, MenuCategory, MenuItem } from '../../models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { HttpError } from '../../utils/httpError.js';
import { assertExist } from '../media/media.service.js';
import { toMediaOrNull } from '../media/media.mapper.js';

const include = [
  { model: MediaAsset, as: 'image' },
  { model: MediaAsset, as: 'iconMedia' },
  { model: MediaAsset, as: 'banner' },
  { model: MediaAsset, as: 'background' },
];

async function itemCounts(ids: number[]) {
  if (!ids.length) return new Map<number, number>();
  const rows = (await MenuItem.findAll({
    attributes: ['categoryId', [fn('COUNT', col('id')), 'n']],
    where: { categoryId: { [Op.in]: ids } },
    group: ['categoryId'],
    raw: true,
  })) as unknown as { categoryId: number; n: number }[];
  return new Map(rows.map((r) => [r.categoryId, Number(r.n)]));
}

function toDTO(c: MenuCategory, count: number): CategoryDTO {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    icon: c.icon,
    displayOrder: c.displayOrder,
    isActive: c.isActive,
    itemCount: count,
    image: toMediaOrNull(c.image),
    iconMedia: toMediaOrNull(c.iconMedia),
    banner: toMediaOrNull(c.banner),
    background: toMediaOrNull(c.background),
  };
}

export async function list(q: { search?: string; isActive?: boolean }) {
  const where: Record<string | symbol, unknown> = {};
  if (q.search) where.name = { [Op.like]: `%${q.search}%` };
  if (q.isActive !== undefined) where.isActive = q.isActive;
  const rows = await MenuCategory.findAll({ where, include, order: [['displayOrder', 'ASC'], ['id', 'ASC']] });
  const counts = await itemCounts(rows.map((r) => r.id));
  return rows.map((r) => toDTO(r, counts.get(r.id) ?? 0));
}

async function load(id: number) {
  const c = await MenuCategory.findByPk(id, { include });
  if (!c) throw HttpError.notFound('Category not found');
  return c;
}

export async function create(input: CategoryInput) {
  await assertExist([input.imageMediaId, input.iconMediaId, input.bannerMediaId, input.backgroundMediaId]);
  const max = ((await MenuCategory.max('displayOrder')) as number | null) ?? 0;
  const created = await MenuCategory.create({ ...input, displayOrder: max + 1 });
  return toDTO(await load(created.id), 0);
}

export async function update(id: number, input: CategoryInput) {
  const c = await load(id);
  await assertExist([input.imageMediaId, input.iconMediaId, input.bannerMediaId, input.backgroundMediaId]);
  await c.update(input);
  const counts = await itemCounts([id]);
  return toDTO(await load(id), counts.get(id) ?? 0);
}

export async function remove(id: number) {
  const c = await load(id);
  const n = await MenuItem.count({ where: { categoryId: id } });
  if (n > 0) {
    throw HttpError.conflict(`This category still has ${n} menu item${n > 1 ? 's' : ''}. Move or delete them first.`);
  }
  await c.destroy();
}

export async function reorder(ids: number[]) {
  await sequelize.transaction(async (t) => {
    const found = await MenuCategory.count({ where: { id: { [Op.in]: ids } }, transaction: t });
    if (found !== new Set(ids).size) throw HttpError.badRequest('Unknown category in the ordering');
    for (const [i, id] of ids.entries()) {
      await MenuCategory.update({ displayOrder: i + 1 }, { where: { id }, transaction: t });
    }
  });
}
