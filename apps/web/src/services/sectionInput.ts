import type { SectionDTO, SectionInput } from '@gc/shared-types';

/** Turns a loaded section back into an editable payload, with optional changes. */
export const sectionToInput = (s: SectionDTO, patch: Partial<SectionInput> = {}): SectionInput => ({
  pageId: s.pageId,
  title: s.title,
  subtitle: s.subtitle,
  description: s.description,
  imageMediaId: s.image?.id ?? null,
  backgroundId: s.backgroundId,
  categoryIds: s.categoryIds,
  itemIds: s.itemIds,
  comboIds: s.comboIds,
  config: s.config,
  ...patch,
});
