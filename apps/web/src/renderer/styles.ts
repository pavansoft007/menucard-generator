import type { CSSProperties } from 'react';
import type { BackgroundConfig, MediaDTO, PatternKind, ThemeConfig } from '@gc/shared-types';

/**
 * Pure config -> CSS helpers. The same functions are used by the admin previews and by the page renderer / PDF export,
 * so a background always looks identical everywhere. Physical sizes are in millimetres (print units).
 */
type Shadow = BackgroundConfig['shadow'] | ThemeConfig['shadow'];
export const shadowCss = (s: Shadow, accent = '#F5B51B') =>
  ({
    none: 'none',
    soft: '0 1mm 3mm rgba(0,0,0,.35)',
    strong: '0 2mm 6mm rgba(0,0,0,.6)',
    'gold-glow': `0 0 4mm ${accent}66`,
    neon: `0 0 1.2mm ${accent}, 0 0 4.5mm ${accent}99, inset 0 0 2.5mm ${accent}44`,
  })[s];

export const hexA = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Perceived brightness of a hex colour (0 = black, 1 = white). */
export const luminance = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
};
export const isDark = (hex: string) => luminance(hex) < 0.35;

/** One repeating tile per pattern (20 x 20 units), stroked/filled with the chosen colour. */
const TILES: Record<Exclude<PatternKind, 'none' | 'sunburst'>, (c: string, o: number) => string> = {
  dots: (c, o) => `<circle cx='10' cy='10' r='1.4' fill='${c}' fill-opacity='${o}'/>`,
  diagonal: (c, o) => `<path d='M-2 22L22 -2M-12 12L12 -12M8 32L32 8' stroke='${c}' stroke-opacity='${o}' stroke-width='1' fill='none'/>`,
  grid: (c, o) => `<path d='M0 0H20M0 0V20' stroke='${c}' stroke-opacity='${o}' stroke-width='.6' fill='none'/>`,
  chevron: (c, o) => `<path d='M0 15l10-9 10 9' stroke='${c}' stroke-opacity='${o}' stroke-width='1.2' fill='none'/>`,
  waves: (c, o) => `<path d='M0 10q5-6 10 0t10 0' stroke='${c}' stroke-opacity='${o}' stroke-width='1' fill='none'/>`,
  halftone: (c, o) => `<g fill='${c}' fill-opacity='${o}'><circle cx='5' cy='5' r='2.3'/><circle cx='15' cy='15' r='2.3'/><circle cx='15' cy='5' r='1.1'/><circle cx='5' cy='15' r='1.1'/></g>`,
  scales: (c, o) => `<path d='M0 20a10 10 0 0 1 20 0M-10 10a10 10 0 0 1 20 0M10 10a10 10 0 0 1 20 0' stroke='${c}' stroke-opacity='${o}' stroke-width='.9' fill='none'/>`,
  crosses: (c, o) => `<path d='M10 7v6M7 10h6' stroke='${c}' stroke-opacity='${o}' stroke-width='1.2' fill='none' stroke-linecap='round'/>`,
};

const svgUrl = (inner: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' width='20' height='20'>${inner}</svg>`)}")`;

/** Returns the CSS image layer (and its tile size) for a pattern, or null. */
export function patternLayer(c: BackgroundConfig): { image: string; size: string | null } | null {
  const kind = c.pattern ?? 'none';
  if (kind === 'none') return null;
  const color = c.patternColor ?? '#ffffff';
  const opacity = c.patternOpacity ?? 0.08;
  if (kind === 'sunburst') {
    const col = hexA(color, opacity);
    return { image: `repeating-conic-gradient(from 0deg at 50% 0%, ${col} 0deg 5deg, transparent 5deg 10deg)`, size: null };
  }
  const size = c.patternSizeMm ?? 8;
  return { image: svgUrl(TILES[kind](color, opacity)), size: `${size}mm ${size}mm` };
}

export function backgroundStyle(c: BackgroundConfig, media: MediaDTO | null): CSSProperties {
  const images: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];
  const repeats: string[] = [];
  const add = (image: string, size: string, pos: string, repeat: string) => {
    images.push(image);
    sizes.push(size);
    positions.push(pos);
    repeats.push(repeat);
  };

  if (c.overlayColor && c.overlayOpacity > 0) {
    const col = hexA(c.overlayColor, c.overlayOpacity);
    add(`linear-gradient(${col},${col})`, 'auto', 'center', 'no-repeat');
  }
  for (const g of c.glows ?? []) add(`radial-gradient(circle at ${g.x}% ${g.y}%, ${hexA(g.color, g.opacity)} 0%, transparent ${g.size}%)`, 'auto', 'center', 'no-repeat');
  const pat = patternLayer(c);
  if (pat) add(pat.image, pat.size ?? 'auto', 'top left', pat.size ? 'repeat' : 'no-repeat');
  if (c.gradient) add(c.gradient, 'auto', 'center', 'no-repeat');
  if (media) add(`url("${media.url}")`, c.size, c.position, c.repeat);

  return {
    backgroundColor: c.color ?? undefined,
    backgroundImage: images.length ? images.join(',') : undefined,
    backgroundSize: images.length ? sizes.join(',') : undefined,
    backgroundPosition: images.length ? positions.join(',') : undefined,
    backgroundRepeat: images.length ? repeats.join(',') : undefined,
    border: c.borderColor && c.borderWidthMm > 0 ? `${c.borderWidthMm}mm solid ${c.borderColor}` : undefined,
    borderRadius: `${c.borderRadiusMm}mm`,
    boxShadow: shadowCss(c.shadow, c.borderColor ?? undefined),
  };
}
