import type { CSSProperties, ReactNode } from 'react';
import type { CardTemplate, ComboDTO, ItemDTO, MediaDTO, SectionConfig, ThemeConfig, VariantDTO } from '@gc/shared-types';
import { shadowCss } from './styles';

export type RenderMode = 'edit' | 'preview' | 'export';

export interface CardOptions {
  theme: ThemeConfig;
  mode: RenderMode;
  showDescription: boolean;
  showPrice: boolean;
  showQuantity: boolean;
  priceStyle: SectionConfig['priceStyle'];
  imagePosition: SectionConfig['imagePosition'];
}

const money = (n: number) => `₹${Number.isInteger(n) ? n : n.toFixed(2)}`;
const font = (name: string) => `"${name}", sans-serif`;

/* ------------------------------------------------------------------ pieces */
function DietMark({ diet }: { diet: ItemDTO['dietType'] }) {
  if (!diet) return null;
  const c = diet === 'veg' ? '#2e9e44' : '#c91420';
  return (
    <span aria-label={diet === 'veg' ? 'Vegetarian' : 'Non-vegetarian'} style={{ display: 'inline-block', width: '2.6mm', height: '2.6mm', border: `0.3mm solid ${c}`, padding: '0.35mm', boxSizing: 'border-box', flex: 'none', background: '#fff' }}>
      <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: '50%', background: c }} />
    </span>
  );
}

/** No-image slot: visible while designing, hidden in the final export so no placeholder is ever printed. */
function ImageBox({ media, o, aspect, style }: { media: MediaDTO | null; o: CardOptions; aspect: string; style?: CSSProperties }) {
  if (!media && o.mode === 'export') return null;
  return (
    <div style={{ aspectRatio: aspect, background: media ? 'transparent' : `${o.theme.colors.background}`, border: media ? 0 : `0.2mm dashed ${o.theme.colors.accentAlt}66`, borderRadius: `${Math.min(o.theme.borderRadiusMm, 3)}mm`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: 'none', ...style }}>
      {media ? (
        // contain: never crop the food photo
        <img src={media.url} alt={media.altText ?? ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : (
        <span style={{ fontSize: '5pt', color: `${o.theme.colors.text}55`, fontFamily: font(o.theme.fonts.body) }}>No image</span>
      )}
    </div>
  );
}

function Price({ v, o, big }: { v: VariantDTO; o: CardOptions; big?: boolean }) {
  if (v.price === null) return null;
  const c = o.theme.colors;
  const shown = v.discountPrice ?? v.price;
  const size = big ? '11pt' : '8pt';
  const strike = v.discountPrice !== null && <s style={{ fontSize: '6pt', opacity: 0.6, marginLeft: '1mm', fontWeight: 400 }}>{money(v.price)}</s>;
  if (o.priceStyle === 'badge') {
    return <span style={{ background: c.priceBadgeBg, color: c.priceBadgeText, padding: big ? '0.8mm 3mm' : '0.4mm 2mm', borderRadius: '10mm', fontFamily: font(o.theme.fonts.price), fontWeight: 700, fontSize: size, whiteSpace: 'nowrap', lineHeight: 1.25 }}>{money(shown)}{strike}</span>;
  }
  return <span style={{ color: c.accent, fontFamily: font(o.theme.fonts.price), fontWeight: 700, fontSize: size, whiteSpace: 'nowrap' }}>{money(shown)}{strike}</span>;
}

const variantText = (v: VariantDTO) => v.label;

function Prices({ item, o, align = 'start', bigFirst }: { item: ItemDTO; o: CardOptions; align?: 'start' | 'end'; bigFirst?: boolean }) {
  if (!o.showPrice) return null;
  const vs = item.variants.filter((v) => v.isActive && v.price !== null);
  if (!vs.length) return null;
  const c = o.theme.colors;
  const single = vs.length === 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8mm', alignItems: align === 'end' ? 'flex-end' : 'stretch' }}>
      {vs.map((v, i) => (
        <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: align === 'end' ? 'flex-end' : 'space-between', gap: '2mm' }}>
          {o.showQuantity && !(single && o.priceStyle !== 'inline' && /^regular/i.test(v.label)) && (
            <span style={{ fontSize: '6.2pt', color: c.text, opacity: 0.85, fontFamily: font(o.theme.fonts.body) }}>{variantText(v)}{o.priceStyle === 'inline' ? ' –' : ''}</span>
          )}
          <Price v={v} o={o} big={bigFirst && i === 0} />
        </div>
      ))}
    </div>
  );
}

