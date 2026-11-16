import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Chip, IconButton, InputAdornment, List, ListItemButton, ListItemText, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import WidgetsIcon from '@mui/icons-material/Widgets';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import LayersIcon from '@mui/icons-material/Layers';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import TitleIcon from '@mui/icons-material/Title';
import ImageIcon from '@mui/icons-material/Image';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { defaultPageSettings, emptyLayout, type CardTemplate, type MediaDTO } from '@gc/shared-types';
import { ItemCard, CARD_TEMPLATE_LABELS, ComboCard, type CardOptions } from '../renderer/cards';
import { themeFor, type MenuData } from '../renderer/menuData';
import { backgroundStyle } from '../renderer/styles';
import { MM_PX } from '../renderer/tokens';
import { Dropzone, checker } from '../components/common';
import { keys, mediaService, pageService } from '../services/menuService';
import { useUiStore } from '../store/uiStore';
import { DND_TYPE, type DropPayload } from './Canvas';
import { DESIGN_PRESETS } from './elements';
import { useEditor } from './store';

const drag = (payload: DropPayload & { aspect?: number }) => ({
  draggable: true,
  onDragStart: (e: React.DragEvent) => {
    e.dataTransfer.setData(DND_TYPE, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  },
});

type Payload = DropPayload & { aspect?: number };
const TABS = [
  { label: 'Pages', icon: <AutoStoriesIcon fontSize="small" /> },
  { label: 'Elements', icon: <WidgetsIcon fontSize="small" /> },
  { label: 'Content', icon: <RestaurantMenuIcon fontSize="small" /> },
  { label: 'Images', icon: <PhotoLibraryIcon fontSize="small" /> },
  { label: 'Backgrounds', icon: <WallpaperIcon fontSize="small" /> },
  { label: 'Templates', icon: <DashboardCustomizeIcon fontSize="small" /> },
  { label: 'Layers', icon: <LayersIcon fontSize="small" /> },
];

const Tile = ({ icon, label, onClick, ...rest }: { icon: ReactNode; label: string; onClick: () => void } & Record<string, unknown>) => (
  <Box role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()} {...rest} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1, textAlign: 'center', cursor: 'pointer', '&:hover, &:focus-visible': { borderColor: 'primary.main', bgcolor: 'action.hover' } }}>
    {icon}
    <Typography variant="caption" display="block" noWrap>{label}</Typography>
  </Box>
);

export function LeftPanel({ data, pageId, onAdd, onApplyTemplate }: { data: MenuData; pageId: number; onAdd: (p: Payload) => void; onApplyTemplate: (t: CardTemplate) => void }) {
  const [tab, setTab] = useState(1);
  return (
    <Box sx={{ display: 'flex', width: 330, flexShrink: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }} aria-label="Editor library">
      <Tabs orientation="vertical" value={tab} onChange={(_, v) => setTab(v)} sx={{ borderRight: 1, borderColor: 'divider', minWidth: 64, '& .MuiTab-root': { minWidth: 64, minHeight: 56, fontSize: 10, p: 0.5, textTransform: 'none' } }} aria-label="Library sections">
        {TABS.map((t) => <Tab key={t.label} icon={t.icon} label={t.label} />)}
      </Tabs>
      <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', p: 1.5 }}>
        {tab === 0 && <PagesTab data={data} pageId={pageId} />}
        {tab === 1 && <ElementsTab data={data} onAdd={onAdd} />}
        {tab === 2 && <ContentTab data={data} pageId={pageId} onAdd={onAdd} />}
        {tab === 3 && <ImagesTab onAdd={onAdd} />}
        {tab === 4 && <BackgroundsTab data={data} />}
        {tab === 5 && <TemplatesTab data={data} onApply={onApplyTemplate} />}
        {tab === 6 && <LayersTab />}
      </Box>
    </Box>
  );
}

/* ------------------------------------------------------------------- pages */
function PagesTab({ data, pageId }: { data: MenuData; pageId: number }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const create = useMutation({
    mutationFn: () => pageService.create({ title: `Page ${data.pages.length + 1}`, subtitle: null, pageType: 'content', themeId: null, isActive: true, settings: defaultPageSettings, layout: emptyLayout }),
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: keys.pages }); nav(`/editor/${p.id}`); },
    onError: (e) => notify(e.message, 'error'),
  });
  return (
    <>
      <Button fullWidth size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => create.mutate()} disabled={create.isPending}>New page</Button>
      <List dense sx={{ mt: 1 }}>
        {data.pages.map((p, i) => (
          <ListItemButton key={p.id} selected={p.id === pageId} onClick={() => p.id !== pageId && nav(`/editor/${p.id}`)} sx={{ borderRadius: 1 }}>
            <ListItemText primary={`${i + 1}. ${p.title}`} secondary={`${p.sectionCount} section${p.sectionCount === 1 ? '' : 's'}${p.isActive ? '' : ' · hidden'}`} slotProps={{ primary: { noWrap: true, fontSize: 13 } }} />
          </ListItemButton>
        ))}
      </List>
      <Typography variant="caption" color="text.secondary">Switching pages saves your changes first.</Typography>
    </>
  );
}

