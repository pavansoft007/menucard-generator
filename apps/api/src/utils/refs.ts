import { Op, type ModelStatic, type Model } from 'sequelize';
import { HttpError } from './httpError.js';

/** Throws 400 when any of the ids does not exist (soft-deleted rows count as missing). */
export async function assertIdsExist(model: ModelStatic<Model>, ids: (number | null | undefined)[], label: string) {
  const unique = [...new Set(ids.filter((i): i is number => typeof i === 'number'))];
  if (!unique.length) return;
  const found = await model.count({ where: { id: { [Op.in]: unique } } });
  if (found !== unique.length) throw HttpError.badRequest(`The selected ${label} no longer exists`);
}

/** Next display_order value for a table, optionally scoped. */
export async function nextOrder(model: ModelStatic<Model>, where: Record<string, unknown> = {}, transaction?: import('sequelize').Transaction) {
  const max = (await model.max('displayOrder', { where, transaction })) as number | null;
  return (max ?? 0) + 1;
}
