import { defaultSectionConfig, type ApplyDesignInput, type DesignTemplate, type PageDTO, type PageSettings, type SectionConfig, type SectionDTO } from '@gc/shared-types';
import { itemsForSection, type MenuData } from '../../renderer/menuData';

/** How cards are chosen: by whether the section's items have photos, or forced one way (to preview a look with photos). */
export type CardMode = 'auto' | 'photos' | 'lists';

export interface PlanOptions {
  pageIds: number[];
  cardMode: CardMode;
}

export interface DesignPlan {
  pages: { id: number; settings: PageSettings }[];
  sections: { id: number; config: SectionConfig }[];
  /** Per section: whether the photo card style was chosen (used to explain the result in the UI). */
  photoSections: number;
  listSections: number;
}

const PHOTO_SHARE = 0.5;

/** Share of a section's items that have a photo (0 when it has none). */
export function photoShare(section: SectionDTO, data: MenuData): number {
  const items = itemsForSection(section, data);
  return items.length ? items.filter((i) => i.mainMedia).length / items.length : 0;
}

/** Page-level settings a template controls: frame, header band, logo size. Margins, size and content settings stay yours. */
export function pageSettingsFor(t: DesignTemplate, page: Pick<PageDTO, 'settings' | 'pageType'>): PageSettings {
  const s = page.settings;
  const isContent = page.pageType === 'content';
  return {
    ...s,
    border: t.page.border,
    // The icon band belongs on menu pages; covers and back covers keep their own composition and just get a larger logo.
    header: isContent ? t.page.header : { ...t.page.header, enabled: false },
    logo: { ...s.logo, widthMm: isContent ? t.page.logoWidthMm : Math.max(t.page.logoWidthMm, 60) },
    footer: { ...s.footer, enabled: true, useRestaurantInfo: true },
  };
}

export function sectionConfigFor(t: DesignTemplate, section: SectionDTO, data: MenuData, mode: CardMode): { config: SectionConfig; photo: boolean } {
  const s = t.sections;
  const keepsCombo = section.config.cardTemplate === 'combo';
  const photo = mode === 'photos' || (mode === 'auto' && photoShare(section, data) >= PHOTO_SHARE);
  const cardTemplate = keepsCombo ? 'combo' : photo ? s.photoCard : s.listCard;
  return {
    photo: !keepsCombo && photo,
    config: {
      ...defaultSectionConfig,
      ...section.config, // keep the user's description / price / quantity switches and row limit
      cardTemplate,
      columns: photo ? s.photoColumns : s.listColumns,
      widthPct: 100,
      heightMm: null,
      headingStyle: s.headingStyle,
      priceStyle: s.priceStyle,
      imagePosition: s.imagePosition,
      border: { ...section.config.border, enabled: false },
    },
  };
}

/** What applying a template to the chosen pages would change. Pure: used for the live preview and for the API request. */
export function buildDesignPlan(t: DesignTemplate, data: MenuData, o: PlanOptions): DesignPlan {
  const targets = data.pages.filter((p) => o.pageIds.includes(p.id));
  let photoSections = 0;
  let listSections = 0;
  const sections: DesignPlan['sections'] = [];
  for (const sec of data.sections) {
    if (sec.pageId === null || !targets.some((p) => p.id === sec.pageId)) continue;
    const r = sectionConfigFor(t, sec, data, o.cardMode);
    if (r.config.cardTemplate !== 'combo') {
      if (r.photo) photoSections++;
      else listSections++;
    }
    sections.push({ id: sec.id, config: r.config });
  }
  return { pages: targets.map((p) => ({ id: p.id, settings: pageSettingsFor(t, p) })), sections, photoSections, listSections };
}

/** The API request for a plan. */
export function toApplyRequest(t: DesignTemplate, plan: DesignPlan, o: { makeDefaultTheme: boolean; resetLayouts: boolean; backup: boolean }): ApplyDesignInput {
  return {
    templateId: t.id,
    theme: { name: t.name, config: t.theme },
    background: { name: t.background.name, kind: 'page', mediaId: null, config: t.background.config },
    makeDefaultTheme: o.makeDefaultTheme,
    resetLayouts: o.resetLayouts,
    backup: o.backup,
    pages: plan.pages,
    sections: plan.sections,
  };
}

const VIRTUAL_ID = -1;

/** Approximate height of one row of cards (mm) per card style, used only to keep previews within one page. */
const ROW_MM: Record<string, number> = { 'hero-ribbon': 47, 'image-top': 64, poster: 48, 'image-left': 35, 'circle-photo': 28, 'compact-list': 12, premium: 64, featured: 82, combo: 64 };
const PREVIEW_ROOM_MM = 226; // page height minus header band, headings and footer

/**
 * Previews show a *typical* page: if the sample page holds more rows than fit, the largest sections are trimmed
 * (preview only – applying a template never hides anything, and the export tells you when real content doesn't fit).
 */
function fitPreviewRows(sections: DesignPlan['sections'], data: MenuData): DesignPlan['sections'] {
  const info = sections.map((s) => {
    const dto = data.sections.find((x) => x.id === s.id)!;
    const items = s.config.cardTemplate === 'combo' ? dto.comboIds.length : itemsForSection(dto, data).length;
    const rows = Math.max(1, Math.ceil(items / s.config.columns));
    return { s, rows, rowMm: ROW_MM[s.config.cardTemplate] ?? 50 };
  });
  const total = () => info.reduce((n, x) => n + x.rows * x.rowMm + 14, 0);
  while (total() > PREVIEW_ROOM_MM) {
    const biggest = info.filter((x) => x.rows > 1).sort((a, b) => b.rows * b.rowMm - a.rows * a.rowMm)[0];
    if (!biggest) break;
    biggest.rows--;
  }
  return info.map((x) => ({ ...x.s, config: { ...x.s.config, rows: x.rows } }));
}

/**
 * A copy of the menu data with the template applied *in memory* (nothing is saved): used by the gallery, the large
 * preview and the template render route. Pages get a virtual theme/background and an empty layout, so they are laid
 * out automatically in the new style.
 */
export function previewData(t: DesignTemplate, data: MenuData, o: PlanOptions): MenuData {
  const plan = buildDesignPlan(t, data, o);
  const pageSettings = new Map(plan.pages.map((p) => [p.id, p.settings]));
  const sectionConfig = new Map(fitPreviewRows(plan.sections, data).map((s) => [s.id, s.config]));
  const pages = data.pages.map((p) => {
    const settings = pageSettings.get(p.id);
    if (!settings) return p;
    return {
      ...p,
      themeId: VIRTUAL_ID,
      settings: { ...settings, backgroundId: VIRTUAL_ID },
      layout: { version: 1 as const, elements: [] },
      sections: p.sections?.map((s) => (sectionConfig.has(s.id) ? { ...s, config: sectionConfig.get(s.id)! } : s)),
    };
  });
  return {
    ...data,
    themes: [{ id: VIRTUAL_ID, name: t.name, isDefault: false, config: t.theme, pageCount: 0 }, ...data.themes],
    backgrounds: [{ id: VIRTUAL_ID, name: t.background.name, kind: 'page', media: null, config: t.background.config }, ...data.backgrounds],
    pages,
    sections: pages.flatMap((p) => p.sections ?? []),
  };
}

/** The page used to preview templates: the first content page that has sections (else the first active page). */
export function samplePage(data: MenuData): PageDTO | undefined {
  const active = data.pages.filter((p) => p.isActive);
  return active.find((p) => p.pageType === 'content' && (p.sections?.length ?? 0) > 0) ?? active[0];
}
