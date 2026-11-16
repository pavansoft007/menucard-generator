import { Router } from 'express';
import type { DashboardStats } from '@gc/shared-types';
import { MediaAsset, MenuCategory, MenuExport, MenuItem, MenuPage, MenuVersion } from '../../models/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [totalCategories, totalItems, activeItems, totalImages, totalPages, lastPublished, lastExport] = await Promise.all([

      MenuCategory.count(),
      MenuItem.count(),
      MenuItem.count({ where: { isActive: true } }),
      MediaAsset.count(),
      MenuPage.count(),
      MenuVersion.findOne({ where: { status: 'published' }, order: [['createdAt', 'DESC']], attributes: ['createdAt'] }),
      MenuExport.findOne({ order: [['createdAt', 'DESC']], attributes: ['createdAt'] }),
    ]);
    const data: DashboardStats = {
      totalCategories,
      totalItems,
      activeItems,
      inactiveItems: totalItems - activeItems,
      totalImages,
      totalPages,
      lastGeneratedMenu: lastExport ? lastExport.createdAt.toISOString() : null,
      lastPublishedAt: lastPublished ? lastPublished.createdAt.toISOString() : null,
    };
    res.json({ success: true, data });
  }),
);
