import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { defaultThemeConfig, type BackgroundDTO, type CategoryDTO, type ComboDTO, type ItemDTO, type LogoDTO, type MediaDTO, type PageDTO, type RestaurantDTO, type SectionDTO, type ThemeConfig, type ThemeDTO } from '@gc/shared-types';
import { api } from '../services/api';
import { backgroundService, categoryService, comboService, itemService, keys, logoService, pageService, restaurantService, themeService } from '../services/menuService';

/** Everything the page renderer needs, all loaded from the API. */
export interface MenuData {
  restaurant: RestaurantDTO | null;
  logos: LogoDTO[];
  themes: ThemeDTO[];
  backgrounds: BackgroundDTO[];
  categories: CategoryDTO[];
  items: ItemDTO[];
  combos: ComboDTO[];
  pages: PageDTO[];
  sections: SectionDTO[];
  media: Map<number, MediaDTO>;
}

export const emptyMenuData: MenuData = { restaurant: null, logos: [], themes: [], backgrounds: [], categories: [], items: [], combos: [], pages: [], sections: [], media: new Map() };

/** Collects every media id that appears in layout image elements so they can be resolved in one request. */
const layoutMediaIds = (pages: PageDTO[]) => [...new Set(pages.flatMap((p) => p.layout.elements.flatMap((e) => (e.type === 'image' && e.mediaId ? [e.mediaId] : []))))].sort((a, b) => a - b);

/**
 * Loads the whole menu. `live` keeps it fresh (focus refetch + short polling) so the preview follows edits made in
 * other tabs; mutations in any tab also invalidate it through the cross-tab broadcast in main.tsx.
 */
export function useMenuData({ live = false }: { live?: boolean } = {}) {
  const opts = { refetchInterval: live ? 8000 : (false as const), refetchOnWindowFocus: live, staleTime: live ? 2000 : 30_000 };
  const restaurant = useQuery({ queryKey: keys.restaurant, queryFn: restaurantService.get, ...opts });
  const logos = useQuery({ queryKey: keys.logos, queryFn: logoService.list, ...opts });
  const themes = useQuery({ queryKey: keys.themes, queryFn: themeService.list, ...opts });
  const backgrounds = useQuery({ queryKey: [...keys.backgrounds, ''], queryFn: () => backgroundService.list(), ...opts });
  const categories = useQuery({ queryKey: keys.categories, queryFn: () => categoryService.list(), ...opts });
  const items = useQuery({ queryKey: [...keys.items, 'all'], queryFn: () => itemService.list({ page: 1, pageSize: 500 }), ...opts });
  const combos = useQuery({ queryKey: keys.combos, queryFn: comboService.list, ...opts });
  const pages = useQuery({ queryKey: [...keys.pages, 'withSections'], queryFn: () => pageService.list(true), ...opts });

  const mediaIds = useMemo(() => layoutMediaIds(pages.data ?? []), [pages.data]);
  const extraMedia = useQuery({
    queryKey: [...keys.media, 'by-ids', mediaIds.join(',')],
    queryFn: () => api<MediaDTO[]>(`/media/by-ids?ids=${mediaIds.join(',')}`),
    enabled: mediaIds.length > 0,
    ...opts,
  });

  const all = [restaurant, logos, themes, backgrounds, categories, items, combos, pages];
  const data = useMemo<MenuData>(() => {
    const media = new Map<number, MediaDTO>();
    const add = (m?: MediaDTO | null) => m && media.set(m.id, m);
    (extraMedia.data ?? []).forEach(add);
    logos.data?.forEach((l) => add(l.media));
    backgrounds.data?.forEach((b) => add(b.media));
    combos.data?.forEach((c) => add(c.image));
    items.data?.data.forEach((i) => { add(i.mainMedia); i.gallery.forEach(add); i.variants.forEach((v) => add(v.media)); });
    categories.data?.forEach((c) => { add(c.image); add(c.banner); add(c.background); add(c.iconMedia); });
    pages.data?.forEach((p) => p.sections?.forEach((s) => add(s.image)));
    return {
      restaurant: restaurant.data ?? null,
      logos: logos.data ?? [],
      themes: themes.data ?? [],
      backgrounds: backgrounds.data ?? [],
      categories: categories.data ?? [],
      items: items.data?.data ?? [],
      combos: combos.data ?? [],
      pages: pages.data ?? [],
      sections: (pages.data ?? []).flatMap((p) => p.sections ?? []),
      media,
    };
  }, [restaurant.data, logos.data, themes.data, backgrounds.data, categories.data, items.data, combos.data, pages.data, extraMedia.data]);

  return {
    data,
    isLoading: all.some((q) => q.isLoading),
    error: all.find((q) => q.isError)?.error ?? null,
    refetch: () => Promise.all([...all, extraMedia].map((q) => q.refetch())),
  };
}

export const themeFor = (data: MenuData, themeId: number | null): ThemeConfig =>
  (themeId ? data.themes.find((t) => t.id === themeId) : undefined)?.config ?? data.themes.find((t) => t.isDefault)?.config ?? defaultThemeConfig;

/** The items a section shows: whole categories first (in the section's order), then hand-picked items, active only. */
export function itemsForSection(s: SectionDTO, data: MenuData): ItemDTO[] {
  const seen = new Set<number>();
  const out: ItemDTO[] = [];
  const push = (i: ItemDTO) => {
    if (!i.isActive || seen.has(i.id)) return;
    seen.add(i.id);
    out.push(i);
  };
  for (const cid of s.categoryIds) data.items.filter((i) => i.categoryId === cid).sort((a, b) => a.displayOrder - b.displayOrder).forEach(push);
  for (const iid of s.itemIds) {
    const i = data.items.find((x) => x.id === iid);
    if (i) push(i);
  }
  return out;
}

export const combosForSection = (s: SectionDTO, data: MenuData) => s.comboIds.map((id) => data.combos.find((c) => c.id === id)).filter((c): c is ComboDTO => !!c && c.isActive);
