import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { sequelize } from '../../db/sequelize.js';
import { env } from '../../config/env.js';

const app = createApp();
afterAll(() => sequelize.close());

describe('auth', () => {
  it('rejects bad credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: env.ADMIN_EMAIL, password: 'wrong-pass' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('validates the body', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nope' });
    expect(res.status).toBe(400);
  });

  it('logs in and reads the profile', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD });
    expect(login.status).toBe(200);
    const token = login.body.data.token as string;
    const me = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(env.ADMIN_EMAIL);
    expect((await request(app).get('/api/auth/profile')).status).toBe(401);
  });
});
