import {
  DataTypes as T,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from 'sequelize';
import type { BackgroundConfig, BackgroundKind, PageLayout, PageSettings, SectionConfig, ThemeConfig } from '@gc/shared-types';
import { sequelize } from '../db/sequelize.js';
import { MediaAsset, MenuItem, MenuItemVariant } from './menu.js';

const id = { type: T.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true } as const;
const dec = (col: string) => ({
  type: T.DECIMAL(10, 2),
  get(this: Model) {
    const v = this.getDataValue(col);
    return v == null ? null : Number(v);
  },
});

export class MenuTheme extends Model<InferAttributes<MenuTheme>, InferCreationAttributes<MenuTheme>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare isDefault: CreationOptional<boolean>;
  declare config: ThemeConfig;
}
MenuTheme.init(
  { id, name: { type: T.STRING(80), allowNull: false }, isDefault: { type: T.BOOLEAN, allowNull: false, defaultValue: false }, config: { type: T.JSON, allowNull: false } },
  { sequelize, tableName: 'menu_themes', paranoid: true },
);

export class MenuBackground extends Model<InferAttributes<MenuBackground>, InferCreationAttributes<MenuBackground>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare kind: BackgroundKind;
  declare mediaId: number | null;
  declare config: BackgroundConfig;
  declare media?: NonAttribute<MediaAsset | null>;
}
MenuBackground.init(
  {
    id,
    name: { type: T.STRING(100), allowNull: false },
    kind: { type: T.ENUM('page', 'category', 'section', 'card', 'header', 'footer', 'pattern', 'texture'), allowNull: false },
    mediaId: T.INTEGER.UNSIGNED,
    config: { type: T.JSON, allowNull: false },
  },
  { sequelize, tableName: 'menu_backgrounds' },
);

export class MenuCombo extends Model<InferAttributes<MenuCombo>, InferCreationAttributes<MenuCombo>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare description: string | null;
  declare imageMediaId: number | null;
  declare sellingPrice: number;
  declare isActive: boolean;
  declare displayOrder: CreationOptional<number>;
  declare image?: NonAttribute<MediaAsset | null>;
  declare comboItems?: NonAttribute<MenuComboItem[]>;
}
MenuCombo.init(
  {
    id,
    name: { type: T.STRING(120), allowNull: false },
    description: T.TEXT,
    imageMediaId: T.INTEGER.UNSIGNED,
    sellingPrice: { ...dec('sellingPrice'), allowNull: false },
    isActive: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
    displayOrder: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  },
  { sequelize, tableName: 'menu_combos' },
);

export class MenuComboItem extends Model<InferAttributes<MenuComboItem>, InferCreationAttributes<MenuComboItem>> {
  declare id: CreationOptional<number>;
  declare comboId: number;
  declare itemId: number;
  declare variantId: number;
  declare quantity: number;
  declare displayOrder: number;
  declare item?: NonAttribute<MenuItem>;
  declare variant?: NonAttribute<MenuItemVariant>;
}
MenuComboItem.init(
  {
    id,
    comboId: { type: T.INTEGER.UNSIGNED, allowNull: false },
    itemId: { type: T.INTEGER.UNSIGNED, allowNull: false },
    variantId: { type: T.INTEGER.UNSIGNED, allowNull: false },
    quantity: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
    displayOrder: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  },
  { sequelize, tableName: 'menu_combo_items' },
);

export class MenuPage extends Model<InferAttributes<MenuPage>, InferCreationAttributes<MenuPage>> {
  declare id: CreationOptional<number>;
  declare title: string;
  declare subtitle: string | null;
  declare pageType: 'cover' | 'content' | 'back';
  declare themeId: number | null;
  declare isActive: boolean;
  declare displayOrder: CreationOptional<number>;
  declare settings: PageSettings;
  declare layout: PageLayout;
  declare updatedAt: CreationOptional<Date>;
}
MenuPage.init(
  {
    id,
    title: { type: T.STRING(120), allowNull: false },
    subtitle: T.STRING(200),
    pageType: { type: T.ENUM('cover', 'content', 'back'), allowNull: false, defaultValue: 'content' },
    themeId: T.INTEGER.UNSIGNED,
    isActive: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
    displayOrder: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    settings: { type: T.JSON, allowNull: false },
    layout: { type: T.JSON, allowNull: false },
    updatedAt: T.DATE,
  },
  { sequelize, tableName: 'menu_pages' },
);

