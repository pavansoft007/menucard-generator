import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { MediaDTO } from '@gc/shared-types';
import { api, json } from '../../services/api';
import { keys } from '../../services/menuService';
import { useUiStore } from '../../store/uiStore';
import { checker } from '../../components/common';
import { clamp, fitAspect, fullRect, moveRect, resizeFromCorner, resultSize, type Corner, type Rect } from './cropMath';

const PRESETS: { label: string; ratio: number | null }[] = [
  { label: 'Free', ratio: null }, { label: '1:1', ratio: 1 }, { label: '4:3', ratio: 4 / 3 }, { label: '3:2', ratio: 3 / 2 },
  { label: '16:9', ratio: 16 / 9 }, { label: '3:4', ratio: 3 / 4 }, { label: '2:3', ratio: 2 / 3 },
];
const CORNERS: { c: Corner; left: string; top: string; cursor: string }[] = [
  { c: 'nw', left: '0%', top: '0%', cursor: 'nwse-resize' }, { c: 'ne', left: '100%', top: '0%', cursor: 'nesw-resize' },
  { c: 'sw', left: '0%', top: '100%', cursor: 'nesw-resize' }, { c: 'se', left: '100%', top: '100%', cursor: 'nwse-resize' },
];

type Drag = { kind: 'move'; sx: number; sy: number; start: Rect } | { kind: 'resize'; corner: Corner; start: Rect };

/** Crops / downsizes into a NEW library image. The original is never modified. */
export default function CropDialog({ media, onClose, onCreated }: { media: MediaDTO; onClose: () => void; onCreated: (m: MediaDTO) => void }) {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const W = media.width ?? 1;
  const H = media.height ?? 1;
  const imageAspect = W / H;
  const [rect, setRect] = useState<Rect>(fullRect);
  const [ratio, setRatio] = useState<number | null>(null);
  const [outW, setOutW] = useState('');

  const outputWidth = outW.trim() === '' ? null : Math.round(Number(outW));
  const outBad = outputWidth !== null && (!Number.isFinite(outputWidth) || outputWidth < 16 || outputWidth > 6000);
  const size = resultSize(rect, W, H, outBad ? null : outputWidth);

  const save = useMutation({
    mutationFn: () => api<MediaDTO>(`/media/${media.id}/crop`, json('POST', { ...rect, outputWidth: outBad ? null : outputWidth })),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: keys.media });
      qc.invalidateQueries({ queryKey: keys.stats });
      notify('Cropped copy added to the library');
      onCreated(m);
    },
    onError: (e) => notify(e.message, 'error'),
  });

  const norm = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const begin = (e: RPointerEvent, d: Drag) => {
    e.stopPropagation();
    drag.current = d;
    try { box.current?.setPointerCapture(e.pointerId); } catch { /* ok */ }
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = norm(e);
    if (d.kind === 'move') setRect(moveRect(d.start, p.x - d.sx, p.y - d.sy));
    else setRect(resizeFromCorner(d.start, d.corner, p.x, p.y, { ratio, imageAspect, minSize: 0.03 }));
  };
  const onUp = () => { drag.current = null; };

  const pickRatio = (r: number | null) => {
    setRatio(r);
    setRect((cur) => fitAspect(cur, r, imageAspect));
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Crop &amp; resize – {media.originalName}</DialogTitle>
      <DialogContent dividers className="flex flex-col gap-3">
        <ToggleButtonGroup size="small" exclusive value={ratio ?? 'free'} onChange={(_, v) => v !== null && pickRatio(v === 'free' ? null : Number(v))} aria-label="Aspect ratio">
          {PRESETS.map((p) => <ToggleButton key={p.label} value={p.ratio ?? 'free'} sx={{ textTransform: 'none', px: 1.5 }}>{p.label}</ToggleButton>)}
        </ToggleButtonGroup>

        <Box sx={{ ...checker, display: 'flex', justifyContent: 'center', borderRadius: 2, p: 1 }}>
          <div
            ref={box}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{ position: 'relative', lineHeight: 0, userSelect: 'none', touchAction: 'none', maxWidth: '100%' }}
          >
            <img src={media.url} alt={media.altText ?? media.originalName} draggable={false} style={{ display: 'block', maxWidth: '100%', maxHeight: '58vh' }} />
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
              <div
                role="group"
                aria-label="Crop area"
                onPointerDown={(e) => begin(e, { kind: 'move', sx: norm(e).x - rect.x, sy: norm(e).y - rect.y, start: rect })}
                style={{ position: 'absolute', left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%`, boxShadow: '0 0 0 9999px rgba(0,0,0,.6)', outline: '2px solid #F5B51B', cursor: 'move' }}
              >
                {[1 / 3, 2 / 3].map((t) => (
                  <span key={t}>
                    <span style={{ position: 'absolute', left: `${t * 100}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,.35)' }} />
                    <span style={{ position: 'absolute', top: `${t * 100}%`, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,.35)' }} />
                  </span>
                ))}
                {CORNERS.map((k) => (
                  <span key={k.c} onPointerDown={(e) => begin(e, { kind: 'resize', corner: k.c, start: rect })} aria-label={`Resize ${k.c} corner`} style={{ position: 'absolute', left: k.left, top: k.top, width: 16, height: 16, marginLeft: -8, marginTop: -8, background: '#fff', border: '2px solid #F5B51B', borderRadius: 3, cursor: k.cursor }} />
                ))}
              </div>
            </div>
          </div>
        </Box>

        <div className="flex flex-wrap items-center gap-3">
          <TextField size="small" label="Resize to width (px)" placeholder="Keep size" value={outW} onChange={(e) => setOutW(e.target.value)} error={outBad} helperText={outBad ? '16 – 6000' : 'Optional – never enlarges'} sx={{ width: 190 }} slotProps={{ htmlInput: { inputMode: 'numeric' }, inputLabel: { shrink: true } }} />
          <Typography variant="body2">Result: <b>{size.w} × {size.h} px</b> <Typography component="span" variant="caption" color="text.secondary">(from {W} × {H})</Typography></Typography>
          <Button size="small" onClick={() => { setRect(fullRect); setRatio(null); setOutW(''); }}>Reset</Button>
        </div>
        <Typography variant="caption" color="text.secondary">The crop is saved as a new image from your untouched original, so you can always go back. Drag the box to move it, drag a corner to resize it.</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || outBad || clamp(rect.w, 0, 1) < 0.005}>{save.isPending ? 'Creating…' : 'Create cropped copy'}</Button>
      </DialogActions>
    </Dialog>
  );
}
