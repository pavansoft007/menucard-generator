import { useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { resolvePageSize, sheetLayout, type ExportOptions } from '@gc/shared-types';
import { layoutIssues, type Issue } from '../../editor/issues';
import { effectiveElements, PageRenderer, type RenderablePage } from '../../renderer/PageRenderer';
import { safeArea } from '../../renderer/geometry';
import { useMenuData, type MenuData } from '../../renderer/menuData';
import { setRenderToken } from '../../services/api';

declare global {
  interface Window {
    __GC_READY__?: boolean;
    __GC_ISSUES__?: { level: Issue['level']; message: string }[];
    __GC_ERROR__?: string;
  }
}

/** Swaps every optimized image URL for the untouched original (maximum print quality). */
function withOriginals(d: MenuData): MenuData {
  const swap = <T,>(v: T): T => {
    if (Array.isArray(v)) return v.map(swap) as T;
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(o)) out[k] = swap(val);
      if (typeof o.originalUrl === 'string' && typeof o.url === 'string' && o.kind !== 'svg') out.url = o.originalUrl;
      return out as T;
    }
    return v;
  };
  return { ...swap({ ...d, media: undefined }), media: new Map([...d.media].map(([k, m]) => [k, swap(m)])) } as MenuData;
}

const nextFrames = (n: number) => new Promise<void>((res) => { const f = (i: number) => (i <= 0 ? res() : requestAnimationFrame(() => f(i - 1))); f(n); });

/**
 * Chrome-free page used by the exporter (headless Chrome opens /render/:pageId?token=…). It draws ONE page at its real
 * size on a sheet (bleed + optional fit-to-paper), then sets window.__GC_READY__ once fonts and images have settled and
 * publishes the print checks in window.__GC_ISSUES__.
 */
export default function RenderPage() {
  const { pageId } = useParams();
  const [q] = useSearchParams();
  const token = q.get('token');
  setRenderToken(token); // before any query runs

  const pageNumber = Number(q.get('n') ?? 1);
  const total = Number(q.get('total') ?? 1);
  const opts: Pick<ExportOptions, 'paper' | 'orientation' | 'bleedMm'> = {
    paper: (q.get('paper') as ExportOptions['paper']) ?? 'native',
    orientation: (q.get('orient') as ExportOptions['orientation']) ?? 'native',
    bleedMm: Math.min(10, Math.max(0, Number(q.get('bleed') ?? 0))),
  };
  const useOriginal = q.get('img') === 'orig';
  const footerOn = q.get('footer') !== '0';
  const pageNumOn = q.get('pnum') !== '0';

  const { data, isLoading, error } = useMenuData();
  const rendered = useMemo(() => (useOriginal ? withOriginals(data) : data), [data, useOriginal]);
  const dbPage = data.pages.find((p) => p.id === Number(pageId));
  const measured = useRef<Record<string, number>>({});
  const flowHeight = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const page = useMemo<RenderablePage | null>(
    () => (dbPage ? { ...dbPage, settings: { ...dbPage.settings, footer: { ...dbPage.settings.footer, enabled: dbPage.settings.footer.enabled && footerOn }, showPageNumber: dbPage.settings.showPageNumber && pageNumOn } } : null),
    [dbPage, footerOn, pageNumOn],
  );

  useEffect(() => {
    if (error) window.__GC_ERROR__ = error instanceof Error ? error.message : 'load failed';
  }, [error]);

  useEffect(() => {
    if (isLoading || !page || !root.current) return;
    let cancelled = false;
    (async () => {
      await nextFrames(2);
      await document.fonts.ready;
      const imgs = [...root.current!.querySelectorAll('img')];
      const broken: string[] = [];
      await Promise.all(imgs.map(async (img) => {
        try {
          if (!img.complete) await Promise.race([img.decode(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20_000))]);
          if (img.naturalWidth === 0) broken.push(img.alt || 'image');
        } catch {
          broken.push(img.alt || 'image');
        }
      }));
      await nextFrames(3); // let section measurements settle
      if (cancelled) return;
      const found = layoutIssues(effectiveElements(page, rendered, pageNumber, 'export'), page.settings, pageNumber, measured.current);
      const issues = found.map((i) => ({ level: i.level, message: i.message }));
      // An automatically laid-out page flows top to bottom: it must end above the footer.
      if (flowHeight.current !== null) {
        const area = safeArea(page.settings, pageNumber);
        const room = area.height - (page.settings.footer.enabled ? 11 : 0);
        if (flowHeight.current > room + 0.5) {
          issues.push({ level: 'error', message: `The content is ${(flowHeight.current - room).toFixed(1)} mm too tall for this page and runs into the footer – reduce columns/rows, use a compact card style, or move a section to another page.` });
        }
      }
      for (const b of broken) issues.push({ level: 'error', message: `An image failed to load (${b}) and would print blank.` });
      window.__GC_ISSUES__ = issues;
      window.__GC_READY__ = true;
    })();
    return () => { cancelled = true; };
  }, [isLoading, page, rendered, pageNumber]);

  if (error) return <pre>Could not load the menu: {error instanceof Error ? error.message : String(error)}</pre>;
  if (isLoading || !page) return null;

  const size = resolvePageSize(page.settings);
  const sheet = sheetLayout({ w: size.widthMm, h: size.heightMm }, opts);
  const theme = rendered.themes.find((t) => t.id === (page.themeId ?? rendered.themes.find((x) => x.isDefault)?.id));
  const bg = page.settings.backgroundId ? rendered.backgrounds.find((b) => b.id === page.settings.backgroundId) : undefined;
  const bleedColor = page.settings.backgroundColor ?? bg?.config.color ?? theme?.config.colors.background ?? '#000';

  return (
    <>
      {/* Exact physical size; no browser margins; keep background colours when printing. */}
      <style>{`
        @page { size: ${sheet.sheetW}mm ${sheet.sheetH}mm; margin: 0; }
        html, body, #root { margin: 0 !important; padding: 0 !important; background: #fff !important; overflow: hidden; height: auto !important; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>
      <div ref={root} data-render-sheet style={{ position: 'relative', width: `${sheet.sheetW}mm`, height: `${sheet.sheetH}mm`, background: bleedColor, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: `${sheet.offsetX}mm`, top: `${sheet.offsetY}mm`, width: `${size.widthMm}mm`, height: `${size.heightMm}mm`, transform: sheet.scale === 1 ? undefined : `scale(${sheet.scale})`, transformOrigin: '0 0' }}>
          <PageRenderer page={page} pageNumber={pageNumber} totalPages={total} data={rendered} mode="export" onMeasureElement={(id, h) => { measured.current[id] = h; }} onMeasureFlow={(h) => { flowHeight.current = h; }} />
        </div>
      </div>
    </>
  );
}
