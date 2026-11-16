import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { zipSync } from 'fflate';
import { parsePageRange, resolvePageSize, type ExportDTO, type ExportOptions, type ExportWarning, type ExportedPage, type UserRole } from '@gc/shared-types';
import { env } from '../../config/env.js';
import { MenuExport, MenuPage, RestaurantSettings } from '../../models/index.js';
import { HttpError } from '../../utils/httpError.js';
import { withPage } from './browser.js';
import { MAX_PIXELS, MM_PT, renderTarget, signRenderToken, type Rendered, type Target } from './render.js';

const slug = (s: string) => s.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').toLowerCase().slice(0, 40) || 'menu';
const pad = (n: number) => String(n).padStart(2, '0');

// Rendering is CPU/RAM heavy: one export at a time, and a short queue so requests can't pile up.
let chain: Promise<unknown> = Promise.resolve();
let queued = 0;
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  if (queued >= 3) throw new HttpError(429, 'EXPORT_BUSY', 'Too many exports are running. Try again in a moment.');
  queued++;
  const run = chain.then(fn, fn).finally(() => { queued--; });
  chain = run.catch(() => undefined);
  return run;
}

export const toDTO = (e: MenuExport): ExportDTO => ({
  id: e.id,
  kind: e.kind,
  filename: e.filename,
  mime: e.mime,
  bytes: e.bytes,
  pageCount: e.pageCount,
  options: e.options,
  pages: e.pages,
  warnings: e.warnings,
  createdAt: e.createdAt.toISOString(),
  downloadUrl: `/api/export/${e.id}/download`,
});

/** Active pages in printing order, then the requested range / sides. Numbers are positions in the full book. */
async function selectTargets(o: ExportOptions): Promise<{ targets: Target[]; total: number }> {
  const pages = await MenuPage.findAll({ where: { isActive: true }, order: [['displayOrder', 'ASC'], ['id', 'ASC']] });
  if (!pages.length) throw HttpError.badRequest('There are no pages to export. Add and include at least one page.');
  const wanted = parsePageRange(o.pages, pages.length);
  if (!wanted) throw HttpError.badRequest(`The page range "${o.pages}" does not match any of the ${pages.length} pages.`);
  const targets = pages
    .map((p, i) => ({ p, n: i + 1 }))
    .filter(({ n }) => wanted.includes(n) && (o.sides === 'all' || (o.sides === 'front' ? n % 2 === 1 : n % 2 === 0)))
    .map(({ p, n }): Target => {
      const { widthMm, heightMm } = resolvePageSize(p.settings);
      return { pageId: p.id, pageNumber: n, title: p.title, widthMm, heightMm };
    });
  if (!targets.length) throw HttpError.badRequest('No pages match that range and side selection.');
  return { targets, total: pages.length };
}

async function renderAll(targets: Target[], total: number, o: ExportOptions, kind: 'pdf' | 'png', userId: number, role: UserRole, tokenVersion: number): Promise<Rendered[]> {
  if (kind === 'png') {
    for (const t of targets) {
      const px = (t.widthMm / 25.4) * o.dpi * ((t.heightMm / 25.4) * o.dpi);
      if (px > MAX_PIXELS) throw HttpError.badRequest(`Page ${t.pageNumber} would be ${(px / 1e6).toFixed(0)} megapixels at ${o.dpi} DPI. Lower the resolution.`);
    }
  }
  const token = signRenderToken(userId, role, tokenVersion);
  const out: Rendered[] = [];
  for (const t of targets) out.push(await withPage((page) => renderTarget(page, t, total, o, kind, token)));
  return out;
}

/**
 * Chrome rounds the PDF page size down to 1/300 inch (A4 comes out 209.89 x 297.01 mm). Each page is therefore redrawn,
 * still as vector content, onto a page of the exact requested size (a ~0.05% scale), so A4 is exactly 210 x 297 mm.
 */
async function addExactPage(doc: PDFDocument, r: Rendered, bleedMm: number) {
  const src = await PDFDocument.load(r.pdf!);
  const [embedded] = await doc.embedPdf(src, [0]);
  const w = r.sheet.sheetW * MM_PT;
  const h = r.sheet.sheetH * MM_PT;
  const page = doc.addPage([w, h]);
  page.drawPage(embedded!, { x: 0, y: 0, width: w, height: h });
  if (bleedMm > 0) {
    const b = bleedMm * MM_PT;
    page.setBleedBox(0, 0, w, h); // where the artwork ends
    page.setTrimBox(b, b, r.sheet.trimW * MM_PT, r.sheet.trimH * MM_PT); // the finished (cut) size
  }
  return page;
}