function Name({ item, o, size = '9.5pt' }: { item: ItemDTO; o: CardOptions; size?: string }) {
  const c = o.theme.colors;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.2mm', flexWrap: 'wrap' }}>
      <DietMark diet={item.dietType} />
      <span style={{ fontFamily: font(o.theme.fonts.heading), fontWeight: 700, fontSize: size, color: c.heading, lineHeight: 1.15 }}>{item.name}</span>
      {item.isBestseller && <Tag bg={c.special} fg="#fff" t="BESTSELLER" />}
      {item.isNew && <Tag bg={c.accent} fg={c.priceBadgeText} t="NEW" />}
      {item.isSpicy && <Tag bg="transparent" fg={c.special} t="🌶 SPICY" border={c.special} />}
    </div>
  );
}
const Tag = ({ bg, fg, t, border }: { bg: string; fg: string; t: string; border?: string }) => (
  <span style={{ background: bg, color: fg, fontSize: '4.4pt', fontWeight: 700, letterSpacing: '0.2pt', padding: '0.3mm 1.2mm', borderRadius: '1mm', border: border ? `0.2mm solid ${border}` : 0, fontFamily: 'Poppins, sans-serif' }}>{t}</span>
);

function Desc({ item, o }: { item: ItemDTO; o: CardOptions }) {
  const text = item.shortDescription || item.description;
  if (!o.showDescription || !text) return null;
  return <div style={{ fontSize: '6.2pt', lineHeight: 1.35, color: o.theme.colors.text, opacity: 0.78, fontFamily: font(o.theme.fonts.body) }}>{text}</div>;
}

const cardBox = (o: CardOptions, extra?: CSSProperties): CSSProperties => ({
  background: o.theme.colors.surface,
  border: `0.35mm solid ${o.theme.colors.accentAlt}`,
  borderRadius: `${o.theme.borderRadiusMm}mm`,
  boxShadow: shadowCss(o.theme.shadow, o.theme.colors.accent),
  boxSizing: 'border-box',
  overflow: 'hidden',
  color: o.theme.colors.text,
  ...extra,
});

