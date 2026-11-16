import type { CardTemplate, IconElement, IconName, ImageElement, ItemCardElement, LayoutElement, LogoElement, OrnamentElement, OrnamentKind, SectionElement, ShapeElement, TextElement } from '@gc/shared-types';

let counter = 0;
export const newId = () => `el_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const base = (over: Partial<LayoutElement> & { x: number; y: number; w: number; h: number }) => ({
  id: newId(),
  name: null,
  rotation: 0,
  z: 0,
  locked: false,
  hidden: false,
  opacity: 1,
  ...over,
});

export type ElementKind = 'text' | 'heading' | 'image' | 'rect' | 'ellipse' | 'line' | 'logo';

export const makeText = (over: Partial<TextElement> = {}): TextElement => ({
  ...base({ x: 20, y: 20, w: 90, h: 14 }),
  type: 'text',
  content: 'Your text here',
  role: 'body',
  font: null,
  fontSizePt: 11,
  fontWeight: 400,
  italic: false,
  color: 'theme:text',
  align: 'left',
  verticalAlign: 'top',
  lineHeight: 1.3,
  letterSpacingPt: 0,
  uppercase: false,
  ...over,
});

export const makeHeading = (over: Partial<TextElement> = {}): TextElement =>
  makeText({ content: 'Heading', role: 'heading', fontSizePt: 22, fontWeight: 700, color: 'theme:heading', align: 'center', verticalAlign: 'middle', w: 120, h: 14, ...over });

export const makeImage = (mediaId: number | null, over: Partial<ImageElement> = {}): ImageElement => ({
  ...base({ x: 20, y: 20, w: 60, h: 45 }),
  type: 'image',
  mediaId,
  fit: 'contain',
  radiusMm: 0,
  borderColor: null,
  borderWidthMm: 0,
  ...over,
});

export const makeShape = (shape: ShapeElement['shape'], over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...base(shape === 'line' ? { x: 20, y: 20, w: 100, h: 1 } : { x: 20, y: 20, w: 60, h: 40 }),
  type: 'shape',
  shape,
  fill: shape === 'line' ? null : 'theme:accent',
  borderColor: shape === 'line' ? 'theme:accent' : null,
  borderWidthMm: shape === 'line' ? 0.6 : 0,
  radiusMm: 0,
  ...over,
});

export const makeLogo = (logoId: number | null = null, over: Partial<LogoElement> = {}): LogoElement => ({ ...base({ x: 70, y: 15, w: 70, h: 35 }), type: 'logo', logoId, ...over });
export const makeSection = (sectionId: number, over: Partial<SectionElement> = {}): SectionElement => ({ ...base({ x: 15, y: 60, w: 180, h: 100 }), type: 'section', sectionId, ...over });
export const makeItemCard = (itemId: number, template: CardTemplate = 'premium', over: Partial<ItemCardElement> = {}): ItemCardElement => ({
  ...base({ x: 20, y: 40, w: 80, h: 70 }),
  type: 'itemCard',
  itemId,
  template,
  showDescription: true,
  showPrice: true,
  showQuantity: true,
  ...over,
});

export const makeIcon = (icon: IconName, over: Partial<IconElement> = {}): IconElement => ({ ...base({ x: 20, y: 20, w: 14, h: 14 }), type: 'icon', icon, color: 'theme:text', strokeMm: 0.45, ...over });
export const makeOrnament = (kind: OrnamentKind, over: Partial<OrnamentElement> = {}): OrnamentElement => ({ ...base({ x: 40, y: 20, w: 110, h: 11 }), type: 'ornament', kind, color: 'theme:accent', strokeMm: 0.3, ...over });

/** Presets shown under "Design elements". */
export const DESIGN_PRESETS: { id: string; label: string; make: () => LayoutElement[] }[] = [
  { id: 'divider', label: 'Gold divider', make: () => [makeShape('line', { w: 120, h: 1, borderWidthMm: 0.7 })] },
  { id: 'frame', label: 'Gold frame', make: () => [makeShape('rect', { w: 100, h: 60, fill: null, borderColor: 'theme:accent', borderWidthMm: 0.9, radiusMm: 3 })] },
  { id: 'banner', label: 'Red brush banner', make: () => [makeShape('rect', { w: 90, h: 14, fill: 'theme:special', radiusMm: 1.5 }), makeHeading({ content: 'CATEGORY', w: 90, h: 14, color: '#FFFFFF', fontSizePt: 16, uppercase: true, z: 1 })] },
  { id: 'badge', label: 'Price badge', make: () => [makeShape('ellipse', { w: 26, h: 26, fill: 'theme:priceBadgeBg' }), makeText({ content: '₹199', role: 'price', w: 26, h: 26, fontSizePt: 16, fontWeight: 700, color: 'theme:priceBadgeText', align: 'center', verticalAlign: 'middle', z: 1 })] },
  { id: 'tagline', label: 'Tagline', make: () => [makeText({ content: '{{restaurant.tagline}}', role: 'heading', fontSizePt: 14, fontWeight: 700, color: 'theme:accent', align: 'center', letterSpacingPt: 3, w: 150, h: 10, verticalAlign: 'middle' })] },
  { id: 'contact', label: 'Contact block', make: () => [makeText({ content: '{{restaurant.fullAddress}}\n{{restaurant.phone1}}  {{restaurant.instagram}}', fontSizePt: 8, align: 'center', w: 150, h: 16 })] },
];
