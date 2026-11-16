import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Chip, CircularProgress, Divider, IconButton, Slider, Switch, Tooltip, Typography, FormControlLabel } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { defaultSectionConfig, resolvePageSize, type CardTemplate, type LayoutElement } from '@gc/shared-types';
import { useMenuData, type MenuData } from '../renderer/menuData';
import { estimateSectionHeight, generateLayout } from '../renderer/generate';
import { safeArea } from '../renderer/geometry';
import { ConfirmDialog, ErrorAlert, ListSkeleton } from '../components/common';
import SectionDialog from '../features/sections/SectionDialog';
import { keys, sectionService } from '../services/menuService';
import { sectionToInput } from '../services/sectionInput';
import { useUiStore } from '../store/uiStore';
import { Canvas, type DropPayload } from './Canvas';
import { DESIGN_PRESETS, makeHeading, makeImage, makeItemCard, makeLogo, makeSection, makeShape, makeText } from './elements';
import { boundsOf, rectOf, round1 } from './geometry';
import { layoutIssues } from './issues';
import { LeftPanel } from './LeftPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { useEditor } from './store';
import { clearDraft, readDraft, useAutosave, type Draft } from './useAutosave';

const STATUS: Record<string, { label: string; color: 'success' | 'warning' | 'default' | 'error' }> = {
  saved: { label: 'All changes saved', color: 'success' },
  dirty: { label: 'Unsaved changes…', color: 'warning' },
  saving: { label: 'Saving…', color: 'default' },
  error: { label: 'Save failed – retrying', color: 'error' },
};

