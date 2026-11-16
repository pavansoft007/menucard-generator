import { DataTypes as T, type QueryInterface } from 'sequelize';

const pk = { type: T.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true };
const stamps = {
  created_at: { type: T.DATE, allowNull: false },
  updated_at: { type: T.DATE, allowNull: false },
};
const softDelete = { deleted_at: { type: T.DATE, allowNull: true } };
const fk = (table: string, onDelete: 'RESTRICT' | 'SET NULL' | 'CASCADE', allowNull = true) => ({
  type: T.INTEGER.UNSIGNED,
  allowNull,
  references: { model: table, key: 'id' },
  onUpdate: 'CASCADE',
  onDelete,
});

export async function up(qi: QueryInterface) {
  await qi.createTable('media_library', {
    id: pk,
    original_name: { type: T.STRING(255), allowNull: false },
    mime: { type: T.STRING(60), allowNull: false },
    kind: { type: T.ENUM('image', 'svg'), allowNull: false },
    size: { type: T.INTEGER.UNSIGNED, allowNull: false },
    width: { type: T.INTEGER.UNSIGNED, allowNull: true },
    height: { type: T.INTEGER.UNSIGNED, allowNull: true },
    has_alpha: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
    sha256: { type: T.CHAR(64), allowNull: false },
    original_path: { type: T.STRING(255), allowNull: false },
    optimized_path: { type: T.STRING(255), allowNull: false },
    thumb_path: { type: T.STRING(255), allowNull: false },
    category: { type: T.STRING(60), allowNull: true },
    alt_text: { type: T.STRING(200), allowNull: true },
    ...stamps,
  });
  await qi.addIndex('media_library', ['category']);
  await qi.addIndex('media_library', ['sha256']);
  await qi.addIndex('media_library', ['created_at']);

  await qi.createTable('restaurant_settings', {
    id: pk,
    name: { type: T.STRING(120), allowNull: false },
    tagline: { type: T.STRING(160), allowNull: true },
    phone1: { type: T.STRING(30), allowNull: true },
    phone2: { type: T.STRING(30), allowNull: true },
    address: { type: T.STRING(400), allowNull: true },
    city: { type: T.STRING(80), allowNull: true },
    pincode: { type: T.STRING(12), allowNull: true },
    instagram: { type: T.STRING(190), allowNull: true },
    facebook: { type: T.STRING(190), allowNull: true },
    website: { type: T.STRING(190), allowNull: true },
    gst_number: { type: T.STRING(30), allowNull: true },
    footer_text: { type: T.STRING(400), allowNull: true },
    ...stamps,
  });

  await qi.createTable('restaurant_logos', {
    id: pk,
    media_id: fk('media_library', 'RESTRICT', false),
    label: { type: T.STRING(80), allowNull: false },
    is_primary: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
    default_width_mm: { type: T.DECIMAL(6, 2), allowNull: false, defaultValue: 40 },
    default_position: { type: T.ENUM('left', 'center', 'right'), allowNull: false, defaultValue: 'center' },
    ...stamps,
    ...softDelete,
  });

  await qi.createTable('menu_categories', {
    id: pk,
    name: { type: T.STRING(120), allowNull: false },
    description: { type: T.TEXT, allowNull: true },
    icon: { type: T.STRING(60), allowNull: true },
    image_media_id: fk('media_library', 'SET NULL'),
    icon_media_id: fk('media_library', 'SET NULL'),
    banner_media_id: fk('media_library', 'SET NULL'),
    background_media_id: fk('media_library', 'SET NULL'),
    display_order: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    is_active: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
    ...stamps,
    ...softDelete,
  });
  await qi.addIndex('menu_categories', ['display_order']);

  await qi.createTable('menu_items', {
    id: pk,
    category_id: fk('menu_categories', 'RESTRICT', false),
    name: { type: T.STRING(160), allowNull: false },
    short_description: { type: T.STRING(200), allowNull: true },
    description: { type: T.TEXT, allowNull: true },
    main_media_id: fk('media_library', 'SET NULL'),
    diet_type: { type: T.ENUM('veg', 'non_veg'), allowNull: true },
    is_bestseller: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
    is_spicy: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
    is_new: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
    is_featured: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
    is_available: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
    is_active: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
    display_order: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    ...stamps,
    ...softDelete,
  });
  await qi.addIndex('menu_items', ['category_id', 'display_order']);
  await qi.addIndex('menu_items', ['name']);

  await qi.createTable('menu_item_media', {
    id: pk,
    item_id: fk('menu_items', 'CASCADE', false),
    media_id: fk('media_library', 'RESTRICT', false),
    display_order: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    ...stamps,
  });
  await qi.addIndex('menu_item_media', ['item_id', 'media_id'], { unique: true });

  await qi.createTable('menu_item_variants', {
    id: pk,
    item_id: fk('menu_items', 'CASCADE', false),
    label: { type: T.STRING(80), allowNull: false },
    quantity: { type: T.INTEGER.UNSIGNED, allowNull: true },
    unit: { type: T.STRING(40), allowNull: true },
    price: { type: T.DECIMAL(10, 2), allowNull: true },
    discount_price: { type: T.DECIMAL(10, 2), allowNull: true },
    media_id: fk('media_library', 'SET NULL'),
    display_order: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    is_active: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
    ...stamps,
  });
  await qi.addIndex('menu_item_variants', ['item_id', 'display_order']);
}

export async function down(qi: QueryInterface) {
  for (const t of [
    'menu_item_variants',
    'menu_item_media',
    'menu_items',
    'menu_categories',
    'restaurant_logos',
    'restaurant_settings',
    'media_library',
  ]) {
    await qi.dropTable(t);
  }
}
