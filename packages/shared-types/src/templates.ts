import {
  defaultBackgroundConfig,
  type BackgroundConfig,
  type CardTemplate,
  type HeadingStyleKind,
  type PageSettings,
  type SectionConfig,
  type ThemeConfig,
} from './design';

/**
 * Built-in page designs. A template is *data only*: a theme, a page background, the page frame and header band, and how
 * sections look (card style, headings, prices). Applying one restyles pages and sections but never touches menu content.
 *
 * 24 templates = 6 design families x 4 colourways. The family defines structure and typography; the colourway defines mood.
 */
export type TemplateMood = 'dark' | 'light' | 'vivid';

export interface DesignTemplate {
  id: string;
  name: string;
  family: string;
  familyName: string;
  description: string;
  mood: TemplateMood;
  /** Hex swatches shown on the gallery card. */
  swatch: string[];
  theme: ThemeConfig;
  background: { name: string; config: BackgroundConfig };
  page: { border: PageSettings['border']; header: PageSettings['header']; logoWidthMm: number };
  sections: {
    /** Used for sections whose items have photos. */
    photoCard: CardTemplate;
    /** Used for sections without photos (text lists). */
    listCard: CardTemplate;
    photoColumns: number;
    listColumns: number;
    headingStyle: HeadingStyleKind;
    priceStyle: SectionConfig['priceStyle'];
    imagePosition: SectionConfig['imagePosition'];
  };
}

interface Palette {
  id: string;
  name: string;
  mood: TemplateMood;
  bg: string;
  surface: string;
  accent: string;
  accentAlt: string;
  heading?: string;
  text: string;
  priceBg?: string;
  priceText: string;
  special: string;
  glow: [string, string];
  pattern?: string; // pattern colour
  /** Small per-colourway differences so siblings are not identical. */
  tweak?: Partial<DesignTemplate['sections']> & { border?: PageSettings['border']['style']; icons?: PageSettings['header']['icons']; title?: string };
}

const colors = (p: Palette): ThemeConfig['colors'] => ({
  background: p.bg,
  surface: p.surface,
  accent: p.accent,
  accentAlt: p.accentAlt,
  heading: p.heading ?? p.accent,
  text: p.text,
  priceBadgeBg: p.priceBg ?? p.accent,
  priceBadgeText: p.priceText,
  special: p.special,
});

const bgBase = (over: Partial<BackgroundConfig>): BackgroundConfig => ({ ...defaultBackgroundConfig, ...over });
const frame = (color: string, style: PageSettings['border']['style'], widthMm: number, radiusMm: number): PageSettings['border'] => ({ enabled: true, style, color, widthMm, radiusMm });
const band = (h: Partial<PageSettings['header']>): PageSettings['header'] => ({ enabled: true, text: null, ...h });

type Builder = (p: Palette) => DesignTemplate;
/** The section-level part of a palette's tweaks (page-level keys such as icons/title are not section settings). */
const sec = (p: Palette): Partial<DesignTemplate['sections']> => {
  const { icons, title, border, ...rest } = p.tweak ?? {};
  void icons; void title; void border;
  return rest;
};
const base = (family: string, familyName: string, description: string, p: Palette): Pick<DesignTemplate, 'id' | 'name' | 'family' | 'familyName' | 'description' | 'mood' | 'swatch'> => ({
  id: `${family}-${p.id}`,
  name: `${familyName} · ${p.name}`,
  family,
  familyName,
  description,
  mood: p.mood,
  swatch: [p.bg, p.surface, p.accent, p.special],
});

/* ---------------------------------------------------------------------------------------------------------------
 * 1. Neon Feast – dark bokeh pages, glowing frames, folded-ribbon item titles over big photos, glossy price pills
 * ------------------------------------------------------------------------------------------------------------- */
