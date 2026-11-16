import { Umzug, SequelizeStorage } from 'umzug';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { sequelize } from './sequelize.js';

export const umzug = new Umzug({
  migrations: {
    glob: ['../migrations/*.ts', { cwd: import.meta.dirname }],
    resolve: ({ name, path: p }) => ({
      name,
      up: async () => (await import(pathToFileURL(p!).href)).up(sequelize.getQueryInterface()),
      down: async () => (await import(pathToFileURL(p!).href)).down(sequelize.getQueryInterface()),
    }),
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

if (path.resolve(process.argv[1] ?? '') === path.resolve(import.meta.filename)) {
  const cmd = process.argv[2] ?? 'up';
  try {
    if (cmd === 'down') await umzug.down();
    else await umzug.up();
  } finally {
    await sequelize.close();
  }
}
