import { Router } from 'express';
import { Op } from 'sequelize';
import { comboInputSchema, type ComboDTO, type ComboInput } from '@gc/shared-types';
import { MediaAsset, MenuCombo, MenuComboItem, MenuItem, MenuItemVariant } from '../../models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { HttpError } from '../../utils/httpError.js';
import { idParam } from '../../utils/query.js';
import { nextOrder } from '../../utils/refs.js';
import { assertExist } from '../media/media.service.js';
import { toMediaOrNull } from '../media/media.mapper.js';

const include = [
  { model: MediaAsset, as: 'image' },
  {
    model: MenuComboItem,
    as: 'comboItems',
    include: [
      { model: MenuItem, as: 'item', attributes: ['id', 'name'], paranoid: false },
      { model: MenuItemVariant, as: 'variant', attributes: ['id', 'label', 'price', 'itemId'] },
    ],
  },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

function toDTO(c: MenuCombo): ComboDTO {
  const items = [...(c.comboItems ?? [])]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((ci) => {
      const unit = ci.variant?.price ?? null;
      return {
        id: ci.id,
        itemId: ci.itemId,
        itemName: ci.item?.name ?? 'Deleted item',
        variantId: ci.variantId,
        variantLabel: ci.variant?.label ?? '',
        quantity: ci.quantity,
        unitPrice: unit,
        lineTotal: unit == null ? null : round2(unit * ci.quantity),
      };
    });
  const complete = items.every((i) => i.lineTotal !== null);
  const regularTotal = complete ? round2(items.reduce((s, i) => s + (i.lineTotal ?? 0), 0)) : null;
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    image: toMediaOrNull(c.image),
    sellingPrice: c.sellingPrice,
    regularTotal,
    savings: regularTotal === null ? null : round2(regularTotal - c.sellingPrice),
    isActive: c.isActive,
    displayOrder: c.displayOrder,
    items,
  };
}

async function load(id: number) {
  const c = await MenuCombo.findByPk(id, { include });
  if (!c) throw HttpError.notFound('Combo not found');
  return c;
}

/** Every chosen variant must exist and belong to the chosen item. */
async function validateItems(items: ComboInput['items']) {
  const variants = await MenuItemVariant.findAll({ where: { id: { [Op.in]: items.map((i) => i.variantId) } }, attributes: ['id', 'itemId'] });
  const byId = new Map(variants.map((v) => [v.id, v.itemId]));
  for (const i of items) {
    if (byId.get(i.variantId) !== i.itemId) throw HttpError.badRequest('A selected size does not belong to its menu item');
  }
  const found = await MenuItem.count({ where: { id: { [Op.in]: items.map((i) => i.itemId) } } });
  if (found !== new Set(items.map((i) => i.itemId)).size) throw HttpError.badRequest('A selected menu item no longer exists');
}

async function writeItems(comboId: number, items: ComboInput['items'], t: import('sequelize').Transaction) {
  await MenuComboItem.destroy({ where: { comboId }, transaction: t });
  await MenuComboItem.bulkCreate(items.map((i, n) => ({ comboId, itemId: i.itemId, variantId: i.variantId, quantity: i.quantity, displayOrder: n + 1 })), { transaction: t });
}

export const combosService = {
  async list() {
    const rows = await MenuCombo.findAll({ include, order: [['displayOrder', 'ASC'], ['id', 'ASC']] });
    return rows.map(toDTO);
  },
  async create(input: ComboInput) {
    await assertExist([input.imageMediaId]);
    await validateItems(input.items);
    const id = await sequelize.transaction(async (t) => {
      const c = await MenuCombo.create(
        { name: input.name, description: input.description, imageMediaId: input.imageMediaId, sellingPrice: input.sellingPrice, isActive: input.isActive, displayOrder: await nextOrder(MenuCombo, {}, t) },
        { transaction: t },
      );
      await writeItems(c.id, input.items, t);
      return c.id;
    });
    return toDTO(await load(id));
  },
  async update(id: number, input: ComboInput) {
    const c = await load(id);
    await assertExist([input.imageMediaId]);
    await validateItems(input.items);
    await sequelize.transaction(async (t) => {
      await c.update({ name: input.name, description: input.description, imageMediaId: input.imageMediaId, sellingPrice: input.sellingPrice, isActive: input.isActive }, { transaction: t });
      await writeItems(id, input.items, t);
    });
    return toDTO(await load(id));
  },
  async remove(id: number) {
    await (await load(id)).destroy();
  },
};

export const combosRouter = Router();
combosRouter.use(requireAuth);
combosRouter.get('/', asyncHandler(async (_req, res) => void res.json({ success: true, data: await combosService.list() })));
combosRouter.post('/', validateBody(comboInputSchema), asyncHandler(async (req, res) => void res.status(201).json({ success: true, data: await combosService.create(req.body) })));
combosRouter.put('/:id', validateBody(comboInputSchema), asyncHandler(async (req, res) => void res.json({ success: true, data: await combosService.update(idParam(req), req.body) })));
combosRouter.delete('/:id', asyncHandler(async (req, res) => {
  await combosService.remove(idParam(req));
  res.json({ success: true, data: { deleted: true } });
}));
