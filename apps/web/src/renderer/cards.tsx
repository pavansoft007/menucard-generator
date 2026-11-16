import type { CSSProperties, ReactNode } from 'react';
import type { CardTemplate, ComboDTO, IconName, ItemDTO, MediaDTO, SectionConfig, ThemeConfig, VariantDTO } from '@gc/shared-types';
import { LineIcon } from './icons';
import { hexA, isDark, shadowCss } from './styles';

/** `gallery` is the template-picker preview: like `preview`, but empty photo slots show tasteful artwork. */
export type RenderMode = 'edit' | 'preview' | 'export' | 'gallery';

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
const displayFont = (t: ThemeConfig) => t.fonts.display ?? t.fonts.heading;

/** Linear mix of two hex colours (t = 0 -> a, t = 1 -> b). */
export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => { const x = h.replace('#', ''); const f = x.length === 3 ? x.split('').map((c) => c + c).join('') : x.slice(0, 6); const n = parseInt(f, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(r1! + (r2! - r1!) * t)}${h(g1! + (g2! - g1!) * t)}${h(b1! + (b2! - b1!) * t)}`;
}

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

const ICON_HINTS: [RegExp, IconName][] = [
  [/chicken|wing|leg|lollipop|popcorn|fried/i, 'drumstick'], [/fries|loaded/i, 'fries'], [/roll|sandwich|wrap/i, 'sandwich'],
  [/mojito|shake|cola|drink|lagoon|water|juice|soda|mocktail/i, 'drink'], [/burger/i, 'burger'], [/pizza/i, 'pizza'],
  [/momo|dumpling/i, 'dumpling'], [/ice|cream|kulfi|sundae/i, 'icecream'], [/coffee|tea|latte/i, 'coffee'],
];
const iconFor = (hint?: string): IconName => ICON_HINTS.find(([re]) => hint && re.test(hint))?.[1] ?? 'chef-hat';

/** Photo slot. Photos are never cropped (contain). Empty slots: dashed box while designing, artwork in the gallery, nothing when exporting. */
function ImageBox({ media, o, aspect, style, hint }: { media: MediaDTO | null; o: CardOptions; aspect: string; style?: CSSProperties; hint?: string }) {
  if (!media && o.mode === 'export') return null;
  const c = o.theme.colors;
  if (!media && o.mode === 'gallery') {
    return (
      <div style={{ aspectRatio: aspect, borderRadius: `${Math.min(o.theme.borderRadiusMm, 4)}mm`, background: `radial-gradient(closest-side at 50% 45%, ${hexA(c.accent, isDark(c.background) ? 0.4 : 0.3)} 0%, ${hexA(c.accentAlt, 0.14)} 62%, transparent 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', ...style }}>
        <div style={{ width: '52%', maxHeight: '70%', aspectRatio: '1' }}><LineIcon name={iconFor(hint)} color={hexA(c.accent, 0.85)} strokeMm={0.5} sizeMm={20} /></div>
      </div>
    );
  }
  return (
    <div style={{ aspectRatio: aspect, background: media ? 'transparent' : c.background, border: media ? 0 : `0.2mm dashed ${c.accentAlt}66`, borderRadius: `${Math.min(o.theme.borderRadiusMm, 3)}mm`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: 'none', ...style }}>
      {media ? (
        <img src={media.url} alt={media.altText ?? ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : (
        <span style={{ fontSize: '5pt', color: `${c.text}55`, fontFamily: font(o.theme.fonts.body) }}>No image</span>
      )}
    </div>
  );
}

/** Glossy gold pill (gradient + highlight + soft shadow) used by the photo-first designs. */
const goldPill = (o: CardOptions, big?: boolean): CSSProperties => {
  const c = o.theme.colors;
  return {
    background: `linear-gradient(180deg, ${mix(c.priceBadgeBg, '#ffffff', 0.42)} 0%, ${c.priceBadgeBg} 48%, ${mix(c.priceBadgeBg, '#000000', 0.22)} 100%)`,
    color: c.priceBadgeText,
    boxShadow: `0 0 0 0.25mm ${mix(c.priceBadgeBg, '#000000', 0.35)}, 0 0.5mm 1.4mm rgba(0,0,0,.5), inset 0 0.35mm 0.5mm rgba(255,255,255,.6)`,
    padding: big ? '0.9mm 3.4mm' : '0.5mm 2.6mm',
    borderRadius: '10mm',
    fontFamily: font(o.theme.fonts.price),
    fontWeight: 700,
    fontSize: big ? '11.5pt' : '8.5pt',
    maxWidth: '100%',
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
    textShadow: '0 0.15mm 0 rgba(255,255,255,.35)',
  };
};

function Price({ v, o, big, style }: { v: VariantDTO; o: CardOptions; big?: boolean; style?: PriceStyle }) {
  if (v.price === null) return null;
  const c = o.theme.colors;
  const shown = v.discountPrice ?? v.price;
  const kind = style ?? o.priceStyle;
  const size = big ? '11pt' : '8pt';
  const strike = v.discountPrice !== null && <s style={{ fontSize: '6pt', opacity: 0.6, marginLeft: '1mm', fontWeight: 400 }}>{money(v.price)}</s>;
  if (kind === 'pill-gold') return <span style={goldPill(o, big)}>{money(shown)}{strike}</span>;
  if (kind === 'pill-outline') {
    return <span style={{ border: `0.35mm solid ${c.accent}`, color: c.accent, borderRadius: '10mm', padding: big ? '0.9mm 4mm' : '0.4mm 2.4mm', fontFamily: font(o.theme.fonts.price), fontWeight: 700, fontSize: big ? '12pt' : '8.5pt', whiteSpace: 'nowrap', lineHeight: 1.2, boxShadow: o.theme.card?.glow ? `0 0 1.2mm ${hexA(c.accent, 0.7)}` : undefined }}>{money(shown)}{strike}</span>;
  }
  if (kind === 'circle') {
    const d = big ? '15mm' : '10.5mm';
    return <span style={{ ...goldPill(o), width: d, height: d, borderRadius: '50%', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: big ? '10.5pt' : '7.6pt', flex: 'none' }}>{money(shown)}</span>;
  }
  if (kind === 'badge') {
    return <span style={{ background: c.priceBadgeBg, color: c.priceBadgeText, padding: big ? '0.8mm 3mm' : '0.4mm 2mm', borderRadius: '10mm', fontFamily: font(o.theme.fonts.price), fontWeight: 700, fontSize: size, whiteSpace: 'nowrap', lineHeight: 1.25 }}>{money(shown)}{strike}</span>;
  }
  return <span style={{ color: c.accent, fontFamily: font(o.theme.fonts.price), fontWeight: 700, fontSize: size, whiteSpace: 'nowrap' }}>{money(shown)}{strike}</span>;
}
type PriceStyle = SectionConfig['priceStyle'];

const isPill = (s: PriceStyle) => s === 'pill-gold' || s === 'pill-outline' || s === 'circle';

/** Size label shown as a dark outlined chip next to a pill price: "4 Pcs [₹159]". */
function SizeChip({ text, o }: { text: string; o: CardOptions }) {
  const c = o.theme.colors;
  const dark = isDark(c.surface);
  return <span style={{ border: `0.3mm solid ${hexA(c.accent, 0.85)}`, background: dark ? 'rgba(0,0,0,.55)' : hexA(c.text, 0.07), color: c.text, borderRadius: '10mm', padding: '0.45mm 2.2mm', fontSize: '6.6pt', fontWeight: 600, fontFamily: font(o.theme.fonts.body), whiteSpace: 'nowrap' }}>{text}</span>;
}

function Prices({ item, o, align = 'start', bigFirst, forcePill }: { item: ItemDTO; o: CardOptions; align?: 'start' | 'end'; bigFirst?: boolean; forcePill?: boolean }) {
  if (!o.showPrice) return null;
  const vs = item.variants.filter((v) => v.isActive && v.price !== null);
  if (!vs.length) return null;
  const c = o.theme.colors;
  const single = vs.length === 1;
  const style: PriceStyle = forcePill && !isPill(o.priceStyle) ? 'pill-gold' : o.priceStyle;
  const pill = isPill(style);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: pill ? '1.2mm' : '0.8mm', alignItems: align === 'end' ? 'flex-end' : pill && single ? 'center' : 'stretch', minWidth: 0 }}>
      {vs.map((v, i) => {
        const hideLabel = !o.showQuantity || (single && style !== 'inline' && /^regular/i.test(v.label));
        return (
          <div key={v.id} style={{ display: 'flex', flexDirection: pill && single && !hideLabel && align !== 'end' ? 'column' : 'row', alignItems: 'center', justifyContent: align === 'end' ? 'flex-end' : style === 'inline' ? 'flex-start' : 'space-between', gap: pill && single ? '1.2mm' : style === 'inline' ? '1.6mm' : '2mm', minWidth: 0 }}>
            {!hideLabel && (pill ? <SizeChip text={v.label} o={o} /> : <span style={{ fontSize: '6.2pt', color: c.text, opacity: 0.85, fontFamily: font(o.theme.fonts.body) }}>{v.label}{style === 'inline' ? ' –' : ''}</span>)}
            <Price v={v} o={o} big={!!bigFirst && i === 0} style={style} />
          </div>
        );
      })}
    </div>
  );
}

