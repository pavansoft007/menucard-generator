import { DataTypes as T, type QueryInterface } from 'sequelize';

export async function up(qi: QueryInterface) {
  // Bumped on password change/reset, deactivation and role change: every token issued before that stops working.
  await qi.addColumn('users', 'token_version', { type: T.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 });

  await qi.createTable('app_settings', {
    key: { type: T.STRING(60), primaryKey: true, allowNull: false },
    value: { type: T.JSON, allowNull: false },
    updated_by: { type: T.INTEGER.UNSIGNED, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
    created_at: { type: T.DATE, allowNull: false },
    updated_at: { type: T.DATE, allowNull: false },
  });
}

export async function down(qi: QueryInterface) {
  await qi.dropTable('app_settings');
  await qi.removeColumn('users', 'token_version');
}
