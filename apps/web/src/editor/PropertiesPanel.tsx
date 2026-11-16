import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Autocomplete, Box, Button, Chip, FormControlLabel, IconButton, MenuItem, Slider, Switch, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import FlipToBackIcon from '@mui/icons-material/FlipToBack';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import { cardTemplates, iconNames, ornamentKinds, resolvePageSize, type ItemCardElement, type LayoutElement, type SectionElement, type TextElement } from '@gc/shared-types';
import { BUNDLED_FONTS } from '../renderer/fonts';
import { themeFor, type MenuData } from '../renderer/menuData';
import { CARD_TEMPLATE_LABELS } from '../renderer/cards';
import { TOKEN_NAMES } from '../renderer/tokens';
import { ImageField } from '../components/ImageField';
import { keys, sectionService } from '../services/menuService';
import { sectionToInput } from '../services/sectionInput';
import { useUiStore } from '../store/uiStore';
import { ColorRefField, Group, Num, Row, Sel } from './controls';
import { boundsOf, rectOf, round1 } from './geometry';
import type { Issue } from './issues';
import { useEditor } from './store';

type Align = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

export function PropertiesPanel({ data, pageNumber, issues, onGenerate, onStack, onClear, onEditSection }: { data: MenuData; pageNumber: number; issues: Issue[]; onGenerate: () => void; onStack: () => void; onClear: () => void; onEditSection: (sectionId: number) => void }) {
  const s = useEditor();
  const selected = s.elements.filter((e) => s.selection.includes(e.id));
  return (
    <Box sx={{ width: 300, flexShrink: 0, overflowY: 'auto', borderLeft: 1, borderColor: 'divider', bgcolor: 'background.paper' }} aria-label="Properties">
      {selected.length === 0 ? <PageProps data={data} pageNumber={pageNumber} issues={issues} onGenerate={onGenerate} onStack={onStack} onClear={onClear} /> : <ElementProps elements={selected} data={data} onEditSection={onEditSection} />}
    </Box>
  );
}

