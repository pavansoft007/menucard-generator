import { resolvePageSize, type PageSettings } from '@gc/shared-types';

/** Binding sits on the left of odd pages and the right of even pages (left-bound, double-sided). */
export const bindingSide = (pageNumber: number): 'left' | 'right' => (pageNumber % 2 === 1 ? 'left' : 'right');

/** The area inside the margins, minus the binding strip on the correct side of this page. All values in mm. */
export function safeArea(settings: PageSettings, pageNumber: number) {
  const { widthMm, heightMm } = resolvePageSize(settings);
  const m = settings.marginsMm;
  const left = m.left + (bindingSide(pageNumber) === 'left' ? settings.bindingMarginMm : 0);
  const right = m.right + (bindingSide(pageNumber) === 'right' ? settings.bindingMarginMm : 0);
  return { left, right, top: m.top, bottom: m.bottom, width: widthMm - left - right, height: heightMm - m.top - m.bottom, pageWidth: widthMm, pageHeight: heightMm };
}
