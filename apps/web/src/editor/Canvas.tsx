import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as RPointerEvent } from 'react';
import { resolvePageSize, type LayoutElement, type TextElement } from '@gc/shared-types';
import { PageRenderer, type RenderablePage } from '../renderer/PageRenderer';
import { ScaledPage } from '../renderer/ScaledPage';
import { safeArea } from '../renderer/geometry';
import { themeFor, type MenuData } from '../renderer/menuData';
import { MM_PX, resolveColor } from '../renderer/tokens';
import { boundsOf, rectOf, resizeRect, round1, snapMove, snapTargets, type Guide, type Handle, type Rect } from './geometry';
import { useEditor } from './store';

export interface DropPayload {
  kind: 'element' | 'media' | 'logo' | 'item' | 'section' | 'category' | 'combo' | 'preset' | 'template';
  id?: number | string;
}
export const DND_TYPE = 'application/x-gc-element';

type Gesture =
  | { kind: 'move'; sx: number; sy: number; items: { id: string; rect: Rect }[] }
  | { kind: 'resize'; id: string; handle: Handle; sx: number; sy: number; start: Rect; keepAspect: boolean }
  | { kind: 'rotate'; id: string };

const HANDLES: { h: Handle; x: number; y: number; cursor: string }[] = [
  { h: 'nw', x: 0, y: 0, cursor: 'nwse-resize' }, { h: 'n', x: 0.5, y: 0, cursor: 'ns-resize' }, { h: 'ne', x: 1, y: 0, cursor: 'nesw-resize' },
  { h: 'e', x: 1, y: 0.5, cursor: 'ew-resize' }, { h: 'se', x: 1, y: 1, cursor: 'nwse-resize' }, { h: 's', x: 0.5, y: 1, cursor: 'ns-resize' },
  { h: 'sw', x: 0, y: 1, cursor: 'nesw-resize' }, { h: 'w', x: 0, y: 0.5, cursor: 'ew-resize' },
];

