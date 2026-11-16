import { z } from 'zod';
import { moneySchema, type MediaDTO } from './menu';

const id = z.number().int().positive();
const nullableId = id.nullable();
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === '' ? null : v));
const mm = (min: number, max: number) => z.number({ invalid_type_error: 'Enter a number' }).min(min, `Min ${min}`).max(max, `Max ${max}`);
export const hexColor = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Use a hex colour like #F5B51B');
const font = z.string().trim().min(1, 'Required').max(80);

/* ------------------------------------------------------------------- themes */
export const shadowStyles = ['none', 'soft', 'strong', 'gold-glow', 'neon'] as const;

/** Section / theme heading looks. */
export const headingStyleKinds = ['brush-red', 'gold-bar', 'ribbon', 'plain', 'fold-ribbon', 'glow-banner', 'tag', 'pill', 'underline', 'stamp'] as const;
export type HeadingStyleKind = (typeof headingStyleKinds)[number];

/** Line icons drawn by the renderer (header band, icon elements). */
export const iconNames = ['drumstick', 'fries', 'drink', 'burger', 'pizza', 'icecream', 'coffee', 'dumpling', 'sandwich', 'chef-hat'] as const;
export type IconName = (typeof iconNames)[number];
export const ornamentKinds = ['diamond', 'double', 'stars', 'wave', 'dots', 'flourish'] as const;
export type OrnamentKind = (typeof ornamentKinds)[number];
export const patternKinds = ['none', 'dots', 'diagonal', 'grid', 'chevron', 'waves', 'halftone', 'sunburst', 'scales', 'crosses'] as const;
export type PatternKind = (typeof patternKinds)[number];
export const cardSurfaces = ['solid', 'glass', 'gradient', 'outline', 'paper'] as const;
export type CardSurface = (typeof cardSurfaces)[number];
export const themeConfigSchema = z.object({
  colors: z.object({
    background: hexColor, // primary page background
    surface: hexColor, // cards / secondary background
    accent: hexColor,
    accentAlt: hexColor,
    heading: hexColor,
    text: hexColor,
    priceBadgeBg: hexColor,
    priceBadgeText: hexColor,
    special: hexColor, // e.g. red category brush headers
  }),
  fonts: z.object({ heading: font, body: font, price: font, display: font.optional() }), // display = script / title face
  border: z.object({ style: z.enum(['none', 'solid', 'double', 'dashed']), widthMm: mm(0, 10), color: hexColor }),
  borderRadiusMm: mm(0, 30),
  shadow: z.enum(shadowStyles),
  headerStyle: z.enum(headingStyleKinds),
  footerStyle: z.enum(['gold-line', 'bar', 'plain']),
  /** How menu cards are filled; optional so older themes keep working. */
  card: z.object({ surface: z.enum(cardSurfaces), glow: z.boolean() }).optional(),
});
export type ThemeConfig = z.infer<typeof themeConfigSchema>;

/** The Golden Crunch brand theme (also the starting point for new themes). */
export const defaultThemeConfig: ThemeConfig = {
  colors: {
    background: '#080808',
    surface: '#17130F',
    accent: '#F5B51B',
    accentAlt: '#D99A19',
    heading: '#F5B51B',
    text: '#FFFFFF',
    priceBadgeBg: '#F5B51B',
    priceBadgeText: '#080808',
    special: '#C91420',
  },
  fonts: { heading: 'Playfair Display', body: 'Poppins', price: 'Oswald' },
  border: { style: 'double', widthMm: 1.2, color: '#D99A19' },
  borderRadiusMm: 3,
  shadow: 'gold-glow',
  headerStyle: 'brush-red',
  footerStyle: 'gold-line',
};

export const themeInputSchema = z.object({ name: z.string().trim().min(1, 'Required').max(80), config: themeConfigSchema });
export type ThemeInput = z.infer<typeof themeInputSchema>;
export interface ThemeDTO {
  id: number;
  name: string;
  isDefault: boolean;
  config: ThemeConfig;
  pageCount: number;
}