/* ---------------------------------------------------------------- elements */
function ElementsTab({ data, onAdd }: { data: MenuData; onAdd: (p: Payload) => void }) {
  const el = (id: string, label: string, icon: ReactNode) => <Tile key={id} icon={icon} label={label} onClick={() => onAdd({ kind: 'element', id })} {...drag({ kind: 'element', id })} />;
  return (
    <>
      <Typography variant="overline" color="text.secondary">Basic</Typography>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {el('text', 'Text', <TitleIcon fontSize="small" />)}
        {el('heading', 'Heading', <TitleIcon fontSize="small" />)}
        {el('image', 'Image', <ImageIcon fontSize="small" />)}
        {el('rect', 'Rectangle', <CropSquareIcon fontSize="small" />)}
        {el('ellipse', 'Ellipse', <CircleOutlinedIcon fontSize="small" />)}
        {el('line', 'Line', <HorizontalRuleIcon fontSize="small" />)}
      </div>
      <Typography variant="overline" color="text.secondary">Design elements</Typography>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {DESIGN_PRESETS.map((p) => <Tile key={p.id} icon={<WidgetsIcon fontSize="small" />} label={p.label} onClick={() => onAdd({ kind: 'preset', id: p.id })} {...drag({ kind: 'preset', id: p.id })} />)}
      </div>
      <Typography variant="overline" color="text.secondary">Logos</Typography>
      {data.logos.length === 0 ? <Typography variant="body2" color="text.secondary">No logos uploaded yet.</Typography> : (
        <div className="grid grid-cols-2 gap-2">
          {data.logos.map((l) => {
            const aspect = l.media.width && l.media.height ? l.media.width / l.media.height : 2;
            return (
              <Box key={l.id} role="button" tabIndex={0} onClick={() => onAdd({ kind: 'logo', id: l.id, aspect })} onKeyDown={(e) => e.key === 'Enter' && onAdd({ kind: 'logo', id: l.id, aspect })} {...drag({ kind: 'logo', id: l.id, aspect })} sx={{ ...checker, height: 70, borderRadius: 1.5, cursor: 'pointer', border: 1, borderColor: 'divider', '&:hover': { borderColor: 'primary.main' } }} className="flex items-center justify-center overflow-hidden" title={`${l.label}${l.isPrimary ? ' (primary)' : ''}`}>
                <img src={l.media.thumbUrl} alt={l.label} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
              </Box>
            );
          })}
        </div>
      )}
      <Typography variant="caption" color="text.secondary" display="block" mt={1.5}>Click to add, or drag onto the page. Text can contain tokens such as {'{{restaurant.phone1}}'}.</Typography>
    </>
  );
}

