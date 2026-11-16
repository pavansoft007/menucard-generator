import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Skeleton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { designTemplates, resolvePageSize, templateFamilies, type ApplyDesignResult, type DesignTemplate, type PageDTO, type TemplateMood } from '@gc/shared-types';
import { api, json } from '../../services/api';
import { useUiStore } from '../../store/uiStore';
import { PageRenderer } from '../../renderer/PageRenderer';
import { ScaledPage } from '../../renderer/ScaledPage';
import { MM_PX } from '../../renderer/tokens';
import type { MenuData } from '../../renderer/menuData';
import { buildDesignPlan, previewData, samplePage, toApplyRequest, type CardMode } from './designPlan';

/** Renders one page of the menu in a template's style (in memory – nothing is saved). */
const TemplatePage = memo(function TemplatePage({ template, data, page, widthPx, cardMode = 'photos' }: { template: DesignTemplate; data: MenuData; page: PageDTO; widthPx: number; cardMode?: CardMode }) {
  const preview = useMemo(() => previewData(template, data, { pageIds: [page.id], cardMode }), [template, data, page.id, cardMode]);
  const target = preview.pages.find((p) => p.id === page.id)!;
  const active = preview.pages.filter((p) => p.isActive);
  const number = Math.max(1, active.findIndex((p) => p.id === page.id) + 1);
  const { widthMm, heightMm } = resolvePageSize(target.settings);
  return (
    <ScaledPage widthMm={widthMm} heightMm={heightMm} zoom={widthPx / (widthMm * MM_PX)} shadow={false}>
      <PageRenderer page={target} pageNumber={number} totalPages={active.length} data={preview} mode="gallery" />
    </ScaledPage>
  );
});

/** Mounts the (heavy) page preview only once the card scrolls into view. */
function LazyPage(props: Parameters<typeof TemplatePage>[0]) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setSeen(true), { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  const { widthMm, heightMm } = resolvePageSize(props.page.settings);
  return (
    <div ref={ref} style={{ width: props.widthPx, height: props.widthPx * (heightMm / widthMm), background: props.template.theme.colors.background, overflow: 'hidden', borderRadius: 6 }}>
      {seen ? <TemplatePage {...props} /> : <Skeleton variant="rectangular" width="100%" height="100%" />}
    </div>
  );
}

const MOODS: { value: '' | TemplateMood; label: string }[] = [{ value: '', label: 'All moods' }, { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'vivid', label: 'Vivid' }];

