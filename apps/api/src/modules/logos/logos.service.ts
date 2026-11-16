import type { LogoCreateInput, LogoDTO, LogoUpdateInput } from '@gc/shared-types';
import { MediaAsset, RestaurantLogo } from '../../models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { HttpError } from '../../utils/httpError.js';
import { assertExist } from '../media/media.service.js';
import { toMediaDTO } from '../media/media.mapper.js';

const include = [{ model: MediaAsset, as: 'media', required: true }];

const toDTO = (l: RestaurantLogo): LogoDTO => ({
  id: l.id,
  label: l.label,
  isPrimary: l.isPrimary,
  defaultWidthMm: l.defaultWidthMm,
  defaultPosition: l.defaultPosition,
  media: toMediaDTO(l.media!),
});

const load = async (id: number) => {
  const l = await RestaurantLogo.findByPk(id, { include });
  if (!l) throw HttpError.notFound('Logo not found');
  return l;
};

export async function getPrimaryLogo() {
  const l = await RestaurantLogo.findOne({ where: { isPrimary: true }, include });
  return l ? toDTO(l) : null;
}

export async function list() {
  const rows = await RestaurantLogo.findAll({ include, order: [['isPrimary', 'DESC'], ['id', 'ASC']] });
  return rows.map(toDTO);
}

export async function create(input: LogoCreateInput) {
  await assertExist([input.mediaId]);
  const id = await sequelize.transaction(async (t) => {
    const hasAny = (await RestaurantLogo.count({ transaction: t })) > 0;
    const primary = input.isPrimary || !hasAny; // the first logo is always primary
    if (primary) await RestaurantLogo.update({ isPrimary: false }, { where: { isPrimary: true }, transaction: t });
    return (await RestaurantLogo.create({ ...input, isPrimary: primary }, { transaction: t })).id;
  });
  return toDTO(await load(id));
}

export async function update(id: number, input: LogoUpdateInput) {
  const logo = await load(id);
  await sequelize.transaction(async (t) => {
    if (input.isPrimary === false && logo.isPrimary) {
      throw HttpError.badRequest('Choose another logo as primary instead of unsetting this one');
    }
    if (input.isPrimary) await RestaurantLogo.update({ isPrimary: false }, { where: { isPrimary: true }, transaction: t });
    await logo.update(input, { transaction: t });
  });
  return toDTO(await load(id));
}

export async function remove(id: number) {
  const logo = await load(id);
  if (logo.isPrimary && (await RestaurantLogo.count()) > 1) {
    throw HttpError.conflict('This is the primary logo. Make another logo primary before deleting it.');
  }
  await logo.destroy();
}
