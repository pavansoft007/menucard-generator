import crypto from 'node:crypto';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import type { MediaKind } from '@gc/shared-types';
import { HttpError } from '../../utils/httpError.js';

const RASTER: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const SVG_START = /^(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i;
// SVG can carry script. We refuse (rather than try to repair) anything active or externally linked.
const SVG_FORBIDDEN = /<script|<foreignObject|<iframe|<embed|<object|\son[a-z]+\s*=|javascript:|(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/|data:text)/i;

export interface ProcessedImage {
  kind: MediaKind;
  mime: string;
  ext: string;
  width: number | null;
  height: number | null;
  hasAlpha: boolean;
  sha256: string;
  original: Buffer;
  optimized: Buffer;
  thumb: Buffer;
  optimizedExt: string;
}

function svgSize(text: string): { width: number | null; height: number | null } {
  const tag = /<svg[^>]*>/i.exec(text)?.[0] ?? '';
  const num = (name: string) => {
    const m = new RegExp(`\\s${name}\\s*=\\s*["']([\\d.]+)(?:px)?["']`, 'i').exec(tag);
    return m ? Math.round(parseFloat(m[1]!)) : null;
  };
  let width = num('width');
  let height = num('height');
  if (!width || !height) {
    const vb = /viewBox\s*=\s*["'][\s,]*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(tag);
    if (vb) {
      width = Math.round(parseFloat(vb[1]!));
      height = Math.round(parseFloat(vb[2]!));
    }
  }
  return { width, height };
}

/** Validates by content (magic bytes), never by the client-supplied name/mime. */
export async function processUpload(buf: Buffer): Promise<ProcessedImage> {
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const ft = await fileTypeFromBuffer(buf);

  if (ft && RASTER[ft.mime]) {
    let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
    try {
      meta = await sharp(buf).metadata();
    } catch {
      throw HttpError.badRequest('The file is not a valid image');
    }
    const rotated = (meta.orientation ?? 1) >= 5;
    const width = (rotated ? meta.height : meta.width) ?? null;
    const height = (rotated ? meta.width : meta.height) ?? null;
    const base = sharp(buf).rotate();
    const optimized = await base
      .clone()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 92, alphaQuality: 100 })
      .toBuffer();
    const thumb = await base
      .clone()
      .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return {
      kind: 'image',
      mime: ft.mime,
      ext: RASTER[ft.mime]!,
      width,
      height,
      hasAlpha: !!meta.hasAlpha,
      sha256,
      original: buf,
      optimized,
      thumb,
      optimizedExt: 'webp',
    };
  }

  if (!ft) {
    const text = buf.toString('utf8');
    if (SVG_START.test(text.slice(0, 4096).trimStart())) {
      if (SVG_FORBIDDEN.test(text)) {
        throw HttpError.badRequest('SVG rejected: it contains scripts, event handlers or external references');
      }
      return {
        kind: 'svg',
        mime: 'image/svg+xml',
        ext: 'svg',
        ...svgSize(text),
        hasAlpha: true,
        sha256,
        original: buf,
        optimized: buf,
        thumb: buf,
        optimizedExt: 'svg',
      };
    }
  }
  throw HttpError.badRequest('Unsupported file type. Upload PNG, JPG, WEBP or SVG images');
}
