/** Crop-box geometry. All rectangles are fractions (0–1) of the image, matching what the API expects. */
export interface Rect { x: number; y: number; w: number; h: number }
export type Corner = 'nw' | 'ne' | 'sw' | 'se';

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const fullRect: Rect = { x: 0, y: 0, w: 1, h: 1 };

/** Moves the box, keeping it entirely inside the image. */
export function moveRect(r: Rect, dx: number, dy: number): Rect {
  return { ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) };
}

/**
 * Drags one corner to the pointer (normalised position). `ratio` is the wanted width/height in *pixels* (null = free);
 * `imageAspect` is image width/height in pixels so the ratio can be honoured in fractional coordinates.
 */
export function resizeFromCorner(start: Rect, corner: Corner, px: number, py: number, o: { ratio: number | null; imageAspect: number; minSize: number }): Rect {
  const fixedX = corner.includes('w') ? start.x + start.w : start.x; // the opposite corner stays put
  const fixedY = corner.includes('n') ? start.y + start.h : start.y;
  const roomX = corner.includes('w') ? fixedX : 1 - fixedX;
  const roomY = corner.includes('n') ? fixedY : 1 - fixedY;
  let w = clamp(Math.abs(clamp(px, 0, 1) - fixedX), 0, roomX);
  let h = clamp(Math.abs(clamp(py, 0, 1) - fixedY), 0, roomY);

  if (o.ratio) {
    // height (fraction) that matches a given width (fraction) at the wanted pixel ratio
    const hFor = (width: number) => (width * o.imageAspect) / o.ratio!;
    if (hFor(w) > h) w = (h * o.ratio) / o.imageAspect;
    else h = hFor(w);
    const shrink = Math.min(1, roomX / Math.max(w, 1e-9), roomY / Math.max(h, 1e-9)); // never leave the image
    w *= shrink;
    h *= shrink;
    const minW = Math.max(o.minSize, (o.minSize * o.ratio) / o.imageAspect);
    if (w < minW) { w = minW; h = hFor(w); }
  } else {
    w = Math.max(w, o.minSize);
    h = Math.max(h, o.minSize);
  }
  return { x: corner.includes('w') ? fixedX - w : fixedX, y: corner.includes('n') ? fixedY - h : fixedY, w, h };
}

/** Re-shapes the current box to an aspect ratio: the largest such box that fits inside it, kept centred. */
export function fitAspect(r: Rect, ratio: number | null, imageAspect: number): Rect {
  if (!ratio) return r;
  const heightFor = (w: number) => (w * imageAspect) / ratio;
  let w = r.w;
  let h = heightFor(w);
  if (h > r.h) { h = r.h; w = (h * ratio) / imageAspect; }
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h };
}

/** Resulting pixel size for a crop of a W x H image, optionally downsized (never upscaled) to `outputWidth`. */
export function resultSize(r: Rect, W: number, H: number, outputWidth: number | null) {
  const w = Math.max(1, Math.round(r.w * W));
  const h = Math.max(1, Math.round(r.h * H));
  if (!outputWidth || outputWidth >= w) return { w, h };
  return { w: outputWidth, h: Math.max(1, Math.round((h * outputWidth) / w)) };
}
