import {
  DataTypes as T,
  Model,
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from 'sequelize';
import type { DietType, MediaKind } from '@gc/shared-types';
import { sequelize } from '../db/sequelize.js';

const id = { type: T.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true } as const;

export class MediaAsset extends Model<InferAttributes<MediaAsset>, InferCreationAttributes<MediaAsset>> {
  declare id: CreationOptional<number>;
  declare originalName: string;
  declare mime: string;
  declare kind: MediaKind;
  declare size: number;
  declare width: number | null;
  declare height: number | null;
  declare hasAlpha: boolean;
  declare sha256: string;
  declare originalPath: string;
  declare optimizedPath: string;
  declare thumbPath: string;
  declare category: string | null;
  declare altText: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
MediaAsset.init(
  {
    id,
    originalName: { type: T.STRING(255), allowNull: false },
    mime: { type: T.STRING(60), allowNull: false },
    kind: { type: T.ENUM('image', 'svg'), allowNull: false },
    size: { type: T.INTEGER.UNSIGNED, allowNull: false },
    width: T.INTEGER.UNSIGNED,
    height: T.INTEGER.UNSIGNED,
    hasAlpha: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
    sha256: { type: T.CHAR(64), allowNull: false },
    originalPath: { type: T.STRING(255), allowNull: false },
    optimizedPath: { type: T.STRING(255), allowNull: false },
    thumbPath: { type: T.STRING(255), allowNull: false },
    category: T.STRING(60),
    altText: T.STRING(200),
    createdAt: T.DATE,
    updatedAt: T.DATE,
  },
  { sequelize, tableName: 'media_library' },
);

export class RestaurantSettings extends Model<InferAttributes<RestaurantSettings>, InferCreationAttributes<RestaurantSettings>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare tagline: string | null;
  declare phone1: string | null;
  declare phone2: string | null;
  declare address: string | null;
  declare city: string | null;
  declare pincode: string | null;
  declare instagram: string | null;
  declare facebook: string | null;
  declare website: string | null;
  declare gstNumber: string | null;
  declare footerText: string | null;
  declare updatedAt: CreationOptional<Date>;
}
RestaurantSettings.init(
  {
    id,
    name: { type: T.STRING(120), allowNull: false },
    tagline: T.STRING(160),
    phone1: T.STRING(30),
    phone2: T.STRING(30),
    address: T.STRING(400),
    city: T.STRING(80),
    pincode: T.STRING(12),
    instagram: T.STRING(190),
    facebook: T.STRING(190),
    website: T.STRING(190),
    gstNumber: T.STRING(30),
    footerText: T.STRING(400),
    updatedAt: T.DATE,
  },
  { sequelize, tableName: 'restaurant_settings' },
);

export class RestaurantLogo extends Model<InferAttributes<RestaurantLogo>, InferCreationAttributes<RestaurantLogo>> {
  declare id: CreationOptional<number>;
  declare mediaId: ForeignKey<MediaAsset['id']>;
  declare label: string;
  declare isPrimary: boolean;
  declare defaultWidthMm: number;
  declare defaultPosition: 'left' | 'center' | 'right';
  declare media?: NonAttribute<MediaAsset>;
}
RestaurantLogo.init(
  {
    id,
    mediaId: { type: T.INTEGER.UNSIGNED, allowNull: false },
    label: { type: T.STRING(80), allowNull: false },
    isPrimary: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
    defaultWidthMm: {
      type: T.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 40,
      get() {
        return Number(this.getDataValue('defaultWidthMm'));
      },
    },
    defaultPosition: { type: T.ENUM('left', 'center', 'right'), allowNull: false, defaultValue: 'center' },
  },
  // Hard delete: a soft-deleted row would keep its RESTRICT foreign key and silently lock the image.
  { sequelize, tableName: 'restaurant_logos' },
);

export class MenuCategory extends Model<InferAttributes<MenuCategory>, InferCreationAttributes<MenuCategory>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare description: string | null;
  declare icon: string | null;
  declare imageMediaId: number | null;
  declare iconMediaId: number | null;
  declare bannerMediaId: number | null;
  declare backgroundMediaId: number | null;
  declare displayOrder: CreationOptional<number>;
  declare isActive: boolean;
  declare image?: NonAttribute<MediaAsset | null>;
  declare iconMedia?: NonAttribute<MediaAsset | null>;
  declare banner?: NonAttribute<MediaAsset | null>;
  declare background?: NonAttribute<MediaAsset | null>;
}
MenuCategory.init(
  {
    id,
    name: { type: T.STRING(120), allowNull: false },
    description: T.TEXT,
    icon: T.STRING(60),
    imageMediaId: T.INTEGER.UNSIGNED,
    iconMediaId: T.INTEGER.UNSIGNED,
    bannerMediaId: T.INTEGER.UNSIGNED,
    backgroundMediaId: T.INTEGER.UNSIGNED,
    displayOrder: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    isActive: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, tableName: 'menu_categories', paranoid: true },
);