/* -------------------------------------------------------------- backgrounds */
export const backgroundKinds = ['page', 'category', 'section', 'card', 'header', 'footer', 'pattern', 'texture'] as const;
export type BackgroundKind = (typeof backgroundKinds)[number];

// Gradients are written into CSS, so only a plain *-gradient(...) expression is accepted (no url(), no ; or {}).
const gradient = z
  .string()
  .trim()
  .max(300)
  .regex(/^(linear|radial|conic)-gradient\([^;{}]*\)$/i, 'Must be a CSS gradient, e.g. linear-gradient(135deg,#000,#222)')
  .refine((v) => !/url\s*\(/i.test(v), 'url() is not allowed')
  .nullable();

export const backgroundConfigSchema = z.object({
  color: hexColor.nullable(),
  gradient,
  position: z.enum(['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right']),
  size: z.enum(['cover', 'contain', 'auto']),
  repeat: z.enum(['no-repeat', 'repeat', 'repeat-x', 'repeat-y']),
  overlayColor: hexColor.nullable(),
  overlayOpacity: z.number().min(0).max(1),
  borderColor: hexColor.nullable(),
  borderWidthMm: mm(0, 10),
  borderRadiusMm: mm(0, 30),
  shadow: z.enum(shadowStyles),
  paddingMm: mm(0, 50),
  marginMm: mm(0, 50),
  /** Repeating pattern drawn above the colour/gradient and below an uploaded image. */
  pattern: z.enum(patternKinds).optional(),
  patternColor: hexColor.optional(),
  patternOpacity: z.number().min(0).max(1).optional(),
  patternSizeMm: mm(2, 80).optional(),
  /** Soft coloured light spots (bokeh-style glows), positions/sizes in percent of the page. */
  glows: z.array(z.object({ color: hexColor, x: z.number().min(-20).max(120), y: z.number().min(-20).max(120), size: z.number().min(5).max(200), opacity: z.number().min(0).max(1) })).max(6).optional(),
});
export type BackgroundConfig = z.infer<typeof backgroundConfigSchema>;
export const defaultBackgroundConfig: BackgroundConfig = {
  color: '#080808',
  gradient: null,
  position: 'center',
  size: 'cover',
  repeat: 'no-repeat',
  overlayColor: null,
  overlayOpacity: 0,
  borderColor: null,
  borderWidthMm: 0,
  borderRadiusMm: 0,
  shadow: 'none',
  paddingMm: 0,
  marginMm: 0,
};

export const backgroundInputSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(100),
  kind: z.enum(backgroundKinds),
  mediaId: nullableId,
  config: backgroundConfigSchema,
});
export type BackgroundInput = z.infer<typeof backgroundInputSchema>;
export interface BackgroundDTO {
  id: number;
  name: string;
  kind: BackgroundKind;
  media: MediaDTO | null;
  config: BackgroundConfig;
}

/* ------------------------------------------------------------------- combos */
export const comboItemInputSchema = z.object({
  itemId: id,
  variantId: id,
  quantity: z.number().int().min(1).max(50),
});
export const comboInputSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(120),
  description: optText(1000),
  imageMediaId: nullableId,
  sellingPrice: moneySchema,
  isActive: z.boolean(),
  items: z.array(comboItemInputSchema).min(1, 'Add at least one item').max(30),
});
export type ComboInput = z.infer<typeof comboInputSchema>;
export interface ComboItemDTO {
  id: number;
  itemId: number;
  itemName: string;
  variantId: number;
  variantLabel: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
}
export interface ComboDTO {
  id: number;
  name: string;
  description: string | null;
  image: MediaDTO | null;
  sellingPrice: number;
  /** Sum of the included options at their regular price; null if any included price is not set. */
  regularTotal: number | null;
  savings: number | null;
  isActive: boolean;
  displayOrder: number;
  items: ComboItemDTO[];
}

/* -------------------------------------------------------------------- pages */
export const A4 = { widthMm: 210, heightMm: 297 } as const;
export const pageTypes = ['cover', 'content', 'back'] as const;

