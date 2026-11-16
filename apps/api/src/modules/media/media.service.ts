import crypto from 'node:crypto';
import { Op, type WhereOptions } from 'sequelize';
import type { MediaUpdateInput } from '@gc/shared-types';
import {
  MediaAsset,
  MenuCategory,
  MenuItem,
  MenuItemMedia,
  MenuItemVariant,
  MenuBackground,
  MenuCombo,
  MenuSection,
  RestaurantLogo,
} from '../../models/index.js';
import { storage } from '../../storage/storage.js';
import { HttpError } from '../../utils/httpError.js';
import { processUpload, type ProcessedImage } from './imagePipeline.js';

async function persistFiles(img: ProcessedImage) {
  const name = crypto.randomUUID();
  const paths = {
    originalPath: `originals/${name}.${img.ext}`,
    optimizedPath: `optimized/${name}.${img.optimizedExt}`,
    thumbPath: img.kind === 'svg' ? `originals/${name}.svg` : `thumbs/${name}.webp`,
  };
  await storage.write(paths.originalPath, img.original);
  if (img.kind === 'svg') {
    // Optimized + thumb are the same vector file.
    paths.optimizedPath = paths.originalPath;
  } else {
    await storage.write(paths.optimizedPath, img.optimized);
    await storage.write(paths.thumbPath, img.thumb);
  }
  return paths;
}

const removeFiles = async (m: Pick<MediaAsset, 'originalPath' | 'optimizedPath' | 'thumbPath'>) => {
  for (const p of new Set([m.originalPath, m.optimizedPath, m.thumbPath])) await storage.remove(p);
};

export async function createFromUpload(file: Express.Multer.File, category: string | null) {
  const img = await processUpload(file.buffer);
  const paths = await persistFiles(img);
  return MediaAsset.create({
    originalName: file.originalname.normalize('NFC').slice(0, 255),
    mime: img.mime,
    kind: img.kind,
    size: file.size,
    width: img.width,
    height: img.height,
    hasAlpha: img.hasAlpha,
    sha256: img.sha256,
    category,
    altText: null,
    ...paths,
  });
}

/** Replaces the file behind an existing media id so every reference keeps working. */
export async function replaceFile(id: number, file: Express.Multer.File) {
  const media = await getOrThrow(id);
  const old = media.get({ plain: true }) as MediaAsset;
  const img = await processUpload(file.buffer);
  const paths = await persistFiles(img);
  await media.update({
    originalName: file.originalname.normalize('NFC').slice(0, 255),
    mime: img.mime,
    kind: img.kind,
    size: file.size,
    width: img.width,
    height: img.height,
    hasAlpha: img.hasAlpha,
    sha256: img.sha256,
    ...paths,
  });
  await removeFiles(old);
  return media;
}

export async function getOrThrow(id: number) {
  const media = await MediaAsset.findByPk(id);
  if (!media) throw HttpError.notFound('Image not found');
  return media;
}

export interface MediaUsage {
  categories: number;
  items: number;
  variants: number;
  logos: number;
  backgrounds: number;
  combos: number;
  sections: number;
  total: number;
}

export async function usageFor(id: number): Promise<MediaUsage> {
  const [c1, c2, c3, c4, mainItems, gallery, variants, logos, backgrounds, combos, sections] = await Promise.all([
    MenuCategory.count({ where: { imageMediaId: id } }),
    MenuCategory.count({ where: { iconMediaId: id } }),
    MenuCategory.count({ where: { bannerMediaId: id } }),
    MenuCategory.count({ where: { backgroundMediaId: id } }),
    MenuItem.count({ where: { mainMediaId: id } }),
    MenuItemMedia.count({ where: { mediaId: id } }),
    MenuItemVariant.count({ where: { mediaId: id } }),
    RestaurantLogo.count({ where: { mediaId: id } }),
    MenuBackground.count({ where: { mediaId: id } }),
    MenuCombo.count({ where: { imageMediaId: id } }),
    MenuSection.count({ where: { imageMediaId: id } }),
  ]);
  const categories = c1 + c2 + c3 + c4;
  const items = mainItems + gallery;
  return { categories, items, variants, logos, backgrounds, combos, sections, total: categories + items + variants + logos + backgrounds + combos + sections };
}

