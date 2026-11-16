import { DataTypes as T, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from 'sequelize';
import type { ExportOptions, ExportWarning, ExportedPage } from '@gc/shared-types';
import { sequelize } from '../db/sequelize.js';

export class MenuExport extends Model<InferAttributes<MenuExport>, InferCreationAttributes<MenuExport>> {
  declare id: CreationOptional<number>;
  declare kind: 'pdf' | 'png';
  declare filename: string;
  declare mime: string;
  declare filePath: string;
  declare bytes: number;
  declare pageCount: number;
  declare options: ExportOptions;
  declare pages: ExportedPage[];
  declare warnings: ExportWarning[];
  declare createdBy: number | null;
  declare createdAt: CreationOptional<Date>;
}
MenuExport.init(
  {
    id: { type: T.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    kind: { type: T.ENUM('pdf', 'png'), allowNull: false },
    filename: { type: T.STRING(190), allowNull: false },
    mime: { type: T.STRING(60), allowNull: false },
    filePath: { type: T.STRING(255), allowNull: false },
    bytes: { type: T.INTEGER.UNSIGNED, allowNull: false },
    pageCount: { type: T.INTEGER.UNSIGNED, allowNull: false },
    options: { type: T.JSON, allowNull: false },
    pages: { type: T.JSON, allowNull: false },
    warnings: { type: T.JSON, allowNull: false },
    createdBy: T.INTEGER.UNSIGNED,
    createdAt: T.DATE,
  },
  { sequelize, tableName: 'menu_exports', updatedAt: false },
);
