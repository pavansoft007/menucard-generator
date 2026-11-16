import { DataTypes as T, type QueryInterface } from 'sequelize';

const pk = { type: T.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true };
const stamps = { created_at: { type: T.DATE, allowNull: false }, updated_at: { type: T.DATE, allowNull: false } };
const fk = (table: string, onDelete: 'RESTRICT' | 'SET NULL' | 'CASCADE', allowNull = true) => ({
  type: T.INTEGER.UNSIGNED,
  allowNull,
  references: { model: table, key: 'id' },
  onUpdate: 'CASCADE',
  onDelete,
});

export async function up(qi: QueryInterface) {
  await qi.createTable('menu_themes', {
    id: pk,
    name: { type: T.STRING(80), allowNull: false },
    is_default: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
    config: { type: T.JSON, allowNull: false },
    ...stamps,
    deleted_at: { type: T.DATE, allowNull: true },
  });

  await qi.createTable('menu_backgrounds', {
    id: pk,
    name: { type: T.STRING(100), allowNull: false },
    kind: { type: T.ENUM('page', 'category', 'section', 'card', 'header', 'footer', 'pattern', 'texture'), allowNull: false },
    media_id: fk('media_library', 'RESTRICT'),
    config: { type: T.JSON, allowNull: false },
    ...stamps,
    deleted_at: { type: T.DATE, allowNull: true },
  });
  await qi.addIndex('menu_backgrounds', ['kind']);

  await qi.createTable('menu_combos', {
    id: pk,
    name: { type: T.STRING(120), allowNull: false },
    description: { type: T.TEXT, allowNull: true },
    image_media_id: fk('media_library', 'RESTRICT'),
    selling_price: { type: T.DECIMAL(10, 2), allowNull: false },
    is_active: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
    display_order: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    ...stamps,
    deleted_at: { type: T.DATE, allowNull: true },
  });

  await qi.createTable('menu_combo_items', {
    id: pk,
    combo_id: fk('menu_combos', 'CASCADE', false),
    item_id: fk('menu_items', 'RESTRICT', false),
    variant_id: fk('menu_item_variants', 'RESTRICT', false),
    quantity: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
    display_order: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    ...stamps,
  });
  await qi.addIndex('menu_combo_items', ['combo_id', 'display_order']);

  await qi.createTable('menu_pages', {
    id: pk,
    title: { type: T.STRING(120), allowNull: false },
    subtitle: { type: T.STRING(200), allowNull: true },
    page_type: { type: T.ENUM('cover', 'content', 'back'), allowNull: false, defaultValue: 'content' },
    theme_id: fk('menu_themes', 'SET NULL'),
    is_active: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
    display_order: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    settings: { type: T.JSON, allowNull: false },
    layout: { type: T.JSON, allowNull: false },
    ...stamps,
  });
  await qi.addIndex('menu_pages', ['display_order']);

  await qi.createTable('menu_sections', {
    id: pk,
    page_id: fk('menu_pages', 'CASCADE'), // deleting a page removes its section layouts (content stays in categories/items)
    title: { type: T.STRING(120), allowNull: false },
    subtitle: { type: T.STRING(200), allowNull: true },
    description: { type: T.TEXT, allowNull: true },
    image_media_id: fk('media_library', 'RESTRICT'),
    background_id: fk('menu_backgrounds', 'RESTRICT'),
    display_order: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    config: { type: T.JSON, allowNull: false },
    ...stamps,
  });
  await qi.addIndex('menu_sections', ['page_id', 'display_order']);

  await qi.createTable('menu_section_categories', {
    id: pk,
    section_id: fk('menu_sections', 'CASCADE', false),
    category_id: fk('menu_categories', 'RESTRICT', false),
    display_order: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  });
  await qi.addIndex('menu_section_categories', ['section_id', 'category_id'], { unique: true });

  await qi.createTable('menu_section_items', {
    id: pk,
    section_id: fk('menu_sections', 'CASCADE', false),
    item_id: fk('menu_items', 'RESTRICT', false),
    display_order: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  });
  await qi.addIndex('menu_section_items', ['section_id', 'item_id'], { unique: true });

  await qi.createTable('menu_versions', {
    id: pk,
    label: { type: T.STRING(120), allowNull: true },
    status: { type: T.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
    snapshot: { type: 'LONGTEXT', allowNull: false }, // JSON text of pages + sections
    page_count: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    section_count: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    created_by: fk('users', 'SET NULL'),
    created_at: { type: T.DATE, allowNull: false },
  });
  await qi.addIndex('menu_versions', ['status', 'created_at']);
}

export async function down(qi: QueryInterface) {
  for (const t of [
    'menu_versions',
    'menu_section_items',
    'menu_section_categories',
    'menu_sections',
    'menu_pages',
    'menu_combo_items',
    'menu_combos',
    'menu_backgrounds',
    'menu_themes',
  ]) {
    await qi.dropTable(t);
  }
}