/** Usage counts for many media ids with a handful of grouped queries (no N+1). */
async function usageCounts(ids: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>(ids.map((i) => [i, 0]));
  if (!ids.length) return counts;
  const bump = (rows: { mediaId: number | null; n: number }[]) =>
    rows.forEach((r) => r.mediaId != null && counts.set(r.mediaId, (counts.get(r.mediaId) ?? 0) + Number(r.n)));
  type Grouped = typeof MenuCategory | typeof MenuItem | typeof MenuItemMedia | typeof MenuItemVariant | typeof RestaurantLogo | typeof MenuBackground | typeof MenuCombo | typeof MenuSection;
  const grouped = async (model: Grouped, attr: string) => {
    const m = model as typeof MenuItem;
    const field = (m.getAttributes() as Record<string, { field?: string }>)[attr]?.field ?? attr; // attribute -> real (snake_case) column
    bump(
      (await m.findAll({
        attributes: [[field, 'mediaId'], [m.sequelize!.fn('COUNT', '*'), 'n']],
        where: { [attr]: { [Op.in]: ids } },
        group: [field],
        raw: true,
      })) as unknown as { mediaId: number; n: number }[],
    );
  };
  await Promise.all([
    grouped(MenuCategory, 'imageMediaId'),
    grouped(MenuCategory, 'iconMediaId'),
    grouped(MenuCategory, 'bannerMediaId'),
    grouped(MenuCategory, 'backgroundMediaId'),
    grouped(MenuItem, 'mainMediaId'),
    grouped(MenuItemMedia, 'mediaId'),
    grouped(MenuItemVariant, 'mediaId'),
    grouped(RestaurantLogo, 'mediaId'),
    grouped(MenuBackground, 'mediaId'),
    grouped(MenuCombo, 'imageMediaId'),
    grouped(MenuSection, 'imageMediaId'),
  ]);
  return counts;
}

export async function list(q: { page: number; pageSize: number; search?: string; category?: string; kind?: string }) {
  const where: WhereOptions<MediaAsset> = {};
  const and: WhereOptions<MediaAsset>[] = [];
  if (q.search) and.push({ [Op.or]: [{ originalName: { [Op.like]: `%${q.search}%` } }, { altText: { [Op.like]: `%${q.search}%` } }] });
  if (q.category) and.push({ category: q.category });
  if (q.kind === 'image' || q.kind === 'svg') and.push({ kind: q.kind });
  if (and.length) Object.assign(where, { [Op.and]: and });

  const { rows, count } = await MediaAsset.findAndCountAll({
    where,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: q.pageSize,
    offset: (q.page - 1) * q.pageSize,
  });
  const usage = await usageCounts(rows.map((r) => r.id));
  return { rows, count, usage };
}

export async function byIds(ids: number[]) {
  return MediaAsset.findAll({ where: { id: { [Op.in]: [...new Set(ids)] } } });
}

export async function categories() {
  const rows = await MediaAsset.findAll({ attributes: ['category'], where: { category: { [Op.ne]: null } }, group: ['category'], raw: true });
  return rows.map((r) => r.category as string).sort();
}

export async function update(id: number, data: MediaUpdateInput) {
  const media = await getOrThrow(id);
  return media.update(data);
}

export async function remove(id: number) {
  const media = await getOrThrow(id);
  const usage = await usageFor(id);
  if (usage.total > 0) {
    const parts = [
      usage.categories && `${usage.categories} categor${usage.categories > 1 ? 'ies' : 'y'}`,
      usage.items && `${usage.items} item image slot${usage.items > 1 ? 's' : ''}`,
      usage.variants && `${usage.variants} price option${usage.variants > 1 ? 's' : ''}`,
      usage.logos && `${usage.logos} logo${usage.logos > 1 ? 's' : ''}`,
      usage.backgrounds && `${usage.backgrounds} background${usage.backgrounds > 1 ? 's' : ''}`,
      usage.combos && `${usage.combos} combo${usage.combos > 1 ? 's' : ''}`,
      usage.sections && `${usage.sections} section${usage.sections > 1 ? 's' : ''}`,
    ].filter(Boolean);
    throw HttpError.conflict(`This image is in use by ${parts.join(', ')}. Replace or detach it first.`);
  }
  await media.destroy();
  await removeFiles(media);
}

/** Throws 400 if any id does not exist. */
export async function assertExist(ids: (number | null | undefined)[]) {
  const unique = [...new Set(ids.filter((i): i is number => typeof i === 'number'))];
  if (!unique.length) return;
  const found = await MediaAsset.count({ where: { id: { [Op.in]: unique } } });
  if (found !== unique.length) throw HttpError.badRequest('One or more selected images no longer exist');
}
