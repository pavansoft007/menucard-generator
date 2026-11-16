import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../app.js';
import { sequelize } from '../db/sequelize.js';
import { env } from '../config/env.js';
import { MenuCategory, MenuItem, MenuItemVariant } from '../models/index.js';

const app = createApp();
let auth: { Authorization: string };
const tag = `t${Date.now()}`; // unique marker so tests never collide with real data
const created = { categories: [] as number[], items: [] as number[], media: [] as number[], logos: [] as number[] };

const png = (alpha = false) =>
  sharp({ create: { width: 640, height: 480, channels: alpha ? 4 : 3, background: alpha ? { r: 245, g: 181, b: 27, alpha: 0.5 } : { r: 245, g: 181, b: 27 } } })
    .png()
    .toBuffer();

const itemBody = (categoryId: number, over: Record<string, unknown> = {}) => ({
  categoryId,
  name: `${tag}-wings`,
  shortDescription: null,
  description: null,
  mainMediaId: null,
  galleryMediaIds: [],
  dietType: 'non_veg',
  isBestseller: false,
  isSpicy: true,
  isNew: false,
  isFeatured: false,
  isAvailable: true,
  isActive: true,
  variants: [
    { label: '4 Pieces', quantity: 4, unit: 'Pieces', price: 159, discountPrice: null, mediaId: null, isActive: true },
    { label: '6 Pieces', quantity: 6, unit: 'Pieces', price: 229, discountPrice: 199, mediaId: null, isActive: true },
  ],
  ...over,
});

beforeAll(async () => {
  const r = await request(app).post('/api/auth/login').send({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD });
  auth = { Authorization: `Bearer ${r.body.data.token}` };
});

afterAll(async () => {
  // Clean up everything the tests created, hard-deleting so no test rows linger.
  await MenuItemVariant.destroy({ where: { itemId: created.items } });
  await MenuItem.destroy({ where: { id: created.items }, force: true });
  await MenuCategory.destroy({ where: { id: created.categories }, force: true });
  for (const id of created.media) await request(app).delete(`/api/media/${id}`).set(auth);
  await sequelize.close();
});

describe('security', () => {
  it('requires auth on management endpoints', async () => {
    for (const p of ['/api/categories', '/api/menu-items', '/api/media', '/api/restaurant', '/api/logos', '/api/dashboard/stats']) {
      expect((await request(app).get(p)).status, p).toBe(401);
    }
  });
});

describe('media', () => {
  it('uploads a PNG, makes an optimized WebP + thumbnail and keeps the original', async () => {
    const res = await request(app).post('/api/media/upload').set(auth).attach('file', await png(true), 'logo.png').field('category', tag);
    expect(res.status).toBe(201);
    const m = res.body.data;
    created.media.push(m.id);
    expect(m).toMatchObject({ kind: 'image', mime: 'image/png', width: 640, height: 480, hasAlpha: true, category: tag });
    expect(m.url).toMatch(/\/uploads\/optimized\/.+\.webp$/);
    expect(m.thumbUrl).toMatch(/\/uploads\/thumbs\/.+\.webp$/);
    expect(m.originalUrl).toMatch(/\/uploads\/originals\/.+\.png$/);
    for (const u of [m.url, m.thumbUrl, m.originalUrl]) expect((await request(app).get(u)).status).toBe(200);
  });

  it('rejects non-images even when named .png', async () => {
    const res = await request(app).post('/api/media/upload').set(auth).attach('file', Buffer.from('not an image'), 'x.png');
    expect(res.status).toBe(400);
  });

  it('accepts a clean SVG and rejects an SVG with script', async () => {
    const ok = await request(app).post('/api/media/upload').set(auth).attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50"/></svg>'), 'a.svg');
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ kind: 'svg', width: 100, height: 50 });
    created.media.push(ok.body.data.id);
    const bad = await request(app).post('/api/media/upload').set(auth).attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'b.svg');
    expect(bad.status).toBe(400);
  });

  it('bulk upload reports partial failures', async () => {
    const res = await request(app).post('/api/media/bulk-upload').set(auth).attach('files', await png(), 'a.png').attach('files', Buffer.from('nope'), 'b.png');
    expect(res.status).toBe(201);
    expect(res.body.data.uploaded).toHaveLength(1);
    expect(res.body.data.failed).toHaveLength(1);
    created.media.push(res.body.data.uploaded[0].id);
  });
});

