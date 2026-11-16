import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Tab, Tabs, TextField, Typography } from '@mui/material';
import { defaultPageSettings, emptyLayout, pageInputSchema, pageTypes, resolvePageSize, type PageDTO, type PageInput } from '@gc/shared-types';
import { backgroundService, keys, logoService, pageService, themeService } from '../../services/menuService';
import { useUiStore } from '../../store/uiStore';
import { ColorField, NumberField, SelectField, SwitchField } from '../../components/fields';

const TABS = ['General', 'Size & margins', 'Background', 'Branding'];

export default function PageDialog({ page, onClose }: { page: PageDTO | null; onClose: () => void }) {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const [tab, setTab] = useState(0);
  const themes = useQuery({ queryKey: keys.themes, queryFn: themeService.list });
  const backgrounds = useQuery({ queryKey: [...keys.backgrounds, ''], queryFn: () => backgroundService.list() });
  const logos = useQuery({ queryKey: keys.logos, queryFn: logoService.list });

  const form = useForm<PageInput>({
    resolver: zodResolver(pageInputSchema),
    defaultValues: page
      ? { title: page.title, subtitle: page.subtitle ?? '', pageType: page.pageType, themeId: page.themeId, isActive: page.isActive, settings: page.settings, layout: page.layout }
      : { title: '', subtitle: '', pageType: 'content', themeId: null, isActive: true, settings: defaultPageSettings, layout: emptyLayout },
  });
  const { control, register, watch, formState } = form;
  const s = watch('settings');
  const size = resolvePageSize(s);
  const errors = formState.errors;
  // Jump to the tab holding the first error so a failed save is never silent.
  const errorTab = (e: typeof errors) => (e.title || e.subtitle ? 0 : e.settings?.marginsMm || e.settings?.widthMm || e.settings?.heightMm || e.settings?.bindingMarginMm || e.settings?.paddingMm || e.settings?.columns ? 1 : e.settings?.backgroundColor || e.settings?.border ? 2 : e.settings ? 3 : null);

  const save = useMutation({
    mutationFn: (v: PageInput) => (page ? pageService.update(page.id, v) : pageService.create(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.pages }); qc.invalidateQueries({ queryKey: keys.stats }); notify(page ? 'Page updated' : 'Page created'); onClose(); },
    onError: (e) => notify(e.message, 'error'),
  });
  const hide = (n: number) => ({ display: tab === n ? 'flex' : 'none', flexDirection: 'column' as const, gap: 2 });
  const nullableSelect = (value: number | null, onChange: (v: number | null) => void, label: string, options: { id: number; name: string }[], none: string) => (
    <TextField select size="small" label={label} value={value !== null && options.some((o) => o.id === value) ? value : ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
      <MenuItem value="">{none}</MenuItem>
      {options.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
    </TextField>
  );

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v), (e) => { const t = errorTab(e); if (t !== null) setTab(t); })} noValidate>
        <DialogTitle>{page ? `Edit page – ${page.title}` : 'New page'}</DialogTitle>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>{TABS.map((t) => <Tab key={t} label={t} />)}</Tabs>
        <DialogContent sx={{ minHeight: 420 }}>
          {/* All tabs stay mounted (hidden) so validation covers every field. */}
          <Box sx={hide(0)}>
            <TextField size="small" label="Page title" {...register('title')} error={!!errors.title} helperText={errors.title?.message} slotProps={{ inputLabel: { shrink: true } }} sx={{ mt: 1 }} />
            <TextField size="small" label="Subtitle" {...register('subtitle')} slotProps={{ inputLabel: { shrink: true } }} />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField control={control} name="pageType" label="Page type" options={pageTypes.map((p) => ({ value: p, label: p === 'back' ? 'back cover' : p }))} />
              <Controller control={control} name="themeId" render={({ field }) => nullableSelect(field.value, field.onChange, 'Theme', themes.data ?? [], 'Default theme')} />
            </div>
            <SwitchField control={control} name="isActive" label="Include this page in the menu" />
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField control={control} name="settings.columns" label="Columns" min={1} max={6} />
              <SelectField control={control} name="settings.contentLayout" label="Content layout" options={['stack', 'grid', 'free']} />
            </div>
          </Box>

          <Box sx={hide(1)}>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <SelectField control={control} name="settings.size" label="Paper size" options={[{ value: 'A4', label: 'A4 (210 × 297 mm)' }, { value: 'custom', label: 'Custom' }]} />
              <SelectField control={control} name="settings.orientation" label="Orientation" options={['portrait', 'landscape']} />
              {s.size === 'custom' && <><NumberField control={control} name="settings.widthMm" label="Width (mm)" min={50} max={1000} /><NumberField control={control} name="settings.heightMm" label="Height (mm)" min={50} max={1000} /></>}
            </div>
            <Typography variant="body2" color="text.secondary">Printed size: <b>{size.widthMm} × {size.heightMm} mm</b></Typography>
            <Typography fontWeight={700}>Margins (mm)</Typography>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(['top', 'right', 'bottom', 'left'] as const).map((k) => <NumberField key={k} control={control} name={`settings.marginsMm.${k}`} label={k[0]!.toUpperCase() + k.slice(1)} min={0} max={100} step={0.5} />)}
            </div>
            {errors.settings?.marginsMm?.message && <Typography color="error" variant="caption">{errors.settings.marginsMm.message}</Typography>}
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField control={control} name="settings.paddingMm" label="Content padding (mm)" min={0} max={50} step={0.5} />
              <NumberField control={control} name="settings.bindingMarginMm" label="Binding margin (mm)" min={0} max={50} step={0.5} helper="Extra inner margin for spiral binding" />
            </div>
          </Box>

          <Box sx={hide(2)}>
            <Controller control={control} name="settings.backgroundId" render={({ field }) => <Box sx={{ mt: 1 }}>{nullableSelect(field.value, field.onChange, 'Background', backgrounds.data ?? [], 'None')}</Box>} />
            <ColorField control={control} name="settings.backgroundColor" label="Background colour (fallback)" nullable />
            <SwitchField control={control} name="settings.border.enabled" label="Page border" />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField control={control} name="settings.border.style" label="Border style" options={['solid', 'double', 'dashed']} />
              <ColorField control={control} name="settings.border.color" label="Border colour" />
              <NumberField control={control} name="settings.border.widthMm" label="Border width (mm)" min={0} max={10} step={0.1} />
              <NumberField control={control} name="settings.border.radiusMm" label="Corner radius (mm)" min={0} max={30} step={0.5} />
            </div>
          </Box>

          <Box sx={hide(3)}>
            <Box sx={{ mt: 1 }}><SwitchField control={control} name="settings.logo.enabled" label="Show logo on this page" /></Box>
            <div className="grid gap-3 sm:grid-cols-3">
              <Controller control={control} name="settings.logo.logoId" render={({ field }) => nullableSelect(field.value, field.onChange, 'Logo', (logos.data ?? []).map((l) => ({ id: l.id, name: l.label })), 'Primary logo')} />
              <NumberField control={control} name="settings.logo.widthMm" label="Logo width (mm)" min={5} max={200} />
              <SelectField control={control} name="settings.logo.position" label="Logo position" options={['left', 'center', 'right']} />
            </div>
            <SwitchField control={control} name="settings.header.enabled" label="Header" />
            <TextField size="small" label="Header text" {...register('settings.header.text')} slotProps={{ inputLabel: { shrink: true } }} />
            <SwitchField control={control} name="settings.footer.enabled" label="Footer" />
            <SwitchField control={control} name="settings.footer.useRestaurantInfo" label="Show phone / address / Instagram in footer" />
            <TextField size="small" label="Custom footer text" {...register('settings.footer.text')} helperText="Leave empty to use the restaurant footer text" slotProps={{ inputLabel: { shrink: true } }} />
            <SwitchField control={control} name="settings.showPageNumber" label="Page number" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save page'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
