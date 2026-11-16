import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { defaultExportOptions } from '@gc/shared-types';
import { createApp } from '../app.js';
import { sequelize } from '../db/sequelize.js';
import { env } from '../config/env.js';

const app = createApp();
const tag = `s${Date.now()}`;
const PW = 'Correct-Horse-9';
const login = (email: string, password: string) => request(app).post('/api/auth/login').send({ email, password });
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

let admin: string;
let editorId: number;
let editorToken: string;
const editorEmail = `${tag}.editor@example.com`;

beforeAll(async () => {
  admin = (await login(env.ADMIN_EMAIL, env.ADMIN_PASSWORD)).body.data.token;
});
afterAll(() => sequelize.close());

describe('login', () => {
  it('gives the same answer for an unknown email and a wrong password', async () => {
    const unknown = await login('nobody@example.com', 'whatever-12345');
    const wrong = await login(env.ADMIN_EMAIL, 'wrong-password-1');
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });
  it('treats the email case-insensitively', async () => {
    expect((await login(env.ADMIN_EMAIL.toUpperCase(), env.ADMIN_PASSWORD)).status).toBe(200);
  });
});

describe('token forgery', () => {
  const payload = { sub: '1', role: 'admin', tv: 0 };
  it('rejects unsigned (alg none), wrongly signed and expired tokens', async () => {
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.`;
    const wrongKey = jwt.sign(payload, 'a-completely-different-secret-value');
    const expired = jwt.sign({ ...payload }, env.JWT_SECRET, { expiresIn: -10 });
    for (const t of [none, wrongKey, expired, 'garbage']) expect((await request(app).get('/api/auth/profile').set(bearer(t))).status).toBe(401);
  });
  it('rejects a token whose version no longer matches', async () => {
    const stale = jwt.sign({ role: 'admin', tv: 99 }, env.JWT_SECRET, { subject: '1' });
    expect((await request(app).get('/api/auth/profile').set(bearer(stale))).status).toBe(401);
  });
  it('ignores a role claim: the database decides', async () => {
    // an editor's real token, tampered to claim admin, is re-signed only by us, so craft one with the right secret
    // but for a user that is an editor in the database
    const created = await request(app).post('/api/users').set(bearer(admin)).send({ email: `${tag}.claim@example.com`, name: 'Claim', role: 'editor', password: PW });
    const forged = jwt.sign({ role: 'admin', tv: 0 }, env.JWT_SECRET, { subject: String(created.body.data.id) });
    expect((await request(app).get('/api/users').set(bearer(forged))).status).toBe(403);
    await request(app).delete(`/api/users/${created.body.data.id}`).set(bearer(admin));
  });
});

describe('roles', () => {
  it('lets an administrator create an editor, with password rules and unique emails', async () => {
    for (const password of ['short1', 'alllettersnodigit', '1234567890123']) {
      expect((await request(app).post('/api/users').set(bearer(admin)).send({ email: `${tag}.weak@example.com`, name: 'W', role: 'editor', password })).status, password).toBe(400);
    }
    const ok = await request(app).post('/api/users').set(bearer(admin)).send({ email: editorEmail.toUpperCase(), name: 'Eddie Editor', role: 'editor', password: PW });
    expect(ok.status).toBe(201);
    expect(ok.body.data.email).toBe(editorEmail); // stored lower-case
    expect(JSON.stringify(ok.body)).not.toMatch(/hash|password/i);
    editorId = ok.body.data.id;
    expect((await request(app).post('/api/users').set(bearer(admin)).send({ email: editorEmail, name: 'Dup', role: 'editor', password: PW })).status).toBe(409);
    editorToken = (await login(editorEmail, PW)).body.data.token;
  });

  it('lets editors work on the menu but not manage users or settings', async () => {
    expect((await request(app).get('/api/menu-pages').set(bearer(editorToken))).status).toBe(200);
    expect((await request(app).get('/api/categories').set(bearer(editorToken))).status).toBe(200);
    for (const [m, p] of [['get', '/api/users'], ['post', '/api/users'], ['get', '/api/settings/system']] as const) {
      expect((await request(app)[m](p).set(bearer(editorToken))).status, `${m} ${p}`).toBe(403);
    }
    expect((await request(app).put('/api/settings/export-defaults').set(bearer(editorToken)).send(defaultExportOptions)).status).toBe(403);
    expect((await request(app).get('/api/settings').set(bearer(editorToken))).status).toBe(200); // reading defaults is fine
  });

  it('applies a role change immediately, without waiting for the token to expire', async () => {
    const up = await request(app).put(`/api/users/${editorId}`).set(bearer(admin)).send({ name: 'Eddie Editor', role: 'admin', isActive: true });
    expect(up.status).toBe(200);
    // the old token carries the old version, so the session ends and the user signs in again as admin
    expect((await request(app).get('/api/users').set(bearer(editorToken))).status).toBe(401);
    const again = (await login(editorEmail, PW)).body.data.token;
    expect((await request(app).get('/api/users').set(bearer(again))).status).toBe(200);
    await request(app).put(`/api/users/${editorId}`).set(bearer(admin)).send({ name: 'Eddie Editor', role: 'editor', isActive: true });
    editorToken = (await login(editorEmail, PW)).body.data.token;
  });

  it('refuses self-lockout and deleting yourself', async () => {
    const me = (await request(app).get('/api/auth/profile').set(bearer(admin))).body.data;
    expect((await request(app).put(`/api/users/${me.id}`).set(bearer(admin)).send({ name: me.name, role: 'editor', isActive: true })).status).toBe(400);
    expect((await request(app).put(`/api/users/${me.id}`).set(bearer(admin)).send({ name: me.name, role: 'admin', isActive: false })).status).toBe(400);
    expect((await request(app).delete(`/api/users/${me.id}`).set(bearer(admin))).status).toBe(400);
  });
});

describe('ending sessions', () => {
  it('a password reset signs the user out everywhere and the new password works', async () => {
    const before = editorToken;
    expect((await request(app).post(`/api/users/${editorId}/reset-password`).set(bearer(admin)).send({ password: 'weak' })).status).toBe(400);
    expect((await request(app).post(`/api/users/${editorId}/reset-password`).set(bearer(admin)).send({ password: 'Brand-New-Pass-7' })).status).toBe(200);
    expect((await request(app).get('/api/menu-pages').set(bearer(before))).status).toBe(401);
    expect((await login(editorEmail, PW)).status).toBe(401);
    editorToken = (await login(editorEmail, 'Brand-New-Pass-7')).body.data.token;
    expect((await request(app).get('/api/menu-pages').set(bearer(editorToken))).status).toBe(200);
  });

  it('changing your own password needs the current one and returns a fresh token', async () => {
    const old = editorToken;
    const body = { currentPassword: 'Brand-New-Pass-7', newPassword: 'Another-Pass-42' };
    expect((await request(app).post('/api/auth/change-password').set(bearer(old)).send({ ...body, currentPassword: 'nope-nope-1' })).status).toBe(400);
    expect((await request(app).post('/api/auth/change-password').set(bearer(old)).send({ ...body, newPassword: 'Brand-New-Pass-7' })).status).toBe(400);
    expect((await request(app).post('/api/auth/change-password').set(bearer(old)).send({ ...body, newPassword: 'short' })).status).toBe(400);
    const ok = await request(app).post('/api/auth/change-password').set(bearer(old)).send(body);
    expect(ok.status).toBe(200);
    expect((await request(app).get('/api/menu-pages').set(bearer(old))).status).toBe(401); // other sessions end
    editorToken = ok.body.data.token;
    expect((await request(app).get('/api/menu-pages').set(bearer(editorToken))).status).toBe(200);
  });

  it('deactivating a user ends their session at once; deleting frees the email', async () => {
    expect((await request(app).put(`/api/users/${editorId}`).set(bearer(admin)).send({ name: 'Eddie Editor', role: 'editor', isActive: false })).status).toBe(200);
    expect((await request(app).get('/api/menu-pages').set(bearer(editorToken))).status).toBe(401);
    expect((await login(editorEmail, 'Another-Pass-42')).status).toBe(401);
    expect((await request(app).delete(`/api/users/${editorId}`).set(bearer(admin))).status).toBe(200);
    const reuse = await request(app).post('/api/users').set(bearer(admin)).send({ email: editorEmail, name: 'Again', role: 'editor', password: PW });
    expect(reuse.status).toBe(201);
    await request(app).delete(`/api/users/${reuse.body.data.id}`).set(bearer(admin));
  });
});

describe('settings', () => {
  it('stores export defaults (admin only), validates them, and serves them to everyone', async () => {
    const initial = await request(app).get('/api/settings').set(bearer(admin));
    expect(initial.body.data.exportDefaults).toMatchObject({ bleedMm: 0, dpi: 300 });
    const bad = await request(app).put('/api/settings/export-defaults').set(bearer(admin)).send({ ...defaultExportOptions, dpi: 9999 });
    expect(bad.status).toBe(400);
    const set = await request(app).put('/api/settings/export-defaults').set(bearer(admin)).send({ ...defaultExportOptions, bleedMm: 3, padToEven: true });
    expect(set.status).toBe(200);
    expect((await request(app).get('/api/settings').set(bearer(admin))).body.data.exportDefaults).toMatchObject({ bleedMm: 3, padToEven: true });
  });
  it('reports system status to administrators', async () => {
    const res = await request(app).get('/api/settings/system').set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ database: 'ok', environment: 'test' });
    expect(res.body.data.storage).toEqual(expect.objectContaining({ mediaCount: expect.any(Number), uploadsBytes: expect.any(Number) }));
    expect(res.body.data.appVersion).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('input limits', () => {
  it('rejects oversized JSON bodies and malformed JSON', async () => {
    const big = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(700 * 1024) }));
    expect(big.status).toBe(413);
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(bad.status).toBe(400);
  });
  it('does not leak stack traces or internals in errors', async () => {
    const res = await request(app).get('/api/this-route-does-not-exist').set(bearer(admin));
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.(ts|js):\d+|node_modules/);
  });
});

describe('image crop & resize', () => {
  const sharpLib = () => import('sharp').then((m) => m.default);
  const made: number[] = [];
  const upload = async (buf: Buffer, name: string, category?: string) => {
    const r = await request(app).post('/api/media/upload').set(bearer(admin)).attach('file', buf, name).field('category', category ?? '');
    made.push(r.body.data.id);
    return r.body.data as { id: number; width: number; height: number; category: string | null; originalUrl: string; hasAlpha: boolean };
  };
  afterAll(async () => { for (const id of made) await request(app).delete(`/api/media/${id}`).set(bearer(admin)); });

  it('crops into a NEW image with the right size, keeps the original and the category', async () => {
    const sharp = await sharpLib();
    // left half red, right half blue so we can prove WHICH area was cropped
    const left = await sharp({ create: { width: 200, height: 300, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const img = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#0000ff' } }).composite([{ input: left, left: 0, top: 0 }]).png().toBuffer();
    const src = await upload(img, 'split.png', 'Food');
    const res = await request(app).post(`/api/media/${src.id}/crop`).set(bearer(admin)).send({ x: 0.5, y: 0.5, w: 0.5, h: 0.5, outputWidth: null });
    expect(res.status).toBe(201);
    made.push(res.body.data.id);
    expect(res.body.data).toMatchObject({ width: 200, height: 150, category: 'Food' });
    expect(res.body.data.id).not.toBe(src.id);
    expect(res.body.data.originalName).toBe('split-crop.png');
    // the cropped area is the right (blue) half
    const out = await sharp(Buffer.from((await request(app).get(res.body.data.originalUrl).buffer(true).parse((r, cb) => { const c: Buffer[] = []; r.on('data', (d: Buffer) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); })).body)).raw().toBuffer({ resolveWithObject: true });
    expect([...out.data.subarray(0, 3)]).toEqual([0, 0, 255]);
    // the source is untouched
    const still = (await request(app).get(`/api/media/by-ids?ids=${src.id}`).set(bearer(admin))).body.data[0];
    expect(still).toMatchObject({ width: 400, height: 300 });
  });

  it('resizes down without ever upscaling', async () => {
    const sharp = await sharpLib();
    const src = await upload(await sharp({ create: { width: 800, height: 400, channels: 3, background: '#888' } }).jpeg().toBuffer(), 'wide.jpg');
    const small = await request(app).post(`/api/media/${src.id}/crop`).set(bearer(admin)).send({ x: 0, y: 0, w: 1, h: 1, outputWidth: 200 });
    made.push(small.body.data.id);
    expect(small.body.data).toMatchObject({ width: 200, height: 100, mime: 'image/jpeg' });
    const big = await request(app).post(`/api/media/${src.id}/crop`).set(bearer(admin)).send({ x: 0, y: 0, w: 1, h: 1, outputWidth: 6000 });
    made.push(big.body.data.id);
    expect(big.body.data.width).toBe(800);
  });

  it('keeps transparency for PNGs', async () => {
    const sharp = await sharpLib();
    const src = await upload(await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.4 } } }).png().toBuffer(), 'alpha.png');
    const res = await request(app).post(`/api/media/${src.id}/crop`).set(bearer(admin)).send({ x: 0, y: 0, w: 0.5, h: 0.5, outputWidth: null });
    made.push(res.body.data.id);
    expect(res.body.data).toMatchObject({ hasAlpha: true, width: 50, height: 50 });
  });

  it('rejects boxes outside the image, SVGs and unknown ids', async () => {
    const sharp = await sharpLib();
    const src = await upload(await sharp({ create: { width: 50, height: 50, channels: 3, background: '#000' } }).png().toBuffer(), 'tiny.png');
    for (const body of [{ x: 0.6, y: 0, w: 0.6, h: 1, outputWidth: null }, { x: -0.1, y: 0, w: 0.5, h: 0.5, outputWidth: null }, { x: 0, y: 0, w: 0, h: 0.5, outputWidth: null }, { x: 0, y: 0, w: 1, h: 1, outputWidth: 5 }]) {
      expect((await request(app).post(`/api/media/${src.id}/crop`).set(bearer(admin)).send(body)).status, JSON.stringify(body)).toBe(400);
    }
    const svg = await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'), 'v.svg');
    expect((await request(app).post(`/api/media/${svg.id}/crop`).set(bearer(admin)).send({ x: 0, y: 0, w: 1, h: 1, outputWidth: null })).status).toBe(400);
    expect((await request(app).post('/api/media/99999999/crop').set(bearer(admin)).send({ x: 0, y: 0, w: 1, h: 1, outputWidth: null })).status).toBe(404);
  });
});
