import type { LayoutElement } from '@gc/shared-types';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Guide { axis: 'x' | 'y'; at: number }

export const rectOf = (e: Pick<LayoutElement, 'x' | 'y' | 'w' | 'h'>): Rect => ({ x: e.x, y: e.y, w: e.w, h: e.h });
export const round1 = (n: number) => Math.round(n * 10) / 10;

export function boundsOf(rects: Rect[]): Rect {
  const x1 = Math.min(...rects.map((r) => r.x));
  const y1 = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Targets an element edge/centre can snap to: page edges + centre, the safe area, and other elements. */
export function snapTargets(page: { w: number; h: number }, safe: { left: number; top: number; width: number; height: number }, others: Rect[]) {
  const xs = [0, page.w / 2, page.w, safe.left, safe.left + safe.width / 2, safe.left + safe.width];
  const ys = [0, page.h / 2, page.h, safe.top, safe.top + safe.height / 2, safe.top + safe.height];
  for (const r of others) {
    xs.push(r.x, r.x + r.w / 2, r.x + r.w);
    ys.push(r.y, r.y + r.h / 2, r.y + r.h);
  }
  return { xs, ys };
}

/** Finds the smallest nudge that aligns a moving rect's edges/centre with a target, within `threshold` mm. */
function snapAxis(start: number, size: number, targets: number[], threshold: number, edges: ('start' | 'mid' | 'end')[] = ['start', 'mid', 'end']) {
  let best: { delta: number; at: number } | null = null;
  const probes = { start: start, mid: start + size / 2, end: start + size };
  for (const k of edges) {
    for (const t of targets) {
      const d = t - probes[k];
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, at: t };
    }
  }
  return best;
}

/** Snaps a moving rectangle on both axes; returns the adjusted rect and the guide lines to draw. */
export function snapMove(r: Rect, t: { xs: number[]; ys: number[] }, threshold: number): { rect: Rect; guides: Guide[] } {
  const sx = snapAxis(r.x, r.w, t.xs, threshold);
  const sy = snapAxis(r.y, r.h, t.ys, threshold);
  const guides: Guide[] = [];
  if (sx) guides.push({ axis: 'x', at: sx.at });
  if (sy) guides.push({ axis: 'y', at: sy.at });
  return { rect: { ...r, x: r.x + (sx?.delta ?? 0), y: r.y + (sy?.delta ?? 0) }, guides };
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Resizes from one handle, optionally snapping the moving edges and keeping the aspect ratio. */
export function resizeRect(start: Rect, handle: Handle, dx: number, dy: number, opts: { keepAspect: boolean; minSize: number; targets?: { xs: number[]; ys: number[] }; threshold: number }): { rect: Rect; guides: Guide[] } {
  let { x, y, w, h } = start;
  const guides: Guide[] = [];
  const snapEdge = (value: number, targets: number[] | undefined, axis: 'x' | 'y') => {
    if (!targets) return value;
    const s = snapAxis(value, 0, targets, opts.threshold, ['start']);
    if (s) guides.push({ axis, at: s.at });
    return value + (s?.delta ?? 0);
  };
  if (handle.includes('e')) w = snapEdge(start.x + start.w + dx, opts.targets?.xs, 'x') - start.x;
  if (handle.includes('s')) h = snapEdge(start.y + start.h + dy, opts.targets?.ys, 'y') - start.y;
  if (handle.includes('w')) {
    const nx = snapEdge(start.x + dx, opts.targets?.xs, 'x');
    w = start.x + start.w - nx;
    x = nx;
  }
  if (handle.includes('n')) {
    const ny = snapEdge(start.y + dy, opts.targets?.ys, 'y');
    h = start.y + start.h - ny;
    y = ny;
  }
  if (opts.keepAspect && start.w > 0 && start.h > 0) {
    const ratio = start.w / start.h;
    if (handle === 'n' || handle === 's') w = h * ratio;
    else if (handle === 'e' || handle === 'w') h = w / ratio;
    else if (Math.abs(w - start.w) / start.w > Math.abs(h - start.h) / start.h) h = w / ratio;
    else w = h * ratio;
    if (handle.includes('w')) x = start.x + start.w - w;
    if (handle.includes('n')) y = start.y + start.h - h;
  }
  if (w < opts.minSize) {
    if (handle.includes('w')) x = start.x + start.w - opts.minSize;
    w = opts.minSize;
  }
  if (h < opts.minSize) {
    if (handle.includes('n')) y = start.y + start.h - opts.minSize;
    h = opts.minSize;
  }
  return { rect: { x, y, w, h }, guides };
}