export class MenuItem extends Model<InferAttributes<MenuItem>, InferCreationAttributes<MenuItem>> {
  declare id: CreationOptional<number>;
  declare categoryId: number;
  declare name: string;
  declare shortDescription: string | null;
  declare description: string | null;
  declare mainMediaId: number | null;
  declare dietType: DietType | null;
  declare isBestseller: boolean;
  declare isSpicy: boolean;
  declare isNew: boolean;
  declare isFeatured: boolean;
  declare isAvailable: boolean;
  declare isActive: boolean;
  declare displayOrder: CreationOptional<number>;
  declare category?: NonAttribute<MenuCategory>;
  declare mainMedia?: NonAttribute<MediaAsset | null>;
  declare gallery?: NonAttribute<(MediaAsset & { MenuItemMedia?: MenuItemMedia })[]>;
  declare variants?: NonAttribute<MenuItemVariant[]>;
}
MenuItem.init(
  {
    id,
    categoryId: { type: T.INTEGER.UNSIGNED, allowNull: false },
    name: { type: T.STRING(160), allowNull: false },
    shortDescription: T.STRING(200),
    description: T.TEXT,
    mainMediaId: T.INTEGER.UNSIGNED,
    dietType: T.ENUM('veg', 'non_veg'),
    isBestseller: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
    isSpicy: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
    isNew: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
    isFeatured: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
    isAvailable: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
    isActive: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
    displayOrder: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  },
  { sequelize, tableName: 'menu_items', paranoid: true },
);

export class MenuItemMedia extends Model<InferAttributes<MenuItemMedia>, InferCreationAttributes<MenuItemMedia>> {
  declare id: CreationOptional<number>;
  declare itemId: number;
  declare mediaId: number;
  declare displayOrder: number;
}
MenuItemMedia.init(
  {
    id,
    itemId: { type: T.INTEGER.UNSIGNED, allowNull: false },
    mediaId: { type: T.INTEGER.UNSIGNED, allowNull: false },
    displayOrder: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  },
  { sequelize, tableName: 'menu_item_media' },
);

const decimal = (col: string) => ({
  type: T.DECIMAL(10, 2),
  get(this: Model) {
    const v = this.getDataValue(col);
    return v == null ? null : Number(v);
  },
});

export class MenuItemVariant extends Model<InferAttributes<MenuItemVariant>, InferCreationAttributes<MenuItemVariant>> {
  declare id: CreationOptional<number>;
  declare itemId: number;
  declare label: string;
  declare quantity: number | null;
  declare unit: string | null;
  declare price: number | null;
  declare discountPrice: number | null;
  declare mediaId: number | null;
  declare displayOrder: number;
  declare isActive: boolean;
  declare media?: NonAttribute<MediaAsset | null>;
}
MenuItemVariant.init(
  {
    id,
    itemId: { type: T.INTEGER.UNSIGNED, allowNull: false },
    label: { type: T.STRING(80), allowNull: false },
    quantity: T.INTEGER.UNSIGNED,
    unit: T.STRING(40),
    price: decimal('price'),
    discountPrice: decimal('discountPrice'),
    mediaId: T.INTEGER.UNSIGNED,
    displayOrder: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    isActive: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, tableName: 'menu_item_variants' },
);

/* -------------------------------------------------------------- associations */
RestaurantLogo.belongsTo(MediaAsset, { as: 'media', foreignKey: 'mediaId' });

MenuCategory.belongsTo(MediaAsset, { as: 'image', foreignKey: 'imageMediaId' });
MenuCategory.belongsTo(MediaAsset, { as: 'iconMedia', foreignKey: 'iconMediaId' });
MenuCategory.belongsTo(MediaAsset, { as: 'banner', foreignKey: 'bannerMediaId' });
MenuCategory.belongsTo(MediaAsset, { as: 'background', foreignKey: 'backgroundMediaId' });
MenuCategory.hasMany(MenuItem, { as: 'items', foreignKey: 'categoryId' });

MenuItem.belongsTo(MenuCategory, { as: 'category', foreignKey: 'categoryId' });
MenuItem.belongsTo(MediaAsset, { as: 'mainMedia', foreignKey: 'mainMediaId' });
MenuItem.belongsToMany(MediaAsset, { as: 'gallery', through: MenuItemMedia, foreignKey: 'itemId', otherKey: 'mediaId' });
MenuItem.hasMany(MenuItemVariant, { as: 'variants', foreignKey: 'itemId' });
MenuItemVariant.belongsTo(MenuItem, { foreignKey: 'itemId' });
MenuItemVariant.belongsTo(MediaAsset, { as: 'media', foreignKey: 'mediaId' });
