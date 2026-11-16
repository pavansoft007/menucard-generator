import { memo, useCallback, type CSSProperties } from 'react';
import type { ImageElement, ItemCardElement, LayoutElement, LogoElement, PageLayout, PageSettings, ShapeElement, TextElement } from '@gc/shared-types';
import { resolvePageSize } from '@gc/shared-types';
import { ItemCard, type CardOptions, type RenderMode } from './cards';
import { themeFor, type MenuData } from './menuData';
import { SectionView } from './SectionView';
import { backgroundStyle } from './styles';
import { contactLine, fillTokens, resolveColor, tokenValues } from './tokens';
import { bindingSide, safeArea } from './geometry';
import { generateLayout } from './generate';

export interface RenderablePage {
  id?: number;
  title: string;
  subtitle: string | null;
  pageType: 'cover' | 'content' | 'back';
  themeId: number | null;
  settings: PageSettings;
  layout: PageLayout;
}

const font = (name: string) => `"${name}", sans-serif`;

export { bindingSide, safeArea } from './geometry';

/* ----------------------------------------------------------------- elements */
function TextView({ el, theme, values }: { el: TextElement; theme: ReturnType<typeof themeFor>; values: Record<string, string> }) {
  const family = el.font ?? theme.fonts[el.role];
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: ({ top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const)[el.verticalAlign] }}>
      <div style={{ width: '100%', textAlign: el.align, fontFamily: font(family), fontSize: `${el.fontSizePt}pt`, fontWeight: el.fontWeight, fontStyle: el.italic ? 'italic' : 'normal', color: resolveColor(el.color, theme), lineHeight: el.lineHeight, letterSpacing: `${el.letterSpacingPt}pt`, textTransform: el.uppercase ? 'uppercase' : 'none', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {fillTokens(el.content, values)}
      </div>
    </div>
  );
}

const Placeholder = ({ text, mode }: { text: string; mode: RenderMode }) =>
  mode === 'export' ? null : <div style={{ width: '100%', height: '100%', border: '0.3mm dashed #888a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6pt', color: '#999', textAlign: 'center', padding: '1mm', boxSizing: 'border-box' }}>{text}</div>;

function ImageView({ el, data, theme, mode }: { el: ImageElement; data: MenuData; theme: ReturnType<typeof themeFor>; mode: RenderMode }) {
  const media = el.mediaId ? data.media.get(el.mediaId) : undefined;
  if (!media) return <Placeholder text={el.mediaId ? 'Image unavailable' : 'No image selected'} mode={mode} />;
  return (
    <img src={media.url} alt={media.altText ?? ''} draggable={false} style={{ width: '100%', height: '100%', objectFit: el.fit, borderRadius: `${el.radiusMm}mm`, border: el.borderColor && el.borderWidthMm ? `${el.borderWidthMm}mm solid ${resolveColor(el.borderColor, theme)}` : 0, boxSizing: 'border-box', display: 'block' }} />
  );
}

function ShapeView({ el, theme }: { el: ShapeElement; theme: ReturnType<typeof themeFor> }) {
  const stroke = resolveColor(el.borderColor, theme);
  if (el.shape === 'line') return <div style={{ width: '100%', height: `${Math.max(el.borderWidthMm, 0.2)}mm`, background: stroke ?? resolveColor(el.fill, theme) ?? 'currentColor', position: 'absolute', top: '50%', transform: 'translateY(-50%)' }} />;
  return <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', background: resolveColor(el.fill, theme), border: stroke && el.borderWidthMm ? `${el.borderWidthMm}mm solid ${stroke}` : 0, borderRadius: el.shape === 'ellipse' ? '50%' : `${el.radiusMm}mm` }} />;
}

function LogoView({ el, data, mode }: { el: LogoElement; data: MenuData; mode: RenderMode }) {
  const logo = (el.logoId ? data.logos.find((l) => l.id === el.logoId) : undefined) ?? data.logos.find((l) => l.isPrimary);
  if (!logo) return <Placeholder text="No logo uploaded" mode={mode} />;
  return <img src={logo.media.url} alt={logo.label} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />;
}

