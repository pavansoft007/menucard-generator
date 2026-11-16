import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { defaultExportOptions, exportOptionsSchema, parsePageRange, sheetLayout } from '@gc/shared-types';
import { createApp } from '../../app.js';
import { sequelize } from '../../db/sequelize.js';
import { env } from '../../config/env.js';
import { findChrome } from './browser.js';
import { MenuPage } from '../../models/index.js';
import { renderUrl, signRenderToken } from './render.js';

const A4 = { w: 210, h: 297 };

describe('page ranges', () => {
  it('parses all, lists and ranges, clipped to the book', () => {
    expect(parsePageRange('all', 4)).toEqual([1, 2, 3, 4]);
    expect(parsePageRange('1-3, 5', 6)).toEqual([1, 2, 3, 5]);
    expect(parsePageRange('2-99', 4)).toEqual([2, 3, 4]);
    expect(parsePageRange('3,3,1', 5)).toEqual([1, 3]);
  });
  it('rejects nonsense and empty selections', () => {
    for (const bad of ['', 'x', '0', '3-1', '1,,2', '5', '-2']) expect(parsePageRange(bad, 4), bad).toBeNull();
  });
});

describe('sheet geometry (shared by the server and the render page)', () => {
  it('keeps A4 at exactly 210 x 297 mm with no bleed', () => {
    expect(sheetLayout(A4, { paper: 'native', orientation: 'native', bleedMm: 0 })).toMatchObject({ sheetW: 210, sheetH: 297, scale: 1, offsetX: 0, offsetY: 0 });
  });
  it('adds bleed on every side and offsets the page into the sheet', () => {
    expect(sheetLayout(A4, { paper: 'native', orientation: 'native', bleedMm: 3 })).toMatchObject({ sheetW: 216, sheetH: 303, trimW: 210, trimH: 297, offsetX: 3, offsetY: 3, scale: 1 });
  });
  it('swaps for the requested orientation and scales content to fit another paper', () => {
    const land = sheetLayout(A4, { paper: 'native', orientation: 'landscape', bleedMm: 0 });
    expect([land.sheetW, land.sheetH]).toEqual([297, 210]);
    const onA3 = sheetLayout(A4, { paper: 'A3', orientation: 'native', bleedMm: 0 });
    expect([onA3.sheetW, onA3.sheetH]).toEqual([297, 420]);
    expect(onA3.scale).toBeCloseTo(420 / 297, 5); // limited by the height ratio; A3 is not exactly 2x A4's width
    expect(onA3.offsetX).toBeLessThan(0.05); // a 0.015 mm centring sliver, invisible in print
    const onA5 = sheetLayout(A4, { paper: 'A5', orientation: 'native', bleedMm: 0 });
    expect(onA5.scale).toBeCloseTo(148 / 210, 5);
  });
  it('centres a page that does not match the paper shape', () => {
    const r = sheetLayout({ w: 297, h: 210 }, { paper: 'A4', orientation: 'portrait', bleedMm: 0 }); // landscape page on portrait A4
    expect([r.sheetW, r.sheetH]).toEqual([210, 297]);
    expect(r.scale).toBeCloseTo(210 / 297, 5);
    expect(r.offsetY).toBeGreaterThan(0); // letterboxed, centred vertically
  });
});

describe('export options validation', () => {
  it('accepts the defaults and rejects out-of-range values', () => {
    expect(exportOptionsSchema.safeParse(defaultExportOptions).success).toBe(true);
    for (const patch of [{ dpi: 1000 }, { dpi: 10 }, { bleedMm: 50 }, { bleedMm: -1 }, { pages: 'abc' }, { paper: 'B7' }, { mode: 'zip' }]) {
      expect(exportOptionsSchema.safeParse({ ...defaultExportOptions, ...patch }).success, JSON.stringify(patch)).toBe(false);
    }
  });
  it('builds the render URL only on the configured origin', () => {
    const url = new URL(renderUrl({ pageId: 7, pageNumber: 2, title: 'x', widthMm: 210, heightMm: 297 }, 5, { ...defaultExportOptions, quality: 'standard', includeFooter: false }, 'tok'));
    expect(url.origin).toBe(new URL(env.RENDER_BASE_URL).origin);
    expect(url.pathname).toBe('/render/7');
    expect(url.searchParams.get('img')).toBe('opt');
    expect(url.searchParams.get('footer')).toBe('0');
  });
});

describe('render token and export endpoints', () => {
  const app = createApp();
  let full: string;
  beforeAll(async () => {
    const r = await request(app).post('/api/auth/login').send({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD });
    full = r.body.data.token;
  });
  afterAll(() => sequelize.close());

  it('the headless-browser token can read but never write or export', async () => {
    const render = signRenderToken(1, 'admin', 0);
    expect((jwt.decode(render) as { purpose: string }).purpose).toBe('render');
    expect((jwt.decode(render) as { exp: number; iat: number }).exp - (jwt.decode(render) as { iat: number }).iat).toBeLessThanOrEqual(15 * 60);
    expect((await request(app).get('/api/menu-pages').set('Authorization', `Bearer ${render}`)).status).toBe(200);
    expect((await request(app).post('/api/menu-pages').set('Authorization', `Bearer ${render}`).send({})).status).toBe(403);
    expect((await request(app).delete('/api/menu-pages/1').set('Authorization', `Bearer ${render}`)).status).toBe(403);
    expect((await request(app).get('/api/export').set('Authorization', `Bearer ${render}`)).status).toBe(403);
    expect((await request(app).post('/api/export/pdf').set('Authorization', `Bearer ${render}`).send(defaultExportOptions)).status).toBe(403);
  });
  it('requires a login for everything', async () => {
    for (const [m, p] of [['get', '/api/export'], ['get', '/api/export/status'], ['post', '/api/export/pdf'], ['post', '/api/export/image'], ['get', '/api/export/1/download'], ['delete', '/api/export/1']] as const) {
      expect((await request(app)[m](p)).status, `${m} ${p}`).toBe(401);
    }
  });
  it('validates options before doing any work', async () => {
    const bad = await request(app).post('/api/export/pdf').set('Authorization', `Bearer ${full}`).send({ ...defaultExportOptions, dpi: 5000 });
    expect(bad.status).toBe(400);
  });
  it('refuses to export when there are no pages (before touching the browser)', async () => {
    await MenuPage.destroy({ where: {} }); // earlier test files leave pages behind in the shared test database
    const res = await request(app).post('/api/export/pdf').set('Authorization', `Bearer ${full}`).send(defaultExportOptions);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/no pages/i);
  });
  it('reports whether Chrome can be found', async () => {
    const res = await request(app).get('/api/export/status').set('Authorization', `Bearer ${full}`);
    expect(res.status).toBe(200);
    expect(res.body.data.chromeFound).toBe(findChrome() !== null);
  });
  it('unknown export -> 404', async () => {
    expect((await request(app).get('/api/export/99999999/download').set('Authorization', `Bearer ${full}`)).status).toBe(404);
  });
});
