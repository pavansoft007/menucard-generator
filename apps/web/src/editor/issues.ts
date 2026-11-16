import { resolvePageSize, type LayoutElement, type PageSettings } from '@gc/shared-types';
import { bindingSide } from '../renderer/geometry';

export interface Issue {
  id: string;
  level: 'error' | 'warning';
  elementIds: string[];
  message: string;
}

const intersects = (a: LayoutElement, b: LayoutElement) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
const label = (e: LayoutElement) => e.name ?? { text: 'Text', image: 'Image', shape: 'Shape', logo: 'Logo', section: 'Section', itemCard: 'Item card' }[e.type];

/**
 * Print-safety checks for one page: content off the sheet, inside the binding strip, sections whose cards overflow
 * their box, and sections that overlap each other. Rotated elements use their unrotated box (good enough for a warning).
 */
export function layoutIssues(elements: LayoutElement[], settings: PageSettings, pageNumber: number, measured: Record<string, number>): Issue[] {
  const { widthMm, heightMm } = resolvePageSize(settings);
  const issues: Issue[] = [];
  const visible = elements.filter((e) => !e.hidden);
  const bindStrip = settings.bindingMarginMm > 0 ? settings.marginsMm[bindingSide(pageNumber)] + settings.bindingMarginMm : 0;

  for (const e of visible) {
    const out = e.x < -0.5 || e.y < -0.5 || e.x + e.w > widthMm + 0.5 || e.y + e.h > heightMm + 0.5;
    if (out) issues.push({ id: `out:${e.id}`, level: 'error', elementIds: [e.id], message: `${label(e)} extends past the edge of the page and would be cropped.` });
    else if (bindStrip > 0 && e.type !== 'shape') {
      const intrudes = bindingSide(pageNumber) === 'left' ? e.x < bindStrip - 0.5 : e.x + e.w > widthMm - bindStrip + 0.5;
      if (intrudes) issues.push({ id: `bind:${e.id}`, level: 'warning', elementIds: [e.id], message: `${label(e)} is inside the spiral-binding zone (${bindStrip.toFixed(0)} mm) and may be hidden.` });
    }
    if (e.type === 'section') {
      const natural = measured[e.id];
      if (natural !== undefined && natural > e.h + 0.5) {
        issues.push({ id: `over:${e.id}`, level: 'error', elementIds: [e.id], message: `${label(e)} content is ${(natural - e.h).toFixed(1)} mm taller than its box – increase the height or reduce columns/rows.` });
      }
    }
  }
  const sections = visible.filter((e) => e.type === 'section');
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const a = sections[i]!;
      const b = sections[j]!;
      // Overflowing sections are compared by their real (natural) height as well.
      const ah = Math.max(a.h, measured[a.id] ?? 0);
      const bh = Math.max(b.h, measured[b.id] ?? 0);
      if (intersects({ ...a, h: ah }, { ...b, h: bh })) issues.push({ id: `overlap:${a.id}:${b.id}`, level: 'error', elementIds: [a.id, b.id], message: `${label(a)} overlaps ${label(b)}.` });
    }
  }
  return issues;
}
