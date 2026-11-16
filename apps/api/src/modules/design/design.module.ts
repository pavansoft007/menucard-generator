import { Router } from 'express';
import { Op } from 'sequelize';
import { applyDesignSchema, normalizePageSettings, type ApplyDesignInput, type ApplyDesignResult } from '@gc/shared-types';
import { MenuBackground, MenuPage, MenuSection, MenuTheme } from '../../models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireFullAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { HttpError } from '../../utils/httpError.js';
import { versionsService } from '../versions/versions.module.js';

/**
 * Applies a design template to the chosen pages and sections in ONE transaction: it either all happens or nothing does.
 * Menu content (categories, items, prices, images) is never touched. The theme and background are created on first use
 * and updated in place afterwards, so applying the same template twice never piles up duplicates.
 */
async function apply(input: ApplyDesignInput, userId: number): Promise<ApplyDesignResult> {
  const pageIds = [...new Set(input.pages.map((p) => p.id))];
  const sectionIds = [...new Set(input.sections.map((s) => s.id))];
  const pages = await MenuPage.findAll({ where: { id: { [Op.in]: pageIds } } });
  if (pages.length !== pageIds.length) throw HttpError.badRequest('One of the selected pages no longer exists');
  const sections = sectionIds.length ? await MenuSection.findAll({ where: { id: { [Op.in]: sectionIds } } }) : [];
  if (sections.length !== sectionIds.length) throw HttpError.badRequest('One of the selected sections no longer exists');
  if (sections.some((s) => s.pageId === null || !pageIds.includes(s.pageId))) throw HttpError.badRequest('A section does not belong to the selected pages');
  if (input.background.mediaId !== null) throw HttpError.badRequest('Template backgrounds cannot reference an uploaded image');

  // Backup first (outside the transaction on purpose: it must exist even if the apply fails and rolls back).
  const backup = input.backup ? await versionsService.create({ label: `Before applying “${input.theme.name}”`.slice(0, 120), status: 'draft' }, userId) : null;

  return sequelize.transaction(async (t) => {
    let theme = await MenuTheme.findOne({ where: { name: input.theme.name }, transaction: t });
    if (theme) await theme.update({ config: input.theme.config }, { transaction: t });
    else theme = await MenuTheme.create({ name: input.theme.name, config: input.theme.config, isDefault: (await MenuTheme.count({ transaction: t })) === 0 }, { transaction: t });
    if (input.makeDefaultTheme && !theme.isDefault) {
      await MenuTheme.update({ isDefault: false }, { where: { isDefault: true }, transaction: t });
      await theme.update({ isDefault: true }, { transaction: t });
    }

    let bg = await MenuBackground.findOne({ where: { name: input.background.name, kind: input.background.kind }, transaction: t });
    if (bg) await bg.update({ config: input.background.config }, { transaction: t });
    else bg = await MenuBackground.create({ name: input.background.name, kind: input.background.kind, mediaId: null, config: input.background.config }, { transaction: t });

    const byId = new Map(pages.map((p) => [p.id, p]));
    for (const incoming of input.pages) {
      const page = byId.get(incoming.id)!;
      await page.update(
        {
          themeId: theme.id,
          settings: normalizePageSettings({ ...incoming.settings, backgroundId: bg.id }),
          ...(input.resetLayouts ? { layout: { version: 1 as const, elements: [] } } : {}),
        },
        { transaction: t },
      );
    }
    const secById = new Map(sections.map((s) => [s.id, s]));
    for (const incoming of input.sections) await secById.get(incoming.id)!.update({ config: incoming.config }, { transaction: t });

    return { themeId: theme.id, backgroundId: bg.id, pagesUpdated: pageIds.length, sectionsUpdated: sectionIds.length, backupVersionId: backup?.id ?? null };
  });
}

export const designRouter = Router();
designRouter.use(requireFullAuth);
designRouter.post('/apply', validateBody(applyDesignSchema), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await apply(req.body, req.auth!.sub) });
}));