/* ------------------------------------------------------------------- page */
function PageProps({ data, pageNumber, issues, onGenerate, onStack, onClear }: { data: MenuData; pageNumber: number; issues: Issue[]; onGenerate: () => void; onStack: () => void; onClear: () => void }) {
  const { settings: st, themeId, meta, setSettings, setThemeId, setMeta, select } = useEditor();
  const size = resolvePageSize(st);
  const bgs = data.backgrounds;
  return (
    <>
      <Group title="Page">
        <TextField size="small" label="Title" value={meta.title} onChange={(e) => setMeta({ title: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" label="Subtitle" value={meta.subtitle ?? ''} onChange={(e) => setMeta({ subtitle: e.target.value || null })} slotProps={{ inputLabel: { shrink: true } }} />
        <Typography variant="caption" color="text.secondary">{st.size === 'A4' ? 'A4' : 'Custom'} {st.orientation} · {size.widthMm} × {size.heightMm} mm · page {pageNumber} (binding on the {pageNumber % 2 === 1 ? 'left' : 'right'})</Typography>
        <Row>
          <Sel label="Paper" value={st.size} onChange={(v) => setSettings({ size: v })} options={[{ value: 'A4', label: 'A4' }, { value: 'custom', label: 'Custom' }]} />
          <Sel label="Orientation" value={st.orientation} onChange={(v) => setSettings({ orientation: v })} options={['portrait', 'landscape']} />
        </Row>
        {st.size === 'custom' && <Row><Num label="Width" suffix="mm" value={st.widthMm} min={50} max={1000} onChange={(v) => setSettings({ widthMm: v })} /><Num label="Height" suffix="mm" value={st.heightMm} min={50} max={1000} onChange={(v) => setSettings({ heightMm: v })} /></Row>}
        <TextField select size="small" label="Theme" value={themeId !== null && data.themes.some((t) => t.id === themeId) ? themeId : ''} onChange={(e) => setThemeId(e.target.value === '' ? null : Number(e.target.value))} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
          <MenuItem value="">Default theme</MenuItem>
          {data.themes.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
        </TextField>
      </Group>

      <Group title="Layout tools">
        <Button size="small" variant="outlined" onClick={onGenerate}>Generate layout from sections</Button>
        <Button size="small" variant="outlined" onClick={onStack}>Fit sections to content &amp; stack</Button>
        <Button size="small" color="error" onClick={onClear}>Clear page</Button>
      </Group>

      <Group title={`Checks ${issues.length ? `(${issues.length})` : ''}`}>
        {issues.length === 0 ? <Typography variant="body2" color="success.main">No print problems found.</Typography> : issues.map((i) => (
          <Box key={i.id} onClick={() => select(i.elementIds)} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', cursor: 'pointer', p: 0.75, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
            {i.level === 'error' ? <ErrorIcon color="error" fontSize="small" /> : <WarningIcon color="warning" fontSize="small" />}
            <Typography variant="caption">{i.message}</Typography>
          </Box>
        ))}
      </Group>

      <Group title="Margins & binding">
        <Row>
          {(['top', 'right', 'bottom', 'left'] as const).map((k) => <Num key={k} label={k[0]!.toUpperCase() + k.slice(1)} suffix="mm" min={0} max={100} step={0.5} value={st.marginsMm[k]} onChange={(v) => setSettings({ marginsMm: { ...st.marginsMm, [k]: v } })} />)}
        </Row>
        <Num label="Binding margin" suffix="mm" min={0} max={50} step={0.5} value={st.bindingMarginMm} onChange={(v) => setSettings({ bindingMarginMm: v })} />
      </Group>

      <Group title="Background & border">
        <TextField select size="small" label="Background" value={st.backgroundId !== null && bgs.some((b) => b.id === st.backgroundId) ? st.backgroundId : ''} onChange={(e) => setSettings({ backgroundId: e.target.value === '' ? null : Number(e.target.value) })} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
          <MenuItem value="">None (theme colour)</MenuItem>
          {bgs.map((b) => <MenuItem key={b.id} value={b.id}>{b.name} <Typography component="span" variant="caption" color="text.secondary" ml={1}>{b.kind}</Typography></MenuItem>)}
        </TextField>
        <FormControlLabel control={<Switch size="small" checked={st.border.enabled} onChange={(e) => setSettings({ border: { ...st.border, enabled: e.target.checked } })} />} label="Page border" />
        {st.border.enabled && (
          <Row>
            <Sel label="Style" value={st.border.style} onChange={(v) => setSettings({ border: { ...st.border, style: v } })} options={['solid', 'double', 'dashed']} />
            <Num label="Width" suffix="mm" min={0} max={10} step={0.1} value={st.border.widthMm} onChange={(v) => setSettings({ border: { ...st.border, widthMm: v } })} />
          </Row>
        )}
      </Group>

      <Group title="Logo, header & footer">
        <FormControlLabel control={<Switch size="small" checked={st.logo.enabled} onChange={(e) => setSettings({ logo: { ...st.logo, enabled: e.target.checked } })} />} label="Show logo on this page" />
        {st.logo.enabled && (
          <>
            <TextField select size="small" label="Logo" value={st.logo.logoId !== null && data.logos.some((l) => l.id === st.logo.logoId) ? st.logo.logoId : ''} onChange={(e) => setSettings({ logo: { ...st.logo, logoId: e.target.value === '' ? null : Number(e.target.value) } })} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
              <MenuItem value="">Primary logo</MenuItem>
              {data.logos.map((l) => <MenuItem key={l.id} value={l.id}>{l.label}</MenuItem>)}
            </TextField>
            <Row>
              <Num label="Width" suffix="mm" min={5} max={200} value={st.logo.widthMm} onChange={(v) => setSettings({ logo: { ...st.logo, widthMm: v } })} />
              <Sel label="Position" value={st.logo.position} onChange={(v) => setSettings({ logo: { ...st.logo, position: v } })} options={['left', 'center', 'right']} />
            </Row>
          </>
        )}
        <FormControlLabel control={<Switch size="small" checked={st.header.enabled} onChange={(e) => setSettings({ header: { ...st.header, enabled: e.target.checked } })} />} label="Header text" />
        {st.header.enabled && <TextField size="small" label="Header" value={st.header.text ?? ''} onChange={(e) => setSettings({ header: { ...st.header, text: e.target.value || null } }, 'header-text')} slotProps={{ inputLabel: { shrink: true } }} />}
        <FormControlLabel control={<Switch size="small" checked={st.footer.enabled} onChange={(e) => setSettings({ footer: { ...st.footer, enabled: e.target.checked } })} />} label="Footer" />
        {st.footer.enabled && (
          <>
            <FormControlLabel control={<Switch size="small" checked={st.footer.useRestaurantInfo} onChange={(e) => setSettings({ footer: { ...st.footer, useRestaurantInfo: e.target.checked } })} />} label="Address, phone, Instagram" />
            <TextField size="small" label="Footer text" value={st.footer.text ?? ''} onChange={(e) => setSettings({ footer: { ...st.footer, text: e.target.value || null } }, 'footer-text')} slotProps={{ inputLabel: { shrink: true } }} />
          </>
        )}
        <FormControlLabel control={<Switch size="small" checked={st.showPageNumber} onChange={(e) => setSettings({ showPageNumber: e.target.checked })} />} label="Page number" />
      </Group>
    </>
  );
}

/* ---------------------------------------------------------------- elements */
const ICON_BTN = { size: 'small' } as const;

function ElementProps({ elements, data, onEditSection }: { elements: LayoutElement[]; data: MenuData; onEditSection: (id: number) => void }) {
  const s = useEditor();
  const ids = elements.map((e) => e.id);
  const one = elements.length === 1 ? elements[0]! : null;
  const theme = themeFor(data, s.themeId);
  const patch = (p: Partial<LayoutElement>, key?: string) => s.patch(ids, p, key ? `${ids.join()}:${key}` : undefined);
  const size = resolvePageSize(s.settings);

  const align = (a: Align) => {
    const group = boundsOf(elements.map(rectOf));
    const ref = elements.length === 1 ? { x: 0, y: 0, w: size.widthMm, h: size.heightMm } : group; // single: page, multiple: selection
    s.patch(ids, (e) => ({
      x: a === 'left' ? round1(ref.x) : a === 'hcenter' ? round1(ref.x + (ref.w - e.w) / 2) : a === 'right' ? round1(ref.x + ref.w - e.w) : e.x,
      y: a === 'top' ? round1(ref.y) : a === 'vcenter' ? round1(ref.y + (ref.h - e.h) / 2) : a === 'bottom' ? round1(ref.y + ref.h - e.h) : e.y,
    }) as Partial<LayoutElement>);
  };

  return (
    <>
      <Group title={one ? ({ text: 'Text', image: 'Image', shape: 'Shape', logo: 'Logo', section: 'Section', itemCard: 'Item card', icon: 'Icon', ornament: 'Ornament' } as const)[one.type] : `${elements.length} elements`}>
        {one && <TextField size="small" label="Layer name" value={one.name ?? ''} onChange={(e) => patch({ name: e.target.value || null }, 'name')} slotProps={{ inputLabel: { shrink: true } }} />}
        <div className="flex flex-wrap items-center gap-0.5">
          <Tooltip title={elements.every((e) => e.locked) ? 'Unlock' : 'Lock'}><IconButton {...ICON_BTN} aria-label="Toggle lock" onClick={() => patch({ locked: !elements.every((e) => e.locked) })}>{elements.every((e) => e.locked) ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}</IconButton></Tooltip>
          <Tooltip title={elements.every((e) => e.hidden) ? 'Show' : 'Hide'}><IconButton {...ICON_BTN} aria-label="Toggle visibility" onClick={() => patch({ hidden: !elements.every((e) => e.hidden) })}>{elements.every((e) => e.hidden) ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}</IconButton></Tooltip>
          <Tooltip title="Bring to front"><IconButton {...ICON_BTN} aria-label="Bring to front" onClick={() => s.reorderZ(ids, 'front')}><FlipToFrontIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Forward"><IconButton {...ICON_BTN} aria-label="Bring forward" onClick={() => s.reorderZ(ids, 'forward')}><ArrowUpwardIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Backward"><IconButton {...ICON_BTN} aria-label="Send backward" onClick={() => s.reorderZ(ids, 'backward')}><ArrowDownwardIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Send to back"><IconButton {...ICON_BTN} aria-label="Send to back" onClick={() => s.reorderZ(ids, 'back')}><FlipToBackIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Duplicate (Ctrl+D)"><IconButton {...ICON_BTN} aria-label="Duplicate" onClick={() => s.duplicate(ids)}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete (Del)"><IconButton {...ICON_BTN} color="error" aria-label="Delete" onClick={() => s.remove(ids)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </div>
      </Group>

      <Group title={one ? 'Position & size' : 'Align'}>
        {one && (
          <>
            <Row cols={2}>
              <Num label="X" suffix="mm" value={one.x} step={0.5} onChange={(v) => patch({ x: v }, 'x')} />
              <Num label="Y" suffix="mm" value={one.y} step={0.5} onChange={(v) => patch({ y: v }, 'y')} />
              <Num label="Width" suffix="mm" value={one.w} min={0.1} step={0.5} onChange={(v) => patch({ w: v }, 'w')} />
              <Num label="Height" suffix="mm" value={one.h} min={0.1} step={0.5} onChange={(v) => patch({ h: v }, 'h')} />
            </Row>
            <Row>
              <Num label="Rotation" suffix="°" value={one.rotation} min={-180} max={180} onChange={(v) => patch({ rotation: v }, 'rot')} />
              <div><Typography variant="caption" color="text.secondary">Opacity</Typography><Slider size="small" min={0} max={1} step={0.05} value={one.opacity} onChange={(_, v) => patch({ opacity: v as number }, 'op')} aria-label="Opacity" /></div>
            </Row>
          </>
        )}
        <div className="flex flex-wrap gap-1">
          {([['left', 'Left'], ['hcenter', 'Centre'], ['right', 'Right'], ['top', 'Top'], ['vcenter', 'Middle'], ['bottom', 'Bottom']] as [Align, string][]).map(([a, label]) => <Button key={a} size="small" variant="outlined" onClick={() => align(a)} sx={{ minWidth: 0, px: 1 }}>{label}</Button>)}
        </div>
        <Typography variant="caption" color="text.secondary">{one ? 'Aligns to the page.' : 'Aligns to the selection.'}</Typography>
      </Group>

      {one?.type === 'text' && <TextProps el={one} theme={theme} patch={patch} />}
      {one?.type === 'image' && (
        <Group title="Image">
          <ImageField label="Image" size={72} value={one.mediaId ? (data.media.get(one.mediaId) ?? null) : null} onChange={(m) => patch({ mediaId: m?.id ?? null } as Partial<LayoutElement>)} />
          <Row><Sel label="Fit" value={one.fit} onChange={(v) => patch({ fit: v } as Partial<LayoutElement>)} options={[{ value: 'contain', label: 'Show whole image' }, { value: 'cover', label: 'Fill (may crop)' }]} /><Num label="Corner radius" suffix="mm" min={0} max={100} value={one.radiusMm} onChange={(v) => patch({ radiusMm: v } as Partial<LayoutElement>, 'rad')} /></Row>
          <ColorRefField label="Border colour" nullable theme={theme} value={one.borderColor} onChange={(v) => patch({ borderColor: v } as Partial<LayoutElement>)} />
          <Num label="Border width" suffix="mm" min={0} max={10} step={0.1} value={one.borderWidthMm} onChange={(v) => patch({ borderWidthMm: v } as Partial<LayoutElement>, 'bw')} />
        </Group>
      )}
      {one?.type === 'shape' && (
        <Group title="Shape">
          <Sel label="Type" value={one.shape} onChange={(v) => patch({ shape: v } as Partial<LayoutElement>)} options={['rect', 'ellipse', 'line']} />
          <ColorRefField label="Fill" nullable theme={theme} value={one.fill} onChange={(v) => patch({ fill: v } as Partial<LayoutElement>)} />
          <ColorRefField label={one.shape === 'line' ? 'Line colour' : 'Border colour'} nullable theme={theme} value={one.borderColor} onChange={(v) => patch({ borderColor: v } as Partial<LayoutElement>)} />
          <Row><Num label={one.shape === 'line' ? 'Thickness' : 'Border'} suffix="mm" min={0} max={10} step={0.1} value={one.borderWidthMm} onChange={(v) => patch({ borderWidthMm: v } as Partial<LayoutElement>, 'bw')} />{one.shape === 'rect' && <Num label="Radius" suffix="mm" min={0} max={100} value={one.radiusMm} onChange={(v) => patch({ radiusMm: v } as Partial<LayoutElement>, 'rad')} />}</Row>
        </Group>
      )}
      {one?.type === 'logo' && (
        <Group title="Logo">
          <TextField select size="small" label="Logo" value={one.logoId !== null && data.logos.some((l) => l.id === one.logoId) ? one.logoId : ''} onChange={(e) => patch({ logoId: e.target.value === '' ? null : Number(e.target.value) } as Partial<LayoutElement>)} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
            <MenuItem value="">Primary logo</MenuItem>
            {data.logos.map((l) => <MenuItem key={l.id} value={l.id}>{l.label}</MenuItem>)}
          </TextField>
        </Group>
      )}
      {one?.type === 'icon' && (
        <Group title="Icon">
          <Sel label="Icon" value={one.icon} onChange={(v) => patch({ icon: v } as Partial<LayoutElement>)} options={iconNames} />
          <ColorRefField label="Colour" theme={theme} value={one.color} onChange={(v) => v && patch({ color: v } as Partial<LayoutElement>)} />
          <Num label="Line weight" suffix="mm" min={0.1} max={3} step={0.05} value={one.strokeMm} onChange={(v) => patch({ strokeMm: v } as Partial<LayoutElement>, 'stroke')} />
        </Group>
      )}
      {one?.type === 'ornament' && (
        <Group title="Ornament">
          <Sel label="Style" value={one.kind} onChange={(v) => patch({ kind: v } as Partial<LayoutElement>)} options={ornamentKinds} />
          <ColorRefField label="Colour" theme={theme} value={one.color} onChange={(v) => v && patch({ color: v } as Partial<LayoutElement>)} />
          <Num label="Line weight" suffix="mm" min={0.1} max={3} step={0.05} value={one.strokeMm} onChange={(v) => patch({ strokeMm: v } as Partial<LayoutElement>, 'stroke')} />
        </Group>
      )}
      {one?.type === 'section' && <SectionProps el={one} data={data} onEditSection={onEditSection} />}
      {one?.type === 'itemCard' && <ItemCardProps el={one} data={data} patch={patch} />}
    </>
  );
}

function TextProps({ el, theme, patch }: { el: TextElement; theme: ReturnType<typeof themeFor>; patch: (p: Partial<LayoutElement>, key?: string) => void }) {
  const upd = (p: Partial<TextElement>, key?: string) => patch(p as Partial<LayoutElement>, key);
  return (
    <Group title="Text">
      <TextField size="small" multiline minRows={3} label="Content" value={el.content} onChange={(e) => upd({ content: e.target.value }, 'content')} slotProps={{ inputLabel: { shrink: true } }} />
      <div className="flex flex-wrap gap-0.5">
        {TOKEN_NAMES.slice(0, 8).map((t) => <Chip key={t} size="small" variant="outlined" label={t.replace('restaurant.', '').replace('page.', 'page ')} onClick={() => upd({ content: `${el.content}{{${t}}}` })} title={`Insert {{${t}}} – filled from your restaurant settings`} />)}
      </div>
      <Row>
        <Sel label="Style" value={el.role} onChange={(v) => upd({ role: v })} options={[{ value: 'body', label: 'Body font' }, { value: 'heading', label: 'Heading font' }, { value: 'price', label: 'Price font' }]} />
        <Num label="Size" suffix="pt" min={3} max={300} step={0.5} value={el.fontSizePt} onChange={(v) => upd({ fontSizePt: v }, 'fs')} />
      </Row>
      <Autocomplete size="small" options={['', ...BUNDLED_FONTS]} getOptionLabel={(o) => o || 'Theme font'} value={el.font ?? ''} onChange={(_, v) => upd({ font: v || null })} renderInput={(p) => <TextField {...p} label="Font" slotProps={{ inputLabel: { shrink: true } }} />} disableClearable />
      <Row>
        <Sel label="Weight" value={el.fontWeight} onChange={(v) => upd({ fontWeight: v })} options={[400, 500, 600, 700]} />
        <ColorRefField label="Colour" theme={theme} value={el.color} onChange={(v) => v && upd({ color: v })} />
      </Row>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleButtonGroup size="small" exclusive value={el.align} onChange={(_, v) => v && upd({ align: v })} aria-label="Alignment">
          <ToggleButton value="left" aria-label="Align left"><FormatAlignLeftIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="center" aria-label="Align centre"><FormatAlignCenterIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="right" aria-label="Align right"><FormatAlignRightIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
        <ToggleButton size="small" value="bold" selected={el.fontWeight >= 700} onChange={() => upd({ fontWeight: el.fontWeight >= 700 ? 400 : 700 })} aria-label="Bold"><FormatBoldIcon fontSize="small" /></ToggleButton>
        <ToggleButton size="small" value="italic" selected={el.italic} onChange={() => upd({ italic: !el.italic })} aria-label="Italic"><FormatItalicIcon fontSize="small" /></ToggleButton>
        <ToggleButton size="small" value="upper" selected={el.uppercase} onChange={() => upd({ uppercase: !el.uppercase })} aria-label="Uppercase"><TextFieldsIcon fontSize="small" /></ToggleButton>
      </div>
      <Row>
        <Sel label="Vertical" value={el.verticalAlign} onChange={(v) => upd({ verticalAlign: v })} options={['top', 'middle', 'bottom']} />
        <Num label="Line height" min={0.6} max={4} step={0.1} value={el.lineHeight} onChange={(v) => upd({ lineHeight: v }, 'lh')} />
      </Row>
      <Num label="Letter spacing" suffix="pt" min={-5} max={40} step={0.5} value={el.letterSpacingPt} onChange={(v) => upd({ letterSpacingPt: v }, 'ls')} />
    </Group>
  );
}

function SectionProps({ el, data, onEditSection }: { el: SectionElement; data: MenuData; onEditSection: (id: number) => void }) {
  const qc = useQueryClient();
  const notify = useUiStore((st) => st.notify);
  const { measured, patch } = useEditor();
  const section = data.sections.find((x) => x.id === el.sectionId);
  const update = useMutation({
    mutationFn: (p: Partial<NonNullable<typeof section>['config']>) => sectionService.update(section!.id, sectionToInput(section!, { config: { ...section!.config, ...p } })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.pages }); qc.invalidateQueries({ queryKey: keys.sections }); },
    onError: (e) => notify(e.message, 'error'),
  });
  const [busy, setBusy] = useState(false);
  if (!section) return <Group title="Section"><Typography variant="body2" color="error">This section no longer exists.</Typography></Group>;
  const c = section.config;
  const natural = measured[el.id];
  return (
    <Group title={`Section – ${section.title}`}>
      <Typography variant="caption" color="text.secondary">These settings belong to the section and apply wherever it is shown.</Typography>
      <Sel label="Card template" value={c.cardTemplate} onChange={(v) => update.mutate({ cardTemplate: v })} options={cardTemplates.map((t) => ({ value: t, label: CARD_TEMPLATE_LABELS[t] }))} />
      <Row>
        <Num label="Columns" min={1} max={6} value={c.columns} onChange={(v) => update.mutate({ columns: Math.round(v) })} />
        <Num label="Max rows" min={1} max={20} value={c.rows} onChange={(v) => update.mutate({ rows: Math.round(v) })} />
      </Row>
      <Row>
        <Sel label="Heading" value={c.headingStyle} onChange={(v) => update.mutate({ headingStyle: v })} options={['theme', 'brush-red', 'gold-bar', 'plain']} />
        <Sel label="Price style" value={c.priceStyle} onChange={(v) => update.mutate({ priceStyle: v })} options={['badge', 'plain', 'inline']} />
      </Row>
      <Sel label="Image position" value={c.imagePosition} onChange={(v) => update.mutate({ imagePosition: v })} options={['top', 'bottom', 'left', 'right']} />
      <div className="flex flex-wrap gap-x-3">
        <FormControlLabel control={<Switch size="small" checked={c.showDescription} onChange={(e) => update.mutate({ showDescription: e.target.checked })} />} label="Description" />
        <FormControlLabel control={<Switch size="small" checked={c.showPrice} onChange={(e) => update.mutate({ showPrice: e.target.checked })} />} label="Price" />
        <FormControlLabel control={<Switch size="small" checked={c.showQuantity} onChange={(e) => update.mutate({ showQuantity: e.target.checked })} />} label="Quantity" />
      </div>
      {natural !== undefined && (
        <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
          <Typography variant="caption">Content height: <b>{natural} mm</b> · box: <b>{el.h} mm</b></Typography>
          <div><Button size="small" disabled={busy || Math.abs(natural - el.h) < 0.3} onClick={() => { setBusy(true); patch([el.id], { h: Math.ceil(natural * 10) / 10 }); setBusy(false); }}>Fit height to content</Button></div>
        </Box>
      )}
      <Button size="small" variant="outlined" onClick={() => onEditSection(section.id)}>Edit categories, items &amp; details…</Button>
    </Group>
  );
}

function ItemCardProps({ el, data, patch }: { el: ItemCardElement; data: MenuData; patch: (p: Partial<LayoutElement>, key?: string) => void }) {
  const upd = (p: Partial<ItemCardElement>) => patch(p as Partial<LayoutElement>);
  return (
    <Group title="Item card">
      <Autocomplete size="small" options={data.items} groupBy={(i) => i.category?.name ?? ''} getOptionLabel={(i) => i.name} value={data.items.find((i) => i.id === el.itemId) ?? data.items[0]} onChange={(_, v) => upd({ itemId: v.id })} renderInput={(p) => <TextField {...p} label="Menu item" slotProps={{ inputLabel: { shrink: true } }} />} disableClearable />
      <Sel label="Card template" value={el.template} onChange={(v) => upd({ template: v })} options={cardTemplates.filter((t) => t !== 'combo').map((t) => ({ value: t, label: CARD_TEMPLATE_LABELS[t] }))} />
      <div className="flex flex-wrap gap-x-3">
        <FormControlLabel control={<Switch size="small" checked={el.showDescription} onChange={(e) => upd({ showDescription: e.target.checked })} />} label="Description" />
        <FormControlLabel control={<Switch size="small" checked={el.showPrice} onChange={(e) => upd({ showPrice: e.target.checked })} />} label="Price" />
        <FormControlLabel control={<Switch size="small" checked={el.showQuantity} onChange={(e) => upd({ showQuantity: e.target.checked })} />} label="Quantity" />
      </div>
    </Group>
  );
}
