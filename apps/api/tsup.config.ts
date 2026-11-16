import { defineConfig } from 'tsup';

// Bundles the API (and the workspace's shared-types TypeScript) into plain Node ESM for production.
// Migrations are separate entries because the migration runner loads them by file name at runtime.
export default defineConfig({
  entry: ['src/server.ts', 'src/db/migrate.ts', 'src/db/seed.ts', 'src/migrations/*.ts'],
  format: 'esm',
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: ['@gc/shared-types'],
  outExtension: () => ({ js: '.js' }),
});