/* ----------------------------------------------------------------- content */
function ContentTab({ data, pageId, onAdd }: { data: MenuData; pageId: number; onAdd: (p: Payload) => void }) {
  const [mode, setMode] = useState<'sections' | 'categories' | 'items' | 'combos'>('sections');
  const [q, setQ] = useState('');
  const onPage = useEditor((s) => new Set(s.elements.flatMap((e) => (e.type === 'section' ? [e.sectionId] : []))));
  const row = (key: string | number, primary: string, secondary: string, payload: Payload, extra?: ReactNode) => (
    <ListItemButton key={key} onClick={() => onAdd(payload)} {...drag(payload)} sx={{ borderRadius: 1, py: 0.25 }}>
      <ListItemText primary={primary} secondary={secondary} slotProps={{ primary: { noWrap: true, fontSize: 13 }, secondary: { noWrap: true, fontSize: 11 } }} />
      {extra}
    </ListItemButton>
  );
  const match = (t: string) => !q || t.toLowerCase().includes(q.toLowerCase());
  return (
    <>
      <ToggleButtonGroup size="small" exclusive fullWidth value={mode} onChange={(_, v) => v && setMode(v)} sx={{ mb: 1, '& .MuiToggleButton-root': { fontSize: 11, px: 0.5, textTransform: 'none' } }}>
        <ToggleButton value="sections">Sections</ToggleButton>
        <ToggleButton value="categories">Categories</ToggleButton>
        <ToggleButton value="items">Items</ToggleButton>
        <ToggleButton value="combos">Combos</ToggleButton>
      </ToggleButtonGroup>
      {mode !== 'sections' && mode !== 'combos' && <TextField size="small" fullWidth placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} sx={{ mb: 1 }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />}
      <List dense disablePadding>
        {mode === 'sections' && (data.sections.length === 0 ? <Typography variant="body2" color="text.secondary">No sections yet – add one from a category.</Typography> : data.sections.map((s) => row(s.id, s.title, `${data.pages.find((p) => p.id === s.pageId)?.title ?? 'Unassigned'} · ${s.config.cardTemplate}`, { kind: 'section', id: s.id }, onPage.has(s.id) ? <Chip size="small" label="on page" color="primary" variant="outlined" /> : s.pageId === pageId ? <Chip size="small" label="this page" /> : null)))}
        {mode === 'categories' && data.categories.filter((c) => match(c.name)).map((c) => row(c.id, c.name, `${c.itemCount} items – adds a new section`, { kind: 'category', id: c.id }))}
        {mode === 'items' && data.items.filter((i) => match(i.name)).slice(0, 80).map((i) => row(i.id, i.name, i.category?.name ?? '', { kind: 'item', id: i.id }))}
        {mode === 'combos' && (data.combos.length === 0 ? <Typography variant="body2" color="text.secondary">No combos yet – create them under Combos.</Typography> : data.combos.map((c) => row(c.id, c.name, `₹${c.sellingPrice} – adds a combo section`, { kind: 'combo', id: c.id })))}
      </List>
      <Typography variant="caption" color="text.secondary" display="block" mt={1}>Click or drag onto the page. A <b>section</b> shows a whole category with the chosen card template; an <b>item</b> adds a single card.</Typography>
    </>
  );
}