export const pageSettingsSchema = z
  .object({
    size: z.enum(['A4', 'custom']),
    orientation: z.enum(['portrait', 'landscape']),
    widthMm: mm(50, 1000),
    heightMm: mm(50, 1000),
    marginsMm: z.object({ top: mm(0, 100), right: mm(0, 100), bottom: mm(0, 100), left: mm(0, 100) }),
    paddingMm: mm(0, 50),
    /** Extra inner margin so spiral binding never hides content (mirrored on odd/even pages at export). */
    bindingMarginMm: mm(0, 50),
    columns: z.number().int().min(1).max(6),
    contentLayout: z.enum(['stack', 'grid', 'free']),
    backgroundId: nullableId,
    backgroundColor: hexColor.nullable(),
    border: z.object({ enabled: z.boolean(), style: z.enum(['solid', 'double', 'dashed', 'glow', 'ornate']), color: hexColor, widthMm: mm(0, 10), radiusMm: mm(0, 30) }),
    logo: z.object({ enabled: z.boolean(), logoId: nullableId, widthMm: mm(5, 200), position: z.enum(['left', 'center', 'right']) }),
    header: z.object({
      enabled: z.boolean(),
      text: optText(200),
      /** Optional brand band: line icons flanking the logo plus a title (e.g. a script "Menu"). */
      layout: z.enum(['banner', 'stacked']).optional(),
      icons: z.array(z.enum(iconNames)).max(8).optional(),
      title: optText(80).optional(), // supports {{page.title}} etc.
      titleFont: z.enum(['display', 'heading']).optional(),
      ornament: z.enum(ornamentKinds).nullable().optional(),
    }),
    footer: z.object({ enabled: z.boolean(), text: optText(400), useRestaurantInfo: z.boolean() }),
    showPageNumber: z.boolean(),
  })
  .refine((s) => s.marginsMm.left + s.marginsMm.right + s.bindingMarginMm < s.widthMm, { message: 'Margins leave no room for content', path: ['marginsMm'] });
export type PageSettings = z.infer<typeof pageSettingsSchema>;

export const defaultPageSettings: PageSettings = {
  size: 'A4',
  orientation: 'portrait',
  widthMm: A4.widthMm,
  heightMm: A4.heightMm,
  marginsMm: { top: 12, right: 12, bottom: 14, left: 12 },
  paddingMm: 0,
  bindingMarginMm: 10,
  columns: 2,
  contentLayout: 'stack',
  backgroundId: null,
  backgroundColor: null,
  border: { enabled: true, style: 'double', color: '#D99A19', widthMm: 1.2, radiusMm: 3 },
  logo: { enabled: true, logoId: null, widthMm: 30, position: 'center' },
  header: { enabled: false, text: null },
  footer: { enabled: true, text: null, useRestaurantInfo: true },
  showPageNumber: true,
};

/** Real print dimensions: A4 is always exactly 210 × 297 mm (swapped for landscape). */
export function resolvePageSize(s: Pick<PageSettings, 'size' | 'orientation' | 'widthMm' | 'heightMm'>) {
  if (s.size === 'A4') {
    return s.orientation === 'portrait' ? { widthMm: A4.widthMm, heightMm: A4.heightMm } : { widthMm: A4.heightMm, heightMm: A4.widthMm };
  }
  return { widthMm: s.widthMm, heightMm: s.heightMm };
}
export const normalizePageSettings = (s: PageSettings): PageSettings => ({ ...s, ...resolvePageSize(s) });

/* ----------------------------------------------------------- layout elements */
/** A colour is either a literal hex or a reference to the page theme, so a theme change restyles the page. */
export const themeColorKeys = ['background', 'surface', 'accent', 'accentAlt', 'heading', 'text', 'priceBadgeBg', 'priceBadgeText', 'special'] as const;
export const colorRefSchema = z.union([hexColor, z.string().regex(/^theme:(background|surface|accent|accentAlt|heading|text|priceBadgeBg|priceBadgeText|special)$/, 'Invalid colour')]);
export type ColorRef = z.infer<typeof colorRefSchema>;