const Tag = ({ bg, fg, t, border }: { bg: string; fg: string; t: string; border?: string }) => (
  <span style={{ background: bg, color: fg, fontSize: '4.4pt', fontWeight: 700, letterSpacing: '0.2pt', padding: '0.3mm 1.2mm', borderRadius: '1mm', border: border ? `0.2mm solid ${border}` : 0, fontFamily: 'Poppins, sans-serif' }}>{t}</span>
);

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

function Desc({ item, o }: { item: ItemDTO; o: CardOptions }) {
  const text = item.shortDescription || item.description;
  if (!o.showDescription || !text) return null;
  return <div style={{ fontSize: '6.2pt', lineHeight: 1.35, color: o.theme.colors.text, opacity: 0.78, fontFamily: font(o.theme.fonts.body) }}>{text}</div>;
}

/** Folded ribbon label (the red title that straddles a card's top edge). */
export function FoldRibbon({ text, o, size = '10.5pt', style }: { text: string; o: CardOptions; size?: string; style?: CSSProperties }) {
  const c = o.theme.colors;
  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <span style={{ display: 'inline-block', background: `linear-gradient(180deg, ${mix(c.special, '#ffffff', 0.18)} 0%, ${c.special} 55%, ${mix(c.special, '#000000', 0.25)} 100%)`, color: '#fff', fontFamily: font(displayFont(o.theme)), fontStyle: 'italic', fontWeight: 700, fontSize: size, lineHeight: 1.1, padding: '1.1mm 6mm 1.1mm 4.2mm', clipPath: 'polygon(0 0, 100% 0, 94% 50%, 100% 100%, 0 100%)', filter: 'drop-shadow(0 0.4mm 0.6mm rgba(0,0,0,.6))', textShadow: '0 0.25mm 0.5mm rgba(0,0,0,.45)', whiteSpace: 'nowrap' }}>{text}</span>
    </div>
  );
}

