import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getDesignTemplate, resolvePageSize } from '@gc/shared-types';
import { PageRenderer } from '../../renderer/PageRenderer';
import { useMenuData } from '../../renderer/menuData';
import { setRenderToken } from '../../services/api';
import { previewData, samplePage, type CardMode } from '../templates/designPlan';

declare global {
  interface Window {
    __GC_READY__?: boolean;
  }
}

const nextFrames = (n: number) => new Promise<void>((res) => { const f = (i: number) => (i <= 0 ? res() : requestAnimationFrame(() => f(i - 1))); f(n); });

/**
 * Chrome-free render of ONE page in a template's style (same read-only token as the export route). Used to produce
 * template preview images and for design review; nothing is saved.
 *   /render/template/:templateId?token=…&page=<pageId>&cards=photos|lists|auto
 */
export default function RenderTemplatePage() {
  const { templateId } = useParams();
  const [q] = useSearchParams();
  setRenderToken(q.get('token'));
  const cards = (q.get('cards') ?? 'photos') as CardMode;
  const template = getDesignTemplate(templateId ?? '');
  const { data, isLoading } = useMenuData();
  const page = useMemo(() => (q.get('page') ? data.pages.find((p) => p.id === Number(q.get('page'))) : samplePage(data)), [data, q]);
  const preview = useMemo(() => (template && page ? previewData(template, data, { pageIds: [page.id], cardMode: cards }) : null), [template, page, data, cards]);

  useEffect(() => {
    if (isLoading || !preview) return;
    let live = true;
    (async () => {
      await nextFrames(2);
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode().catch(() => undefined)));
      await nextFrames(3);
      if (live) window.__GC_READY__ = true;
    })();
    return () => { live = false; };
  }, [isLoading, preview]);

  if (!template) return <pre>Unknown template</pre>;
  if (isLoading || !preview || !page) return null;
  const target = preview.pages.find((p) => p.id === page.id)!;
  const active = preview.pages.filter((p) => p.isActive);
  const { widthMm, heightMm } = resolvePageSize(target.settings);
  return (
    <>
      <style>{`html, body, #root { margin: 0 !important; padding: 0 !important; background: #fff !important; overflow: hidden; height: auto !important; }`}</style>
      <div style={{ width: `${widthMm}mm`, height: `${heightMm}mm` }}>
        <PageRenderer page={target} pageNumber={Math.max(1, active.findIndex((p) => p.id === page.id) + 1)} totalPages={active.length} data={preview} mode="gallery" />
      </div>
    </>
  );
}
