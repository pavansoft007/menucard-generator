import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import type { Page } from 'puppeteer-core';
import { sheetLayout, type ExportOptions, type ExportWarning, type SheetLayout, type UserRole } from '@gc/shared-types';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/httpError.js';

export const MM_PX = 96 / 25.4; // CSS pixels per millimetre
export const MM_PT = 72 / 25.4; // PDF points per millimetre
export const MAX_PIXELS = 90_000_000; // protects memory: A3 at 600 DPI is ~69 MP

export interface Target {
  pageId: number;
  pageNumber: number; // position among the active pages (stable even when a range is exported)
  title: string;
  widthMm: number;
  heightMm: number;
}
export interface Rendered {
  target: Target;
  sheet: SheetLayout;
  pdf?: Buffer;
  png?: Buffer;
  pxWidth?: number;
  pxHeight?: number;
  warnings: ExportWarning[];
}

/** 15-minute, read-only token that lets the headless browser load the menu data. */
export function signRenderToken(userId: number, role: UserRole, tokenVersion: number): string {
  return jwt.sign({ role, tv: tokenVersion, purpose: 'render' }, env.JWT_SECRET, { subject: String(userId), algorithm: 'HS256', expiresIn: '15m' });
}

export function renderUrl(t: Target, total: number, o: ExportOptions, token: string): string {
  const q = new URLSearchParams({
    token,
    n: String(t.pageNumber),
    total: String(total),
    bleed: String(o.bleedMm),
    paper: o.paper,
    orient: o.orientation,
    img: o.quality === 'max' ? 'orig' : 'opt',
    footer: o.includeFooter ? '1' : '0',
    pnum: o.includePageNumbers ? '1' : '0',
  });
  return `${env.RENDER_BASE_URL}/render/${t.pageId}?${q.toString()}`;
}

/** Opens the render route, waits until fonts/images are settled, then captures a PDF page or a PNG. */
export async function renderTarget(page: Page, t: Target, total: number, o: ExportOptions, kind: 'pdf' | 'png', token: string): Promise<Rendered> {
  const sheet = sheetLayout({ w: t.widthMm, h: t.heightMm }, o);
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(e instanceof Error ? e.message : String(e)));
  page.on('requestfailed', (r) => problems.push(`failed: ${r.url().slice(0, 120)}`));

  const scaleFactor = kind === 'png' ? o.dpi / 96 : 1;
  await page.setViewport({ width: Math.ceil(sheet.sheetW * MM_PX), height: Math.ceil(sheet.sheetH * MM_PX), deviceScaleFactor: scaleFactor });
  await page.emulateMediaType(kind === 'pdf' ? 'print' : 'screen');

  try {
    await page.goto(renderUrl(t, total, o, token), { waitUntil: 'load', timeout: 60_000 });
    await page.waitForFunction('window.__GC_READY__ === true', { timeout: 60_000 });
  } catch {
    throw new HttpError(502, 'RENDER_FAILED', `Page ${t.pageNumber} could not be rendered. Is the web app reachable at ${env.RENDER_BASE_URL}? ${problems.slice(-2).join(' | ')}`.trim());
  }
  const raw = (await page.evaluate('window.__GC_ISSUES__ ?? []')) as { level: 'error' | 'warning'; message: string }[];
  const warnings = raw.map((w) => ({ page: t.pageNumber, level: w.level, message: w.message }));

  if (kind === 'pdf') {
    const pdf = Buffer.from(
      await page.pdf({ width: `${sheet.sheetW}mm`, height: `${sheet.sheetH}mm`, printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: '1' }),
    );
    return { target: t, sheet, pdf, warnings };
  }

  const pxWidth = Math.round((sheet.sheetW / 25.4) * o.dpi);
  const pxHeight = Math.round((sheet.sheetH / 25.4) * o.dpi);
  const shot = Buffer.from(await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: sheet.sheetW * MM_PX, height: sheet.sheetH * MM_PX } }));
  // Chrome may be off by a pixel from rounding; force the exact pixel size for the requested DPI and tag the density.
  const png = await sharp(shot).resize(pxWidth, pxHeight, { fit: 'fill' }).withMetadata({ density: o.dpi }).png({ compressionLevel: 6 }).toBuffer();
  return { target: t, sheet, png, pxWidth, pxHeight, warnings };
}
