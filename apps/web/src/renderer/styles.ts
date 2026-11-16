import type { CSSProperties } from 'react';
import type { BackgroundConfig, MediaDTO, ThemeConfig } from '@gc/shared-types';

/**
 * Pure config -> CSS helpers. The same functions are used by the admin previews now and by the
 * page renderer / PDF export later, so a background always looks identical everywhere.
 * Physical sizes are in millimetres (print units).
 */
export const shadowCss = (s: BackgroundConfig['shadow'] | ThemeConfig['shadow'], accent = '#F5B51B') =>
  ({ none: 'none', soft: '0 1mm 3mm rgba(0,0,0,.35)', strong: '0 2mm 6mm rgba(0,0,0,.6)', 'gold-glow': `0 0 4mm ${accent}66` })[s];

const hexA = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export function backgroundStyle(c: BackgroundConfig, media: MediaDTO | null): CSSProperties {
  const layers: string[] = [];
  if (c.overlayColor && c.overlayOpacity > 0) layers.push(`linear-gradient(${hexA(c.overlayColor, c.overlayOpacity)},${hexA(c.overlayColor, c.overlayOpacity)})`);
  if (c.gradient) layers.push(c.gradient);
  if (media) layers.push(`url("${media.url}")`);
  return {
    backgroundColor: c.color ?? undefined,
    backgroundImage: layers.length ? layers.join(',') : undefined,
    backgroundPosition: c.position,
    backgroundSize: c.size,
    backgroundRepeat: c.repeat,
    border: c.borderColor && c.borderWidthMm > 0 ? `${c.borderWidthMm}mm solid ${c.borderColor}` : undefined,
    borderRadius: `${c.borderRadiusMm}mm`,
    boxShadow: shadowCss(c.shadow, c.borderColor ?? undefined),
  };
}