export default function EditorPage() {
  const { pageId: param } = useParams();
  const id = Number(param);
  const nav = useNavigate();
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const { data, isLoading, error, refetch } = useMenuData();
  const { flush } = useAutosave();
  const store = useEditor();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState<null | 'generate' | 'clear'>(null);
  const [editSection, setEditSection] = useState<number | null>(null);

  const page = data.pages.find((p) => p.id === id);
  const active = data.pages.filter((p) => p.isActive);
  const pageNumber = Math.max(1, (active.findIndex((p) => p.id === id) + 1) || data.pages.findIndex((p) => p.id === id) + 1);
  const totalPages = Math.max(1, active.length);
  const loaded = store.pageId === id;

  // Load the page into the editor (saving the previous page first). An untouched page gets its starting layout.
  useEffect(() => {
    if (!page || isLoading || store.pageId === id) return;
    let cancelled = false;
    (async () => {
      await flush();
      if (cancelled) return;
      const fresh = !page.layout.elements.length && !page.layout.blank;
      const elements = fresh ? generateLayout(page, page.sections ?? [], data, pageNumber) : page.layout.elements;
      useEditor.getState().load(page, elements);
      if (fresh && elements.length) useEditor.setState({ rev: 1, status: 'dirty' }); // persist the generated layout
      const d = readDraft(id);
      setDraft(d && d.savedAt > Date.parse(page.updatedAt) && JSON.stringify(d.elements) !== JSON.stringify(elements) ? d : null);
    })();
    return () => { cancelled = true; };
  }, [page, isLoading, id, store.pageId, data, pageNumber, flush]);

  const size = loaded ? resolvePageSize(store.settings) : { widthMm: 210, heightMm: 297 };
  const issues = useMemo(() => (loaded ? layoutIssues(store.elements, store.settings, pageNumber, store.measured) : []), [loaded, store.elements, store.settings, pageNumber, store.measured]);
  const issueIds = useMemo(() => new Set(issues.flatMap((i) => i.elementIds)), [issues]);

  /* ---------------------------------------------------------------- adding */
  const centre = (els: LayoutElement[], x?: number, y?: number): LayoutElement[] => {
    const b = boundsOf(els.map(rectOf));
    const dx = (x ?? size.widthMm / 2) - (b.x + b.w / 2);
    const dy = (y ?? size.heightMm / 2) - (b.y + b.h / 2);
    return els.map((e) => ({ ...e, x: round1(e.x + dx), y: round1(e.y + dy) }));
  };
  const nextFreeY = () => {
    const cur = useEditor.getState().elements.filter((e) => e.type === 'section');
    const area = safeArea(useEditor.getState().settings, pageNumber);
    return cur.length ? round1(Math.max(...cur.map((e) => e.y + Math.max(e.h, useEditor.getState().measured[e.id] ?? 0))) + 4) : round1(area.top + 20);
  };

  const addSectionElement = useCallback((sectionId: number, dto: MenuData['sections'][number] | undefined, d: MenuData, x?: number, y?: number) => {
    const st = useEditor.getState();
    const area = safeArea(st.settings, pageNumber);
    const w = round1(area.width * ((dto?.config.widthPct ?? 100) / 100));
    const h = dto ? (dto.config.heightMm ?? estimateSectionHeight(dto, d, w)) : 80;
    const el = makeSection(sectionId, { x: round1(area.left + (area.width - w) / 2), y: y !== undefined ? round1(y) : nextFreeY(), w, h, name: dto?.title ?? null });
    st.addElements([x !== undefined ? { ...el, x: round1(x - w / 2) } : el]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber]);

  const createSection = async (title: string, over: { categoryIds?: number[]; comboIds?: number[]; template?: CardTemplate }, x?: number, y?: number) => {
    try {
      const created = await sectionService.create({
        pageId: id, title, subtitle: null, description: null, imageMediaId: null, backgroundId: null,
        categoryIds: over.categoryIds ?? [], itemIds: [], comboIds: over.comboIds ?? [],
        config: { ...defaultSectionConfig, cardTemplate: over.template ?? defaultSectionConfig.cardTemplate },
      });
      await qc.refetchQueries({ queryKey: keys.pages });
      const fresh = qc.getQueryData<MenuData['pages']>([...keys.pages, 'withSections']);
      const dto = fresh?.flatMap((p) => p.sections ?? []).find((s) => s.id === created.id) ?? created;
      addSectionElement(created.id, dto, { ...data, sections: [...data.sections, dto] }, x, y);
      notify(`Section “${title}” added to this page`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not create the section', 'error');
    }
  };

  const onAdd = (p: DropPayload & { aspect?: number }, x?: number, y?: number) => {
    const st = useEditor.getState();
    const nid = typeof p.id === 'number' ? p.id : 0;
    switch (p.kind) {
      case 'element': {
        const made = { text: () => makeText(), heading: () => makeHeading(), image: () => makeImage(null), rect: () => makeShape('rect'), ellipse: () => makeShape('ellipse'), line: () => makeShape('line') }[String(p.id) as 'text'];
        if (made) st.addElements(centre([made()], x, y));
        break;
      }
      case 'preset': {
        const preset = DESIGN_PRESETS.find((d) => d.id === p.id);
        if (preset) st.addElements(centre(preset.make(), x, y));
        break;
      }
      case 'media': {
        const w = 60;
        st.addElements(centre([makeImage(nid, { w, h: round1(Math.min(120, w / (p.aspect ?? 1))) })], x, y));
        break;
      }
      case 'logo': {
        const w = 60;
        st.addElements(centre([makeLogo(nid, { w, h: round1(Math.min(60, w / (p.aspect ?? 2))) })], x, y));
        break;
      }
      case 'item': st.addElements(centre([makeItemCard(nid)], x, y)); break;
      case 'section': addSectionElement(nid, data.sections.find((s) => s.id === nid), data, x, y); break;
      case 'category': { const c = data.categories.find((k) => k.id === nid); if (c) void createSection(c.name, { categoryIds: [c.id] }, x, y); break; }
      case 'combo': { const c = data.combos.find((k) => k.id === nid); if (c) void createSection(c.name, { comboIds: [c.id], template: 'combo' }, x, y); break; }
    }
  };

  const applyTemplate = async (t: CardTemplate) => {
    const st = useEditor.getState();
    const sel = st.elements.filter((e) => st.selection.includes(e.id));
    const targets = sel.filter((e) => e.type === 'section' || e.type === 'itemCard');
    if (!targets.length) return notify('Select a section or an item card on the page first', 'info');
    try {
      for (const el of targets) {
        if (el.type === 'itemCard') st.patch([el.id], { template: t === 'combo' ? 'premium' : t });
        else {
          const sec = data.sections.find((s) => s.id === el.sectionId);
          if (sec) await sectionService.update(sec.id, sectionToInput(sec, { config: { ...sec.config, cardTemplate: t } }));
        }
      }
      await qc.invalidateQueries({ queryKey: keys.pages });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not apply the template', 'error');
    }
  };

  /* --------------------------------------------------------- layout tools */
  const generate = () => {
    if (!page) return;
    const sections = data.sections.filter((s) => s.pageId === id).sort((a, b) => a.displayOrder - b.displayOrder);
    const st = useEditor.getState();
    st.replaceElements(generateLayout({ title: st.meta.title, subtitle: st.meta.subtitle, pageType: st.meta.pageType, settings: st.settings }, sections, data, pageNumber));
    st.select([]);
  };
  const stack = () => {
    const st = useEditor.getState();
    const secs = st.elements.filter((e) => e.type === 'section').sort((a, b) => a.y - b.y || a.x - b.x);
    if (secs.length < 2) return notify('Nothing to stack – the page has fewer than two sections', 'info');
    let y = secs[0]!.y;
    const place = new Map<string, number>();
    for (const e of secs) {
      place.set(e.id, round1(y));
      y += Math.max(e.h, st.measured[e.id] ?? 0) + 4;
    }
    st.patch(secs.map((e) => e.id), (e) => ({ y: place.get(e.id)!, h: Math.max(e.h, st.measured[e.id] ?? 0) }));
  };

  /* -------------------------------------------------------------- keyboard */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="listbox"]')) return;
      const st = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) st.redo(); else st.undo(); }
      else if (mod && key === 'y') { e.preventDefault(); st.redo(); }
      else if (mod && key === 's') { e.preventDefault(); void flush().then(() => notify('Saved')); }
      else if (mod && key === 'd') { e.preventDefault(); st.duplicate(st.selection); }
      else if (mod && key === 'a') { e.preventDefault(); st.select(st.elements.map((x) => x.id)); }
      else if (mod && key === '0') { e.preventDefault(); st.setFit(true); }
      else if (mod && (key === '=' || key === '+')) { e.preventDefault(); st.setZoom(st.zoom * 1.15); }
      else if (mod && key === '-') { e.preventDefault(); st.setZoom(st.zoom / 1.15); }
      else if ((key === 'delete' || key === 'backspace') && st.selection.length) { e.preventDefault(); st.remove(st.selection); }
      else if (key === 'escape') st.select([]);
      else if (key.startsWith('arrow') && st.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 0.5;
        const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
        const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
        st.patch(st.selection.filter((sid) => !st.elements.find((x) => x.id === sid)?.locked), (el) => ({ x: round1(el.x + dx), y: round1(el.y + dy) }), 'nudge');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flush, notify]);

  const restoreDraft = () => {
    if (!draft || !page) return;
    const st = useEditor.getState();
    st.load(page, draft.elements);
    useEditor.setState({ settings: draft.settings, themeId: draft.themeId, rev: 1, status: 'dirty' });
    setDraft(null);
  };
  const discardDraft = () => { clearDraft(id); setDraft(null); };

  const idx = data.pages.findIndex((p) => p.id === id);
  const goto = (p?: { id: number }) => p && nav(`/editor/${p.id}`);
  const status = STATUS[store.status]!;

  if (error) return <Box p={3}><ErrorAlert error={error} onRetry={() => refetch()} /></Box>;
  if (!isLoading && !page) return <Box p={3}><Alert severity="warning" action={<Button component={RouterLink} to="/pages">Back to pages</Button>}>That page doesn’t exist (it may have been deleted).</Alert></Box>;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Box component="header" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, height: 52, flexShrink: 0, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', overflowX: 'auto' }}>
        <Tooltip title="Back to Page Builder"><IconButton component={RouterLink} to="/pages" aria-label="Back to Page Builder"><ArrowBackIcon /></IconButton></Tooltip>
        <Typography fontWeight={800} sx={{ color: 'primary.main', whiteSpace: 'nowrap' }}>Design</Typography>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <IconButton size="small" disabled={idx <= 0} onClick={() => goto(data.pages[idx - 1])} aria-label="Previous page"><NavigateBeforeIcon /></IconButton>
        <Typography noWrap sx={{ maxWidth: 220, minWidth: 90 }} title={store.meta.title}>{loaded ? store.meta.title : '…'}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{idx + 1}/{data.pages.length}</Typography>
        <IconButton size="small" disabled={idx < 0 || idx >= data.pages.length - 1} onClick={() => goto(data.pages[idx + 1])} aria-label="Next page"><NavigateNextIcon /></IconButton>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Tooltip title="Undo (Ctrl+Z)"><span><IconButton disabled={!store.past.length} onClick={store.undo} aria-label="Undo"><UndoIcon /></IconButton></span></Tooltip>
        <Tooltip title="Redo (Ctrl+Shift+Z)"><span><IconButton disabled={!store.future.length} onClick={store.redo} aria-label="Redo"><RedoIcon /></IconButton></span></Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <IconButton size="small" onClick={() => store.setZoom(store.zoom / 1.15)} aria-label="Zoom out"><ZoomOutIcon /></IconButton>
        <Slider size="small" min={0.2} max={3} step={0.05} value={store.zoom} onChange={(_, v) => store.setZoom(v as number)} sx={{ width: 100 }} aria-label="Zoom" />
        <IconButton size="small" onClick={() => store.setZoom(store.zoom * 1.15)} aria-label="Zoom in"><ZoomInIcon /></IconButton>
        <Button size="small" variant={store.fit ? 'contained' : 'outlined'} onClick={() => store.setFit(true)} sx={{ minWidth: 0 }}>Fit</Button>
        <Typography variant="body2" width={44}>{Math.round(store.zoom * 100)}%</Typography>
        <FormControlLabel sx={{ m: 0, whiteSpace: 'nowrap' }} control={<Switch size="small" checked={store.snap} onChange={() => store.toggle('snap')} />} label={<Typography variant="body2">Snap</Typography>} />
        <FormControlLabel sx={{ m: 0, whiteSpace: 'nowrap' }} control={<Switch size="small" checked={store.guides} onChange={() => store.toggle('guides')} />} label={<Typography variant="body2">Guides</Typography>} />
        <Box sx={{ flex: 1 }} />
        <Tooltip title={store.saveError ?? ''}><Chip size="small" color={status.color} label={status.label} icon={store.status === 'saving' ? <CircularProgress size={12} /> : undefined} /></Tooltip>
        <Button size="small" startIcon={<SaveIcon />} onClick={() => void flush().then(() => notify('Saved'))} disabled={store.status === 'saved'}>Save</Button>
        <Button size="small" variant="outlined" startIcon={<VisibilityIcon />} component="a" href="/preview" target="_blank" rel="noopener">Preview</Button>
      </Box>

      {draft && (
        <Alert severity="info" sx={{ borderRadius: 0 }} action={<><Button color="inherit" size="small" onClick={restoreDraft}>Restore</Button><Button color="inherit" size="small" onClick={discardDraft}>Discard</Button></>}>
          Unsaved changes from an earlier session were recovered on this device.
        </Alert>
      )}

      {isLoading || !loaded || !page ? (
        <Box p={3}><ListSkeleton rows={4} height={90} /></Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <LeftPanel data={data} pageId={id} onAdd={(p) => onAdd(p)} onApplyTemplate={(t) => void applyTemplate(t)} />
          <Canvas data={data} pageId={id} pageNumber={pageNumber} totalPages={totalPages} issueIds={issueIds} onDropPayload={(p, x, y) => onAdd(p, x, y)} />
          <PropertiesPanel data={data} pageNumber={pageNumber} issues={issues} onGenerate={() => (store.elements.length ? setConfirm('generate') : generate())} onStack={stack} onClear={() => setConfirm('clear')} onEditSection={setEditSection} />
        </Box>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'clear' ? 'Clear this page?' : 'Replace the layout?'}
        confirmLabel={confirm === 'clear' ? 'Clear page' : 'Generate'}
        message={confirm === 'clear' ? 'Every element on this page will be removed. You can undo this with Ctrl+Z.' : 'Your current arrangement is replaced by an automatic one built from this page’s sections. You can undo this with Ctrl+Z.'}
        onClose={() => setConfirm(null)}
        onConfirm={() => { if (confirm === 'clear') { useEditor.getState().replaceElements([]); useEditor.getState().select([]); } else generate(); setConfirm(null); }}
      />
      {editSection !== null && data.sections.find((s) => s.id === editSection) && (
        <SectionDialog key={editSection} section={data.sections.find((s) => s.id === editSection)!} defaultPageId={id} pages={data.pages} categories={data.categories} items={data.items} combos={data.combos} onClose={() => setEditSection(null)} />
      )}
    </Box>
  );
}