function ItemCardView({ el, data, theme, mode }: { el: ItemCardElement; data: MenuData; theme: ReturnType<typeof themeFor>; mode: RenderMode }) {
  const item = data.items.find((i) => i.id === el.itemId);
  if (!item) return <Placeholder text="Item was deleted" mode={mode} />;
  const o: CardOptions = { theme, mode, showDescription: el.showDescription, showPrice: el.showPrice, showQuantity: el.showQuantity, priceStyle: 'badge', imagePosition: 'top' };
  return <div style={{ width: '100%', height: '100%' }}><ItemCard item={item} template={el.template} o={o} /></div>;
}

interface ElementProps {
  el: LayoutElement;
  data: MenuData;
  theme: ReturnType<typeof themeFor>;
  mode: RenderMode;
  values: Record<string, string>;
  onMeasure?: (elementId: string, heightMm: number) => void;
}

const ElementView = memo(function ElementView({ el, data, theme, mode, values, onMeasure }: ElementProps) {
  const measure = useCallback((h: number) => onMeasure?.(el.id, h), [onMeasure, el.id]);
  if (el.hidden && mode !== 'edit') return null;
  const style: CSSProperties = { position: 'absolute', left: `${el.x}mm`, top: `${el.y}mm`, width: `${el.w}mm`, height: `${el.h}mm`, transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined, opacity: el.hidden ? 0.15 : el.opacity, zIndex: el.z };
  let body;
  switch (el.type) {
    case 'text': body = <TextView el={el} theme={theme} values={values} />; break;
    case 'image': body = <ImageView el={el} data={data} theme={theme} mode={mode} />; break;
    case 'shape': body = <ShapeView el={el} theme={theme} />; break;
    case 'logo': body = <LogoView el={el} data={data} mode={mode} />; break;
    case 'itemCard': body = <ItemCardView el={el} data={data} theme={theme} mode={mode} />; break;
    case 'section': {
      const section = data.sections.find((s) => s.id === el.sectionId);
      body = section ? <SectionView section={section} data={data} theme={theme} mode={mode} onMeasure={onMeasure ? measure : undefined} /> : <Placeholder text="Section was deleted" mode={mode} />;
      break;
    }
  }
  return <div data-el-id={el.id} data-el-type={el.type} style={style}>{body}</div>;
});

/* --------------------------------------------------------------------- page */
export interface PageRendererProps {
  page: RenderablePage;
  pageNumber: number;
  totalPages: number;
  data: MenuData;
  mode: RenderMode;
  /** Edit mode only: margin / binding-zone guides. */
  showGuides?: boolean;
  onMeasureElement?: (elementId: string, heightMm: number) => void;
}

/**
 * Draws one page at its real physical size (CSS millimetres). The editor, live preview and PDF export
 * all use this component, so what you design is exactly what prints.
 */
