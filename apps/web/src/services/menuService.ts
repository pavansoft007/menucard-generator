import type {
  BackgroundDTO,
  BackgroundInput,
  ComboDTO,
  ComboInput,
  PageDTO,
  PageInput,
  SectionDTO,
  SectionInput,
  ThemeDTO,
  ThemeInput,
  VersionDTO,
  VersionInput,
  CategoryDTO,
  CategoryInput,
  DashboardStats,
  ItemDTO,
  ItemInput,
  LogoCreateInput,
  LogoDTO,
  LogoUpdateInput,
  MediaDTO,
  MediaUpdateInput,
  ReorderInput,
  RestaurantDTO,
  RestaurantInput,
} from '@gc/shared-types';
import { api, apiPage, json, qs } from './api';

export const keys = {
  stats: ['stats'] as const,
  restaurant: ['restaurant'] as const,
  logos: ['logos'] as const,
  categories: ['categories'] as const,
  items: ['items'] as const,
  media: ['media'] as const,
  themes: ['themes'] as const,
  backgrounds: ['backgrounds'] as const,
  combos: ['combos'] as const,
  pages: ['pages'] as const,
  sections: ['sections'] as const,
  versions: ['versions'] as const,
};

export const dashboardService = { stats: () => api<DashboardStats>('/dashboard/stats') };

export const restaurantService = {
  get: () => api<RestaurantDTO>('/restaurant'),
  update: (v: RestaurantInput) => api<RestaurantDTO>('/restaurant', json('PUT', v)),
};

export const logoService = {
  list: () => api<LogoDTO[]>('/logos'),
  create: (v: LogoCreateInput) => api<LogoDTO>('/logos', json('POST', v)),
  update: (id: number, v: LogoUpdateInput) => api<LogoDTO>(`/logos/${id}`, json('PUT', v)),
  remove: (id: number) => api<{ deleted: boolean }>(`/logos/${id}`, json('DELETE')),
};

export const categoryService = {
  list: (q: { search?: string; isActive?: boolean } = {}) => api<CategoryDTO[]>(`/categories${qs(q)}`),
  create: (v: CategoryInput) => api<CategoryDTO>('/categories', json('POST', v)),
  update: (id: number, v: CategoryInput) => api<CategoryDTO>(`/categories/${id}`, json('PUT', v)),
  remove: (id: number) => api<{ deleted: boolean }>(`/categories/${id}`, json('DELETE')),
  reorder: (v: ReorderInput) => api<{ reordered: boolean }>('/categories/reorder', json('PATCH', v)),
};

export interface ItemFilters {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: number;
  isActive?: boolean;
  dietType?: 'veg' | 'non_veg';
}
export const itemService = {
  list: (q: ItemFilters) => apiPage<ItemDTO[]>(`/menu-items${qs({ ...q })}`),
  create: (v: ItemInput) => api<ItemDTO>('/menu-items', json('POST', v)),
  update: (id: number, v: ItemInput) => api<ItemDTO>(`/menu-items/${id}`, json('PUT', v)),
  remove: (id: number) => api<{ deleted: boolean }>(`/menu-items/${id}`, json('DELETE')),
};

export interface MediaFilters {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
  kind?: 'image' | 'svg';
}
export interface MediaUsage {
  categories: number;
  items: number;
  variants: number;
  logos: number;
  backgrounds: number;
  combos: number;
  sections: number;
  total: number;
}
export const mediaService = {
  list: (q: MediaFilters) => apiPage<MediaDTO[]>(`/media${qs({ ...q })}`),
  categories: () => api<string[]>('/media/categories'),
  usage: (id: number) => api<MediaUsage>(`/media/${id}/usage`),
  update: (id: number, v: MediaUpdateInput) => api<MediaDTO>(`/media/${id}`, json('PUT', v)),
  remove: (id: number) => api<{ deleted: boolean }>(`/media/${id}`, json('DELETE')),
  replace: (id: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api<MediaDTO>(`/media/${id}/replace`, { method: 'POST', body: fd });
  },
  /** Uploads sequentially-batched files; returns what worked and what failed. */
  upload: (files: File[], category?: string) => {
    const fd = new FormData();
    if (category) fd.append('category', category);
    files.forEach((f) => fd.append('files', f));
    return api<{ uploaded: MediaDTO[]; failed: { name: string; error: string }[] }>('/media/bulk-upload', { method: 'POST', body: fd });
  },
};

export const themeService = {
  list: () => api<ThemeDTO[]>('/themes'),
  create: (v: ThemeInput) => api<ThemeDTO>('/themes', json('POST', v)),
  update: (id: number, v: ThemeInput) => api<ThemeDTO>(`/themes/${id}`, json('PUT', v)),
  makeDefault: (id: number) => api<ThemeDTO>(`/themes/${id}/default`, json('POST')),
  remove: (id: number) => api<{ deleted: boolean }>(`/themes/${id}`, json('DELETE')),
};

export const backgroundService = {
  list: (kind?: string) => api<BackgroundDTO[]>(`/backgrounds${qs({ kind })}`),
  create: (v: BackgroundInput) => api<BackgroundDTO>('/backgrounds', json('POST', v)),
  update: (id: number, v: BackgroundInput) => api<BackgroundDTO>(`/backgrounds/${id}`, json('PUT', v)),
  remove: (id: number) => api<{ deleted: boolean }>(`/backgrounds/${id}`, json('DELETE')),
};

export const comboService = {
  list: () => api<ComboDTO[]>('/combos'),
  create: (v: ComboInput) => api<ComboDTO>('/combos', json('POST', v)),
  update: (id: number, v: ComboInput) => api<ComboDTO>(`/combos/${id}`, json('PUT', v)),
  remove: (id: number) => api<{ deleted: boolean }>(`/combos/${id}`, json('DELETE')),
};

export const pageService = {
  list: (withSections = false) => api<PageDTO[]>(`/menu-pages${qs({ withSections: withSections || undefined })}`),
  create: (v: PageInput) => api<PageDTO>('/menu-pages', json('POST', v)),
  update: (id: number, v: PageInput) => api<PageDTO>(`/menu-pages/${id}`, json('PUT', v)),
  duplicate: (id: number) => api<PageDTO>(`/menu-pages/${id}/duplicate`, json('POST')),
  remove: (id: number) => api<{ deleted: boolean }>(`/menu-pages/${id}`, json('DELETE')),
  reorder: (ids: number[]) => api<{ reordered: boolean }>('/menu-pages/reorder', json('PATCH', { ids })),
};

export const sectionService = {
  list: (pageId?: number | 'none') => api<SectionDTO[]>(`/menu-sections${qs({ pageId })}`),
  create: (v: SectionInput) => api<SectionDTO>('/menu-sections', json('POST', v)),
  update: (id: number, v: SectionInput) => api<SectionDTO>(`/menu-sections/${id}`, json('PUT', v)),
  duplicate: (id: number) => api<SectionDTO>(`/menu-sections/${id}/duplicate`, json('POST')),
  remove: (id: number) => api<{ deleted: boolean }>(`/menu-sections/${id}`, json('DELETE')),
  reorder: (pageId: number | null, ids: number[]) => api<{ reordered: boolean }>('/menu-sections/reorder', json('PATCH', { pageId, ids })),
};

export const versionService = {
  list: () => api<VersionDTO[]>('/menu-versions'),
  create: (v: VersionInput) => api<VersionDTO>('/menu-versions', json('POST', v)),
  restore: (id: number) => api<{ restoredFrom: number; backupVersionId: number; pages: number; droppedReferences: number }>(`/menu-versions/${id}/restore`, json('POST')),
};