function ApplyDialog({ template, data, initialPageId, onClose, onApplied }: { template: DesignTemplate; data: MenuData; initialPageId?: number; onClose: () => void; onApplied: () => void }) {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const pages = data.pages;
  const [scope, setScope] = useState<'all' | 'some'>(initialPageId ? 'some' : 'all');
  const [chosen, setChosen] = useState<number[]>(initialPageId ? [initialPageId] : pages.map((p) => p.id));
  const [cardMode, setCardMode] = useState<CardMode>('auto');
  const [resetLayouts, setResetLayouts] = useState(true);
  const [backup, setBackup] = useState(true);
  const [makeDefault, setMakeDefault] = useState(true);
  const pageIds = scope === 'all' ? pages.map((p) => p.id) : chosen;
  const plan = useMemo(() => buildDesignPlan(template, data, { pageIds, cardMode }), [template, data, pageIds, cardMode]);

  const apply = useMutation({
    mutationFn: () => api<ApplyDesignResult>('/design/apply', json('POST', toApplyRequest(template, plan, { makeDefaultTheme: makeDefault && scope === 'all', resetLayouts, backup }))),
    onSuccess: (r) => {
      qc.invalidateQueries();
      notify(`“${template.name}” applied to ${r.pagesUpdated} page${r.pagesUpdated === 1 ? '' : 's'}${r.backupVersionId ? ' – a backup version was saved' : ''}`);
      onApplied();
    },
    onError: (e) => notify(e.message, 'error'),
  });

  return (
    <Dialog open onClose={apply.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Apply “{template.name}”</DialogTitle>
      <DialogContent dividers className="flex flex-col gap-3">
        <Alert severity="info">Only the <b>look</b> changes: theme, backgrounds, frames, headers and card styles. Your categories, items, prices and photos are never touched.</Alert>

        <Typography fontWeight={700}>Where</Typography>
        <RadioGroup value={scope} onChange={(e) => setScope(e.target.value as 'all' | 'some')}>
          <FormControlLabel value="all" control={<Radio size="small" />} label={`The whole menu (${pages.length} pages)`} />
          <FormControlLabel value="some" control={<Radio size="small" />} label="Only some pages" />
        </RadioGroup>
        {scope === 'some' && (
          <div className="flex flex-col pl-3">
            {pages.map((p) => (
              <FormControlLabel key={p.id} control={<Checkbox size="small" checked={chosen.includes(p.id)} onChange={(e) => setChosen((c) => (e.target.checked ? [...c, p.id] : c.filter((x) => x !== p.id)))} />} label={p.title} />
            ))}
          </div>
        )}

        <TextField select size="small" label="Item cards" value={cardMode} onChange={(e) => setCardMode(e.target.value as CardMode)} helperText={cardMode === 'auto' ? 'Photo cards for sections whose items have photos, text lists for the rest' : cardMode === 'photos' ? 'Photo-style cards everywhere – best once you have added photos' : 'Compact text lists everywhere'}>
          <MenuItem value="auto">Automatic (recommended)</MenuItem>
          <MenuItem value="photos">Always photo cards</MenuItem>
          <MenuItem value="lists">Always text lists</MenuItem>
        </TextField>

        <FormControlLabel control={<Checkbox size="small" checked={resetLayouts} onChange={(e) => setResetLayouts(e.target.checked)} />} label="Re-arrange the selected pages automatically in the new style (recommended)" />
        {!resetLayouts && <Alert severity="warning">Pages you arranged by hand keep their element positions and sizes; some content may not fit the new card styles.</Alert>}
        <FormControlLabel control={<Checkbox size="small" checked={backup} onChange={(e) => setBackup(e.target.checked)} />} label="Save a backup version first, so I can undo this (recommended)" />
        {scope === 'all' && <FormControlLabel control={<Checkbox size="small" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />} label="Use this theme for new pages" />}

        <Typography variant="body2" color="text.secondary">
          Changes: <b>{plan.pages.length}</b> page{plan.pages.length === 1 ? '' : 's'}, <b>{plan.sections.length}</b> section{plan.sections.length === 1 ? '' : 's'} ({plan.photoSections} photo-style, {plan.listSections} list-style).
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={apply.isPending}>Cancel</Button>
        <Button variant="contained" disabled={apply.isPending || plan.pages.length === 0} onClick={() => apply.mutate()}>{apply.isPending ? 'Applying…' : 'Apply design'}</Button>
      </DialogActions>
    </Dialog>
  );
}

function PreviewDialog({ template, data, initialPage, onClose, onApply }: { template: DesignTemplate; data: MenuData; initialPage: PageDTO; onClose: () => void; onApply: (pageId: number) => void }) {
  const active = data.pages.filter((p) => p.isActive);
  const [pageId, setPageId] = useState(initialPage.id);
  const [cardMode, setCardMode] = useState<CardMode>('photos');
  const page = active.find((p) => p.id === pageId) ?? initialPage;
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle className="flex flex-wrap items-center gap-2">
        <span style={{ flex: 1 }}>{template.name}</span>
        <TextField select size="small" value={page.id} onChange={(e) => setPageId(Number(e.target.value))} sx={{ minWidth: 220 }} aria-label="Preview page">
          {active.map((p, i) => <MenuItem key={p.id} value={p.id}>{i + 1}. {p.title}</MenuItem>)}
        </TextField>
        <ToggleButtonGroup size="small" exclusive value={cardMode} onChange={(_, v: CardMode | null) => v && setCardMode(v)} aria-label="Card style">
          <ToggleButton value="photos" sx={{ textTransform: 'none' }}>With photos</ToggleButton>
          <ToggleButton value="lists" sx={{ textTransform: 'none' }}>Text only</ToggleButton>
        </ToggleButtonGroup>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', justifyContent: 'center', bgcolor: 'action.hover' }}>
        <Box sx={{ boxShadow: 6 }}><TemplatePage template={template} data={data} page={page} widthPx={500} cardMode={cardMode} /></Box>
      </DialogContent>
      <DialogActions>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1, pl: 1 }}>{template.description} Empty photo slots show artwork here; they print nothing until you add photos.</Typography>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={() => onApply(page.id)}>Use this design…</Button>
      </DialogActions>
    </Dialog>
  );
}

