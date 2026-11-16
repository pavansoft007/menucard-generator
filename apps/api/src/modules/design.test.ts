import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { defaultBackgroundConfig, defaultPageSettings, defaultSectionConfig, defaultThemeConfig, emptyLayout } from '@gc/shared-types';
import { createApp } from '../app.js';
import { sequelize } from '../db/sequelize.js';
import { env } from '../config/env.js';

const app = createApp();
let auth: { Authorization: string };
const get = (p: string) => request(app).get(p).set(auth);
const post = (p: string, b?: unknown) => request(app).post(p).set(auth).send(b as object);
const put = (p: string, b: unknown) => request(app).put(p).set(auth).send(b as object);
const del = (p: string) => request(app).delete(p).set(auth);
const patch = (p: string, b: unknown) => request(app).patch(p).set(auth).send(b as object);

const pageBody = (over: Record<string, unknown> = {}, settings: Record<string, unknown> = {}) => ({
  title: 'Page', subtitle: null, pageType: 'content', themeId: null, isActive: true,
  settings: { ...defaultPageSettings, ...settings }, layout: emptyLayout, ...over,
});
const sectionBody = (over: Record<string, unknown> = {}) => ({
  pageId: null, title: 'Section', subtitle: null, description: null, imageMediaId: null, backgroundId: null,
  categoryIds: [], itemIds: [], comboIds: [], config: defaultSectionConfig, ...over,
});

let categoryId: number;
let itemId: number;
let variantId: number;
let pricelessVariantId: number;
let pricelessItemId: number;

beforeAll(async () => {
  const r = await request(app).post('/api/auth/login').send({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD });
  auth = { Authorization: `Bearer ${r.body.data.token}` };
  const cat = await post('/api/categories', { name: 'Design cat', description: null, icon: null, imageMediaId: null, iconMediaId: null, bannerMediaId: null, backgroundMediaId: null, isActive: true });
  categoryId = cat.body.data.id;
  const mk = async (name: string, price: number | null) => {
    const res = await post('/api/menu-items', {
      categoryId, name, shortDescription: null, description: null, mainMediaId: null, galleryMediaIds: [], dietType: null,
      isBestseller: false, isSpicy: false, isNew: false, isFeatured: false, isAvailable: true, isActive: true,
      variants: [{ label: 'Regular', quantity: null, unit: null, price, discountPrice: null, mediaId: null, isActive: true }],
    });
    return res.body.data as { id: number; variants: { id: number }[] };
  };
  const a = await mk('Wings', 159);
  itemId = a.id;
  variantId = a.variants[0]!.id;
  const b = await mk('Water', null);
  pricelessItemId = b.id;
  pricelessVariantId = b.variants[0]!.id;
});
afterAll(() => sequelize.close());

describe('auth', () => {
  it('protects every Phase 3 endpoint', async () => {
    for (const p of ['/api/themes', '/api/backgrounds', '/api/combos', '/api/menu-pages', '/api/menu-sections', '/api/menu-versions']) {
      expect((await request(app).get(p)).status, p).toBe(401);
    }
  });
});

describe('themes', () => {
  let a: number;
  let b: number;
  it('the first theme becomes the default; defaults and in-use themes cannot be deleted', async () => {
    const t1 = await post('/api/themes', { name: 'Gold', config: defaultThemeConfig });
    expect(t1.status).toBe(201);
    expect(t1.body.data.isDefault).toBe(true);
    a = t1.body.data.id;
    const t2 = await post('/api/themes', { name: 'Light', config: { ...defaultThemeConfig, colors: { ...defaultThemeConfig.colors, background: '#ffffff' } } });
    expect(t2.body.data.isDefault).toBe(false);
    b = t2.body.data.id;
    expect((await del(`/api/themes/${a}`)).status).toBe(409); // default
    await post(`/api/themes/${b}/default`);
    const list = (await get('/api/themes')).body.data as { id: number; isDefault: boolean }[];
    expect(list.filter((t) => t.isDefault).map((t) => t.id)).toEqual([b]);
    const page = await post('/api/menu-pages', pageBody({ themeId: a, title: 'uses theme' }));
    expect((await del(`/api/themes/${a}`)).status).toBe(409); // in use
    await del(`/api/menu-pages/${page.body.data.id}`);
    expect((await del(`/api/themes/${a}`)).status).toBe(200);
  });
  it('rejects invalid colours', async () => {
    const bad = await post('/api/themes', { name: 'Bad', config: { ...defaultThemeConfig, colors: { ...defaultThemeConfig.colors, accent: 'gold' } } });
    expect(bad.status).toBe(400);
  });
});