export function PageRenderer({ page, pageNumber, totalPages, data, mode, showGuides, onMeasureElement }: PageRendererProps) {
  const s = page.settings;
  const theme = themeFor(data, page.themeId);
  const { widthMm, heightMm } = resolvePageSize(s);
  const area = safeArea(s, pageNumber);
  const values = tokenValues(data.restaurant, page, pageNumber, totalPages);

  const bg = s.backgroundId ? data.backgrounds.find((b) => b.id === s.backgroundId) : undefined;
  const bgStyle: CSSProperties = bg ? { ...backgroundStyle(bg.config, bg.media), border: undefined, borderRadius: undefined, boxShadow: undefined } : {};
  const logo = s.logo.enabled ? (data.logos.find((l) => l.id === s.logo.logoId) ?? data.logos.find((l) => l.isPrimary)) : undefined;
  const frameInset = Math.max(2, Math.min(s.marginsMm.top, s.marginsMm.right, s.marginsMm.bottom, s.marginsMm.left) - 3);

  const footerText = s.footer.text ? fillTokens(s.footer.text, values) : '';
  const contact = s.footer.useRestaurantInfo ? contactLine(values) : '';
  const footerLines = [footerText, contact, !s.footer.text && !s.footer.useRestaurantInfo ? values['restaurant.footerText'] : ''].filter(Boolean);
  const headerText = s.header.enabled && s.header.text ? fillTokens(s.header.text, values) : '';
  const justify = ({ left: 'flex-start', center: 'center', right: 'flex-end' } as const)[s.logo.position];
  // A page nobody has opened in the editor yet (no elements, not marked blank) gets the automatic stacked layout.
  const auto = mode !== 'edit' && page.layout.elements.length === 0 && !page.layout.blank && page.id !== undefined;
  const elements = auto ? generateLayout(page, data.sections.filter((x) => x.pageId === page.id).sort((a, b) => a.displayOrder - b.displayOrder), data, pageNumber) : page.layout.elements;
  const sorted = [...elements].sort((a, b) => a.z - b.z);

  return (
    <div className="gc-page" data-page-type={page.pageType} style={{ position: 'relative', width: `${widthMm}mm`, height: `${heightMm}mm`, overflow: 'hidden', boxSizing: 'border-box', backgroundColor: s.backgroundColor ?? bg?.config.color ?? theme.colors.background, color: theme.colors.text, fontFamily: font(theme.fonts.body), ...bgStyle }}>
      {s.border.enabled && <div style={{ position: 'absolute', inset: `${frameInset}mm`, border: `${s.border.widthMm}mm ${s.border.style} ${s.border.color}`, borderRadius: `${s.border.radiusMm}mm`, pointerEvents: 'none' }} />}

      {(logo || headerText) && (
        <div style={{ position: 'absolute', top: `${area.top}mm`, left: `${area.left}mm`, width: `${area.width}mm`, display: 'flex', flexDirection: 'column', alignItems: justify, gap: '2mm', pointerEvents: 'none' }}>
          {logo && <img src={logo.media.url} alt={logo.label} draggable={false} style={{ width: `${s.logo.widthMm}mm`, maxHeight: '45mm', objectFit: 'contain', display: 'block' }} />}
          {headerText && <div style={{ width: '100%', textAlign: s.logo.position, fontFamily: font(theme.fonts.heading), fontSize: '9pt', fontWeight: 700, color: theme.colors.heading }}>{headerText}</div>}
        </div>
      )}

      {sorted.map((el) => (
        <ElementView key={el.id} el={el} data={data} theme={theme} mode={mode} values={values} onMeasure={onMeasureElement} />
      ))}

      {s.footer.enabled && footerLines.length > 0 && (
        <div style={{ position: 'absolute', left: `${area.left}mm`, width: `${area.width}mm`, bottom: `${area.bottom}mm`, textAlign: 'center', fontFamily: font(theme.fonts.body), fontSize: '5.6pt', lineHeight: 1.5, pointerEvents: 'none', zIndex: 9000, ...(theme.footerStyle === 'bar' ? { background: theme.colors.accent, color: theme.colors.priceBadgeText, padding: '1.2mm 3mm', borderRadius: '1mm' } : theme.footerStyle === 'gold-line' ? { borderTop: `0.35mm solid ${theme.colors.accent}`, paddingTop: '1.5mm', color: theme.colors.text } : { color: theme.colors.text }) }}>
          {footerLines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {s.showPageNumber && (
        <div style={{ position: 'absolute', left: `${area.left}mm`, width: `${area.width}mm`, bottom: `${Math.max(1, area.bottom / 2 - 2)}mm`, textAlign: 'center', fontFamily: font(theme.fonts.price), fontSize: '7pt', color: theme.colors.accent, pointerEvents: 'none', zIndex: 9000 }}>{pageNumber}</div>
      )}

      {mode === 'edit' && showGuides && (
        <>
          <div style={{ position: 'absolute', left: `${area.left}mm`, top: `${area.top}mm`, width: `${area.width}mm`, height: `${area.height}mm`, border: '0.2mm dashed rgba(80,200,255,.75)', pointerEvents: 'none', zIndex: 9500 }} />
          {s.bindingMarginMm > 0 && (
            <div title="Binding zone – keep content out of this strip" style={{ position: 'absolute', top: 0, bottom: 0, [bindingSide(pageNumber)]: 0, width: `${s.marginsMm[bindingSide(pageNumber)] + s.bindingMarginMm}mm`, background: 'repeating-linear-gradient(45deg, rgba(255,80,80,.16) 0 1.2mm, transparent 1.2mm 2.4mm)', pointerEvents: 'none', zIndex: 9400 }} />
          )}
        </>
      )}
    </div>
  );
}
