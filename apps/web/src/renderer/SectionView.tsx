import { useLayoutEffect, useRef } from 'react';
import type { SectionDTO, ThemeConfig } from '@gc/shared-types';
import type { ReactNode } from 'react';
import { ComboCard, FoldRibbon, ItemCard, type CardOptions, type RenderMode } from './cards';
import { combosForSection, itemsForSection, type MenuData } from './menuData';
import { backgroundStyle } from './styles';
import { MM_PX } from './tokens';

function Heading({ section, theme, mode }: { section: SectionDTO; theme: ThemeConfig; mode: RenderMode }) {
  const c = theme.colors;
  const kind = section.config.headingStyle === 'theme' ? theme.headerStyle : section.config.headingStyle;
  const display = theme.fonts.display ?? theme.fonts.heading;
  const base = { fontFamily: `"${theme.fonts.heading}", serif`, fontWeight: 700, textTransform: 'uppercase' as const, lineHeight: 1.1, letterSpacing: '0.4pt' };
  const sub = section.subtitle && <div style={{ fontFamily: `"${theme.fonts.body}", sans-serif`, fontSize: '6.5pt', color: c.text, opacity: 0.8, marginTop: '1mm' }}>{section.subtitle}</div>;
  const o: CardOptions = { theme, mode, showDescription: true, showPrice: true, showQuantity: true, priceStyle: 'badge', imagePosition: 'top' };
  let body: ReactNode;
  switch (kind) {
    case 'brush-red':
      body = <span style={{ ...base, display: 'inline-block', background: c.special, color: '#fff', fontSize: '12pt', padding: '1.3mm 8mm', clipPath: 'polygon(0 12%,2% 0,50% 6%,98% 0,100% 14%,99% 88%,100% 100%,48% 94%,2% 100%,0 86%)' }}>{section.title}</span>;
      break;
    case 'ribbon':
      body = <span style={{ ...base, display: 'inline-block', background: c.accent, color: c.priceBadgeText, fontSize: '11pt', padding: '1.2mm 8mm', clipPath: 'polygon(0 0,100% 0,96% 50%,100% 100%,0 100%,4% 50%)' }}>{section.title}</span>;
      break;
    case 'gold-bar':
      body = (
        <div>
          <span style={{ ...base, color: c.heading, fontSize: '13pt' }}>{section.title}</span>
          <div style={{ height: '0.7mm', margin: '1.2mm auto 0', width: '40%', background: `linear-gradient(90deg, transparent, ${c.accent}, transparent)` }} />
        </div>
      );
      break;
    case 'fold-ribbon':
      body = <FoldRibbon text={section.title} o={o} size="14pt" />;
      break;
    case 'glow-banner':
      body = (
        <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
          <div style={{ flex: 1, height: '0.5mm', background: `linear-gradient(90deg, transparent, ${c.accent})`, boxShadow: `0 0 1.5mm ${c.accent}` }} />
          <span style={{ fontFamily: `"${display}", serif`, fontStyle: 'italic', fontWeight: 700, fontSize: '16pt', color: c.heading, textShadow: `0 0 1.6mm ${c.accent}, 0 0 4mm ${c.accent}88`, lineHeight: 1.1 }}>{section.title}</span>
          <div style={{ flex: 1, height: '0.5mm', background: `linear-gradient(270deg, transparent, ${c.accent})`, boxShadow: `0 0 1.5mm ${c.accent}` }} />
        </div>
      );
      break;
    case 'tag':
      body = <span style={{ ...base, display: 'inline-block', background: c.accent, color: c.priceBadgeText, fontSize: '12pt', padding: '1.3mm 7mm', borderRadius: '1.2mm 7mm 1.2mm 7mm', boxShadow: '0 0.6mm 1.2mm rgba(0,0,0,.35)' }}>{section.title}</span>;
      break;
    case 'pill':
      body = <span style={{ ...base, display: 'inline-block', border: `0.45mm solid ${c.accent}`, color: c.heading, fontSize: '11pt', padding: '1mm 7mm', borderRadius: '10mm', letterSpacing: '1pt', boxShadow: theme.card?.glow ? `0 0 1.4mm ${c.accent}88` : undefined }}>{section.title}</span>;
      break;
    case 'underline':
      body = (
        <div style={{ textAlign: 'left' }}>
          <span style={{ ...base, color: c.heading, fontSize: '15pt', textTransform: 'none', fontFamily: `"${display}", serif`, fontStyle: 'italic' }}>{section.title}</span>
          <div style={{ height: '0.4mm', marginTop: '1mm', background: `linear-gradient(90deg, ${c.accent}, ${c.accent}00)` }} />
        </div>
      );
      break;
    case 'stamp':
      body = <span style={{ ...base, display: 'inline-block', border: `0.5mm double ${c.accent}`, color: c.heading, fontSize: '11pt', padding: '1.2mm 6mm', letterSpacing: '1.6pt' }}>{section.title}</span>;
      break;
    default:
      body = <span style={{ ...base, color: c.heading, fontSize: '13pt' }}>{section.title}</span>;
  }
  return (
    <div style={{ textAlign: kind === 'underline' ? 'left' : 'center', marginBottom: '2.8mm' }}>
      {body}
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
        <Heading section={section} theme={theme} mode={mode} />
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