async function newDoc(title: string) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setProducer('Golden Crunch Menu Builder');
  doc.setCreator('Golden Crunch Menu Builder');
  return doc;
}
// Plain (non-object-stream) output keeps the file readable by every print workflow and inspection tool.
const save = async (doc: PDFDocument) => Buffer.from(await doc.save({ useObjectStreams: false }));

async function mergePdfs(rendered: Rendered[], o: ExportOptions, title: string): Promise<Buffer> {
  const doc = await newDoc(title);
  for (const r of rendered) await addExactPage(doc, r, o.bleedMm);
  if (o.padToEven && doc.getPageCount() % 2 === 1) {
    const last = doc.getPage(doc.getPageCount() - 1);
    doc.addPage([last.getWidth(), last.getHeight()]); // blank back so duplex sheets line up
  }
  return save(doc);
}

async function singlePdf(r: Rendered, o: ExportOptions, title: string): Promise<Buffer> {
  const doc = await newDoc(title);
  await addExactPage(doc, r, o.bleedMm);
  return save(doc);
}

async function store(kind: 'pdf' | 'png', filename: string, mime: string, data: Buffer, o: ExportOptions, pages: ExportedPage[], warnings: ExportWarning[], userId: number) {
  const ext = path.extname(filename);
  const rel = `${crypto.randomUUID()}${ext}`;
  await fs.mkdir(env.exportDir, { recursive: true });
  await fs.writeFile(path.join(env.exportDir, rel), data);
  const row = await MenuExport.create({ kind, filename, mime, filePath: rel, bytes: data.length, pageCount: pages.length, options: o, pages, warnings, createdBy: userId });
  return toDTO(row);
}

export function createExport(kind: 'pdf' | 'png', o: ExportOptions, userId: number, role: UserRole, tokenVersion: number): Promise<ExportDTO> {
  return serialize(async () => {
    const { targets, total } = await selectTargets(o);
    const restaurant = await RestaurantSettings.findByPk(1);
    const base = slug(restaurant?.name ?? 'menu');
    const date = new Date().toISOString().slice(0, 10);
    const rendered = await renderAll(targets, total, o, kind, userId, role, tokenVersion);
    const warnings = rendered.flatMap((r) => r.warnings);
    const pages: ExportedPage[] = rendered.map((r) => ({ page: r.target.pageNumber, title: r.target.title, widthMm: r.sheet.sheetW, heightMm: r.sheet.sheetH, pxWidth: r.pxWidth, pxHeight: r.pxHeight }));

    if (kind === 'pdf') {
      if (o.mode === 'separate' && rendered.length > 1) {
        const files: Record<string, Uint8Array> = {};
        for (const r of rendered) files[`${base}-page-${pad(r.target.pageNumber)}-${slug(r.target.title)}.pdf`] = await singlePdf(r, o, r.target.title);
        return store('pdf', `${base}-pdf-pages-${date}.zip`, 'application/zip', Buffer.from(zipSync(files, { level: 0 })), o, pages, warnings, userId);
      }
      const merged = await mergePdfs(rendered, o, `${restaurant?.name ?? 'Menu'} – menu`);
      const name = rendered.length === 1 ? `${base}-page-${pad(rendered[0]!.target.pageNumber)}-${date}.pdf` : `${base}-menu-${date}.pdf`;
      return store('pdf', name, 'application/pdf', merged, o, pages, warnings, userId);
    }

    if (rendered.length === 1) {
      return store('png', `${base}-page-${pad(rendered[0]!.target.pageNumber)}-${o.dpi}dpi-${date}.png`, 'image/png', rendered[0]!.png!, o, pages, warnings, userId);
    }
    const files: Record<string, Uint8Array> = {};
    for (const r of rendered) files[`${base}-page-${pad(r.target.pageNumber)}-${slug(r.target.title)}.png`] = r.png!;
    return store('png', `${base}-png-pages-${o.dpi}dpi-${date}.zip`, 'application/zip', Buffer.from(zipSync(files, { level: 0 })), o, pages, warnings, userId);
  });
}

export const listExports = async () => (await MenuExport.findAll({ order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: 50 })).map(toDTO);

export async function getExportFile(id: number) {
  const row = await MenuExport.findByPk(id);
  if (!row) throw HttpError.notFound('Export not found');
  const full = path.join(env.exportDir, row.filePath);
  if (!full.startsWith(env.exportDir + path.sep)) throw HttpError.notFound('Export not found'); // path-traversal guard
  try {
    await fs.access(full);
  } catch {
    throw HttpError.notFound('The exported file is no longer on the server');
  }
  return { row, full };
}

export async function deleteExport(id: number) {
  const row = await MenuExport.findByPk(id);
  if (!row) throw HttpError.notFound('Export not found');
  await fs.rm(path.join(env.exportDir, row.filePath), { force: true });
  await row.destroy();
}
