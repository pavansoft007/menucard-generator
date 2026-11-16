import { describe, expect, it } from 'vitest';
import { fitAspect, fullRect, moveRect, resizeFromCorner, resultSize, type Rect } from './cropMath';

const inside = (r: Rect) => r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= 1 + 1e-9 && r.y + r.h <= 1 + 1e-9;
const O = { ratio: null, imageAspect: 4 / 3, minSize: 0.05 };

describe('crop box', () => {
  it('moves but never leaves the image', () => {
    const r = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 };
    const moved = moveRect(r, 0.1, 0.1);
    expect(moved.x).toBeCloseTo(0.3);
    expect(moved.y).toBeCloseTo(0.3);
    expect(moveRect(r, 5, 5)).toMatchObject({ x: 0.5, y: 0.5 });
    expect(moveRect(r, -5, -5)).toMatchObject({ x: 0, y: 0 });
  });

  it('resizes freely from each corner with the opposite corner fixed', () => {
    const start = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
    const se = resizeFromCorner(start, 'se', 0.9, 0.8, O);
    expect(se).toMatchObject({ x: 0.25, y: 0.25 });
    expect(se.w).toBeCloseTo(0.65);
    expect(se.h).toBeCloseTo(0.55);
    const nw = resizeFromCorner(start, 'nw', 0.1, 0.05, O);
    expect(nw.x).toBeCloseTo(0.1);
    expect(nw.y).toBeCloseTo(0.05);
    expect(nw.x + nw.w).toBeCloseTo(0.75); // the south-east corner did not move
    expect(nw.y + nw.h).toBeCloseTo(0.75);
  });

  it('clamps to the image and enforces a minimum size', () => {
    const start = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
    expect(inside(resizeFromCorner(start, 'se', 3, 3, O))).toBe(true);
    expect(inside(resizeFromCorner(start, 'nw', -3, -3, O))).toBe(true);
    const tiny = resizeFromCorner(start, 'se', 0.2501, 0.2501, O);
    expect(tiny.w).toBeGreaterThanOrEqual(0.05);
    expect(tiny.h).toBeGreaterThanOrEqual(0.05);
  });

  it('keeps an exact PIXEL aspect ratio on a non-square image', () => {
    const W = 4000;
    const H = 3000; // 4:3
    const imageAspect = W / H;
    for (const ratio of [1, 16 / 9, 3 / 4]) {
      for (const corner of ['nw', 'ne', 'sw', 'se'] as const) {
        const r = resizeFromCorner({ x: 0.3, y: 0.3, w: 0.3, h: 0.3 }, corner, 0.95, 0.9, { ratio, imageAspect, minSize: 0.03 });
        expect((r.w * W) / (r.h * H), `${ratio} ${corner}`).toBeCloseTo(ratio, 5);
        expect(inside(r), `${ratio} ${corner} inside`).toBe(true);
      }
    }
  });

  it('re-shapes to a preset ratio: largest box that fits, centred', () => {
    const r = fitAspect(fullRect, 1, 4 / 3); // square inside a 4:3 image
    expect((r.w * 4) / (r.h * 3)).toBeCloseTo(1, 5);
    expect(r.h).toBeCloseTo(1);
    expect(r.x + r.w / 2).toBeCloseTo(0.5);
    expect(fitAspect(fullRect, null, 4 / 3)).toEqual(fullRect);
    expect(inside(fitAspect({ x: 0.9, y: 0.9, w: 0.1, h: 0.1 }, 16 / 9, 1.5))).toBe(true);
  });

  it('reports the result size, downscaling but never upscaling', () => {
    expect(resultSize({ x: 0, y: 0, w: 0.5, h: 0.5 }, 4000, 3000, null)).toEqual({ w: 2000, h: 1500 });
    expect(resultSize({ x: 0, y: 0, w: 0.5, h: 0.5 }, 4000, 3000, 1000)).toEqual({ w: 1000, h: 750 });
    expect(resultSize({ x: 0, y: 0, w: 0.5, h: 0.5 }, 4000, 3000, 9999)).toEqual({ w: 2000, h: 1500 });
  });
});
