import { describe, expect, it } from 'vitest';
import { applyDesignSchema, defaultPageSettings, defaultSectionConfig, designTemplates, emptyLayout, getDesignTemplate, type ItemDTO, type MediaDTO, type PageDTO, type SectionDTO } from '@gc/shared-types';
import { emptyMenuData, type MenuData } from '../../renderer/menuData';
import { buildDesignPlan, photoShare, previewData, samplePage, toApplyRequest } from './designPlan';

const media = { id: 1, url: '/x.webp', thumbUrl: '/t.webp', originalUrl: '/x.png', originalName: 'x', kind: 'image', mime: 'image/png' } as unknown as MediaDTO;
const item = (id: number, categoryId: number, photo: boolean): ItemDTO => ({ id, categoryId, category: null, name: `Item ${id}`, shortDescription: null, description: null, dietType: null, isBestseller: false, isSpicy: false, isNew: false, isFeatured: false, isAvailable: true, isActive: true, displayOrder: id, mainMedia: photo ? media : null, gallery: [], variants: [] });
const section = (id: number, pageId: number, categoryId: number, over: Partial<SectionDTO> = {}): SectionDTO => ({ id, pageId, title: `S${id}`, subtitle: null, description: null, displayOrder: id, image: null, backgroundId: null, categoryIds: [categoryId], itemIds: [], comboIds: [], config: defaultSectionConfig, ...over });
const page = (id: number, pageType: PageDTO['pageType'], sections: SectionDTO[]): PageDTO => ({ id, title: `P${id}`, subtitle: null, pageType, themeId: null, isActive: true, displayOrder: id, settings: defaultPageSettings, layout: { ...emptyLayout, elements: [{ id: 'e', type: 'shape' } as never] }, sectionCount: sections.length, updatedAt: '', sections });

// Category 1: 4 of 4 items have photos. Category 2: none. Category 3: 1 of 4 (below the 50% line).
const items = [...[1, 2, 3, 4].map((i) => item(i, 1, true)), ...[5, 6, 7, 8].map((i) => item(i, 2, false)), item(9, 3, true), ...[10, 11, 12].map((i) => item(i, 3, false))];
const sPhoto = section(1, 2, 1);
const sList = section(2, 2, 2);
const sMixed = section(3, 2, 3);
const sCombo = section(4, 2, 1, { config: { ...defaultSectionConfig, cardTemplate: 'combo' } });
const sOther = section(5, 3, 1);
const pages = [page(1, 'cover', []), page(2, 'content', [sPhoto, sList, sMixed, sCombo]), page(3, 'content', [sOther])];
const data: MenuData = { ...emptyMenuData, items, pages, sections: pages.flatMap((p) => p.sections ?? []) };
const tpl = getDesignTemplate('neon-feast-gold')!;

