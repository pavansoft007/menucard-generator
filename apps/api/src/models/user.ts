import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional } from 'sequelize';
import type { UserRole } from '@gc/shared-types';
import { sequelize } from '../db/sequelize.js';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;
  declare email: string;
  declare name: string;
  declare passwordHash: string;
  declare role: CreationOptional<UserRole>;
  declare isActive: CreationOptional<boolean>;
  declare tokenVersion: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;
}

User.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING(190), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    passwordHash: { type: DataTypes.STRING(120), allowNull: false },
    role: { type: DataTypes.ENUM('admin', 'editor'), allowNull: false, defaultValue: 'editor' },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    tokenVersion: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'users', paranoid: true },
);