/* --------------------------------------------------------------- templates */
function Premium({ item, o }: { item: ItemDTO; o: CardOptions }) {
  const dir = ({ top: 'column', bottom: 'column-reverse', left: 'row', right: 'row-reverse' } as const)[o.imagePosition];
  const side = o.imagePosition === 'left' || o.imagePosition === 'right';
  return (
    <div style={cardBox(o, { padding: '2.5mm', display: 'flex', flexDirection: dir, gap: '2.2mm', height: '100%' })}>
      <ImageBox media={item.mainMedia} o={o} aspect={side ? '1' : '4 / 3'} style={side ? { width: '38%' } : { width: '100%' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2mm', flex: 1, minWidth: 0 }}>
        <Name item={item} o={o} />
        <Desc item={item} o={o} />
        <div style={{ marginTop: 'auto' }}><Prices item={item} o={o} /></div>
      </div>
    </div>
  );
}

function ImageLeft({ item, o }: { item: ItemDTO; o: CardOptions }) {
  return (
    <div style={cardBox(o, { padding: '2mm', display: 'flex', gap: '2.4mm', alignItems: 'stretch', height: '100%' })}>
      <ImageBox media={item.mainMedia} o={o} aspect="1" style={{ width: '34%' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1mm', flex: 1, minWidth: 0, justifyContent: 'center' }}>
        <Name item={item} o={o} size="9pt" />
        <Desc item={item} o={o} />
        <Prices item={item} o={o} />
      </div>
    </div>
  );
}

function ImageTop({ item, o }: { item: ItemDTO; o: CardOptions }) {
  return (
    <div style={cardBox(o, { display: 'flex', flexDirection: 'column', height: '100%' })}>
      <ImageBox media={item.mainMedia} o={o} aspect="16 / 10" style={{ width: '100%', borderRadius: 0 }} />
      <div style={{ padding: '2.2mm', display: 'flex', flexDirection: 'column', gap: '1.1mm', flex: 1 }}>
        <Name item={item} o={o} />
        <Desc item={item} o={o} />
        <div style={{ marginTop: 'auto' }}><Prices item={item} o={o} /></div>
      </div>
    </div>
  );
}

function CompactList({ item, o }: { item: ItemDTO; o: CardOptions }) {
  const c = o.theme.colors;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2mm', padding: '1mm 0', borderBottom: `0.2mm dotted ${c.accentAlt}88`, color: c.text }}>
      {item.mainMedia && <ImageBox media={item.mainMedia} o={o} aspect="1" style={{ width: '9mm' }} />}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.4mm' }}>
        <Name item={item} o={o} size="8.5pt" />
        <Desc item={item} o={o} />
      </div>
      <Prices item={item} o={o} align="end" />
    </div>
  );
}

function Featured({ item, o }: { item: ItemDTO; o: CardOptions }) {
  const c = o.theme.colors;
  return (
    <div style={cardBox(o, { border: `0.9mm double ${c.accent}`, padding: '3mm', display: 'flex', flexDirection: 'column', gap: '2.4mm', position: 'relative', height: '100%', boxShadow: shadowCss('gold-glow', c.accent) })}>
      <div style={{ position: 'absolute', top: '3mm', left: '-0.5mm', background: c.special, color: '#fff', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '5pt', letterSpacing: '0.4pt', padding: '0.7mm 3mm 0.7mm 2.4mm', borderRadius: '0 1mm 1mm 0', zIndex: 1 }}>{item.isBestseller ? 'BESTSELLER' : 'FEATURED'}</div>
      <ImageBox media={item.mainMedia} o={o} aspect="1 / 0.8" style={{ width: '100%' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2mm', flex: 1 }}>
        <Name item={item} o={o} size="11pt" />
        <Desc item={item} o={o} />
        <div style={{ marginTop: 'auto' }}><Prices item={item} o={o} bigFirst /></div>
      </div>
    </div>
  );
}

export function ComboCard({ combo, o }: { combo: ComboDTO; o: CardOptions }) {
  const c = o.theme.colors;
  return (
    <div style={cardBox(o, { padding: '2.5mm', display: 'flex', flexDirection: 'column', gap: '2mm', height: '100%', border: `0.5mm solid ${c.accent}` })}>
      <ImageBox media={combo.image} o={o} aspect="16 / 10" style={{ width: '100%' }} />
      <div style={{ fontFamily: font(o.theme.fonts.heading), fontWeight: 700, fontSize: '10pt', color: c.heading, lineHeight: 1.15 }}>{combo.name}</div>
      {o.showDescription && combo.description && <div style={{ fontSize: '6.2pt', opacity: 0.8, fontFamily: font(o.theme.fonts.body) }}>{combo.description}</div>}
      <ul style={{ margin: 0, paddingLeft: '3.2mm', fontSize: '6.4pt', lineHeight: 1.4, fontFamily: font(o.theme.fonts.body) }}>
        {combo.items.map((i) => (
          <li key={i.id}>{i.quantity > 1 ? `${i.quantity} × ` : ''}{i.itemName}{o.showQuantity ? ` (${i.variantLabel})` : ''}</li>
        ))}
      </ul>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2mm' }}>
        {combo.savings !== null && combo.savings > 0 ? <span style={{ fontSize: '6pt', color: c.accent, fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>SAVE {money(combo.savings)}</span> : <span />}
        {o.showPrice && <Price v={{ id: 0, label: '', quantity: null, unit: null, price: combo.sellingPrice, discountPrice: null, displayOrder: 0, isActive: true, media: null }} o={{ ...o, priceStyle: 'badge' }} big />}
      </div>
    </div>
  );
}

export const CARD_TEMPLATE_LABELS: Record<CardTemplate, string> = {
  premium: 'Premium food card',
  'image-left': 'Image left / details right',
  'image-top': 'Image top / details bottom',
  'compact-list': 'Compact menu list',
  featured: 'Featured item',
  combo: 'Combo card',
};

/** Renders one menu item with the chosen template (the combo template needs a combo; items fall back to premium). */
export function ItemCard({ item, template, o }: { item: ItemDTO; template: CardTemplate; o: CardOptions }): ReactNode {
  switch (template) {
    case 'image-left': return <ImageLeft item={item} o={o} />;
    case 'image-top': return <ImageTop item={item} o={o} />;
    case 'compact-list': return <CompactList item={item} o={o} />;
    case 'featured': return <Featured item={item} o={o} />;
    default: return <Premium item={item} o={o} />;
  }
}
