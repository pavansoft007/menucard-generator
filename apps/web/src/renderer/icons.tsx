import type { CSSProperties, ReactNode } from 'react';
import type { IconName, OrnamentKind } from '@gc/shared-types';

/**
 * Line art drawn on a 64 x 64 grid (icons) and 200 x 20 grid (ornaments). Everything is stroked, never filled, so it
 * takes any colour from the theme and stays crisp at any print size. Stroke widths are real millimetres.
 */
const ICON_PATHS: Record<IconName, ReactNode> = {
  drumstick: (
    <>
      <ellipse cx="38" cy="26" rx="18" ry="13" transform="rotate(-45 38 26)" />
      <path d="M33 17c4-3 9-3 13 1" />
      <path d="M27 37 13 51" />
      <circle cx="11" cy="49" r="4" />
      <circle cx="15" cy="53" r="4" />
    </>
  ),
  fries: (
    <>
      <path d="M17 30h30l-3.5 27h-23z" />
      <path d="M20 40h24" />
      <path d="M23 30V15m6 15V8m6 22V11m6 19V17m5 13V22" />
      <path d="M21 16l2-3 2 3m3-8 2-3 2 3m4 6 2-3 2 3" />
    </>
  ),
  drink: (
    <>
      <path d="M19 22h26l-3 35H22z" />
      <path d="M16 22h32" />
      <path d="M33 22l5-15h9" />
      <path d="M21.5 36h21" />
      <circle cx="29" cy="46" r="2" />
      <circle cx="36" cy="49" r="1.5" />
    </>
  ),
  burger: (
    <>
      <path d="M11 29c0-12 9-19 21-19s21 7 21 19z" />
      <path d="M22 18h2m8-3h2m7 4h2" />
      <path d="M9 35c4 3 6-3 10 0s6-3 10 0 6-3 10 0 6-3 10 0 6-3 8 0" />
      <rect x="10" y="39" width="44" height="7" rx="3.5" />
      <path d="M11 50h42c0 5-4 8-8 8H19c-4 0-8-3-8-8z" />
    </>
  ),
  pizza: (
    <>
      <path d="M8 15c15-7 33-7 48 0L32 58z" />
      <path d="M11 22c13-5 29-5 42 0" />
      <circle cx="27" cy="29" r="4" />
      <circle cx="38" cy="26" r="3.5" />
      <circle cx="32" cy="41" r="3.5" />
    </>
  ),
  icecream: (
    <>
      <circle cx="32" cy="7.5" r="3" />
      <path d="M19 31c-4-12 5-21 13-21s17 9 13 21" />
      <path d="M17 31c3 4 6 4 8 0 2 4 5 4 7 0 2 4 5 4 7 0 2 4 5 4 8 0z" />
      <path d="M22 33l10 25 10-25" />
      <path d="M26 40l10 6m-8-12 11 8" />
    </>
  ),
  coffee: (
    <>
      <path d="M13 26h30v13c0 8-6 14-15 14s-15-6-15-14z" />
      <path d="M43 29h4c6 0 6 11 0 11h-4" />
      <path d="M9 57h38" />
      <path d="M22 9c-3 4 3 6 0 10m8-10c-3 4 3 6 0 10m8-10c-3 4 3 6 0 10" />
    </>
  ),
  dumpling: (
    <>
      <path d="M7 41c0-15 11-25 25-25s25 10 25 25c0 4-3 7-6 7H13c-3 0-6-3-6-7z" />
      <path d="M19 25l5 22m4-28 2 28m6-28-2 28m10-22-5 22" />
    </>
  ),
  sandwich: (
    <>
      <path d="M7 45 31 13l26 32z" />
      <path d="M7 45h50v7H7z" />
      <path d="M12 39c4 3 6-3 10 0s6-3 10 0 6-3 10 0 6-3 10 0" />
      <circle cx="24" cy="33" r="1.6" />
      <circle cx="35" cy="27" r="1.6" />
    </>
  ),
  'chef-hat': (
    <>
      <path d="M20 45V33c-8 0-12-6-10-12 2-5 9-7 15-4 3-6 13-6 16 0 6-3 13-1 15 4 2 6-2 12-10 12v12z" />
      <path d="M20 51h28v6H20z" />
    </>
  ),
};