/* ------------------------------------------------------------------ images */
function ImagesTab({ onAdd }: { onAdd: (p: Payload) => void }) {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const [q, setQ] = useState('');
  const list = useQuery({ queryKey: [...keys.media, 'editor', q], queryFn: () => mediaService.list({ page: 1, pageSize: 48, search: q || undefined }) });
  const upload = useMutation({
    mutationFn: (files: File[]) => mediaService.upload(files),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: keys.media }); if (r.failed.length) notify(r.failed[0]!.error, 'warning'); },
    onError: (e) => notify(e.message, 'error'),
  });
  const add = (m: MediaDTO) => onAdd({ kind: 'media', id: m.id, aspect: m.width && m.height ? m.width / m.height : 1 });
  return (
    <>
      <Dropzone compact onFiles={(f) => upload.mutate(f)} busy={upload.isPending} />
      <TextField size="small" fullWidth placeholder="Search images…" value={q} onChange={(e) => setQ(e.target.value)} sx={{ my: 1 }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
      {list.data?.data.length === 0 && <Typography variant="body2" color="text.secondary">No images yet. Upload above or in the Image Library.</Typography>}
      <div className="grid grid-cols-3 gap-1.5">
        {list.data?.data.map((m) => (
          <Box key={m.id} role="button" tabIndex={0} title={m.originalName} onClick={() => add(m)} onKeyDown={(e) => e.key === 'Enter' && add(m)} {...drag({ kind: 'media', id: m.id, aspect: m.width && m.height ? m.width / m.height : 1 })} sx={{ ...checker, aspectRatio: '1', borderRadius: 1, cursor: 'pointer', border: 1, borderColor: 'divider', '&:hover': { borderColor: 'primary.main' } }} className="flex items-center justify-center overflow-hidden">
            <img src={m.thumbUrl} alt={m.altText ?? m.originalName} loading="lazy" draggable={false} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </Box>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------- backgrounds */
function BackgroundsTab({ data }: { data: MenuData }) {
  const bgId = useEditor((s) => s.settings?.backgroundId);
  const setSettings = useEditor((s) => s.setSettings);
  return (
    <>
      <Typography variant="body2" color="text.secondary" mb={1}>Click to use as this page’s background.</Typography>
      <div className="grid grid-cols-2 gap-2">
        <Tile icon={<WallpaperIcon fontSize="small" />} label="None" onClick={() => setSettings({ backgroundId: null })} aria-pressed={bgId === null} />
        {data.backgrounds.map((b) => (
          <Box key={b.id} role="button" tabIndex={0} aria-pressed={bgId === b.id} onClick={() => setSettings({ backgroundId: b.id })} onKeyDown={(e) => e.key === 'Enter' && setSettings({ backgroundId: b.id })} sx={{ cursor: 'pointer', borderRadius: 1.5, border: 2, borderColor: bgId === b.id ? 'primary.main' : 'divider', overflow: 'hidden' }}>
            <div style={{ height: 64, ...backgroundStyle({ ...b.config, borderWidthMm: 0, borderRadiusMm: 0, shadow: 'none' }, b.media) }} />
            <Typography variant="caption" noWrap display="block" px={0.5}>{b.name}</Typography>
          </Box>
        ))}
      </div>
      {data.backgrounds.length === 0 && <Typography variant="body2" color="text.secondary">No backgrounds yet. Create some under Backgrounds.</Typography>}
    </>
  );
}

/* --------------------------------------------------------------- templates */
function TemplatesTab({ data, onApply }: { data: MenuData; onApply: (t: CardTemplate) => void }) {
  const themeId = useEditor((s) => s.themeId);
  const theme = themeFor(data, themeId);
  const item = data.items.find((i) => i.isActive);
  const combo = data.combos.find((c) => c.isActive);
  const o: CardOptions = { theme, mode: 'preview', showDescription: true, showPrice: true, showQuantity: true, priceStyle: 'badge', imagePosition: 'top' };
  const cardMm = 62;
  const scale = 250 / (cardMm * MM_PX);
  return (
    <>
      <Typography variant="body2" color="text.secondary" mb={1}>Select a section or item card on the page, then click a template to apply it.</Typography>
      <div className="flex flex-col gap-3">
        {(Object.keys(CARD_TEMPLATE_LABELS) as CardTemplate[]).map((t) => (
          <Box key={t} role="button" tabIndex={0} onClick={() => onApply(t)} onKeyDown={(e) => e.key === 'Enter' && onApply(t)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1, cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}>
            <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>{CARD_TEMPLATE_LABELS[t]}</Typography>
            <div style={{ background: theme.colors.background, padding: 6, borderRadius: 6, overflow: 'hidden', height: 150 }}>
              <div style={{ width: `${cardMm}mm`, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                {t === 'combo' ? (combo ? <ComboCard combo={combo} o={o} /> : <div style={{ color: theme.colors.text, fontSize: '7pt' }}>Needs a combo</div>) : item ? <ItemCard item={item} template={t} o={o} /> : <div style={{ color: theme.colors.text, fontSize: '7pt' }}>Add a menu item to preview</div>}
              </div>
            </div>
          </Box>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ layers */
function LayersTab() {
  const { elements, selection, select, patch } = useEditor();
  const name = (e: (typeof elements)[number]) => e.name ?? (e.type === 'text' ? e.content.slice(0, 28) || 'Text' : e.type === 'section' ? 'Section' : e.type === 'itemCard' ? 'Item card' : e.type[0]!.toUpperCase() + e.type.slice(1));
  const sorted = [...elements].sort((a, b) => b.z - a.z);
  if (!sorted.length) return <Typography variant="body2" color="text.secondary">The page has no elements yet.</Typography>;
  return (
    <List dense disablePadding>
      {sorted.map((e) => (
        <ListItemButton key={e.id} selected={selection.includes(e.id)} onClick={(ev) => select([e.id], ev.shiftKey)} sx={{ borderRadius: 1, py: 0.25, opacity: e.hidden ? 0.5 : 1 }}>
          <ListItemText primary={name(e)} secondary={e.type} slotProps={{ primary: { noWrap: true, fontSize: 13 }, secondary: { fontSize: 10 } }} />
          <Tooltip title={e.hidden ? 'Show' : 'Hide'}><IconButton size="small" aria-label={`${e.hidden ? 'Show' : 'Hide'} layer`} onClick={(ev) => { ev.stopPropagation(); patch([e.id], { hidden: !e.hidden }); }}>{e.hidden ? <VisibilityOffIcon fontSize="inherit" /> : <VisibilityIcon fontSize="inherit" />}</IconButton></Tooltip>
          <Tooltip title={e.locked ? 'Unlock' : 'Lock'}><IconButton size="small" aria-label={`${e.locked ? 'Unlock' : 'Lock'} layer`} onClick={(ev) => { ev.stopPropagation(); patch([e.id], { locked: !e.locked }); }}>{e.locked ? <LockIcon fontSize="inherit" /> : <LockOpenIcon fontSize="inherit" />}</IconButton></Tooltip>
        </ListItemButton>
      ))}
    </List>
  );
}

