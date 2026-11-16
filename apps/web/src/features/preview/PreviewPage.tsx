import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, IconButton, MenuItem, Slider, Switch, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, FormControlLabel } from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import EditIcon from '@mui/icons-material/Edit';
import { resolvePageSize, type PageDTO } from '@gc/shared-types';
import { useMenuData } from '../../renderer/menuData';
import { PageRenderer } from '../../renderer/PageRenderer';
import { ScaledPage } from '../../renderer/ScaledPage';
import { MM_PX } from '../../renderer/tokens';
import { ErrorAlert, ListSkeleton, PageHeader } from '../../components/common';
import EmptyState from '../../components/EmptyState';

type View = 'single' | 'sheets' | 'all';

/** Live read-only preview of the whole menu book. It follows edits made anywhere (polling + cross-tab invalidation). */
export default function PreviewPage() {
  const { data, isLoading, error, refetch } = useMenuData({ live: true });
  const [view, setView] = useState<View>('single');
  const [index, setIndex] = useState(0);
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [guides, setGuides] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const [areaWidth, setAreaWidth] = useState(900);

  const pages = useMemo(() => data.pages.filter((p) => p.isActive), [data.pages]);
  const safeIndex = Math.min(index, Math.max(0, pages.length - 1));

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAreaWidth(el.clientWidth));
    ro.observe(el);
    setAreaWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [isLoading, pages.length]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (view !== 'single' || (e.target as HTMLElement).closest('input,textarea,[role=combobox]')) return;
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, pages.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [view, pages.length]);

  const render = (p: PageDTO, n: number, z: number) => {
    const { widthMm, heightMm } = resolvePageSize(p.settings);
    return (
      <ScaledPage key={p.id} widthMm={widthMm} heightMm={heightMm} zoom={z}>
        <PageRenderer page={p} pageNumber={n} totalPages={pages.length} data={data} mode="preview" showGuides={guides} />
      </ScaledPage>
    );
  };

  // "Fit" sizes the widest layout in the current view to the available width.
  const widest = Math.max(...pages.map((p) => resolvePageSize(p.settings).widthMm), 210);
  const perRow = view === 'sheets' ? 2 : view === 'all' ? Math.max(1, Math.floor(areaWidth / (widest * MM_PX * 0.3))) : 1;
  const tallest = Math.max(...pages.map((p) => resolvePageSize(p.settings).heightMm), 297);
  const widthFit = (areaWidth - 48 - (perRow - 1) * 24) / (perRow * widest * MM_PX);
  const heightFit = view === 'all' ? Infinity : (window.innerHeight - 290) / (tallest * MM_PX); // whole page visible without scrolling
  const fit = Math.max(0.1, Math.min(1.6, widthFit, heightFit));
  const zoom = view === 'all' ? Math.min(0.3, fit) : zoomMode === 'fit' ? fit : zoomMode;

  const current = pages[safeIndex];

  return (
    <>
      <PageHeader
        title="Menu Preview"
        subtitle="Exactly what will print – updates automatically when you change items, prices, images or designs."
        actions={current && view === 'single' ? <Button startIcon={<EditIcon />} component={RouterLink} to={`/editor/${current.id}`}>Edit this page</Button> : undefined}
      />
      {isLoading ? <ListSkeleton rows={2} height={300} /> : error ? <ErrorAlert error={error} onRetry={() => refetch()} /> : pages.length === 0 ? (
        <EmptyState title="Nothing to preview" description="Add pages in the Page Builder. Only pages marked as included are shown here." />
      ) : (
        <>
          <Box className="mb-3 flex flex-wrap items-center gap-3">
            <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v: View | null) => v && setView(v)} aria-label="Preview mode">
              <ToggleButton value="single">Single page</ToggleButton>
              <ToggleButton value="sheets">Front &amp; back</ToggleButton>
              <ToggleButton value="all">All pages</ToggleButton>
            </ToggleButtonGroup>
            {view === 'single' && (
              <div className="flex items-center gap-1">
                <IconButton aria-label="Previous page" disabled={safeIndex === 0} onClick={() => setIndex(safeIndex - 1)}><NavigateBeforeIcon /></IconButton>
                <TextField select size="small" value={safeIndex} onChange={(e) => setIndex(Number(e.target.value))} sx={{ minWidth: 220 }} aria-label="Jump to page">
                  {pages.map((p, i) => <MenuItem key={p.id} value={i}>{i + 1}. {p.title}</MenuItem>)}
                </TextField>
                <IconButton aria-label="Next page" disabled={safeIndex >= pages.length - 1} onClick={() => setIndex(safeIndex + 1)}><NavigateNextIcon /></IconButton>
              </div>
            )}
            {view !== 'all' && (
              <div className="flex items-center gap-2" style={{ minWidth: 230 }}>
                <Button size="small" variant={zoomMode === 'fit' ? 'contained' : 'outlined'} onClick={() => setZoomMode('fit')}>Fit</Button>
                <Slider size="small" min={0.25} max={2} step={0.05} value={zoom} onChange={(_, v) => setZoomMode(v as number)} aria-label="Zoom" sx={{ width: 130 }} />
                <Typography variant="body2" width={44}>{Math.round(zoom * 100)}%</Typography>
              </div>
            )}
            <Tooltip title="Shows margins and the spiral-binding zone (not printed)">
              <FormControlLabel control={<Switch size="small" checked={guides} onChange={(e) => setGuides(e.target.checked)} />} label="Print guides" />
            </Tooltip>
          </Box>

          <Box ref={area} sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 3, overflow: 'auto', maxHeight: 'calc(100vh - 230px)' }}>
            {view === 'single' && current && <div className="flex justify-center">{render(current, safeIndex + 1, zoom)}</div>}
            {view === 'sheets' && (
              <div className="flex flex-col gap-8">
                {Array.from({ length: Math.ceil(pages.length / 2) }, (_, s) => (
                  <div key={s}>
                    <Typography variant="caption" color="text.secondary">Sheet {s + 1} – front (page {s * 2 + 1}){pages[s * 2 + 1] ? ` / back (page ${s * 2 + 2})` : ''}</Typography>
                    <div className="mt-1 flex justify-center gap-6">
                      {pages.slice(s * 2, s * 2 + 2).map((p, k) => render(p, s * 2 + k + 1, zoom))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {view === 'all' && (
              <div className="flex flex-wrap justify-center gap-6">
                {pages.map((p, i) => (
                  <button key={p.id} type="button" onClick={() => { setIndex(i); setView('single'); }} style={{ all: 'unset', cursor: 'pointer' }} aria-label={`Open page ${i + 1}: ${p.title}`}>
                    {render(p, i + 1, zoom)}
                    <Typography variant="caption" display="block" textAlign="center" mt={0.5}>{i + 1}. {p.title}</Typography>
                  </button>
                ))}
              </div>
            )}
          </Box>
        </>
      )}
    </>
  );
}