/** Card chrome from the theme: surface style (solid / glass / gradient / outline / paper) and optional neon glow. */
export const cardBox = (o: CardOptions, extra?: CSSProperties): CSSProperties => {
  const c = o.theme.colors;
  const surface = o.theme.card?.surface ?? 'solid';
  const glow = o.theme.card?.glow;
  const bg: CSSProperties =
    surface === 'glass' ? { background: `linear-gradient(145deg, ${hexA('#ffffff', 0.17)}, ${hexA('#ffffff', 0.05)})` }
    : surface === 'gradient' ? { background: `linear-gradient(160deg, ${c.surface} 0%, ${mix(c.surface, c.background, 0.75)} 100%)` }
    : surface === 'outline' ? { background: 'transparent' }
    : { background: c.surface };
  const border = surface === 'glass' ? `0.25mm solid ${hexA('#ffffff', 0.3)}` : `0.35mm ${surface === 'paper' ? 'dashed' : 'solid'} ${glow ? c.accent : c.accentAlt}`;
  return {
    ...bg,
    border,
    borderRadius: `${o.theme.borderRadiusMm}mm`,
    boxShadow: glow ? shadowCss('neon', c.accent) : shadowCss(o.theme.shadow, c.accent),
    boxSizing: 'border-box',
    overflow: 'hidden',
    color: c.text,
    ...extra,
  };
};

