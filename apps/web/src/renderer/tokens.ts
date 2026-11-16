import type { ColorRef, PageDTO, RestaurantDTO, ThemeConfig } from '@gc/shared-types';

export const MM_PX = 96 / 25.4; // CSS pixels per millimetre
export const PT_MM = 25.4 / 72; // millimetres per typographic point

/** Resolves a literal hex or a `theme:<key>` reference against the page's theme. */
export function resolveColor(ref: ColorRef | null | undefined, theme: ThemeConfig): string | undefined {
  if (!ref) return undefined;
  if (ref.startsWith('theme:')) return theme.colors[ref.slice(6) as keyof ThemeConfig['colors']];
  return ref;
}

export const themeColorLabel: Record<keyof ThemeConfig['colors'], string> = {
  background: 'Page background',
  surface: 'Card background',
  accent: 'Primary accent',
  accentAlt: 'Secondary accent',
  heading: 'Heading',
  text: 'Body text',
  priceBadgeBg: 'Price badge',
  priceBadgeText: 'Price badge text',
  special: 'Special (red)',
};

const instagram = (v: string | null) => (v ? (/^https?:\/\//i.test(v) ? v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '@').replace(/\/$/, '') : `@${v.replace(/^@/, '')}`) : '');

/** Values available to {{tokens}} inside text elements. Everything comes from the database, nothing is hardcoded. */
export function tokenValues(restaurant: RestaurantDTO | null, page: Pick<PageDTO, 'title' | 'subtitle'>, pageNumber: number, totalPages: number): Record<string, string> {
  const r = restaurant;
  const cityLine = [r?.city, r?.pincode].filter(Boolean).join(' – ');
  return {
    'restaurant.name': r?.name ?? '',
    'restaurant.tagline': r?.tagline ?? '',
    'restaurant.phone1': r?.phone1 ?? '',
    'restaurant.phone2': r?.phone2 ?? '',
    'restaurant.address': r?.address ?? '',
    'restaurant.city': r?.city ?? '',
    'restaurant.pincode': r?.pincode ?? '',
    'restaurant.fullAddress': [r?.address, cityLine].filter(Boolean).join(', '),
    'restaurant.instagram': instagram(r?.instagram ?? null),
    'restaurant.facebook': r?.facebook ?? '',
    'restaurant.website': r?.website ?? '',
    'restaurant.gst': r?.gstNumber ?? '',
    'restaurant.footerText': r?.footerText ?? '',
    'page.title': page.title,
    'page.subtitle': page.subtitle ?? '',
    'page.number': String(pageNumber),
    'page.total': String(totalPages),
  };
}

export const TOKEN_NAMES = ['restaurant.name', 'restaurant.tagline', 'restaurant.phone1', 'restaurant.phone2', 'restaurant.fullAddress', 'restaurant.instagram', 'restaurant.website', 'restaurant.footerText', 'page.title', 'page.subtitle', 'page.number'];

export const fillTokens = (text: string, values: Record<string, string>) => text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => values[k] ?? '');

/** The "address · phone · @instagram" line used by page footers. */
export function contactLine(values: Record<string, string>) {
  return [values['restaurant.fullAddress'], [values['restaurant.phone1'], values['restaurant.phone2']].filter(Boolean).join(' / '), values['restaurant.instagram']].filter(Boolean).join('  •  ');
}