export function Canvas({ data, pageId, pageNumber, totalPages, issueIds, onDropPayload }: { data: MenuData; pageId: number; pageNumber: number; totalPages: number; issueIds: Set<string>; onDropPayload: (p: DropPayload, xMm: number, yMm: number) => void }) {
  const s = useEditor();
  const { elements, settings, themeId, meta, selection, zoom, fit, snap, guides: showGuides, measured, editingText } = s;
  const scroller = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [lines, setLines] = useState<Guide[]>([]);

  const size = resolvePageSize(settings);
  const theme = themeFor(data, themeId);
  const k = 1 / (MM_PX * zoom); // mm per screen px

  // "Fit" keeps the whole page in view whenever the pane is resized.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !fit) return;
    const run = () => useEditor.setState({ zoom: Math.max(0.1, Math.min(2.5, Math.min((el.clientWidth - 64) / (size.widthMm * MM_PX), (el.clientHeight - 64) / (size.heightMm * MM_PX)))) });
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, size.widthMm, size.heightMm]);

  const page = useMemo<RenderablePage>(() => ({ id: pageId, title: meta.title, subtitle: meta.subtitle, pageType: meta.pageType, themeId, settings, layout: { version: 1, elements } }), [pageId, meta, themeId, settings, elements]);
  const onMeasure = useCallback((id: string, h: number) => useEditor.getState().setMeasured(id, h), []);

  // Capture keeps a drag alive outside the page; some pointer types refuse it, which must not abort the gesture.
  const capture = (pointerId: number) => {
    try { wrapper.current?.setPointerCapture(pointerId); } catch { /* not capturable */ }
  };

  const toMm = (e: { clientX: number; clientY: number }) => {
    const r = wrapper.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  };

  const targetsFor = (excludeIds: string[]) => {
    const others = elements.filter((e) => !e.hidden && !excludeIds.includes(e.id)).map(rectOf);
    return snapTargets({ w: size.widthMm, h: size.heightMm }, safeArea(settings, pageNumber), others);
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || editingText) return;
    const el = (e.target as HTMLElement).closest('[data-el-id]');
    const id = el?.getAttribute('data-el-id');
    if (!id) {
      if (!e.shiftKey) s.select([]);
      return;
    }
    const element = elements.find((x) => x.id === id);
    if (!element) return;
    if (e.shiftKey) {
      s.select([id], true);
      return;
    }
    const current = selection.includes(id) ? selection : [id];
    if (!selection.includes(id)) s.select([id]);
    const movable = elements.filter((x) => current.includes(x.id) && !x.locked);
    if (!movable.length) return;
    gesture.current = { kind: 'move', sx: e.clientX, sy: e.clientY, items: movable.map((x) => ({ id: x.id, rect: rectOf(x) })) };
    s.beginGesture();
    capture(e.pointerId);
  };

  const startResize = (e: RPointerEvent, element: LayoutElement, handle: Handle) => {
    e.stopPropagation();
    gesture.current = { kind: 'resize', id: element.id, handle, sx: e.clientX, sy: e.clientY, start: rectOf(element), keepAspect: element.type === 'image' || element.type === 'logo' };
    s.beginGesture();
    capture(e.pointerId);
  };
  const startRotate = (e: RPointerEvent, element: LayoutElement) => {
    e.stopPropagation();
    gesture.current = { kind: 'rotate', id: element.id };
    s.beginGesture();
    capture(e.pointerId);
  };

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const threshold = 6 * k;
    if (g.kind === 'move') {
      const dx = (e.clientX - g.sx) * k;
      const dy = (e.clientY - g.sy) * k;
      const group = boundsOf(g.items.map((i) => i.rect));
      let rect = { ...group, x: group.x + dx, y: group.y + dy };
      if (snap && !e.altKey) {
        const res = snapMove(rect, targetsFor(g.items.map((i) => i.id)), threshold);
        rect = res.rect;
        setLines(res.guides);
      } else setLines([]);
      const ox = rect.x - group.x;
      const oy = rect.y - group.y;
      const map = new Map(g.items.map((i) => [i.id, i.rect]));
      s.live((d) => ({ ...d, elements: d.elements.map((el) => (map.has(el.id) ? { ...el, x: round1(map.get(el.id)!.x + ox), y: round1(map.get(el.id)!.y + oy) } : el)) }));
    } else if (g.kind === 'resize') {
      const dx = (e.clientX - g.sx) * k;
      const dy = (e.clientY - g.sy) * k;
      const res = resizeRect(g.start, g.handle, dx, dy, { keepAspect: g.keepAspect !== e.shiftKey, minSize: 2, targets: snap && !e.altKey ? targetsFor([g.id]) : undefined, threshold });
      setLines(res.guides);
      s.live((d) => ({ ...d, elements: d.elements.map((el) => (el.id === g.id ? { ...el, x: round1(res.rect.x), y: round1(res.rect.y), w: round1(res.rect.w), h: round1(res.rect.h) } : el)) }));
    } else {
      const el = elements.find((x) => x.id === g.id);
      if (!el) return;
      const p = toMm(e);
      let deg = (Math.atan2(p.y - (el.y + el.h / 2), p.x - (el.x + el.w / 2)) * 180) / Math.PI + 90;
      if (deg > 180) deg -= 360;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      s.live((d) => ({ ...d, elements: d.elements.map((x) => (x.id === g.id ? { ...x, rotation: Math.round(deg) } : x)) }));
    }
  };

  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!gesture.current) return;
    gesture.current = null;
    s.endGesture();
    setLines([]);
    if (wrapper.current?.hasPointerCapture(e.pointerId)) wrapper.current.releasePointerCapture(e.pointerId);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const id = (e.target as HTMLElement).closest('[data-el-id]')?.getAttribute('data-el-id');
    const el = elements.find((x) => x.id === id);
    if (el?.type === 'text' && !el.locked) {
      s.select([el.id]);
      s.setEditingText(el.id);
    }
  };

  const onDrop = (e: DragEvent) => {
    const raw = e.dataTransfer.getData(DND_TYPE);
    if (!raw) return;
    e.preventDefault();
    const p = toMm(e);
    onDropPayload(JSON.parse(raw) as DropPayload, round1(p.x), round1(p.y));
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    s.setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  };

  const selected = elements.filter((e) => selection.includes(e.id));
  const single = selected.length === 1 ? selected[0]! : null;
  const px = (n: number) => `${n * k}px`; // screen-constant size expressed inside the scaled space
  const editing = editingText ? (elements.find((e) => e.id === editingText && e.type === 'text') as TextElement | undefined) : undefined;

  return (
    <div ref={scroller} onWheel={onWheel} style={{ flex: 1, minWidth: 0, overflow: 'auto', background: '#1b1b1f', backgroundImage: 'radial-gradient(#2a2a30 1px, transparent 1px)', backgroundSize: '18px 18px', display: 'flex', padding: 32 }}>
      <div style={{ margin: 'auto' }}>
        <ScaledPage widthMm={size.widthMm} heightMm={size.heightMm} zoom={zoom}>
          <div
            ref={wrapper}
            data-testid="canvas-page"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
            onDragOver={(e) => e.dataTransfer.types.includes(DND_TYPE) && e.preventDefault()}
            onDrop={onDrop}
            style={{ position: 'relative', width: `${size.widthMm}mm`, height: `${size.heightMm}mm`, userSelect: 'none', touchAction: 'none' }}
          >
            <PageRenderer page={page} pageNumber={pageNumber} totalPages={totalPages} data={data} mode="edit" showGuides={showGuides} onMeasureElement={onMeasure} />

            {/* ---- selection overlay (screen-constant stroke/handle sizes) ---- */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20000 }}>
              {elements.filter((e) => issueIds.has(e.id) && !selection.includes(e.id)).map((e) => (
                <div key={`i${e.id}`} style={{ position: 'absolute', left: `${e.x}mm`, top: `${e.y}mm`, width: `${e.w}mm`, height: `${e.h}mm`, outline: `${px(1.5)} dashed #ff4d4f`, transform: e.rotation ? `rotate(${e.rotation}deg)` : undefined }} />
              ))}
              {elements.filter((e) => e.type === 'section' && (measured[e.id] ?? 0) > e.h + 0.5).map((e) => (
                <div key={`o${e.id}`} style={{ position: 'absolute', left: `${e.x}mm`, top: `${e.y}mm`, width: `${e.w}mm`, height: `${measured[e.id]}mm`, outline: `${px(1.5)} dotted #ff4d4f`, background: 'rgba(255,77,79,.07)' }} />
              ))}
              {selected.map((e) => (
                <div key={`s${e.id}`} style={{ position: 'absolute', left: `${e.x}mm`, top: `${e.y}mm`, width: `${e.w}mm`, height: `${e.h}mm`, transform: e.rotation ? `rotate(${e.rotation}deg)` : undefined, outline: `${px(1.5)} ${e.locked ? 'dashed #ffb020' : 'solid #35b9ff'}` }}>
                  {single?.id === e.id && (
                    <>
                      <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: px(4), fontSize: px(10), whiteSpace: 'nowrap', background: '#35b9ff', color: '#00131c', padding: `0 ${px(4)}`, borderRadius: px(2) }}>
                        {round1(e.w)} × {round1(e.h)} mm{e.locked ? ' · locked' : ''}
                      </div>
                      {!e.locked && (
                        <>
                          <div data-handle="rotate" onPointerDown={(ev) => startRotate(ev, e)} title="Rotate (Shift = 15° steps)" style={{ position: 'absolute', left: '50%', top: px(-22), width: px(10), height: px(10), marginLeft: px(-5), borderRadius: '50%', background: '#fff', border: `${px(1.5)} solid #35b9ff`, cursor: 'grab', pointerEvents: 'auto' }} />
                          {e.rotation === 0 && HANDLES.map((h) => (
                            <div key={h.h} data-handle={h.h} onPointerDown={(ev) => startResize(ev, e, h.h)} style={{ position: 'absolute', left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: px(9), height: px(9), marginLeft: px(-4.5), marginTop: px(-4.5), background: '#fff', border: `${px(1.5)} solid #35b9ff`, cursor: h.cursor, pointerEvents: 'auto' }} />
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
              {lines.map((g, i) => (
                <div key={i} style={g.axis === 'x' ? { position: 'absolute', left: `${g.at}mm`, top: 0, bottom: 0, width: px(1), background: '#ff3bd4' } : { position: 'absolute', top: `${g.at}mm`, left: 0, right: 0, height: px(1), background: '#ff3bd4' }} />
              ))}
              {editing && (
                <InlineText el={editing} color={resolveColor(editing.color, theme) ?? '#fff'} family={editing.font ?? theme.fonts[editing.role]} onDone={(content) => { if (content !== undefined && content !== editing.content) s.patch([editing.id], { content }); s.setEditingText(null); }} />
              )}
            </div>
          </div>
        </ScaledPage>
      </div>
    </div>
  );
}

function InlineText({ el, color, family, onDone }: { el: TextElement; color: string; family: string; onDone: (content?: string) => void }) {
  const [value, setValue] = useState(el.content);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <textarea
      ref={ref}
      value={value}
      aria-label="Edit text"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onDone(value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onDone(undefined);
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onDone(value);
      }}
      style={{ pointerEvents: 'auto', position: 'absolute', left: `${el.x}mm`, top: `${el.y}mm`, width: `${el.w}mm`, height: `${el.h}mm`, transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined, resize: 'none', boxSizing: 'border-box', border: '0.3mm solid #35b9ff', background: 'rgba(0,0,0,.55)', color, fontFamily: `"${family}", sans-serif`, fontSize: `${el.fontSizePt}pt`, fontWeight: el.fontWeight, lineHeight: el.lineHeight, textAlign: el.align, padding: 0, outline: 'none' }}
    />
  );
}
