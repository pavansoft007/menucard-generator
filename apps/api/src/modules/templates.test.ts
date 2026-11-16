import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  backgroundConfigSchema,
  defaultPageSettings,
  defaultSectionConfig,
  designTemplates,
  emptyLayout,
  headingStyleKinds,
  pageSettingsSchema,
  sectionConfigSchema,
  templateFamilies,
  themeConfigSchema,
  type DesignTemplate,
} from '@gc/shared-types';
import { createApp } from '../app.js';
import { sequelize } from '../db/sequelize.js';
import { env } from '../config/env.js';

/* ---- WCAG contrast ------------------------------------------------------------------------------------------ */
const lum = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
};
const contrast = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi! + 0.05) / (lo! + 0.05); };

describe('template catalogue', () => {
  it('ships 24 templates in 6 families of 4, with unique ids and names', () => {
    expect(designTemplates).toHaveLength(24);
    expect(templateFamilies).toHaveLength(6);
    expect(new Set(designTemplates.map((t) => t.id)).size).toBe(24);
    expect(new Set(designTemplates.map((t) => t.name)).size).toBe(24);
    for (const f of templateFamilies) expect(designTemplates.filter((t) => t.family === f.id), f.id).toHaveLength(4);
  });

  it('offers real variety: several moods, fonts, card styles and heading styles', () => {
    expect(new Set(designTemplates.map((t) => t.mood))).toEqual(new Set(['dark', 'light', 'vivid']));
    expect(new Set(designTemplates.map((t) => t.theme.fonts.heading)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(designTemplates.map((t) => t.sections.photoCard)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(designTemplates.map((t) => t.theme.card?.surface)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(designTemplates.map((t) => t.page.border.style)).size).toBeGreaterThanOrEqual(4);
    // two colourways of one family must differ visibly
    for (const f of templateFamilies) {
      const bgs = designTemplates.filter((t) => t.family === f.id).map((t) => t.theme.colors.accent);
      expect(new Set(bgs).size, f.id).toBe(4);
    }
  });

  it.each(designTemplates.map((t) => [t.id, t] as const))('%s validates against every schema it feeds', (_id, t: DesignTemplate) => {
    expect(themeConfigSchema.safeParse(t.theme).error?.issues ?? []).toEqual([]);
    expect(backgroundConfigSchema.safeParse(t.background.config).error?.issues ?? []).toEqual([]);
    const page = { ...defaultPageSettings, border: t.page.border, header: t.page.header, logo: { ...defaultPageSettings.logo, widthMm: t.page.logoWidthMm } };
    expect(pageSettingsSchema.safeParse(page).error?.issues ?? []).toEqual([]);
    const sec = (card: DesignTemplate['sections']['photoCard']) => ({ ...defaultSectionConfig, cardTemplate: card, columns: t.sections.photoColumns, headingStyle: t.sections.headingStyle, priceStyle: t.sections.priceStyle, imagePosition: t.sections.imagePosition });
    expect(sectionConfigSchema.safeParse(sec(t.sections.photoCard)).error?.issues ?? []).toEqual([]);
    expect(sectionConfigSchema.safeParse(sec(t.sections.listCard)).error?.issues ?? []).toEqual([]);
    expect(headingStyleKinds).toContain(t.theme.headerStyle);
    expect(t.swatch).toHaveLength(4);
  });

  it.each(designTemplates.map((t) => [t.id, t] as const))('%s keeps all text readable (WCAG contrast)', (_id, t: DesignTemplate) => {
    const c = t.theme.colors;
    const bg = t.background.config.color ?? c.background;
    expect(bg.toLowerCase(), 'page colour matches the theme background').toBe(c.background.toLowerCase());
    expect(contrast(c.text, c.background), 'body text on page').toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.text, c.surface), 'body text on cards').toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.heading, c.background), 'headings on page').toBeGreaterThanOrEqual(3);
    expect(contrast(c.heading, c.surface), 'item names on cards').toBeGreaterThanOrEqual(3);
    expect(contrast(c.priceBadgeText, c.priceBadgeBg), 'price pill text').toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.accent, c.background), 'accent / lines on page').toBeGreaterThanOrEqual(3);
    expect(contrast('#FFFFFF', c.special), 'white ribbon text on the ribbon colour').toBeGreaterThanOrEqual(3);
  });
});