/** All geometry is in millimetres relative to the page's top-left corner (A4 = 210 x 297). */
const elementBase = z.object({
  id: z.string().min(1).max(40),
  name: z.string().max(60).nullable(),
  x: z.number().min(-1000).max(2000),
  y: z.number().min(-1000).max(2000),
  w: z.number().min(0.1).max(2000),
  h: z.number().min(0.1).max(2000),
  rotation: z.number().min(-180).max(180),
  z: z.number().int().min(0).max(10000),
  locked: z.boolean(),
  hidden: z.boolean(),
  opacity: z.number().min(0).max(1),
});

export const textElementSchema = elementBase.extend({
  type: z.literal('text'),
  /** Supports {{restaurant.name}}, {{restaurant.tagline}}, {{restaurant.phone1}}, {{restaurant.address}}, {{page.title}}, {{page.number}} … */
  content: z.string().max(2000),
  role: z.enum(['body', 'heading', 'price']),
  font: z.string().max(80).nullable(),
  fontSizePt: z.number().min(3).max(300),
  fontWeight: z.number().int().min(100).max(900),
  italic: z.boolean(),
  color: colorRefSchema,
  align: z.enum(['left', 'center', 'right']),
  verticalAlign: z.enum(['top', 'middle', 'bottom']),
  lineHeight: z.number().min(0.6).max(4),
  letterSpacingPt: z.number().min(-5).max(40),
  uppercase: z.boolean(),
});
export const imageElementSchema = elementBase.extend({
  type: z.literal('image'),
  mediaId: nullableId,
  fit: z.enum(['contain', 'cover']),
  radiusMm: mm(0, 100),
  borderColor: colorRefSchema.nullable(),
  borderWidthMm: mm(0, 10),
});
export const shapeElementSchema = elementBase.extend({
  type: z.literal('shape'),
  shape: z.enum(['rect', 'ellipse', 'line']),
  fill: colorRefSchema.nullable(),
  borderColor: colorRefSchema.nullable(),
  borderWidthMm: mm(0, 10),
  radiusMm: mm(0, 100),
});
export const logoElementSchema = elementBase.extend({ type: z.literal('logo'), logoId: nullableId }); // null = primary logo
export const sectionElementSchema = elementBase.extend({ type: z.literal('section'), sectionId: id });
export const itemCardElementSchema = elementBase.extend({
  type: z.literal('itemCard'),
  itemId: id,
  template: z.enum(['premium', 'image-left', 'image-top', 'compact-list', 'featured', 'combo', 'hero-ribbon', 'poster', 'circle-photo']),
  showDescription: z.boolean(),
  showPrice: z.boolean(),
  showQuantity: z.boolean(),
});

export const iconElementSchema = elementBase.extend({ type: z.literal('icon'), icon: z.enum(iconNames), color: colorRefSchema, strokeMm: mm(0.1, 3) });
export const ornamentElementSchema = elementBase.extend({ type: z.literal('ornament'), kind: z.enum(ornamentKinds), color: colorRefSchema, strokeMm: mm(0.1, 3) });

export const layoutElementSchema = z.discriminatedUnion('type', [textElementSchema, imageElementSchema, shapeElementSchema, logoElementSchema, sectionElementSchema, itemCardElementSchema, iconElementSchema, ornamentElementSchema]);
export type LayoutElement = z.infer<typeof layoutElementSchema>;
export type TextElement = z.infer<typeof textElementSchema>;
export type ImageElement = z.infer<typeof imageElementSchema>;
export type ShapeElement = z.infer<typeof shapeElementSchema>;
export type LogoElement = z.infer<typeof logoElementSchema>;
export type SectionElement = z.infer<typeof sectionElementSchema>;
export type ItemCardElement = z.infer<typeof itemCardElementSchema>;
export type IconElement = z.infer<typeof iconElementSchema>;
export type OrnamentElement = z.infer<typeof ornamentElementSchema>;