/* --------------------------------------------------------------- templates */
function Premium({ item, o }: { item: ItemDTO; o: CardOptions }) {
  const dir = ({ top: 'column', bottom: 'column-reverse', left: 'row', right: 'row-reverse' } as const)[o.imagePosition];
  const side = o.imagePosition === 'left' || o.imagePosition === 'right';
  return (
    <div style={cardBox(o, { padding: '2.5mm', display: 'flex', flexDirection: dir, gap: '2.2mm', height: '100%' })}>
      <ImageBox media={item.mainMedia} o={o} aspect={side ? '1' : '4 / 3'} hint={item.name} style={side ? { width: '38%' } : { width: '100%' }} />
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
      <ImageBox media={item.mainMedia} o={o} aspect="1" hint={item.name} style={{ width: '34%' }} />
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
      <ImageBox media={item.mainMedia} o={o} aspect="16 / 10" hint={item.name} style={{ width: '100%', borderRadius: 0 }} />
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
      <ImageBox media={item.mainMedia} o={o} aspect="1 / 0.8" hint={item.name} style={{ width: '100%' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2mm', flex: 1 }}>
        <Name item={item} o={o} size="11pt" />
        <Desc item={item} o={o} />
        <div style={{ marginTop: 'auto' }}><Prices item={item} o={o} bigFirst /></div>
      </div>
    </div>
  );
}

/** Photo-first card: a folded ribbon title straddling the top edge, a large photo, and stacked gold price pills. */
function HeroRibbon({ item, o }: { item: ItemDTO; o: CardOptions }) {
  const c = o.theme.colors;
  const flip = o.imagePosition === 'right';
  const hasPhoto = !!item.mainMedia || o.mode === 'gallery' || o.mode === 'edit' || o.mode === 'preview';
  return (
    <div style={{ position: 'relative', height: '100%', paddingTop: '3.2mm', boxSizing: 'border-box' }}>
      <div style={cardBox(o, { height: '100%', padding: '5.2mm 2.6mm 2.6mm', display: 'flex', flexDirection: flip ? 'row-reverse' : 'row', gap: '2.4mm', alignItems: 'center', background: `linear-gradient(160deg, ${mix(c.surface, '#ffffff', 0.04)} 0%, ${mix(c.surface, c.background, 0.55)} 100%)` })}>
        {hasPhoto && <ImageBox media={item.mainMedia} o={o} aspect="1.1 / 1" hint={item.name} style={{ width: '54%', filter: item.mainMedia ? 'drop-shadow(0 1mm 1.6mm rgba(0,0,0,.55))' : undefined }} />}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.6mm', justifyContent: 'center' }}>
          <Desc item={item} o={o} />
          <Prices item={item} o={o} forcePill bigFirst={item.variants.filter((v) => v.isActive && v.price !== null).length === 1} />
        </div>
      </div>
      <div style={{ position: 'absolute', top: 0, left: '3mm', zIndex: 2 }}>
        <FoldRibbon text={item.name} o={o} size="10.5pt" />
      </div>
      {item.dietType && <div style={{ position: 'absolute', top: '4.5mm', right: '3mm', zIndex: 2 }}><DietMark diet={item.dietType} /></div>}
    </div>
  );
}

/** Full-bleed photo with a dark gradient and the title + price pills laid over the bottom. */
function Poster({ item, o }: { item: ItemDTO; o: CardOptions }) {
  const c = o.theme.colors;
  return (
    <div style={cardBox(o, { position: 'relative', height: '100%', minHeight: '46mm', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: `linear-gradient(160deg, ${mix(c.surface, c.accent, 0.12)}, ${c.background})` })}>
      {item.mainMedia ? (
        <img src={item.mainMedia.url} alt={item.mainMedia.altText ?? ''} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 38%' }} />
      ) : o.mode !== 'export' ? (
        <div style={{ position: 'absolute', inset: '0 0 38% 0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(circle at 50% 50%, ${hexA(c.accent, 0.3)}, transparent 70%)` }}>
          <div style={{ width: '30%', aspectRatio: '1' }}><LineIcon name={iconFor(item.name)} color={hexA(c.accent, 0.8)} strokeMm={0.5} sizeMm={18} /></div>
        </div>
      ) : null}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(0deg, ${hexA(isDark(c.background) ? mix(c.background, '#000000', 0.35) : '#000000', 0.9)} 0%, ${hexA(isDark(c.background) ? mix(c.background, '#000000', 0.2) : '#000000', 0.55)} 38%, transparent 68%)` }} />
      <div style={{ position: 'relative', padding: '2.6mm', display: 'flex', flexDirection: 'column', gap: '1.3mm' }}>
        <div style={{ fontFamily: font(displayFont(o.theme)), fontSize: '12pt', fontWeight: 700, color: '#fff', lineHeight: 1.1, textShadow: '0 0.3mm 1mm rgba(0,0,0,.7)' }}>{item.name}</div>
        <Desc item={item} o={{ ...o, theme: { ...o.theme, colors: { ...c, text: '#ffffff' } } }} />
        <Prices item={item} o={o} forcePill />
      </div>
    </div>
  );
}

/** Round photo with an accent ring, name and dotted-leader prices. Good for rustic / minimal styles. */
function CirclePhoto({ item, o }: { item: ItemDTO; o: CardOptions }) {
  const c = o.theme.colors;
  const showPhoto = !!item.mainMedia || o.mode !== 'export';
  return (
    <div style={{ display: 'flex', gap: '3mm', alignItems: 'center', padding: '1.6mm 0', height: '100%' }}>
      {showPhoto && (
        <div style={{ width: '21mm', height: '21mm', flex: 'none', borderRadius: '50%', border: `0.5mm solid ${c.accent}`, padding: '0.6mm', boxSizing: 'border-box', boxShadow: o.theme.card?.glow ? shadowCss('neon', c.accent) : undefined }}>
          <ImageBox media={item.mainMedia} o={o} aspect="1" hint={item.name} style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1mm' }}>
        <Name item={item} o={o} size="9.5pt" />
        <Desc item={item} o={o} />
        <Prices item={item} o={o} />
      </div>
    </div>
  );
}

export function ComboCard({ combo, o }: { combo: ComboDTO; o: CardOptions }) {
  const c = o.theme.colors;
  return (
    <div style={cardBox(o, { padding: '2.5mm', display: 'flex', flexDirection: 'column', gap: '2mm', height: '100%', border: `0.5mm solid ${c.accent}` })}>
      <ImageBox media={combo.image} o={o} aspect="16 / 10" hint={combo.name} style={{ width: '100%' }} />
      <div style={{ fontFamily: font(o.theme.fonts.heading), fontWeight: 700, fontSize: '10pt', color: c.heading, lineHeight: 1.15 }}>{combo.name}</div>
      {o.showDescription && combo.description && <div style={{ fontSize: '6.2pt', opacity: 0.8, fontFamily: font(o.theme.fonts.body) }}>{combo.description}</div>}
      <ul style={{ margin: 0, paddingLeft: '3.2mm', fontSize: '6.4pt', lineHeight: 1.4, fontFamily: font(o.theme.fonts.body) }}>
        {combo.items.map((i) => (
          <li key={i.id}>{i.quantity > 1 ? `${i.quantity} × ` : ''}{i.itemName}{o.showQuantity ? ` (${i.variantLabel})` : ''}</li>
        ))}
      </ul>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2mm' }}>
        {combo.savings !== null && combo.savings > 0 ? <span style={{ fontSize: '6pt', color: c.accent, fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>SAVE {money(combo.savings)}</span> : <span />}
        {o.showPrice && <Price v={{ id: 0, label: '', quantity: null, unit: null, price: combo.sellingPrice, discountPrice: null, displayOrder: 0, isActive: true, media: null }} o={o} big style={isPill(o.priceStyle) ? o.priceStyle : 'badge'} />}
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
  'hero-ribbon': 'Ribbon title + photo + price pills',
  poster: 'Poster (photo with overlay text)',
  'circle-photo': 'Round photo + details',
};

/** Renders one menu item with the chosen template (the combo template needs a combo; items fall back to premium). */
export function ItemCard({ item, template, o }: { item: ItemDTO; template: CardTemplate; o: CardOptions }): ReactNode {
  switch (template) {
    case 'image-left': return <ImageLeft item={item} o={o} />;
    case 'image-top': return <ImageTop item={item} o={o} />;
    case 'compact-list': return <CompactList item={item} o={o} />;
    case 'featured': return <Featured item={item} o={o} />;
    case 'hero-ribbon': return <HeroRibbon item={item} o={o} />;
    case 'poster': return <Poster item={item} o={o} />;
    case 'circle-photo': return <CirclePhoto item={item} o={o} />;
    default: return <Premium item={item} o={o} />;
  }
}

