import { DataTypes, type QueryInterface } from 'sequelize';

export async function up(qi: QueryInterface) {
  await qi.createTable('users', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING(190), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    password_hash: { type: DataTypes.STRING(120), allowNull: false },
    role: { type: DataTypes.ENUM('admin', 'editor'), allowNull: false, defaultValue: 'editor' },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  });
}

export async function down(qi: QueryInterface) {
  await qi.dropTable('users');
}
