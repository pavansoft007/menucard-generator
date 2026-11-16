import { DataTypes as T, type QueryInterface } from 'sequelize';

export async function up(qi: QueryInterface) {
  await qi.createTable('menu_exports', {
    id: { type: T.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    kind: { type: T.ENUM('pdf', 'png'), allowNull: false },
    filename: { type: T.STRING(190), allowNull: false },
    mime: { type: T.STRING(60), allowNull: false },
    file_path: { type: T.STRING(255), allowNull: false },
    bytes: { type: T.INTEGER.UNSIGNED, allowNull: false },
    page_count: { type: T.INTEGER.UNSIGNED, allowNull: false },
    options: { type: T.JSON, allowNull: false },
    pages: { type: T.JSON, allowNull: false },
    warnings: { type: T.JSON, allowNull: false },
    created_by: { type: T.INTEGER.UNSIGNED, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
    created_at: { type: T.DATE, allowNull: false },
  });
  await qi.addIndex('menu_exports', ['created_at']);
}

export async function down(qi: QueryInterface) {
  await qi.dropTable('menu_exports');
}
