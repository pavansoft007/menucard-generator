import { DataTypes as T, type QueryInterface } from 'sequelize';

export async function up(qi: QueryInterface) {
  await qi.createTable('menu_section_combos', {
    id: { type: T.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    section_id: { type: T.INTEGER.UNSIGNED, allowNull: false, references: { model: 'menu_sections', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
    combo_id: { type: T.INTEGER.UNSIGNED, allowNull: false, references: { model: 'menu_combos', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
    display_order: { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  });
  await qi.addIndex('menu_section_combos', ['section_id', 'combo_id'], { unique: true });
}

export async function down(qi: QueryInterface) {
  await qi.dropTable('menu_section_combos');
}