describe('buildDesignPlan', () => {
  it('measures how many of a section’s items have photos', () => {
    expect(photoShare(sPhoto, data)).toBe(1);
    expect(photoShare(sList, data)).toBe(0);
    expect(photoShare(sMixed, data)).toBe(0.25);
  });

  it('automatic mode: photo cards where there are photos, text lists where there are not, combos untouched', () => {
    const plan = buildDesignPlan(tpl, data, { pageIds: [2], cardMode: 'auto' });
    const cfg = (id: number) => plan.sections.find((s) => s.id === id)!.config;
    expect(cfg(1)).toMatchObject({ cardTemplate: 'hero-ribbon', columns: 2, headingStyle: 'glow-banner', priceStyle: 'pill-gold' });
    expect(cfg(2).cardTemplate).toBe('compact-list');
    expect(cfg(3).cardTemplate).toBe('compact-list'); // only 25% have photos
    expect(cfg(4).cardTemplate).toBe('combo');
    expect([plan.photoSections, plan.listSections]).toEqual([1, 2]);
  });

  it('forced modes override the photo check', () => {
    const photos = buildDesignPlan(tpl, data, { pageIds: [2], cardMode: 'photos' });
    expect(photos.sections.filter((s) => s.config.cardTemplate === 'hero-ribbon')).toHaveLength(3);
    const lists = buildDesignPlan(tpl, data, { pageIds: [2], cardMode: 'lists' });
    expect(lists.sections.filter((s) => s.config.cardTemplate === 'compact-list')).toHaveLength(3);
  });

  it('only touches the selected pages and their sections', () => {
    const plan = buildDesignPlan(tpl, data, { pageIds: [2], cardMode: 'auto' });
    expect(plan.pages.map((p) => p.id)).toEqual([2]);
    expect(plan.sections.map((s) => s.id).sort()).toEqual([1, 2, 3, 4]);
    expect(plan.sections.some((s) => s.id === 5)).toBe(false);
  });

  it('gives content pages the header band, but covers only a bigger logo', () => {
    const plan = buildDesignPlan(tpl, data, { pageIds: [1, 2], cardMode: 'auto' });
    const cover = plan.pages.find((p) => p.id === 1)!.settings;
    const content = plan.pages.find((p) => p.id === 2)!.settings;
    expect(content.header).toMatchObject({ enabled: true, layout: 'banner', title: 'Menu' });
    expect(cover.header.enabled).toBe(false);
    expect(cover.logo.widthMm).toBeGreaterThanOrEqual(60);
    expect(content.border.style).toBe('glow');
    expect(content.marginsMm).toEqual(defaultPageSettings.marginsMm); // size and margins stay the user's
    expect(content.footer).toMatchObject({ enabled: true, useRestaurantInfo: true });
  });

  it('keeps the user’s own section switches (description / price / quantity / row limit)', () => {
    const custom = section(9, 2, 1, { config: { ...defaultSectionConfig, showDescription: false, showQuantity: false, rows: 2 } });
    const d: MenuData = { ...data, pages: [page(2, 'content', [custom])], sections: [custom] };
    const cfg = buildDesignPlan(tpl, d, { pageIds: [2], cardMode: 'photos' }).sections[0]!.config;
    expect(cfg).toMatchObject({ showDescription: false, showQuantity: false, rows: 2 });
  });

  it('produces a request the server accepts for EVERY template', () => {
    for (const t of designTemplates) {
      const plan = buildDesignPlan(t, data, { pageIds: [1, 2, 3], cardMode: 'auto' });
      const req = toApplyRequest(t, plan, { makeDefaultTheme: true, resetLayouts: true, backup: true });
      const parsed = applyDesignSchema.safeParse(req);
      expect(parsed.error?.issues ?? [], t.id).toEqual([]);
    }
  });
});

describe('previewData', () => {
  it('applies the design in memory without mutating the real data', () => {
    const before = JSON.stringify(data.pages);
    const prev = previewData(tpl, data, { pageIds: [2], cardMode: 'photos' });
    expect(JSON.stringify(data.pages)).toBe(before);
    const p2 = prev.pages.find((p) => p.id === 2)!;
    expect(p2.themeId).toBe(-1);
    expect(p2.settings.backgroundId).toBe(-1);
    expect(p2.layout.elements).toEqual([]); // empty, not blank: laid out automatically
    expect(p2.layout.blank).toBeUndefined();
    expect(prev.themes[0]).toMatchObject({ id: -1, name: tpl.name });
    expect(prev.backgrounds[0]).toMatchObject({ id: -1 });
    // other pages are left exactly as they were
    expect(prev.pages.find((p) => p.id === 3)).toEqual(data.pages.find((p) => p.id === 3));
  });

  it('trims preview rows to what fits one page, but never below one row and never in the apply plan', () => {
    const many = Array.from({ length: 40 }, (_, i) => item(100 + i, 7, true));
    const big = section(50, 2, 7);
    const d: MenuData = { ...data, items: [...items, ...many], pages: [page(2, 'content', [big])], sections: [big] };
    const prev = previewData(tpl, d, { pageIds: [2], cardMode: 'photos' });
    const rows = prev.sections[0]!.config.rows!;
    expect(rows).toBeGreaterThanOrEqual(1);
    expect(rows * 2).toBeLessThan(40); // trimmed for the preview
    const plan = buildDesignPlan(tpl, d, { pageIds: [2], cardMode: 'photos' });
    expect(plan.sections[0]!.config.rows).toBeNull(); // applying hides nothing
  });
});

describe('samplePage', () => {
  it('prefers an active content page that has sections', () => {
    expect(samplePage(data)?.id).toBe(2);
    expect(samplePage({ ...emptyMenuData, pages: [] })).toBeUndefined();
    const inactive = { ...data, pages: data.pages.map((p) => ({ ...p, isActive: p.id === 1 })) };
    expect(samplePage(inactive)?.id).toBe(1);
  });
});