export const pageLayoutSchema = z.object({
  version: z.literal(1),
  elements: z.array(layoutElementSchema).max(300),
  /** true = the page was deliberately emptied, so the automatic starting layout must not be generated for it. */
  blank: z.boolean().optional(),
});
export type PageLayout = z.infer<typeof pageLayoutSchema>;
export const emptyLayout: PageLayout = { version: 1, elements: [] };

export const pageInputSchema = z.object({
  title: z.string().trim().min(1, 'Required').max(120),
  subtitle: optText(200),
  pageType: z.enum(pageTypes),
  themeId: nullableId,
  isActive: z.boolean(),
  settings: pageSettingsSchema,
  layout: pageLayoutSchema,
});
export type PageInput = z.infer<typeof pageInputSchema>;

/* ----------------------------------------------------------------- sections */
export const cardTemplates = ['premium', 'image-left', 'image-top', 'compact-list', 'featured', 'combo', 'hero-ribbon', 'poster', 'circle-photo'] as const;
export type CardTemplate = (typeof cardTemplates)[number];

export const sectionConfigSchema = z.object({
  cardTemplate: z.enum(cardTemplates),
  columns: z.number().int().min(1).max(6),
  rows: z.number().int().min(1).max(20).nullable(),
  widthPct: mm(10, 100),
  heightMm: mm(10, 1000).nullable(),
  border: z.object({ enabled: z.boolean(), style: z.enum(['solid', 'double', 'dashed']), color: hexColor, widthMm: mm(0, 10) }),
  headingStyle: z.enum(['theme', ...headingStyleKinds]),
  priceStyle: z.enum(['badge', 'plain', 'inline', 'pill-gold', 'pill-outline', 'circle']),
  imagePosition: z.enum(['left', 'right', 'top', 'bottom']),
  showDescription: z.boolean(),
  showPrice: z.boolean(),
  showQuantity: z.boolean(),
});
export type SectionConfig = z.infer<typeof sectionConfigSchema>;
export const defaultSectionConfig: SectionConfig = {
  cardTemplate: 'premium',
  columns: 3,
  rows: null,
  widthPct: 100,
  heightMm: null,
  border: { enabled: false, style: 'solid', color: '#D99A19', widthMm: 0.5 },
  headingStyle: 'theme',
  priceStyle: 'badge',
  imagePosition: 'top',
  showDescription: true,
  showPrice: true,
  showQuantity: true,
};

export const sectionInputSchema = z.object({
  pageId: nullableId, // null = parked, not on any page
  title: z.string().trim().min(1, 'Required').max(120),
  subtitle: optText(200),
  description: optText(1000),
  imageMediaId: nullableId,
  backgroundId: nullableId,
  categoryIds: z.array(id).max(50),
  itemIds: z.array(id).max(200),
  comboIds: z.array(id).max(50),
  config: sectionConfigSchema,
});
export type SectionInput = z.infer<typeof sectionInputSchema>;
export interface SectionDTO {
  id: number;
  pageId: number | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  displayOrder: number;
  image: MediaDTO | null;
  backgroundId: number | null;
  categoryIds: number[];
  itemIds: number[];
  comboIds: number[];
  config: SectionConfig;
}
export interface PageDTO {
  id: number;
  title: string;
  subtitle: string | null;
  pageType: (typeof pageTypes)[number];
  themeId: number | null;
  isActive: boolean;
  displayOrder: number;
  settings: PageSettings;
  layout: PageLayout;
  sectionCount: number;
  updatedAt: string;
  sections?: SectionDTO[];
}

/* ----------------------------------------------------------------- versions */
export const versionInputSchema = z.object({
  label: optText(120),
  status: z.enum(['draft', 'published']),
});
export type VersionInput = z.infer<typeof versionInputSchema>;
export interface VersionDTO {
  id: number;
  label: string | null;
  status: 'draft' | 'published';
  pageCount: number;
  sectionCount: number;
  createdBy: string | null;
  createdAt: string;
}