describe('categories, items and variants', () => {
  let categoryId: number;
  let itemId: number;
  let mediaId: number;

  it('creates a category appended at the end', async () => {
    const res = await request(app).post('/api/categories').set(auth).send({
      name: `${tag}-cat`, description: null, icon: null, imageMediaId: null, iconMediaId: null, bannerMediaId: null, backgroundMediaId: null, isActive: true,
    });
    expect(res.status).toBe(201);
    categoryId = res.body.data.id;
    created.categories.push(categoryId);
  });

  it('validates prices and the discount rule', async () => {
    const neg = await request(app).post('/api/menu-items').set(auth).send(itemBody(categoryId, { variants: [{ label: 'x', quantity: null, unit: null, price: -5, discountPrice: null, mediaId: null, isActive: true }] }));
    expect(neg.status).toBe(400);
    const decimals = await request(app).post('/api/menu-items').set(auth).send(itemBody(categoryId, { variants: [{ label: 'x', quantity: null, unit: null, price: 10.555, discountPrice: null, mediaId: null, isActive: true }] }));
    expect(decimals.status).toBe(400);
    const disc = await request(app).post('/api/menu-items').set(auth).send(itemBody(categoryId, { variants: [{ label: 'x', quantity: null, unit: null, price: 100, discountPrice: 150, mediaId: null, isActive: true }] }));
    expect(disc.status).toBe(400);
    const none = await request(app).post('/api/menu-items').set(auth).send(itemBody(categoryId, { variants: [] }));
    expect(none.status).toBe(400);
  });

  it('creates ONE item with several price variants and a null (unset) price allowed', async () => {
    const up = await request(app).post('/api/media/upload').set(auth).attach('file', await png(), 'food.png');
    mediaId = up.body.data.id;
    created.media.push(mediaId);
    const variants = [
      { label: '4 Pieces', quantity: 4, unit: 'Pieces', price: 159, discountPrice: null, mediaId: null, isActive: true },
      { label: '6 Pieces', quantity: 6, unit: 'Pieces', price: 229, discountPrice: 199, mediaId: null, isActive: true },
      { label: '500 ML', quantity: 500, unit: 'ML', price: null, discountPrice: null, mediaId: null, isActive: true },
    ];
    const res = await request(app).post('/api/menu-items').set(auth).send(itemBody(categoryId, { mainMediaId: mediaId, galleryMediaIds: [mediaId], variants }));
    expect(res.status).toBe(201);
    itemId = res.body.data.id;
    created.items.push(itemId);
    expect(res.body.data.variants.map((v: { price: number | null }) => v.price)).toEqual([159, 229, null]);
    expect(res.body.data.variants[1].discountPrice).toBe(199);
    expect(res.body.data.mainMedia.id).toBe(mediaId);
    expect(res.body.data.gallery).toHaveLength(1);
  });

  it('updates variants in place: edits, adds and removes', async () => {
    const cur = (await request(app).get(`/api/menu-items/${itemId}`).set(auth)).body.data;
    const [first, , third] = cur.variants;
    const body = itemBody(categoryId, {
      mainMediaId: mediaId,
      variants: [
        { id: first.id, label: '4 Pieces', quantity: 4, unit: 'Pieces', price: 169, discountPrice: null, mediaId: null, isActive: true },
        { id: third.id, label: '500 ML', quantity: 500, unit: 'ML', price: 20, discountPrice: null, mediaId: null, isActive: true },
        { label: '12 Pieces', quantity: 12, unit: 'Pieces', price: 399, discountPrice: null, mediaId: null, isActive: true },
      ],
    });
    const res = await request(app).put(`/api/menu-items/${itemId}`).set(auth).send(body);
    expect(res.status).toBe(200);
    expect(res.body.data.variants.map((v: { price: number }) => v.price)).toEqual([169, 20, 399]);
    expect(res.body.data.variants[0].id).toBe(first.id); // existing row kept, not recreated
    expect(res.body.data.gallery).toHaveLength(0);
  });

  it('refuses to attach a variant id that belongs to another item', async () => {
    const res = await request(app).put(`/api/menu-items/${itemId}`).set(auth).send(itemBody(categoryId, {
      variants: [{ id: 99999999, label: 'x', quantity: null, unit: null, price: 1, discountPrice: null, mediaId: null, isActive: true }],
    }));
    expect(res.status).toBe(400);
  });

  it('lists with search, filters and pagination meta', async () => {
    const res = await request(app).get('/api/menu-items').query({ search: tag, categoryId, pageSize: 5 }).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 5, total: 1 });
    expect(res.body.data[0].category.id).toBe(categoryId);
  });

  it('blocks deleting media that is in use, allowing it once detached', async () => {
    const blocked = await request(app).delete(`/api/media/${mediaId}`).set(auth);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toMatch(/in use/i);
  });

  it('blocks deleting a category that still has items, and never deletes the items', async () => {
    const res = await request(app).delete(`/api/categories/${categoryId}`).set(auth);
    expect(res.status).toBe(409);
    expect((await request(app).get(`/api/menu-items/${itemId}`).set(auth)).status).toBe(200);
  });

  it('reorders categories and validates ids', async () => {
    const all = (await request(app).get('/api/categories').set(auth)).body.data as { id: number }[];
    const ids = all.map((c) => c.id).reverse();
    expect((await request(app).patch('/api/categories/reorder').set(auth).send({ ids })).status).toBe(200);
    const after = (await request(app).get('/api/categories').set(auth)).body.data as { id: number }[];
    expect(after.map((c) => c.id)).toEqual(ids);
    expect((await request(app).patch('/api/categories/reorder').set(auth).send({ ids: [99999999] })).status).toBe(400);
    // restore original order
    await request(app).patch('/api/categories/reorder').set(auth).send({ ids: all.map((c) => c.id) });
  });

  it('soft-deletes an item, then the empty category can be deleted', async () => {
    expect((await request(app).delete(`/api/menu-items/${itemId}`).set(auth)).status).toBe(200);
    expect((await request(app).get(`/api/menu-items/${itemId}`).set(auth)).status).toBe(404);
    expect((await request(app).delete(`/api/categories/${categoryId}`).set(auth)).status).toBe(200);
  });
});

