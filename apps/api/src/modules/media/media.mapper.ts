import type { MediaDTO } from '@gc/shared-types';
import type { MediaAsset } from '../../models/index.js';
import { storage } from '../../storage/storage.js';

export function toMediaDTO(m: MediaAsset, usageCount?: number): MediaDTO {
  return {
    id: m.id,
    originalName: m.originalName,
    mime: m.mime,
    kind: m.kind,
    size: m.size,
    width: m.width,
    height: m.height,
    hasAlpha: m.hasAlpha,
    category: m.category,
    altText: m.altText,
    url: storage.publicUrl(m.optimizedPath),
    thumbUrl: storage.publicUrl(m.thumbPath),
    originalUrl: storage.publicUrl(m.originalPath),
    createdAt: m.createdAt.toISOString(),
    ...(usageCount === undefined ? {} : { usageCount }),
  };
}

export const toMediaOrNull = (m?: MediaAsset | null) => (m ? toMediaDTO(m) : null);