/* ---- applying -------------------------------------------------------------------------------------------- */
const app = createApp();
const tpl = designTemplates.find((t) => t.id === 'neon-feast-gold')!;
const pageSettingsFor = (t: DesignTemplate, over: Record<string, unknown> = {}) => ({ ...defaultPageSettings, border: t.page.border, header: t.page.header, logo: { ...defaultPageSettings.logo, widthMm: t.page.logoWidthMm }, ...over });
const body = (t: DesignTemplate, pages: number[], sections: number[], over: Record<string, unknown> = {}) => ({
  templateId: t.id,
  theme: { name: t.name, config: t.theme },
  background: { name: t.background.name, kind: 'page', mediaId: null, config: t.background.config },
  makeDefaultTheme: false,
  resetLayouts: true,
  backup: true,
  pages: pages.map((id) => ({ id, settings: pageSettingsFor(t) })),
  sections: sections.map((id) => ({ id, config: { ...defaultSectionConfig, cardTemplate: t.sections.photoCard, headingStyle: t.sections.headingStyle, priceStyle: t.sections.priceStyle } })),
  ...over,
});

describe('applying a template', () => {
  let auth: { Authorization: string };
  let pageA: number;
  let pageB: number;
  let sectionA: number;
  const get = (p: string) => request(app).get(p).set(auth);
  const post = (p: string, b?: unknown) => request(app).post(p).set(auth).send(b as object);

  beforeAll(async () => {
    const r = await request(app).post('/api/auth/login').send({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD });
    auth = { Authorization: `Bearer ${r.body.data.token}` };
    const mkPage = async (title: string) => (await post('/api/menu-pages', { title, subtitle: null, pageType: 'content', themeId: null, isActive: true, settings: defaultPageSettings, layout: { version: 1, elements: [{ id: 'keep', type: 'shape', name: null, x: 10, y: 10, w: 20, h: 20, rotation: 0, z: 1, locked: false, hidden: false, opacity: 1, shape: 'rect', fill: '#FF0000', borderColor: null, borderWidthMm: 0, radiusMm: 0 }] } })).body.data.id as number;
    pageA = await mkPage('Tpl A');
    pageB = await mkPage('Tpl B');
    sectionA = (await post('/api/menu-sections', { pageId: pageA, title: 'S', subtitle: null, description: null, imageMediaId: null, backgroundId: null, categoryIds: [], itemIds: [], comboIds: [], config: defaultSectionConfig })).body.data.id;
  });
  afterAll(() => sequelize.close());

  it('restyles pages and sections, resets layouts, and leaves other pages alone', async () => {
    const res = await post('/api/design/apply', body(tpl, [pageA], [sectionA]));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ pagesUpdated: 1, sectionsUpdated: 1 });
    const a = (await get(`/api/menu-pages/${pageA}`)).body.data;
    expect(a.themeId).toBe(res.body.data.themeId);
    expect(a.settings.backgroundId).toBe(res.body.data.backgroundId);
    expect(a.settings.border.style).toBe('glow');
    expect(a.settings.header).toMatchObject({ layout: 'banner', title: 'Menu' });
    expect(a.layout.elements).toEqual([]); // reset so the new design lays itself out
    expect(a.sections[0].config).toMatchObject({ cardTemplate: 'hero-ribbon', headingStyle: 'glow-banner', priceStyle: 'pill-gold' });
    const b = (await get(`/api/menu-pages/${pageB}`)).body.data;
    expect(b.themeId).toBeNull();
    expect(b.layout.elements).toHaveLength(1); // untouched
  });

  it('keeps hand-made layouts when asked, and is idempotent (no duplicate theme or background)', async () => {
    const first = (await post('/api/design/apply', body(tpl, [pageB], [], { resetLayouts: false, backup: false }))).body.data;
    expect((await get(`/api/menu-pages/${pageB}`)).body.data.layout.elements).toHaveLength(1);
    const second = (await post('/api/design/apply', body(tpl, [pageB], [], { resetLayouts: false, backup: false }))).body.data;
    expect(second.themeId).toBe(first.themeId);
    expect(second.backgroundId).toBe(first.backgroundId);
    const themes = (await get('/api/themes')).body.data as { name: string }[];
    expect(themes.filter((t) => t.name === tpl.name)).toHaveLength(1);
    const bgs = (await get('/api/backgrounds')).body.data as { name: string }[];
    expect(bgs.filter((b) => b.name === tpl.background.name)).toHaveLength(1);
  });

  it('saves a restorable backup version first, and can make the theme the default', async () => {
    const before = (await get('/api/menu-versions')).body.data.length;
    const other = designTemplates.find((t) => t.id === 'royal-classic-ivory')!;
    const res = await post('/api/design/apply', body(other, [pageA], [], { backup: true, makeDefaultTheme: true }));
    expect(res.body.data.backupVersionId).toBeGreaterThan(0);
    const versions = (await get('/api/menu-versions')).body.data as { id: number; label: string; status: string }[];
    expect(versions.length).toBe(before + 1);
    expect(versions.find((v) => v.id === res.body.data.backupVersionId)).toMatchObject({ status: 'draft' });
    expect(versions.find((v) => v.id === res.body.data.backupVersionId)!.label).toMatch(/^Before applying/);
    const themes = (await get('/api/themes')).body.data as { id: number; isDefault: boolean }[];
    expect(themes.filter((t) => t.isDefault).map((t) => t.id)).toEqual([res.body.data.themeId]);
  });

  it('rolls back completely when anything is invalid, and rejects bad payloads', async () => {
    const before = (await get(`/api/menu-pages/${pageA}`)).body.data;
    const themeCount = (await get('/api/themes')).body.data.length;
    const unknownTpl = { ...tpl, name: 'Should Never Exist', id: 'x' } as DesignTemplate;
    const bad = await post('/api/design/apply', body(unknownTpl, [pageA, 99999999], [], { backup: false }));
    expect(bad.status).toBe(400);
    expect((await get('/api/themes')).body.data).toHaveLength(themeCount); // no theme created
    expect((await get(`/api/menu-pages/${pageA}`)).body.data.themeId).toBe(before.themeId);
    // a section that is not on the selected pages
    expect((await post('/api/design/apply', body(tpl, [pageB], [sectionA], { backup: false }))).status).toBe(400);
    // schema violations
    expect((await post('/api/design/apply', { ...body(tpl, [pageA], []), pages: [] })).status).toBe(400);
    expect((await post('/api/design/apply', body(tpl, [pageA], [], { background: { ...body(tpl, [pageA], []).background, mediaId: 5 } }))).status).toBe(400);
    const badColour = body(tpl, [pageA], [], { theme: { name: 'x', config: { ...tpl.theme, colors: { ...tpl.theme.colors, accent: 'gold' } } } });
    expect((await post('/api/design/apply', badColour)).status).toBe(400);
    expect((await request(app).post('/api/design/apply').send(body(tpl, [pageA], []))).status).toBe(401);
  });

  it('accepts the new element types and style options in layouts', async () => {
    const el = (extra: object) => ({ id: `n${Math.random().toString(36).slice(2, 7)}`, name: null, x: 10, y: 10, w: 20, h: 20, rotation: 0, z: 1, locked: false, hidden: false, opacity: 1, ...extra });
    const layout = { version: 1, elements: [el({ type: 'icon', icon: 'drumstick', color: 'theme:accent', strokeMm: 0.5 }), el({ type: 'ornament', kind: 'diamond', color: '#FFFFFF', strokeMm: 0.3 })] };
    const ok = await request(app).put(`/api/menu-pages/${pageA}`).set(auth).send({ title: 'Tpl A', subtitle: null, pageType: 'content', themeId: null, isActive: true, settings: defaultPageSettings, layout });
    expect(ok.status).toBe(200);
    for (const bad of [{ type: 'icon', icon: 'rocket', color: '#fff', strokeMm: 0.5 }, { type: 'ornament', kind: 'nope', color: '#fff', strokeMm: 0.3 }]) {
      const res = await request(app).put(`/api/menu-pages/${pageA}`).set(auth).send({ title: 'x', subtitle: null, pageType: 'content', themeId: null, isActive: true, settings: defaultPageSettings, layout: { version: 1, elements: [el(bad)] } });
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
    void emptyLayout;
  });
});
