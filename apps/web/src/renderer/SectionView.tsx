import { useLayoutEffect, useRef } from 'react';
import type { SectionDTO, ThemeConfig } from '@gc/shared-types';
import { ComboCard, ItemCard, type CardOptions, type RenderMode } from './cards';
import { combosForSection, itemsForSection, type MenuData } from './menuData';
import { backgroundStyle } from './styles';
import { MM_PX } from './tokens';

function Heading({ section, theme }: { section: SectionDTO; theme: ThemeConfig }) {
  const c = theme.colors;
  const style = section.config.headingStyle === 'theme' ? theme.headerStyle : section.config.headingStyle;
  const base = { fontFamily: `"${theme.fonts.heading}", serif`, fontWeight: 700, textTransform: 'uppercase' as const, lineHeight: 1.1, letterSpacing: '0.4pt' };
  const sub = section.subtitle && <div style={{ fontFamily: `"${theme.fonts.body}", sans-serif`, fontSize: '6.5pt', color: c.text, opacity: 0.8, marginTop: '1mm' }}>{section.subtitle}</div>;
  return (
    <div style={{ textAlign: 'center', marginBottom: '2.5mm' }}>
      {style === 'brush-red' ? (
        <span style={{ ...base, display: 'inline-block', background: c.special, color: '#fff', fontSize: '12pt', padding: '1.3mm 8mm', clipPath: 'polygon(0 12%,2% 0,50% 6%,98% 0,100% 14%,99% 88%,100% 100%,48% 94%,2% 100%,0 86%)' }}>{section.title}</span>
      ) : style === 'ribbon' ? (
        <span style={{ ...base, display: 'inline-block', background: c.accent, color: c.priceBadgeText, fontSize: '11pt', padding: '1.2mm 8mm', clipPath: 'polygon(0 0,100% 0,96% 50%,100% 100%,0 100%,4% 50%)' }}>{section.title}</span>
      ) : style === 'gold-bar' ? (
        <div>
          <span style={{ ...base, color: c.heading, fontSize: '13pt' }}>{section.title}</span>
          <div style={{ height: '0.7mm', margin: '1.2mm auto 0', width: '40%', background: `linear-gradient(90deg, transparent, ${c.accent}, transparent)` }} />
        </div>
      ) : (
        <span style={{ ...base, color: c.heading, fontSize: '13pt' }}>{section.title}</span>
      )}
      {sub}
    </div>
  );
}

/** Renders one menu section (heading + cards) and reports its natural content height in mm. */
export function SectionView({ section, data, theme, mode, onMeasure }: { section: SectionDTO; data: MenuData; theme: ThemeConfig; mode: RenderMode; onMeasure?: (heightMm: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cfg = section.config;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !onMeasure) return;
    const report = () => onMeasure(Math.round((el.offsetHeight / MM_PX) * 10) / 10);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onMeasure, section, data]);

  const o: CardOptions = { theme, mode, showDescription: cfg.showDescription, showPrice: cfg.showPrice, showQuantity: cfg.showQuantity, priceStyle: cfg.priceStyle, imagePosition: cfg.imagePosition };
  const isCombo = cfg.cardTemplate === 'combo';
  const combos = isCombo ? combosForSection(section, data) : [];
  const allItems = isCombo ? [] : itemsForSection(section, data);
  const limit = cfg.rows ? cfg.columns * cfg.rows : Infinity;
  const items = allItems.slice(0, limit);
  const cols = cfg.cardTemplate === 'compact-list' ? Math.max(1, Math.min(cfg.columns, 2)) : cfg.columns;

  const bg = section.backgroundId ? data.backgrounds.find((b) => b.id === section.backgroundId) : undefined;
  const bgStyle = bg ? backgroundStyle(bg.config, bg.media) : {};
  const pad = bg ? bg.config.paddingMm : 1.5;
  const border = cfg.border.enabled ? { border: `${cfg.border.widthMm}mm ${cfg.border.style} ${cfg.border.color}` } : {};

  return (
    <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', ...bgStyle, ...border }}>
      <div ref={ref} style={{ padding: `${pad}mm`, boxSizing: 'border-box' }}>
        <Heading section={section} theme={theme} />
        {section.image && <img src={section.image.url} alt="" style={{ display: 'block', margin: '0 auto 2.5mm', maxWidth: '100%', maxHeight: '28mm', objectFit: 'contain' }} />}
        {cfg.showDescription && section.description && <div style={{ textAlign: 'center', fontSize: '6.5pt', color: theme.colors.text, opacity: 0.85, marginBottom: '2.5mm', fontFamily: `"${theme.fonts.body}", sans-serif` }}>{section.description}</div>}

        {(isCombo ? combos.length : items.length) === 0 ? (
          mode !== 'export' && <div style={{ border: `0.2mm dashed ${theme.colors.accentAlt}88`, borderRadius: '2mm', padding: '4mm', textAlign: 'center', fontSize: '6.5pt', color: theme.colors.text, opacity: 0.7 }}>{isCombo ? 'No combos assigned to this section' : 'No active items – assign categories or items to this section'}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: cfg.cardTemplate === 'compact-list' ? '0 5mm' : '3mm', alignItems: 'stretch' }}>
            {isCombo ? combos.map((c) => <ComboCard key={c.id} combo={c} o={o} />) : items.map((i) => <ItemCard key={i.id} item={i} template={cfg.cardTemplate} o={o} />)}
          </div>
        )}
        {mode === 'edit' && allItems.length > items.length && (
          <div style={{ marginTop: '1.5mm', fontSize: '5.5pt', color: '#ff8a8a', textAlign: 'center' }}>{allItems.length - items.length} more item(s) hidden by the row limit</div>
        )}
      </div>
    </div>
  );
}