const neonFeast: Builder = (p) => ({
  ...base('neon-feast', 'Neon Feast', 'Glowing frame, ribbon titles over big photos and glossy price pills – the classic fast-food menu look.', p),
  theme: {
    colors: colors(p),
    fonts: { heading: 'Poppins', body: 'Poppins', price: 'Oswald', display: 'Lobster' },
    border: { style: 'solid', widthMm: 0.5, color: p.accent },
    borderRadiusMm: 4,
    shadow: 'neon',
    headerStyle: 'glow-banner',
    footerStyle: 'gold-line',
    card: { surface: 'gradient', glow: true },
  },
  background: {
    name: `Neon Feast ${p.name}`,
    config: bgBase({
      color: p.bg,
      gradient: `radial-gradient(ellipse at 50% -8%, ${p.surface} 0%, ${p.bg} 72%)`,
      glows: [
        { color: p.glow[0], x: 14, y: 10, size: 38, opacity: 0.22 },
        { color: p.glow[1], x: 88, y: 36, size: 34, opacity: 0.16 },
        { color: p.glow[0], x: 24, y: 88, size: 40, opacity: 0.14 },
        { color: p.glow[1], x: 92, y: 94, size: 30, opacity: 0.12 },
      ],
    }),
  },
  page: { border: frame(p.accent, 'glow', 0.7, 5), header: band({ layout: 'banner', icons: p.tweak?.icons ?? ['drumstick', 'fries', 'drink'], title: p.tweak?.title ?? 'Menu', titleFont: 'display' }), logoWidthMm: 34 },
  sections: { photoCard: 'hero-ribbon', listCard: 'compact-list', photoColumns: 2, listColumns: 2, headingStyle: 'glow-banner', priceStyle: 'pill-gold', imagePosition: 'left', ...sec(p) },
});

/* ---------------------------------------------------------------------------------------------------------------
 * 2. Royal Classic – ornate frame, serif type, diamond dividers, image-on-top cards
 * ------------------------------------------------------------------------------------------------------------- */
const royalClassic: Builder = (p) => ({
  ...base('royal-classic', 'Royal Classic', 'Ornate corner frame, serif lettering and diamond dividers for fine-dining elegance.', p),
  theme: {
    colors: colors(p),
    fonts: { heading: 'Cinzel', body: 'Lora', price: 'Playfair Display', display: 'Playfair Display' },
    border: { style: 'solid', widthMm: 0.4, color: p.accent },
    borderRadiusMm: 1.5,
    shadow: 'none',
    headerStyle: 'gold-bar',
    footerStyle: 'gold-line',
    card: { surface: 'outline', glow: false },
  },
  background: {
    name: `Royal Classic ${p.name}`,
    config: bgBase({
      color: p.bg,
      gradient: `radial-gradient(ellipse at 50% 0%, ${p.surface} 0%, ${p.bg} 75%)`,
      pattern: 'scales',
      patternColor: p.pattern ?? p.accent,
      patternOpacity: 0.07,
      patternSizeMm: 9,
      glows: [{ color: p.glow[0], x: 50, y: 0, size: 45, opacity: 0.12 }],
    }),
  },
  page: { border: frame(p.accent, 'ornate', 0.5, 0), header: band({ layout: 'stacked', icons: [], title: p.tweak?.title ?? 'Our Menu', titleFont: 'display', ornament: 'diamond' }), logoWidthMm: 36 },
  sections: { photoCard: 'image-top', listCard: 'compact-list', photoColumns: 2, listColumns: 2, headingStyle: 'gold-bar', priceStyle: 'pill-outline', imagePosition: 'top', ...sec(p) },
});

/* ---------------------------------------------------------------------------------------------------------------
 * 3. Street Pop – bold condensed type, halftone pages, poster cards, circle price stickers
 * ------------------------------------------------------------------------------------------------------------- */
const streetPop: Builder = (p) => ({
  ...base('street-pop', 'Street Pop', 'Loud and fun: bold condensed headings, halftone dots, photo posters and round price stickers.', p),
  theme: {
    colors: colors(p),
    fonts: { heading: 'Anton', body: 'Poppins', price: 'Anton', display: 'Permanent Marker' },
    border: { style: 'solid', widthMm: 1.2, color: p.accent },
    borderRadiusMm: 3,
    shadow: 'strong',
    headerStyle: 'tag',
    footerStyle: 'bar',
    card: { surface: 'solid', glow: false },
  },
  background: {
    name: `Street Pop ${p.name}`,
    config: bgBase({ color: p.bg, pattern: 'halftone', patternColor: p.pattern ?? p.accent, patternOpacity: 0.16, patternSizeMm: 6.5, gradient: `linear-gradient(180deg, ${p.bg} 0%, ${p.surface} 140%)` }),
  },
  page: { border: frame(p.accent, 'solid', 1.4, 4), header: band({ layout: 'banner', icons: p.tweak?.icons ?? ['burger', 'fries', 'drink', 'pizza'], title: p.tweak?.title ?? 'MENU', titleFont: 'heading' }), logoWidthMm: 32 },
  sections: { photoCard: 'poster', listCard: 'compact-list', photoColumns: 2, listColumns: 2, headingStyle: 'tag', priceStyle: 'circle', imagePosition: 'top', ...sec(p) },
});