const wave = `M0 10${Array.from({ length: 16 }, (_, i) => (i === 0 ? 'q6.25 -7 12.5 0' : 't12.5 0')).join(' ')}`;
const star = (x: number, s: number) => `M${x} ${10 - 5 * s}l${1.4 * s} ${3.6 * s} ${3.6 * s} ${1.4 * s}-${3.6 * s} ${1.4 * s}-${1.4 * s} ${3.6 * s}-${1.4 * s}-${3.6 * s}-${3.6 * s}-${1.4 * s} ${3.6 * s}-${1.4 * s}z`;

const ORNAMENT_PATHS: Record<OrnamentKind, ReactNode> = {
  diamond: (
    <>
      <path d="M0 10H84M116 10H200" />
      <path d="M100 2l8 8-8 8-8-8z" />
    </>
  ),
  double: <path d="M0 6.5H200M0 13.5H200" />,
  stars: (
    <>
      <path d="M0 10H76M124 10H200" />
      <path d={star(100, 1.5)} />
      <path d={star(86, 0.9)} />
      <path d={star(114, 0.9)} />
    </>
  ),
  wave: <path d={wave} />,
  dots: <>{Array.from({ length: 17 }, (_, i) => <circle key={i} cx={6 + i * 11} cy="10" r="1.7" />)}</>,
  flourish: (
    <>
      <path d="M0 10H70c10 0 14-8 20-8s8 6 4 8-8-2-6-5" />
      <path d="M200 10H130c-10 0-14-8-20-8s-8 6-4 8 8-2 6-5" />
      <path d="M97 10h6" />
    </>
  ),
};

/** Stroke given in real millimetres, converted to the SVG's own units from the physical size it is drawn at. */
const common = (stroke: string, strokeUnits: number): CSSProperties => ({ fill: 'none', stroke, strokeWidth: strokeUnits, strokeLinecap: 'round', strokeLinejoin: 'round' });

export function LineIcon({ name, color, strokeMm = 0.5, sizeMm, style }: { name: IconName; color: string; strokeMm?: number; sizeMm: number; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', overflow: 'visible', ...style }} aria-hidden>
      <g style={common(color, (strokeMm * 64) / Math.max(sizeMm, 1))}>{ICON_PATHS[name]}</g>
    </svg>
  );
}

export function Ornament({ kind, color, strokeMm = 0.35, widthMm, style }: { kind: OrnamentKind; color: string; strokeMm?: number; widthMm: number; style?: CSSProperties }) {
  const filled = kind === 'dots';
  return (
    <svg viewBox="0 0 200 20" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', overflow: 'visible', ...style }} aria-hidden>
      <g style={filled ? { fill: color, stroke: 'none' } : common(color, (strokeMm * 200) / Math.max(widthMm, 1))}>{ORNAMENT_PATHS[kind]}</g>
    </svg>
  );
}

/** Corner flourish for ornate page frames (drawn once, rotated for the four corners). */
export function CornerFlourish({ color, strokeMm = 0.4, sizeMm, style }: { color: string; strokeMm?: number; sizeMm: number; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%" style={{ display: 'block', overflow: 'visible', ...style }} aria-hidden>
      <g style={common(color, (strokeMm * 40) / Math.max(sizeMm, 1))}>
        <path d="M2 38V9a7 7 0 0 1 7-7h29" />
        <path d="M8 32V12a4 4 0 0 1 4-4h20" />
        <path d="M14 14c0 5 4 5 4 9s-4 4-4-1" />
        <circle cx="2" cy="2" r="1.6" />
      </g>
    </svg>
  );
}