describe('backgrounds', () => {
  it('validates the config and blocks CSS injection through gradients', async () => {
    const base = { name: 'bg', kind: 'page', mediaId: null };
    expect((await post('/api/backgrounds', { ...base, config: { ...defaultBackgroundConfig, gradient: 'linear-gradient(135deg,#000,#222)' } })).status).toBe(201);
    for (const gradient of ['url(http://evil/x.png)', 'linear-gradient(red,blue); background:url(x)', 'red', 'linear-gradient(url(x),blue)']) {
      expect((await post('/api/backgrounds', { ...base, config: { ...defaultBackgroundConfig, gradient } })).status, gradient).toBe(400);
    }
    expect((await post('/api/backgrounds', { ...base, config: { ...defaultBackgroundConfig, overlayOpacity: 2 } })).status).toBe(400);
  });

  it('protects media and itself while in use', async () => {
    const up = await request(app).post('/api/media/upload').set(auth).attach('file', await sharp({ create: { width: 50, height: 50, channels: 3, background: '#111' } }).png().toBuffer(), 'bg.png');
    const mediaId = up.body.data.id as number;
    const bg = await post('/api/backgrounds', { name: 'textured', kind: 'texture', mediaId, config: defaultBackgroundConfig });
    expect(bg.status).toBe(201);
    expect(bg.body.data.media.id).toBe(mediaId);
    const blocked = await del(`/api/media/${mediaId}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toMatch(/background/);
    // a page using it (settings JSON) blocks deleting the background
    const page = await post('/api/menu-pages', pageBody({ title: 'bg page' }, { backgroundId: bg.body.data.id }));
    expect((await del(`/api/backgrounds/${bg.body.data.id}`)).status).toBe(409);
    await del(`/api/menu-pages/${page.body.data.id}`);
    expect((await del(`/api/backgrounds/${bg.body.data.id}`)).status).toBe(200);
    expect((await del(`/api/media/${mediaId}`)).status).toBe(200);
  });
});

describe('combos', () => {
  it('computes regular total and savings; unknown totals stay null', async () => {
    const ok = await post('/api/combos', { name: 'Combo', description: null, imageMediaId: null, sellingPrice: 129.5, isActive: true, items: [{ itemId, variantId, quantity: 2 }] });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ regularTotal: 318, savings: 188.5, sellingPrice: 129.5 });
    expect(ok.body.data.items[0]).toMatchObject({ itemName: 'Wings', variantLabel: 'Regular', unitPrice: 159, lineTotal: 318 });
    const unknown = await post('/api/combos', { name: 'Unknown', description: null, imageMediaId: null, sellingPrice: 100, isActive: true, items: [{ itemId, variantId, quantity: 1 }, { itemId: pricelessItemId, variantId: pricelessVariantId, quantity: 1 }] });
    expect(unknown.body.data.regularTotal).toBeNull();
    expect(unknown.body.data.savings).toBeNull();
  });
  it('rejects a size that belongs to another item and empty combos', async () => {
    expect((await post('/api/combos', { name: 'x', description: null, imageMediaId: null, sellingPrice: 10, isActive: true, items: [{ itemId, variantId: pricelessVariantId, quantity: 1 }] })).status).toBe(400);
    expect((await post('/api/combos', { name: 'x', description: null, imageMediaId: null, sellingPrice: 10, isActive: true, items: [] })).status).toBe(400);
    expect((await post('/api/combos', { name: 'x', description: null, imageMediaId: null, sellingPrice: -1, isActive: true, items: [{ itemId, variantId, quantity: 1 }] })).status).toBe(400);
  });
});

describe('pages and sections', () => {
  const ids: number[] = [];
  const sec: number[] = [];

  it('stores exact A4 dimensions, swapped for landscape, and ignores client-sent sizes', async () => {
    const p = await post('/api/menu-pages', pageBody({ title: 'P1' }, { size: 'A4', orientation: 'landscape', widthMm: 100, heightMm: 100 }));
    expect(p.status).toBe(201);
    expect(p.body.data.settings).toMatchObject({ widthMm: 297, heightMm: 210 });
    ids.push(p.body.data.id);
    const custom = await post('/api/menu-pages', pageBody({ title: 'P2' }, { size: 'custom', widthMm: 150, heightMm: 200 }));
    expect(custom.body.data.settings).toMatchObject({ widthMm: 150, heightMm: 200 });
    ids.push(custom.body.data.id);
    const third = await post('/api/menu-pages', pageBody({ title: 'P3' }));
    ids.push(third.body.data.id);
    expect(third.body.data.settings).toMatchObject({ widthMm: 210, heightMm: 297 });
  });

  it('rejects margins that leave no room and bad refs', async () => {
    expect((await post('/api/menu-pages', pageBody({}, { marginsMm: { top: 0, right: 100, bottom: 0, left: 100 }, bindingMarginMm: 50 }))).status).toBe(400);
    expect((await post('/api/menu-pages', pageBody({ themeId: 99999999 }))).status).toBe(400);
  });

  it('creates sections with categories and items, appended in order', async () => {
    const s1 = await post('/api/menu-sections', sectionBody({ pageId: ids[0], title: 'S1', categoryIds: [categoryId], itemIds: [itemId] }));
    expect(s1.status).toBe(201);
    expect(s1.body.data).toMatchObject({ categoryIds: [categoryId], itemIds: [itemId], displayOrder: 1 });
    const s2 = await post('/api/menu-sections', sectionBody({ pageId: ids[0], title: 'S2' }));
    expect(s2.body.data.displayOrder).toBe(2);
    sec.push(s1.body.data.id, s2.body.data.id);
    expect((await post('/api/menu-sections', sectionBody({ pageId: ids[0], categoryIds: [99999999] }))).status).toBe(400);
    expect((await post('/api/menu-sections', sectionBody({ pageId: 99999999 }))).status).toBe(400);
    expect((await post('/api/menu-sections', sectionBody({ pageId: ids[0], config: { ...defaultSectionConfig, columns: 99 } }))).status).toBe(400);
  });

  it('reorders sections within a page and refuses mixed pages', async () => {
    expect((await patch('/api/menu-sections/reorder', { pageId: ids[0], ids: [sec[1], sec[0]] })).status).toBe(200);
    expect((await get(`/api/menu-sections?pageId=${ids[0]}`)).body.data.map((s: { id: number }) => s.id)).toEqual([sec[1], sec[0]]);
    expect((await patch('/api/menu-sections/reorder', { pageId: ids[1], ids: [sec[0]] })).status).toBe(400);
  });

  it('moves a section to another page (appended) and keeps its links', async () => {
    const cur = (await get(`/api/menu-sections/${sec[0]}`)).body.data;
    const moved = await put(`/api/menu-sections/${sec[0]}`, sectionBody({ pageId: ids[1], title: cur.title, categoryIds: cur.categoryIds, itemIds: cur.itemIds }));
    expect(moved.status).toBe(200);
    expect(moved.body.data).toMatchObject({ pageId: ids[1], displayOrder: 1, categoryIds: [categoryId], itemIds: [itemId] });
  });

  it('duplicates a section', async () => {
    const copy = await post(`/api/menu-sections/${sec[0]}/duplicate`);
    expect(copy.status).toBe(201);
    expect(copy.body.data.title).toMatch(/\(copy\)$/);
    expect(copy.body.data.categoryIds).toEqual([categoryId]);
    sec.push(copy.body.data.id);
  });

  it('hides links to soft-deleted items instead of returning dangling ids', async () => {
    const tmp = await post('/api/menu-items', {
      categoryId, name: 'Temp', shortDescription: null, description: null, mainMediaId: null, galleryMediaIds: [], dietType: null,
      isBestseller: false, isSpicy: false, isNew: false, isFeatured: false, isAvailable: true, isActive: true,
      variants: [{ label: 'R', quantity: null, unit: null, price: 5, discountPrice: null, mediaId: null, isActive: true }],
    });
    const s = await post('/api/menu-sections', sectionBody({ pageId: ids[2], title: 'tmp', itemIds: [tmp.body.data.id] }));
    expect(s.body.data.itemIds).toEqual([tmp.body.data.id]);
    await del(`/api/menu-items/${tmp.body.data.id}`);
    expect((await get(`/api/menu-sections/${s.body.data.id}`)).body.data.itemIds).toEqual([]);
  });

  it('duplicates a page with its sections right after the original', async () => {
    const copy = await post(`/api/menu-pages/${ids[1]}/duplicate`);
    expect(copy.status).toBe(201);
    expect(copy.body.data.title).toBe('P2 (copy)');
    expect(copy.body.data.sections.length).toBeGreaterThan(0);
    expect(copy.body.data.sections[0].categoryIds).toEqual([categoryId]);
    const order = (await get('/api/menu-pages')).body.data.map((p: { title: string }) => p.title);
    expect(order.indexOf('P2 (copy)')).toBe(order.indexOf('P2') + 1);
    ids.push(copy.body.data.id);
  });

  it('reorders pages', async () => {
    const all = (await get('/api/menu-pages')).body.data.map((p: { id: number }) => p.id) as number[];
    expect((await patch('/api/menu-pages/reorder', { ids: [...all].reverse() })).status).toBe(200);
    expect((await get('/api/menu-pages')).body.data.map((p: { id: number }) => p.id)).toEqual([...all].reverse());
  });

  it('deleting a page removes its sections but never the categories or items', async () => {
    expect((await del(`/api/menu-pages/${ids[1]}`)).status).toBe(200);
    expect((await get(`/api/menu-sections/${sec[0]}`)).status).toBe(404);
    expect((await get(`/api/menu-items/${itemId}`)).status).toBe(200);
    expect((await get('/api/categories')).body.data.some((c: { id: number }) => c.id === categoryId)).toBe(true);
  });
});

describe('versions', () => {
  it('snapshots the design, restores it, and keeps a backup of what it replaced', async () => {
    const before = (await get('/api/menu-pages')).body.data as { title: string }[];
    const v = await post('/api/menu-versions', { label: 'Draft A', status: 'draft' });
    expect(v.status).toBe(201);
    expect(v.body.data).toMatchObject({ status: 'draft', pageCount: before.length });

    // change the design after the snapshot
    const first = (await get('/api/menu-pages')).body.data[0] as { id: number };
    await del(`/api/menu-pages/${first.id}`);
    await post('/api/menu-pages', pageBody({ title: 'Added later' }));
    expect(((await get('/api/menu-pages')).body.data as { title: string }[]).some((p) => p.title === 'Added later')).toBe(true);

    const restored = await post(`/api/menu-versions/${v.body.data.id}/restore`);
    expect(restored.status).toBe(200);
    const after = (await get('/api/menu-pages')).body.data as { title: string }[];
    expect(after.map((p) => p.title).sort()).toEqual(before.map((p) => p.title).sort());
    expect(after.some((p) => p.title === 'Added later')).toBe(false);

    const list = (await get('/api/menu-versions')).body.data as { id: number; label: string }[];
    expect(list.some((x) => x.id === restored.body.data.backupVersionId && /Before restoring/.test(x.label))).toBe(true);
  });

  it('publishing is recorded and shown on the dashboard', async () => {
    const pub = await post('/api/menu-versions', { label: null, status: 'published' });
    expect(pub.body.data.status).toBe('published');
    const stats = (await get('/api/dashboard/stats')).body.data;
    expect(stats.lastPublishedAt).toBeTruthy();
    expect(stats.totalPages).toBeGreaterThan(0);
  });

  it('unknown version -> 404', async () => {
    expect((await post('/api/menu-versions/99999999/restore')).status).toBe(404);
  });
});

describe('layout json and section combos', () => {
  const textEl = {
    id: 'el_1', type: 'text', name: null, x: 10, y: 10, w: 100, h: 12, rotation: 0, z: 1, locked: false, hidden: false, opacity: 1,
    content: '{{restaurant.name}}', role: 'heading', font: null, fontSizePt: 24, fontWeight: 700, italic: false, color: 'theme:heading',
    align: 'center', verticalAlign: 'middle', lineHeight: 1.2, letterSpacingPt: 0, uppercase: false,
  };
  it('stores a structured layout and rejects malformed elements', async () => {
    const ok = await post('/api/menu-pages', pageBody({ title: 'layout', layout: { version: 1, elements: [textEl] } }));
    expect(ok.status).toBe(201);
    expect(ok.body.data.layout.elements[0]).toMatchObject({ type: 'text', content: '{{restaurant.name}}' });
    expect(ok.body.data.updatedAt).toBeTruthy();
    const bad = [
      { ...textEl, color: 'gold' },
      { ...textEl, w: -5 },
      { ...textEl, type: 'video' },
      { ...textEl, fontSizePt: 9999 },
    ];
    for (const el of bad) expect((await post('/api/menu-pages', pageBody({ layout: { version: 1, elements: [el] } }))).status).toBe(400);
    await del(`/api/menu-pages/${ok.body.data.id}`);
  });

  it('links combos to a section and drops them when the combo is deleted', async () => {
    const combo = await post('/api/combos', { name: 'Sec combo', description: null, imageMediaId: null, sellingPrice: 100, isActive: true, items: [{ itemId, variantId, quantity: 1 }] });
    const page = await post('/api/menu-pages', pageBody({ title: 'combo page' }));
    const s = await post('/api/menu-sections', sectionBody({ pageId: page.body.data.id, comboIds: [combo.body.data.id] }));
    expect(s.status).toBe(201);
    expect(s.body.data.comboIds).toEqual([combo.body.data.id]);
    expect((await post('/api/menu-sections', sectionBody({ pageId: page.body.data.id, comboIds: [99999999] }))).status).toBe(400);
    await del(`/api/combos/${combo.body.data.id}`);
    expect((await get(`/api/menu-sections/${s.body.data.id}`)).body.data.comboIds).toEqual([]);
    await del(`/api/menu-pages/${page.body.data.id}`);
  });
});