/* ---------------------------------------------------------------------------------------------------------------
 * 4. Rustic Kraft – paper tones, dashed frames, round photos, hand-lettered headings
 * ------------------------------------------------------------------------------------------------------------- */
const rusticKraft: Builder = (p) => ({
  ...base('rustic-kraft', 'Rustic Kraft', 'Warm paper tones, dashed frames, round photos and hand-lettered headings.', p),
  theme: {
    colors: colors(p),
    fonts: { heading: 'DM Serif Display', body: 'Lora', price: 'DM Serif Display', display: 'Kaushan Script' },
    border: { style: 'dashed', widthMm: 0.5, color: p.accent },
    borderRadiusMm: 2,
    shadow: 'none',
    headerStyle: 'underline',
    footerStyle: 'plain',
    card: { surface: 'paper', glow: false },
  },
  background: {
    name: `Rustic Kraft ${p.name}`,
    config: bgBase({ color: p.bg, pattern: 'dots', patternColor: p.pattern ?? p.accent, patternOpacity: 0.12, patternSizeMm: 5, gradient: `radial-gradient(ellipse at 50% 40%, transparent 55%, ${p.surface}99 130%)` }),
  },
  page: { border: frame(p.accent, 'dashed', 0.6, 2), header: band({ layout: 'stacked', icons: ['coffee', 'sandwich', 'chef-hat'], title: p.tweak?.title ?? 'Our Menu', titleFont: 'display', ornament: 'wave' }), logoWidthMm: 34 },
  sections: { photoCard: 'circle-photo', listCard: 'circle-photo', photoColumns: 2, listColumns: 2, headingStyle: 'underline', priceStyle: 'inline', imagePosition: 'left', ...sec(p) },
});

/* ---------------------------------------------------------------------------------------------------------------
 * 5. Modern Minimal – airy light pages, thin lines, side-photo cards, outlined price pills
 * ------------------------------------------------------------------------------------------------------------- */
const modernMinimal: Builder = (p) => ({
  ...base('modern-minimal', 'Modern Minimal', 'Clean and airy: thin lines, plenty of space, side photos and outlined price pills.', p),
  theme: {
    colors: colors(p),
    fonts: { heading: 'Montserrat', body: 'Inter', price: 'Montserrat', display: 'Playfair Display' },
    border: { style: 'solid', widthMm: 0.3, color: p.accent },
    borderRadiusMm: 3,
    shadow: 'soft',
    headerStyle: 'pill',
    footerStyle: 'gold-line',
    card: { surface: 'solid', glow: false },
  },
  background: {
    name: `Modern Minimal ${p.name}`,
    config: bgBase({ color: p.bg, pattern: 'dots', patternColor: p.pattern ?? p.accent, patternOpacity: 0.1, patternSizeMm: 7, glows: [{ color: p.glow[0], x: 100, y: 0, size: 45, opacity: 0.16 }, { color: p.glow[1], x: 0, y: 100, size: 40, opacity: 0.12 }] }),
  },
  page: { border: frame(p.accent, 'solid', 0.3, 3), header: band({ layout: 'stacked', icons: [], title: p.tweak?.title ?? 'Menu', titleFont: 'display', ornament: 'double' }), logoWidthMm: 34 },
  sections: { photoCard: 'image-left', listCard: 'compact-list', photoColumns: 2, listColumns: 2, headingStyle: 'pill', priceStyle: 'pill-outline', imagePosition: 'left', ...sec(p) },
});

/* ---------------------------------------------------------------------------------------------------------------
 * 6. Glass Gradient – vivid gradient glows, frosted-glass cards, script titles; made for drinks and desserts
 * ------------------------------------------------------------------------------------------------------------- */
