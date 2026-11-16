import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, FormControlLabel, IconButton, MenuItem, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import { defaultExportOptions, exportOptionsSchema, paperSizes, parsePageRange, resolvePageSize, sheetLayout, type ExportDTO, type ExportOptions } from '@gc/shared-types';
import { api, json } from '../../services/api';
import { adminKeys, settingsService } from '../../services/adminService';
import { keys, pageService } from '../../services/menuService';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { ConfirmDialog, ErrorAlert, formatBytes, ListSkeleton, PageHeader } from '../../components/common';

const exportKeys = { list: ['exports'] as const, status: ['exports', 'status'] as const };
const mm = (n: number) => `${Math.round(n * 10) / 10}`;

async function downloadExport(e: ExportDTO) {
  const res = await fetch(e.downloadUrl, { headers: { Authorization: `Bearer ${useAuthStore.getState().token}` } });
  if (!res.ok) throw new Error('The file could not be downloaded');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = e.filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function ExportPage() {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const [o, setO] = useState<ExportOptions>(defaultExportOptions);
  const [rangeMode, setRangeMode] = useState<'all' | 'custom'>('all');
  const [result, setResult] = useState<ExportDTO | null>(null);
  const [deleting, setDeleting] = useState<ExportDTO | null>(null);
  const set = <K extends keyof ExportOptions>(k: K, v: ExportOptions[K]) => setO((p) => ({ ...p, [k]: v }));

  // Start from the saved export defaults (set by an administrator under Application Settings).
  const defaults = useQuery({ queryKey: adminKeys.settings, queryFn: settingsService.get });
  useEffect(() => { if (defaults.data) setO({ ...defaults.data.exportDefaults, pages: 'all' }); }, [defaults.data]);

  const pages = useQuery({ queryKey: [...keys.pages, 'list'], queryFn: () => pageService.list(false) });
  const history = useQuery({ queryKey: exportKeys.list, queryFn: () => api<ExportDTO[]>('/export') });
  const status = useQuery({ queryKey: exportKeys.status, queryFn: () => api<{ chromeFound: boolean; chromePath: string | null; renderBaseUrl: string; renderReachable: boolean }>('/export/status'), refetchInterval: 15_000 });

  const active = useMemo(() => (pages.data ?? []).filter((p) => p.isActive), [pages.data]);
  const validation = exportOptionsSchema.safeParse(o);
  const selected = useMemo(() => {
    const wanted = parsePageRange(rangeMode === 'all' ? 'all' : o.pages, active.length);
    return wanted ? active.map((p, i) => ({ p, n: i + 1 })).filter(({ n }) => wanted.includes(n) && (o.sides === 'all' || (o.sides === 'front' ? n % 2 === 1 : n % 2 === 0))) : [];
  }, [active, o.pages, o.sides, rangeMode]);

  const run = useMutation({
    mutationFn: ({ kind, mode }: { kind: 'pdf' | 'image'; mode?: ExportOptions['mode'] }) => api<ExportDTO>(`/export/${kind}`, json('POST', { ...o, pages: rangeMode === 'all' ? 'all' : o.pages, mode: mode ?? o.mode })),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: exportKeys.list });
      qc.invalidateQueries({ queryKey: keys.stats });
      const errs = r.warnings.filter((w) => w.level === 'error').length;
      notify(errs ? `Exported with ${errs} problem${errs > 1 ? 's' : ''} – review them below` : 'Export ready', errs ? 'warning' : 'success');
    },
    onError: (e) => notify(e.message, 'error'),
  });
  const remove = useMutation({
    mutationFn: (e: ExportDTO) => api(`/export/${e.id}`, json('DELETE')),
    onSuccess: (_d, e) => { qc.invalidateQueries({ queryKey: exportKeys.list }); if (result?.id === e.id) setResult(null); setDeleting(null); },
    onError: (e) => notify(e.message, 'error'),
  });
  const download = useMutation({ mutationFn: downloadExport, onError: (e) => notify(e.message, 'error') });

  const notReady = status.data && (!status.data.chromeFound || !status.data.renderReachable);
  const disabled = run.isPending || !validation.success || selected.length === 0 || !!notReady;
  const sample = selected[0] ? resolvePageSize(selected[0].p.settings) : null;
  const sheet = sample ? sheetLayout({ w: sample.widthMm, h: sample.heightMm }, o) : null;
  const px = sheet ? { w: Math.round((sheet.sheetW / 25.4) * o.dpi), h: Math.round((sheet.sheetH / 25.4) * o.dpi) } : null;

  return (
    <>
      <PageHeader title="PDF & Image Export" subtitle="Print-ready output at exact page size. Rendered by the same engine as the editor, so it matches what you designed." />

      {status.data && !status.data.chromeFound && <Alert severity="error" sx={{ mb: 2 }}>No Chrome/Chromium was found on the server. Install Chrome, or set <code>CHROME_PATH</code> in <code>.env</code>, then restart the API.</Alert>}
      {status.data && status.data.chromeFound && !status.data.renderReachable && <Alert severity="warning" sx={{ mb: 2 }}>The exporter can’t reach the web app at <code>{status.data.renderBaseUrl}</code>. Start the web app (or set <code>RENDER_BASE_URL</code>).</Alert>}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card variant="outlined">
          <CardContent className="flex flex-col gap-4">
            <Typography fontWeight={700}>Pages</Typography>
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField select size="small" label="Which pages" value={rangeMode} onChange={(e) => setRangeMode(e.target.value as 'all' | 'custom')}>
                <MenuItem value="all">All pages ({active.length})</MenuItem>
                <MenuItem value="custom">Page range…</MenuItem>
              </TextField>
              <TextField size="small" label="Range" placeholder="e.g. 1-3, 5" disabled={rangeMode === 'all'} value={rangeMode === 'all' ? '' : o.pages === 'all' ? '' : o.pages} onChange={(e) => set('pages', e.target.value)} error={rangeMode === 'custom' && !selected.length} helperText={rangeMode === 'custom' && !selected.length ? 'No pages match' : undefined} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField select size="small" label="Sides (double-sided)" value={o.sides} onChange={(e) => set('sides', e.target.value as ExportOptions['sides'])}>
                <MenuItem value="all">Front &amp; back (all)</MenuItem>
                <MenuItem value="front">Fronts only (odd pages)</MenuItem>
                <MenuItem value="back">Backs only (even pages)</MenuItem>
              </TextField>
            </div>

            <Typography fontWeight={700}>Paper</Typography>
            <div className="grid gap-3 sm:grid-cols-4">
              <TextField select size="small" label="Paper size" value={o.paper} onChange={(e) => set('paper', e.target.value as ExportOptions['paper'])} helperText={o.paper === 'native' ? "Each page's own size" : 'Pages are scaled to fit'}>
                {paperSizes.map((p) => <MenuItem key={p} value={p}>{p === 'native' ? 'Page size (as designed)' : p}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Orientation" value={o.orientation} onChange={(e) => set('orientation', e.target.value as ExportOptions['orientation'])}>
                <MenuItem value="native">As designed</MenuItem>
                <MenuItem value="portrait">Portrait</MenuItem>
                <MenuItem value="landscape">Landscape</MenuItem>
              </TextField>
              <TextField size="small" type="number" label="Bleed (mm)" value={o.bleedMm} onChange={(e) => set('bleedMm', Number(e.target.value))} error={o.bleedMm < 0 || o.bleedMm > 10} helperText="0–10, usually 3" slotProps={{ htmlInput: { min: 0, max: 10, step: 0.5 } }} />
              <TextField select size="small" label="Image quality" value={o.quality} onChange={(e) => set('quality', e.target.value as ExportOptions['quality'])} helperText={o.quality === 'max' ? 'Original uploads' : 'Optimized (smaller)'}>
                <MenuItem value="max">Maximum (originals)</MenuItem>
                <MenuItem value="standard">Standard (optimized)</MenuItem>
              </TextField>
            </div>

            <Typography fontWeight={700}>Content</Typography>
            <div className="flex flex-wrap gap-x-5">
              <FormControlLabel control={<Switch size="small" checked={o.includeFooter} onChange={(e) => set('includeFooter', e.target.checked)} />} label="Footer" />
              <FormControlLabel control={<Switch size="small" checked={o.includePageNumbers} onChange={(e) => set('includePageNumbers', e.target.checked)} />} label="Page numbers" />
              <Tooltip title="Adds a blank last page when the count is odd, so double-sided sheets line up"><FormControlLabel control={<Switch size="small" checked={o.padToEven} onChange={(e) => set('padToEven', e.target.checked)} />} label="Pad to an even page count" /></Tooltip>
            </div>
            <TextField size="small" type="number" label="Image resolution (DPI)" value={o.dpi} onChange={(e) => set('dpi', Number(e.target.value))} error={!Number.isInteger(o.dpi) || o.dpi < 72 || o.dpi > 600} helperText="PNG only · 300 = print quality · 72–600" sx={{ maxWidth: 260 }} slotProps={{ htmlInput: { min: 72, max: 600, step: 50 } }} />
            <Typography variant="caption" color="text.secondary">Spiral binding: keep content out of the binding zone shown in the editor’s guides – the export reports anything that intrudes. Bleed extends each page’s background colour; images and gradients are not stretched into the bleed.</Typography>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card variant="outlined">
            <CardContent className="flex flex-col gap-2">
              <Typography fontWeight={700}>Output</Typography>
              {pages.isLoading ? <ListSkeleton rows={2} height={30} /> : selected.length === 0 ? <Typography color="error" variant="body2">No pages selected.</Typography> : (
                <>
                  <Typography variant="body2"><b>{selected.length}</b> page{selected.length === 1 ? '' : 's'}: {selected.map((s) => s.n).join(', ')}{o.padToEven && selected.length % 2 === 1 ? ' + blank' : ''}</Typography>
                  {sheet && <Typography variant="body2" color="text.secondary">{mm(sheet.sheetW)} × {mm(sheet.sheetH)} mm{o.bleedMm > 0 ? ` (trim ${mm(sheet.trimW)} × ${mm(sheet.trimH)} + ${o.bleedMm} mm bleed)` : ''} · PNG {px?.w} × {px?.h} px at {o.dpi} DPI</Typography>}
                </>
              )}
              <Button variant="contained" size="large" startIcon={run.isPending && run.variables?.kind === 'pdf' && run.variables.mode !== 'separate' ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdfIcon />} disabled={disabled} onClick={() => run.mutate({ kind: 'pdf', mode: 'book' })}>Export PDF – complete menu</Button>
              <Button variant="outlined" startIcon={<FolderZipIcon />} disabled={disabled || selected.length < 2} onClick={() => run.mutate({ kind: 'pdf', mode: 'separate' })}>PDF – one file per page (zip)</Button>
              <Button variant="outlined" startIcon={run.isPending && run.variables?.kind === 'image' ? <CircularProgress size={18} /> : <ImageIcon />} disabled={disabled} onClick={() => run.mutate({ kind: 'image' })}>PNG image{selected.length > 1 ? 's (zip)' : ''}</Button>
              {run.isPending && <Typography variant="caption" color="text.secondary">Rendering… large menus or 600 DPI can take a minute.</Typography>}
              {!validation.success && <Typography variant="caption" color="error">{validation.error.issues[0]?.message}</Typography>}
            </CardContent>
          </Card>
        </div>
      </div>

      {result && (
        <Card variant="outlined" sx={{ mt: 3 }}>
          <CardContent className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Typography fontWeight={700} flex={1}>{result.filename}</Typography>
              <Chip size="small" label={`${result.pageCount} page${result.pageCount === 1 ? '' : 's'} · ${formatBytes(result.bytes)}`} />
              <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => download.mutate(result)} disabled={download.isPending}>Download</Button>
            </div>
            {result.warnings.length === 0 ? <Alert severity="success">No print problems found: nothing cropped, overlapping, or inside the binding zone.</Alert> : (
              <Alert severity={result.warnings.some((w) => w.level === 'error') ? 'error' : 'warning'}>
                <b>{result.warnings.length} thing{result.warnings.length === 1 ? '' : 's'} to check before printing:</b>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{result.warnings.map((w, i) => <li key={i}>Page {w.page}: {w.message}</li>)}</ul>
              </Alert>
            )}
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead><TableRow><TableCell>Page</TableCell><TableCell>Title</TableCell><TableCell>Size (mm)</TableCell>{result.kind === 'png' && <TableCell>Pixels</TableCell>}</TableRow></TableHead>
                <TableBody>{result.pages.map((p) => <TableRow key={p.page}><TableCell>{p.page}</TableCell><TableCell>{p.title}</TableCell><TableCell>{mm(p.widthMm)} × {mm(p.heightMm)}</TableCell>{result.kind === 'png' && <TableCell>{p.pxWidth} × {p.pxHeight}</TableCell>}</TableRow>)}</TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>
      )}

      <Typography fontWeight={700} mt={3} mb={1}>Previous exports</Typography>
      {history.isLoading ? <ListSkeleton rows={3} height={44} /> : history.isError ? <ErrorAlert error={history.error} onRetry={() => history.refetch()} /> : history.data!.length === 0 ? <Typography color="text.secondary" variant="body2">Nothing exported yet.</Typography> : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>File</TableCell><TableCell>Pages</TableCell><TableCell>Size</TableCell><TableCell>Created</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
            <TableBody>
              {history.data!.map((e) => (
                <TableRow key={e.id} hover>
                  <TableCell>{e.filename}{e.warnings.some((w) => w.level === 'error') && <Chip size="small" color="error" label="had problems" sx={{ ml: 1 }} />}</TableCell>
                  <TableCell>{e.pageCount}</TableCell>
                  <TableCell>{formatBytes(e.bytes)}</TableCell>
                  <TableCell>{new Date(e.createdAt).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Download"><IconButton aria-label={`Download ${e.filename}`} onClick={() => download.mutate(e)}><DownloadIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton aria-label={`Delete ${e.filename}`} onClick={() => setDeleting(e)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
      <ConfirmDialog open={!!deleting} title="Delete this export?" message={<>“{deleting?.filename}” will be removed from the server.</>} busy={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  );
}