export class MenuSection extends Model<InferAttributes<MenuSection>, InferCreationAttributes<MenuSection>> {
  declare id: CreationOptional<number>;
  declare pageId: number | null;
  declare title: string;
  declare subtitle: string | null;
  declare description: string | null;
  declare imageMediaId: number | null;
  declare backgroundId: number | null;
  declare displayOrder: CreationOptional<number>;
  declare config: SectionConfig;
  declare image?: NonAttribute<MediaAsset | null>;
}
MenuSection.init(
  {
    id,
    pageId: T.INTEGER.UNSIGNED,
    title: { type: T.STRING(120), allowNull: false },
    subtitle: T.STRING(200),
    description: T.TEXT,
    imageMediaId: T.INTEGER.UNSIGNED,
    backgroundId: T.INTEGER.UNSIGNED,
    displayOrder: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    config: { type: T.JSON, allowNull: false },
  },
  { sequelize, tableName: 'menu_sections' },
);

export class MenuSectionCategory extends Model<InferAttributes<MenuSectionCategory>, InferCreationAttributes<MenuSectionCategory>> {
  declare id: CreationOptional<number>;
  declare sectionId: number;
  declare categoryId: number;
  declare displayOrder: number;
}
MenuSectionCategory.init(
  { id, sectionId: { type: T.INTEGER.UNSIGNED, allowNull: false }, categoryId: { type: T.INTEGER.UNSIGNED, allowNull: false }, displayOrder: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 } },
  { sequelize, tableName: 'menu_section_categories', timestamps: false },
);

export class MenuSectionItem extends Model<InferAttributes<MenuSectionItem>, InferCreationAttributes<MenuSectionItem>> {
  declare id: CreationOptional<number>;
  declare sectionId: number;
  declare itemId: number;
  declare displayOrder: number;
}
MenuSectionItem.init(
  { id, sectionId: { type: T.INTEGER.UNSIGNED, allowNull: false }, itemId: { type: T.INTEGER.UNSIGNED, allowNull: false }, displayOrder: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 } },
  { sequelize, tableName: 'menu_section_items', timestamps: false },
);

export class MenuSectionCombo extends Model<InferAttributes<MenuSectionCombo>, InferCreationAttributes<MenuSectionCombo>> {
  declare id: CreationOptional<number>;
  declare sectionId: number;
  declare comboId: number;
  declare displayOrder: number;
}
MenuSectionCombo.init(
  { id, sectionId: { type: T.INTEGER.UNSIGNED, allowNull: false }, comboId: { type: T.INTEGER.UNSIGNED, allowNull: false }, displayOrder: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 } },
  { sequelize, tableName: 'menu_section_combos', timestamps: false },
);

export class MenuVersion extends Model<InferAttributes<MenuVersion>, InferCreationAttributes<MenuVersion>> {
  declare id: CreationOptional<number>;
  declare label: string | null;
  declare status: 'draft' | 'published';
  declare snapshot: string;
  declare pageCount: number;
  declare sectionCount: number;
  declare createdBy: number | null;
  declare createdAt: CreationOptional<Date>;
}
MenuVersion.init(
  {
    id,
    label: T.STRING(120),
    status: { type: T.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
    snapshot: { type: 'LONGTEXT' as unknown as typeof T.TEXT, allowNull: false },
    pageCount: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    sectionCount: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    createdBy: T.INTEGER.UNSIGNED,
    createdAt: T.DATE,
  },
  { sequelize, tableName: 'menu_versions', updatedAt: false },
);

/* -------------------------------------------------------------- associations */
MenuBackground.belongsTo(MediaAsset, { as: 'media', foreignKey: 'mediaId' });
MenuCombo.belongsTo(MediaAsset, { as: 'image', foreignKey: 'imageMediaId' });
MenuCombo.hasMany(MenuComboItem, { as: 'comboItems', foreignKey: 'comboId' });
MenuComboItem.belongsTo(MenuItem, { as: 'item', foreignKey: 'itemId' });
MenuComboItem.belongsTo(MenuItemVariant, { as: 'variant', foreignKey: 'variantId' });
MenuPage.hasMany(MenuSection, { as: 'sections', foreignKey: 'pageId' });
MenuSection.belongsTo(MenuPage, { as: 'page', foreignKey: 'pageId' });
MenuSection.belongsTo(MediaAsset, { as: 'image', foreignKey: 'imageMediaId' });
