import { Router } from 'express';
import { Op } from 'sequelize';
import { versionInputSchema, type VersionDTO, type VersionInput, type PageLayout, type PageSettings, type SectionConfig } from '@gc/shared-types';
import {
  MediaAsset,
  MenuBackground,
  MenuCategory,
  MenuCombo,
  MenuItem,
  MenuPage,
  MenuSection,
  MenuSectionCategory,
  MenuSectionCombo,
  MenuSectionItem,
  MenuTheme,
  MenuVersion,
  RestaurantLogo,
  User,
} from '../../models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { HttpError } from '../../utils/httpError.js';
import { idParam } from '../../utils/query.js';
import { toSectionDTOs } from '../sections/sections.service.js';

/**
 * A version freezes the *design*: pages, their settings/layout JSON and which categories/items each section shows.
 * Menu content (item names, prices, images) is intentionally live, so restoring an old version never reverts prices.
 */
interface SnapshotSection {
  title: string; subtitle: string | null; description: string | null; imageMediaId: number | null; backgroundId: number | null;
  displayOrder: number; config: SectionConfig; categoryIds: number[]; itemIds: number[]; comboIds?: number[];
}
interface SnapshotPage {
  title: string; subtitle: string | null; pageType: 'cover' | 'content' | 'back'; themeId: number | null; isActive: boolean;
  displayOrder: number; settings: PageSettings; layout: PageLayout; sections: SnapshotSection[];
}
interface Snapshot { v: 1; pages: SnapshotPage[] }

async function buildSnapshot(): Promise<Snapshot> {
  const pages = await MenuPage.findAll({ order: [['displayOrder', 'ASC'], ['id', 'ASC']] });
  const sections = await toSectionDTOs(await MenuSection.findAll({ where: { pageId: { [Op.in]: pages.map((p) => p.id) } }, include: [{ association: 'image' }], order: [['displayOrder', 'ASC'], ['id', 'ASC']] }));
  return {
    v: 1,
    pages: pages.map((p) => ({
      title: p.title, subtitle: p.subtitle, pageType: p.pageType, themeId: p.themeId, isActive: p.isActive,
      displayOrder: p.displayOrder, settings: p.settings, layout: p.layout,
      sections: sections.filter((s) => s.pageId === p.id).map((s) => ({
        title: s.title, subtitle: s.subtitle, description: s.description, imageMediaId: s.image?.id ?? null, backgroundId: s.backgroundId,
        displayOrder: s.displayOrder, config: s.config, categoryIds: s.categoryIds, itemIds: s.itemIds, comboIds: s.comboIds,
      })),
    })),
  };
}

const toDTO = (v: MenuVersion, creator?: string | null): VersionDTO => ({
  id: v.id, label: v.label, status: v.status, pageCount: v.pageCount, sectionCount: v.sectionCount,
  createdBy: creator ?? null, createdAt: v.createdAt.toISOString(),
});

async function snapshotNow(input: VersionInput, userId: number | null) {
  const snap = await buildSnapshot();
  return MenuVersion.create({
    label: input.label, status: input.status, snapshot: JSON.stringify(snap),
    pageCount: snap.pages.length, sectionCount: snap.pages.reduce((n, p) => n + p.sections.length, 0), createdBy: userId,
  });
}

const existing = async (model: typeof MenuCombo | typeof MediaAsset | typeof MenuBackground | typeof MenuTheme | typeof RestaurantLogo | typeof MenuCategory | typeof MenuItem, ids: (number | null)[]) => {
  const wanted = [...new Set(ids.filter((i): i is number => i !== null))];
  if (!wanted.length) return new Set<number>();
  return new Set((await (model as typeof MenuItem).findAll({ attributes: ['id'], where: { id: { [Op.in]: wanted } } })).map((r) => r.id));
};

