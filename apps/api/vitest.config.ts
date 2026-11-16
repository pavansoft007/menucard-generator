import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { TEST_DB, TEST_UPLOADS } from './test/globalSetup';

export default defineConfig(({ mode }) => ({
  test: {
    globalSetup: ['./test/globalSetup.ts'],
    // Workers get the shared .env plus the isolated test database / upload dir.
    env: { ...loadEnv(mode, '../..', ''), NODE_ENV: 'test', DB_NAME: TEST_DB, UPLOAD_DIR: TEST_UPLOADS },
    fileParallelism: false,
    testTimeout: 20000,
  },
}));
