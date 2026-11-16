import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { DataTypes as T, Model, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import { defaultExportOptions, exportOptionsSchema, type ExportOptions, type SystemStatus } from '@gc/shared-types';
import { env } from '../../config/env.js';
import { sequelize } from '../../db/sequelize.js';
import { MediaAsset, MenuExport } from '../../models/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth, requireFullAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { findChrome } from '../export/browser.js';
import pkg from '../../../package.json' with { type: 'json' };

class AppSetting extends Model<InferAttributes<AppSetting>, InferCreationAttributes<AppSetting>> {
  declare key: string;
  declare value: unknown;
  declare updatedBy: number | null;
}
AppSetting.init(
  { key: { type: T.STRING(60), primaryKey: true }, value: { type: T.JSON, allowNull: false }, updatedBy: T.INTEGER.UNSIGNED },
  { sequelize, tableName: 'app_settings' },
);

const EXPORT_KEY = 'export_defaults';

async function exportDefaults(): Promise<ExportOptions> {
  const row = await AppSetting.findByPk(EXPORT_KEY);
  // Stored values are re-validated, so a hand-edited or outdated row can never break the export page.
  const parsed = exportOptionsSchema.safeParse({ ...defaultExportOptions, ...(row?.value as object | undefined) });
  return parsed.success ? parsed.data : defaultExportOptions;
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  try {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      total += entry.isDirectory() ? await dirSize(p) : (await fs.stat(p)).size;
    }
  } catch {
    /* directory not created yet */
  }
  return total;
}

export const settingsRouter = Router();

settingsRouter.get('/', requireAuth, asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { exportDefaults: await exportDefaults() } });
}));

settingsRouter.put('/export-defaults', requireFullAuth, requireRole('admin'), validateBody(exportOptionsSchema), asyncHandler(async (req, res) => {
  await AppSetting.upsert({ key: EXPORT_KEY, value: req.body, updatedBy: req.auth!.sub });
  res.json({ success: true, data: { exportDefaults: await exportDefaults() } });
}));

settingsRouter.get('/system', requireFullAuth, requireRole('admin'), asyncHandler(async (_req, res) => {
  let database: SystemStatus['database'] = 'ok';
  try {
    await sequelize.authenticate();
  } catch {
    database = 'error';
  }
  const [uploadsBytes, exportsBytes, mediaCount, exportCount] = await Promise.all([dirSize(env.uploadDir), dirSize(env.exportDir), MediaAsset.count(), MenuExport.count()]);
  const data: SystemStatus = {
    appVersion: pkg.version,
    nodeVersion: process.version,
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    database,
    chromeFound: findChrome() !== null,
    renderBaseUrl: env.RENDER_BASE_URL,
    storage: { uploadsBytes, exportsBytes, mediaCount, exportCount },
  };
  res.json({ success: true, data });
}));