const glassGradient: Builder = (p) => ({
  ...base('glass-gradient', 'Glass Gradient', 'Colourful light glows with frosted-glass cards and a script title – ideal for shakes, drinks and desserts.', p),
  theme: {
    colors: colors(p),
    fonts: { heading: 'Poppins', body: 'Poppins', price: 'Poppins', display: 'Pacifico' },
    border: { style: 'solid', widthMm: 0.4, color: p.accent },
    borderRadiusMm: 5,
    shadow: 'soft',
    headerStyle: 'pill',
    footerStyle: 'plain',
    card: { surface: 'glass', glow: false },
  },
  background: {
    name: `Glass Gradient ${p.name}`,
    config: bgBase({
      color: p.bg,
      gradient: `linear-gradient(160deg, ${p.surface} 0%, ${p.bg} 70%)`,
      glows: [
        { color: p.glow[0], x: 8, y: 8, size: 52, opacity: 0.45 },
        { color: p.glow[1], x: 96, y: 40, size: 48, opacity: 0.38 },
        { color: p.glow[0], x: 30, y: 96, size: 50, opacity: 0.32 },
      ],
    }),
  },
  page: { border: frame(p.accent, 'glow', 0.4, 6), header: band({ layout: 'banner', icons: p.tweak?.icons ?? ['icecream', 'drink', 'coffee'], title: p.tweak?.title ?? 'Menu', titleFont: 'display' }), logoWidthMm: 32 },
  sections: { photoCard: 'poster', listCard: 'compact-list', photoColumns: 2, listColumns: 2, headingStyle: 'pill', priceStyle: 'pill-gold', imagePosition: 'top', ...sec(p) },
});

/* ----------------------------------------------------------------------------------------------------------- */
const pal = (p: Palette) => p;

