import type { LayoutElement, PageDTO, PageSettings, SectionDTO } from '@gc/shared-types';
import { combosForSection, itemsForSection, type MenuData } from './menuData';
import { safeArea } from './geometry';
import { makeHeading, makeSection, makeText } from '../editor/elements';

/** Rough natural height of a section in mm, used for the first arrangement (the editor measures the real height afterwards). */
export function estimateSectionHeight(section: SectionDTO, data: MenuData, widthMm: number): number {
  const c = section.config;
  const isCombo = c.cardTemplate === 'combo';
  const n = isCombo ? combosForSection(section, data).length : itemsForSection(section, data).length;
  const cols = c.cardTemplate === 'compact-list' ? Math.min(c.columns, 2) : c.columns;
  const shown = c.rows ? Math.min(n, cols * c.rows) : n;
  const rows = Math.max(1, Math.ceil(shown / cols));
  const colW = (widthMm - 3 - 3 * (cols - 1)) / cols;
  const card = { premium: colW * 0.75 + 26, 'image-left': Math.max(colW * 0.34 + 5, 26), 'image-top': colW * 0.625 + 24, 'compact-list': 11, featured: colW * 0.8 + 42, combo: colW * 0.625 + 40, 'hero-ribbon': Math.max(colW * 0.5 + 16, 38), poster: colW * 1.1 + 4, 'circle-photo': 25 }[c.cardTemplate];
  const heading = 16 + (section.subtitle ? 5 : 0) + (section.description && c.showDescription ? 8 : 0) + (section.image ? 30 : 0);
  return Math.round((heading + rows * card + (rows - 1) * (c.cardTemplate === 'compact-list' ? 0 : 3) + 4) * 10) / 10;
}

const GAP = 4;
/** Height of the logo / header band that the page renders automatically at the top. */
function headerBand(settings: PageSettings, data: MenuData): number {
  let h = 0;
  const logo = settings.logo.enabled ? (data.logos.find((l) => l.id === settings.logo.logoId) ?? data.logos.find((l) => l.isPrimary)) : undefined;
  if (logo) {
    const { width, height } = logo.media;
    h += Math.min(45, width && height ? settings.logo.widthMm * (height / width) : settings.logo.widthMm * 0.5);
  }
  const hd = settings.header;
  if (hd.enabled && ((hd.icons?.length ?? 0) > 0 || hd.title)) {
    // brand band: banner = one row as tall as the logo; stacked = logo, then a title row (+ ornament)
    const logoH = logo ? h : 9;
    return (hd.layout === 'stacked' ? logoH + 14 + (hd.ornament ? 6 : 0) : Math.max(logoH, 12) + (hd.ornament ? 6 : 0)) + GAP;
  }
  if (hd.enabled && hd.text) h += 8;
  return h ? h + GAP : 0;
}

/**
 * Builds a starting layout for a page from its sections: sections stacked inside the safe area
 * (margins + binding zone), cover / back-cover pages get brand text from the restaurant settings.
 */
export function generateLayout(page: Pick<PageDTO, 'title' | 'subtitle' | 'pageType' | 'settings'>, sections: SectionDTO[], data: MenuData, pageNumber: number): LayoutElement[] {
  const s = page.settings;
  const area = safeArea(s, pageNumber);
  const out: LayoutElement[] = [];
  let z = 1;

  if (page.pageType === 'cover') {
    const top = area.top + headerBand(s, data) + 10;
    out.push(makeHeading({ content: '{{restaurant.name}}', x: area.left, y: top, w: area.width, h: 22, fontSizePt: 34, letterSpacingPt: 2, name: 'Restaurant name', z: z++ }));
    out.push(makeText({ content: '{{restaurant.tagline}}', role: 'heading', x: area.left, y: top + 26, w: area.width, h: 12, fontSizePt: 14, fontWeight: 600, color: 'theme:accent', align: 'center', verticalAlign: 'middle', letterSpacingPt: 4, name: 'Tagline', z: z++ }));
    return out;
  }
  if (page.pageType === 'back') {
    const top = area.top + headerBand(s, data) + 20;
    out.push(makeHeading({ content: 'Visit us', x: area.left, y: top, w: area.width, h: 14, fontSizePt: 24, name: 'Heading', z: z++ }));
    out.push(makeText({ content: '{{restaurant.fullAddress}}\n{{restaurant.phone1}}   {{restaurant.phone2}}\n{{restaurant.instagram}}   {{restaurant.website}}', x: area.left, y: top + 20, w: area.width, h: 34, fontSizePt: 11, align: 'center', lineHeight: 1.7, name: 'Contact', z: z++ }));
    return out;
  }

  let y = area.top + headerBand(s, data);
  if (page.subtitle) {
    out.push(makeText({ content: '{{page.subtitle}}', role: 'heading', x: area.left, y, w: area.width, h: 8, fontSizePt: 10, color: 'theme:accent', align: 'center', verticalAlign: 'middle', name: 'Subtitle', z: z++ }));
    y += 8 + GAP;
  }
  for (const sec of sections) {
    const w = Math.round(area.width * (sec.config.widthPct / 100) * 10) / 10;
    const h = sec.config.heightMm ?? estimateSectionHeight(sec, data, w);
    out.push(makeSection(sec.id, { x: Math.round((area.left + (area.width - w) / 2) * 10) / 10, y: Math.round(y * 10) / 10, w, h, name: sec.title, z: z++ }));
    y += h + GAP;
  }
  return out;
}