export const versionsService = {
  async list() {
    const rows = await MenuVersion.findAll({ attributes: { exclude: ['snapshot'] }, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: 100 });
    const users = await User.findAll({ attributes: ['id', 'name'], where: { id: { [Op.in]: rows.map((r) => r.createdBy).filter((x): x is number => x !== null) } } });
    const names = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => toDTO(r, r.createdBy ? names.get(r.createdBy) : null));
  },
  async create(input: VersionInput, userId: number | null) {
    const v = await snapshotNow(input, userId);
    return toDTO(v);
  },
  async restore(id: number, userId: number | null) {
    const version = await MenuVersion.findByPk(id);
    if (!version) throw HttpError.notFound('Version not found');
    let snap: Snapshot;
    try {
      snap = JSON.parse(version.snapshot) as Snapshot;
      if (snap.v !== 1 || !Array.isArray(snap.pages)) throw new Error('bad');
    } catch {
      throw HttpError.badRequest('This version could not be read');
    }

    // Safety net: keep the current design so the restore itself can be undone.
    const backup = await snapshotNow({ label: `Before restoring #${id}`, status: 'draft' }, userId);

    const all = snap.pages.flatMap((p) => p.sections);
    const [themes, bgs, logos, media, cats, items, combosOk] = await Promise.all([

      existing(MenuTheme, snap.pages.map((p) => p.themeId)),
      existing(MenuBackground, [...snap.pages.map((p) => p.settings.backgroundId), ...all.map((s) => s.backgroundId)]),
      existing(RestaurantLogo, snap.pages.map((p) => p.settings.logo.logoId)),
      existing(MediaAsset, all.map((s) => s.imageMediaId)),
      existing(MenuCategory, all.flatMap((s) => s.categoryIds)),
      existing(MenuItem, all.flatMap((s) => s.itemIds)),
      existing(MenuCombo, all.flatMap((s) => s.comboIds ?? [])),
    ]);
    let dropped = 0;
    const keep = (set: Set<number>, v: number | null) => (v !== null && set.has(v) ? v : (v !== null && dropped++, null));

    await sequelize.transaction(async (t) => {
      await MenuPage.destroy({ where: {}, transaction: t }); // sections cascade
      for (const p of snap.pages) {
        const page = await MenuPage.create(
          {
            title: p.title, subtitle: p.subtitle, pageType: p.pageType, themeId: keep(themes, p.themeId), isActive: p.isActive, displayOrder: p.displayOrder,
            settings: { ...p.settings, backgroundId: keep(bgs, p.settings.backgroundId), logo: { ...p.settings.logo, logoId: keep(logos, p.settings.logo.logoId) } },
            layout: p.layout,
          },
          { transaction: t },
        );
        for (const s of p.sections) {
          const sec = await MenuSection.create(
            { pageId: page.id, title: s.title, subtitle: s.subtitle, description: s.description, imageMediaId: keep(media, s.imageMediaId), backgroundId: keep(bgs, s.backgroundId), displayOrder: s.displayOrder, config: s.config },
            { transaction: t },
          );
          const cIds = s.categoryIds.filter((c) => cats.has(c));
          const iIds = s.itemIds.filter((i) => items.has(i));
          dropped += s.categoryIds.length - cIds.length + (s.itemIds.length - iIds.length);
          if (cIds.length) await MenuSectionCategory.bulkCreate(cIds.map((categoryId, n) => ({ sectionId: sec.id, categoryId, displayOrder: n + 1 })), { transaction: t });
          if (iIds.length) await MenuSectionItem.bulkCreate(iIds.map((itemId, n) => ({ sectionId: sec.id, itemId, displayOrder: n + 1 })), { transaction: t });
          const coIds = (s.comboIds ?? []).filter((c) => combosOk.has(c));
          if (coIds.length) await MenuSectionCombo.bulkCreate(coIds.map((comboId, n) => ({ sectionId: sec.id, comboId, displayOrder: n + 1 })), { transaction: t });
        }
      }
    });
    return { restoredFrom: id, backupVersionId: backup.id, pages: snap.pages.length, droppedReferences: dropped };
  },
};

export const versionsRouter = Router();
versionsRouter.use(requireAuth);
versionsRouter.get('/', asyncHandler(async (_req, res) => void res.json({ success: true, data: await versionsService.list() })));
versionsRouter.post('/', validateBody(versionInputSchema), asyncHandler(async (req, res) => void res.status(201).json({ success: true, data: await versionsService.create(req.body, req.auth!.sub) })));
versionsRouter.post('/:id/restore', asyncHandler(async (req, res) => void res.json({ success: true, data: await versionsService.restore(idParam(req), req.auth!.sub) })));