const FAMILIES: { build: Builder; palettes: Palette[] }[] = [
  {
    build: neonFeast,
    palettes: [
      pal({ id: 'gold', name: 'Gold on Black', mood: 'dark', bg: '#0A0806', surface: '#1E160C', accent: '#F5B51B', accentAlt: '#D99A19', text: '#FFFFFF', priceText: '#1A1000', special: '#C91420', glow: ['#F5B51B', '#E8590C'] }),
      pal({ id: 'crimson', name: 'Crimson Fire', mood: 'dark', bg: '#0B0405', surface: '#240B0E', accent: '#FF5A47', accentAlt: '#D12A22', heading: '#FFD3C9', text: '#FFF4F1', priceBg: '#C9281A', priceText: '#FFFFFF', special: '#C96B00', glow: ['#FF3B30', '#FF9500'], tweak: { headingStyle: 'fold-ribbon', imagePosition: 'right' } }),
      pal({ id: 'electric', name: 'Electric Blue', mood: 'dark', bg: '#040913', surface: '#0B1A2E', accent: '#2DD4FF', accentAlt: '#139AD6', text: '#F2FAFF', priceText: '#031520', special: '#2563EB', glow: ['#00B4FF', '#7C3AED'], tweak: { icons: ['burger', 'pizza', 'drink'] } }),
      pal({ id: 'emerald', name: 'Emerald Night', mood: 'dark', bg: '#030E0A', surface: '#0A2118', accent: '#3FE0A0', accentAlt: '#1FA86F', heading: '#BFF5DE', text: '#F1FFF8', priceText: '#03140D', special: '#D1385C', glow: ['#10B981', '#F59E0B'], tweak: { imagePosition: 'right' } }),
    ],
  },
  {
    build: royalClassic,
    palettes: [
      pal({ id: 'black-gold', name: 'Black & Gold', mood: 'dark', bg: '#0B0B0C', surface: '#1A1710', accent: '#D4AF37', accentAlt: '#A8862A', heading: '#E6C766', text: '#F5EFE0', priceText: '#14110A', special: '#9B1C2C', glow: ['#D4AF37', '#D4AF37'] }),
      pal({ id: 'burgundy', name: 'Burgundy & Cream', mood: 'dark', bg: '#3F0D19', surface: '#5A1424', accent: '#E8C98B', accentAlt: '#C7A15A', heading: '#F3DDB1', text: '#FBF1E1', priceText: '#3A0B15', special: '#B8324A', glow: ['#E8C98B', '#B8324A'], tweak: { title: 'The Menu' } }),
      pal({ id: 'navy-gold', name: 'Midnight & Gold', mood: 'dark', bg: '#0A1330', surface: '#12204A', accent: '#E3B75A', accentAlt: '#BC9238', heading: '#F0D590', text: '#EEF2FF', priceText: '#0A1330', special: '#C0392B', glow: ['#E3B75A', '#3B5BDB'] }),
      pal({ id: 'ivory', name: 'Ivory & Gold', mood: 'light', bg: '#FBF6EA', surface: '#FFFFFF', accent: '#A67A22', accentAlt: '#8C6A1F', heading: '#7A5A18', text: '#2B2118', priceBg: '#8C6A1F', priceText: '#FFFFFF', special: '#9B1C2C', glow: ['#E3C77D', '#E3C77D'], pattern: '#B8892E' }),
    ],
  },
  {
    build: streetPop,
    palettes: [
      pal({ id: 'yellow', name: 'Yellow & Black', mood: 'vivid', bg: '#141414', surface: '#252525', accent: '#FFD400', accentAlt: '#E0B800', heading: '#FFD400', text: '#FFFFFF', priceText: '#141414', special: '#FF3B30', glow: ['#FFD400', '#FFD400'] }),
      pal({ id: 'red', name: 'Hot Red', mood: 'vivid', bg: '#B4121B', surface: '#8E0D14', accent: '#FFE066', accentAlt: '#F2B705', heading: '#FFE066', text: '#FFFFFF', priceBg: '#FFE066', priceText: '#5A0A10', special: '#1F1F1F', glow: ['#FF6B6B', '#FF6B6B'], pattern: '#FFFFFF' }),
      pal({ id: 'teal', name: 'Teal & Orange', mood: 'vivid', bg: '#0A3D4A', surface: '#0F5062', accent: '#FF8A1F', accentAlt: '#E66A00', heading: '#FFB066', text: '#F2FEFF', priceText: '#2B1500', special: '#FF4D4D', glow: ['#14B8A6', '#14B8A6'], pattern: '#FFFFFF' }),
      pal({ id: 'pink', name: 'Pink & Lime', mood: 'vivid', bg: '#5B1342', surface: '#7A1A58', accent: '#D8FF3D', accentAlt: '#B4D92A', heading: '#EFFF9E', text: '#FFF4FA', priceText: '#2A0A1F', special: '#FF3D8B', glow: ['#FF3D8B', '#FF3D8B'], pattern: '#FFFFFF', tweak: { icons: ['icecream', 'burger', 'drink', 'pizza'] } }),
    ],
  },
  {
    build: rusticKraft,
    palettes: [
      pal({ id: 'kraft', name: 'Kraft Brown', mood: 'light', bg: '#E2C9A0', surface: '#F3E3C3', accent: '#8A4B1C', accentAlt: '#6E3A12', heading: '#4A2A10', text: '#3B2412', priceText: '#FFF6E6', special: '#A63D1F', glow: ['#C9A06A', '#C9A06A'], pattern: '#8A4B1C' }),
      pal({ id: 'chalk', name: 'Chalkboard', mood: 'dark', bg: '#1E2A25', surface: '#27372F', accent: '#F2C14E', accentAlt: '#D9A62E', heading: '#F8E7B5', text: '#F4F1E8', priceText: '#1E2A25', special: '#D9534F', glow: ['#F2C14E', '#F2C14E'], pattern: '#FFFFFF' }),
      pal({ id: 'olive', name: 'Olive & Cream', mood: 'light', bg: '#F1E9D4', surface: '#FBF6E6', accent: '#6F8426', accentAlt: '#53651B', heading: '#44521A', text: '#33401F', priceBg: '#53651B', priceText: '#FFFFFF', special: '#B5532A', glow: ['#B7C46B', '#B7C46B'], pattern: '#6F8426' }),
      pal({ id: 'terracotta', name: 'Terracotta', mood: 'light', bg: '#F5DFCB', surface: '#FCEEDF', accent: '#C4572C', accentAlt: '#9D431F', heading: '#7A2F14', text: '#4F2616', priceBg: '#9D431F', priceText: '#FFF3E8', special: '#2F6F5E', glow: ['#E9A97C', '#E9A97C'], pattern: '#C4572C' }),
    ],
  },
  {
    build: modernMinimal,
    palettes: [
      pal({ id: 'orange', name: 'White & Orange', mood: 'light', bg: '#FFFFFF', surface: '#F7F5F2', accent: '#E55A0A', accentAlt: '#D9540C', heading: '#1D1D1F', text: '#2A2A2D', priceBg: '#BF4A07', priceText: '#FFFFFF', special: '#E55A0A', glow: ['#FFB27A', '#FFD3B0'], pattern: '#FF6B1A' }),
      pal({ id: 'mint', name: 'Mint & Charcoal', mood: 'light', bg: '#EAF7F1', surface: '#FFFFFF', accent: '#16A07A', accentAlt: '#0F7C5E', heading: '#17332A', text: '#1F3D33', priceBg: '#0F7C5E', priceText: '#FFFFFF', special: '#16A07A', glow: ['#8FE0C3', '#C5F0DE'], pattern: '#16A07A' }),
      pal({ id: 'sky', name: 'Sky & Navy', mood: 'light', bg: '#EAF3FF', surface: '#FFFFFF', accent: '#2F6BFF', accentAlt: '#1F4FD1', heading: '#0E2145', text: '#1B2C52', priceBg: '#1F4FD1', priceText: '#FFFFFF', special: '#2F6BFF', glow: ['#9CC1FF', '#CFE0FF'], pattern: '#2F6BFF' }),
      pal({ id: 'blush', name: 'Blush & Rose', mood: 'light', bg: '#FFF0F2', surface: '#FFFFFF', accent: '#E2446B', accentAlt: '#BA2E52', heading: '#3A1A22', text: '#4A2630', priceBg: '#BA2E52', priceText: '#FFFFFF', special: '#E2446B', glow: ['#FFB3C4', '#FFD6E0'], pattern: '#E2446B' }),
    ],
  },
  {
    build: glassGradient,
    palettes: [
      pal({ id: 'purple', name: 'Purple Dream', mood: 'vivid', bg: '#120A2B', surface: '#231450', accent: '#C084FC', accentAlt: '#9B5DE5', heading: '#F0DBFF', text: '#FAF5FF', priceBg: '#F472B6', priceText: '#2A0A24', special: '#EC4899', glow: ['#8B5CF6', '#EC4899'] }),
      pal({ id: 'sunset', name: 'Sunset', mood: 'vivid', bg: '#1E0913', surface: '#3A1220', accent: '#FFB347', accentAlt: '#F58B1F', heading: '#FFE0B8', text: '#FFF6EE', priceText: '#2A1000', special: '#FF3D77', glow: ['#FF7A18', '#FF3D77'] }),
      pal({ id: 'ocean', name: 'Ocean', mood: 'vivid', bg: '#031526', surface: '#08294A', accent: '#38E1FF', accentAlt: '#1AA9D6', heading: '#C8F4FF', text: '#EFFBFF', priceText: '#03202C', special: '#0072FF', glow: ['#00C6FF', '#0072FF'], tweak: { icons: ['drink', 'icecream', 'coffee'] } }),
      pal({ id: 'berry', name: 'Berry', mood: 'vivid', bg: '#1B0722', surface: '#35103F', accent: '#FF6FB5', accentAlt: '#E0408F', heading: '#FFD0E8', text: '#FFF4FA', priceText: '#2B0A20', special: '#7C3AED', glow: ['#FF4DA6', '#7C3AED'] }),
    ],
  },
];