/** The 24 built-in page designs, previewed with your own menu. */
export default function PageDesigns({ data }: { data: MenuData }) {
  const [family, setFamily] = useState('');
  const [mood, setMood] = useState<'' | TemplateMood>('');
  const [previewing, setPreviewing] = useState<DesignTemplate | null>(null);
  const [applying, setApplying] = useState<{ t: DesignTemplate; pageId?: number } | null>(null);
  const [done, setDone] = useState(false);
  const sample = samplePage(data);
  const list = useMemo(() => designTemplates.filter((t) => (!family || t.family === family) && (!mood || t.mood === mood)), [family, mood]);

  if (!sample) return <Alert severity="info">Create at least one page in the Page Builder to preview designs on your menu.</Alert>;
  return (
    <>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone(false)} action={<Button color="inherit" size="small" component={RouterLink} to="/preview">View the menu</Button>}>Design applied. Fine-tune any page in the visual editor, or restore the previous look from Page Builder → Versions.</Alert>}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip label={`All (${designTemplates.length})`} color={family === '' ? 'primary' : 'default'} onClick={() => setFamily('')} />
        {templateFamilies.map((f) => <Chip key={f.id} label={f.name} color={family === f.id ? 'primary' : 'default'} onClick={() => setFamily(f.id)} />)}
        <TextField select size="small" value={mood} onChange={(e) => setMood(e.target.value as '' | TemplateMood)} sx={{ ml: 'auto', minWidth: 140 }} aria-label="Mood">
          {MOODS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
        </TextField>
      </div>
      {family && <Typography color="text.secondary" mb={2}>{templateFamilies.find((f) => f.id === family)?.description}</Typography>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((t) => (
          <Card key={t.id} variant="outlined" className="flex flex-col gap-2 p-2" data-template-id={t.id}>
            <Box role="button" tabIndex={0} aria-label={`Preview ${t.name}`} onClick={() => setPreviewing(t)} onKeyDown={(e) => e.key === 'Enter' && setPreviewing(t)} sx={{ cursor: 'zoom-in', lineHeight: 0 }}>
              <LazyPage template={t} data={data} page={sample} widthPx={216} />
            </Box>
            <div className="flex items-center gap-1">
              <div style={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={700} variant="body2" noWrap title={t.name}>{t.name.split(' · ')[1]}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap display="block">{t.familyName} · {t.mood}</Typography>
              </div>
              <div className="flex gap-0.5">{t.swatch.slice(1).map((c, i) => <span key={i} title={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c, border: '1px solid rgba(128,128,128,.5)' }} />)}</div>
            </div>
            <div className="flex gap-1">
              <Button size="small" fullWidth onClick={() => setPreviewing(t)}>Preview</Button>
              <Button size="small" fullWidth variant="contained" onClick={() => setApplying({ t })}>Apply</Button>
            </div>
          </Card>
        ))}
      </div>
      {list.length === 0 && <Typography color="text.secondary" textAlign="center" py={6}>No designs match these filters.</Typography>}

      {previewing && <PreviewDialog template={previewing} data={data} initialPage={sample} onClose={() => setPreviewing(null)} onApply={(pageId) => { setApplying({ t: previewing, pageId }); setPreviewing(null); }} />}
      {applying && <ApplyDialog template={applying.t} data={data} initialPageId={applying.pageId} onClose={() => setApplying(null)} onApplied={() => { setApplying(null); setDone(true); }} />}
    </>
  );
}
