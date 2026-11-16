import path from 'node:path';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(3307),
  DB_NAME: z.string().default('goldencrunch'),
  DB_USER: z.string().default('goldencrunch'),
  DB_PASSWORD: z.string().default('goldencrunch'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGINS: z.string().default('http://localhost:5180'),
  UPLOAD_DIR: z.string().default('../../uploads'),
  RENDER_BASE_URL: z.string().url().default('http://localhost:5180'), // where headless Chrome opens /render/:pageId
  CHROME_PATH: z.string().optional(),
  CHROME_NO_SANDBOX: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  EXPORT_DIR: z.string().default('../../exports'),
  FORCE_HTTPS: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'), // true when TLS is terminated in front of the app: enables HSTS and upgrade-insecure-requests
  TRUST_PROXY: z.string().optional(), // e.g. 1 when running behind nginx / a load balancer, so rate limits see real client IPs
  WEB_DIST: z.string().default('../web/dist'),
  ADMIN_EMAIL: z.string().email().default('admin@goldencrunch.local'),
  ADMIN_PASSWORD: z.string().min(10).default('ChangeMe123!'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Refuse to run a production server with example credentials.
if (parsed.data.NODE_ENV === 'production') {
  const weak = parsed.data.JWT_SECRET.length < 32 || /change-?me|secret|password|example/i.test(parsed.data.JWT_SECRET);
  if (weak) {
    console.error('JWT_SECRET is too weak for production: use at least 32 random characters (e.g. `openssl rand -hex 48`).');
    process.exit(1);
  }
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()),
  uploadDir: path.resolve(process.cwd(), parsed.data.UPLOAD_DIR),
  exportDir: path.resolve(process.cwd(), parsed.data.EXPORT_DIR),
  webDist: path.resolve(process.cwd(), parsed.data.WEB_DIST),
};