export const designTemplates: DesignTemplate[] = FAMILIES.flatMap((f) => f.palettes.map((p) => f.build(p)));

export const templateFamilies = FAMILIES.map((f) => {
  const first = f.build(f.palettes[0]!);
  return { id: first.family, name: first.familyName, description: first.description };
});

export const getDesignTemplate = (id: string) => designTemplates.find((t) => t.id === id);

/* ------------------------------------------------------------------------------------------------------------- *
 * Applying a template (client computes the plan from live menu data; the server applies it atomically)
 * ------------------------------------------------------------------------------------------------------------- */
import { z } from 'zod';
import { backgroundInputSchema, pageSettingsSchema, sectionConfigSchema, themeInputSchema } from './design';

export const applyDesignSchema = z.object({
  templateId: z.string().trim().min(1).max(80),
  theme: themeInputSchema,
  background: backgroundInputSchema,
  makeDefaultTheme: z.boolean(),
  /** Clear each page's hand-arranged layout so the new look is laid out automatically (recommended). */
  resetLayouts: z.boolean(),
  /** Save a draft version of the current design first, so the change can be undone from Versions. */
  backup: z.boolean(),
  pages: z.array(z.object({ id: z.number().int().positive(), settings: pageSettingsSchema })).min(1).max(100),
  sections: z.array(z.object({ id: z.number().int().positive(), config: sectionConfigSchema })).max(500),
});
export type ApplyDesignInput = z.infer<typeof applyDesignSchema>;

export interface ApplyDesignResult {
  themeId: number;
  backgroundId: number;
  pagesUpdated: number;
  sectionsUpdated: number;
  backupVersionId: number | null;
}
