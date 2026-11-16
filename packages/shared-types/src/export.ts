import { z } from 'zod';

export const paperSizes = ['native', 'A3', 'A4', 'A5', 'Letter'] as const;
export type PaperSize = (typeof paperSizes)[number];
/** Portrait dimensions in mm. */
export const PAPER_MM: Record<Exclude<PaperSize, 'native'>, { w: number; h: number }> = {
  A3: { w: 297, h: 420 },
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  Letter: { w: 215.9, h: 279.4 },
};

export const exportOptionsSchema = z.object({
  /** "all" or a list like "1-3,5" (numbers are positions in the active page order). */
  pages: z
    .string()
    .trim()
    .max(100)
    .regex(/^(all|\d+(-\d+)?(\s*,\s*\d+(-\d+)?)*)$/i, 'Use "all" or a range such as 1-3,5'),
  /** Double-sided printing: odd pages are fronts, even pages are backs. */
  sides: z.enum(['all', 'front', 'back']),
  paper: z.enum(paperSizes),
  orientation: z.enum(['native', 'portrait', 'landscape']),
  bleedMm: z.number().min(0).max(10),
  quality: z.enum(['standard', 'max']), // standard = optimized images, max = original uploads
  includeFooter: z.boolean(),
  includePageNumbers: z.boolean(),
  /** Add a blank page so the page count is even and duplex sheets line up. */
  padToEven: z.boolean(),
  dpi: z.number().int().min(72).max(600), // PNG only
  mode: z.enum(['book', 'separate']), // PDF: one multi-page file, or one file per page (zipped)
});
export type ExportOptions = z.infer<typeof exportOptionsSchema>;

export const defaultExportOptions: ExportOptions = {
  pages: 'all',
  sides: 'all',
  paper: 'native',
  orientation: 'native',
  bleedMm: 0,
  quality: 'max',
  includeFooter: true,
  includePageNumbers: true,
  padToEven: false,
  dpi: 300,
  mode: 'book',
};

/** "1-3,5" -> [1,2,3,5], clipped to 1..total; "all" -> every page. Returns null when nothing valid is selected. */
export function parsePageRange(spec: string, total: number): number[] | null {
  if (/^all$/i.test(spec.trim())) return Array.from({ length: total }, (_, i) => i + 1);
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const m = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(part);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < a) return null;
    for (let n = a; n <= Math.min(b, total); n++) out.add(n);
  }
  return out.size ? [...out].sort((x, y) => x - y) : null;
}

export interface SheetLayout {
  /** Full output size including bleed (mm). */
  sheetW: number;
  sheetH: number;
  /** Trim (finished) size without bleed (mm). */
  trimW: number;
  trimH: number;
  /** Uniform scale applied to the page so it fits the trim size (1 when paper is "native"). */
  scale: number;
  /** Where the (scaled) page starts inside the sheet (mm). */
  offsetX: number;
  offsetY: number;
}

/** One rule shared by the server (PDF size, screenshot clip) and the render page (placement) so they always agree. */
export function sheetLayout(page: { w: number; h: number }, o: Pick<ExportOptions, 'paper' | 'orientation' | 'bleedMm'>): SheetLayout {
  let trimW = page.w;
  let trimH = page.h;
  if (o.paper !== 'native') {
    const p = PAPER_MM[o.paper];
    const landscape = o.orientation === 'native' ? page.w > page.h : o.orientation === 'landscape';
    trimW = landscape ? p.h : p.w;
    trimH = landscape ? p.w : p.h;
  } else if (o.orientation !== 'native') {
    const wantLandscape = o.orientation === 'landscape';
    if (wantLandscape !== trimW > trimH) [trimW, trimH] = [trimH, trimW];
  }
  const scale = trimW === page.w && trimH === page.h ? 1 : Math.min(trimW / page.w, trimH / page.h);
  const b = o.bleedMm;
  return {
    sheetW: round(trimW + 2 * b),
    sheetH: round(trimH + 2 * b),
    trimW,
    trimH,
    scale,
    offsetX: round(b + (trimW - page.w * scale) / 2),
    offsetY: round(b + (trimH - page.h * scale) / 2),
  };
}
const round = (n: number) => Math.round(n * 1000) / 1000;

export interface ExportWarning {
  page: number;
  level: 'error' | 'warning';
  message: string;
}
export interface ExportedPage {
  page: number;
  title: string;
  widthMm: number;
  heightMm: number;
  pxWidth?: number;
  pxHeight?: number;
}
export interface ExportDTO {
  id: number;
  kind: 'pdf' | 'png';
  filename: string;
  mime: string;
  bytes: number;
  pageCount: number;
  options: ExportOptions;
  pages: ExportedPage[];
  warnings: ExportWarning[];
  createdAt: string;
  downloadUrl: string;
}