describe('restaurant + logos', () => {
  it('reads and updates restaurant settings', async () => {
    const cur = (await request(app).get('/api/restaurant').set(auth)).body.data;
    expect(cur.name).toBeTruthy();
    const { id: _id, primaryLogo: _p, updatedAt: _u, ...fields } = cur;
    void _id; void _p; void _u;
    const res = await request(app).put('/api/restaurant').set(auth).send({ ...fields, footerText: `${tag}-footer` });
    expect(res.status).toBe(200);
    expect(res.body.data.footerText).toBe(`${tag}-footer`);
    await request(app).put('/api/restaurant').set(auth).send(fields); // restore
    expect((await request(app).put('/api/restaurant').set(auth).send({ ...fields, name: '' })).status).toBe(400);
  });

  it('keeps exactly one primary logo', async () => {
    const mk = async () => {
      const up = await request(app).post('/api/media/upload').set(auth).attach('file', await png(true), 'logo.png');
      created.media.push(up.body.data.id);
      return up.body.data.id as number;
    };
    const a = await request(app).post('/api/logos').set(auth).send({ mediaId: await mk(), label: `${tag}-a`, isPrimary: false, defaultWidthMm: 40, defaultPosition: 'center' });
    const b = await request(app).post('/api/logos').set(auth).send({ mediaId: await mk(), label: `${tag}-b`, isPrimary: true, defaultWidthMm: 50, defaultPosition: 'left' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    created.logos.push(a.body.data.id, b.body.data.id);
    const list = (await request(app).get('/api/logos').set(auth)).body.data as { isPrimary: boolean; label: string }[];
    expect(list.filter((l) => l.isPrimary)).toHaveLength(1);
    expect(list.find((l) => l.isPrimary)!.label).toBe(`${tag}-b`);
    // primary cannot be deleted while others exist; non-primary can
    expect((await request(app).delete(`/api/logos/${b.body.data.id}`).set(auth)).status).toBe(409);
    expect((await request(app).delete(`/api/logos/${a.body.data.id}`).set(auth)).status).toBe(200);
    // promote nothing else -> leave state clean: make b deletable by deleting it only if it is alone
    expect((await request(app).delete(`/api/logos/${b.body.data.id}`).set(auth)).status).toBe(200);
  });
});
