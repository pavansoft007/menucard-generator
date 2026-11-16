import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { loadEnv } from 'vite';

export const TEST_DB = 'goldencrunch_test';
export const TEST_UPLOADS = '../../uploads/_test';

/** Builds a fresh, isolated database + upload folder so tests never touch development data. */
export default async function setup() {
  const e = loadEnv('test', path.resolve(import.meta.dirname, '../../..'), '');
  Object.assign(process.env, e, { NODE_ENV: 'test', DB_NAME: TEST_DB, UPLOAD_DIR: TEST_UPLOADS });

  const root = await mysql.createConnection({
    host: e.DB_HOST ?? '127.0.0.1',
    port: Number(e.DB_PORT ?? 3307),
    user: 'root',
    password: e.TEST_DB_ROOT_PASSWORD ?? 'root',
  });
  await root.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await root.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await root.query(`GRANT ALL PRIVILEGES ON \`${TEST_DB}\`.* TO '${e.DB_USER ?? 'goldencrunch'}'@'%'`);
  await root.end();

  const { umzug } = await import('../src/db/migrate.js');
  const { sequelize } = await import('../src/db/sequelize.js');
  const { User } = await import('../src/models/index.js');
  await umzug.up();
  await User.create({
    email: process.env.ADMIN_EMAIL ?? 'admin@goldencrunch.local',
    name: 'Test Admin',
    passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD ?? 'ChangeMe123!', 4),
    role: 'admin',
  });
  await sequelize.close();

  return async () => {
    await fs.rm(path.resolve(import.meta.dirname, '..', TEST_UPLOADS), { recursive: true, force: true });
  };
}
