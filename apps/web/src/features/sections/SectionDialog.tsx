import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Tab, Tabs, TextField, Typography } from '@mui/material';
import { cardTemplates, defaultSectionConfig, sectionInputSchema, type CategoryDTO, type ComboDTO, type ItemDTO, type MediaDTO, type PageDTO, type SectionDTO, type SectionInput } from '@gc/shared-types';
import { backgroundService, keys, sectionService } from '../../services/menuService';
import { useUiStore } from '../../store/uiStore';
import { ImageField } from '../../components/ImageField';
import { ColorField, NumberField, SelectField, SwitchField } from '../../components/fields';

const TEMPLATE_LABELS: Record<(typeof cardTemplates)[number], string> = {
  premium: 'Premium food card', 'image-left': 'Image left / details right', 'image-top': 'Image top / details bottom',
  'compact-list': 'Compact list', featured: 'Featured item', combo: 'Combo card',
};

export default function SectionDialog({ section, defaultPageId, pages, categories, items, combos, onClose }: { section: SectionDTO | null; defaultPageId: number | null; pages: PageDTO[]; categories: CategoryDTO[]; items: ItemDTO[]; combos: ComboDTO[]; onClose: () => void }) {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const [tab, setTab] = useState(0);
  const [image, setImage] = useState<MediaDTO | null>(section?.image ?? null);
  const backgrounds = useQuery({ queryKey: [...keys.backgrounds, ''], queryFn: () => backgroundService.list() });

  const form = useForm<SectionInput>({
    resolver: zodResolver(sectionInputSchema),
    defaultValues: section
      ? { pageId: section.pageId, title: section.title, subtitle: section.subtitle ?? '', description: section.description ?? '', imageMediaId: section.image?.id ?? null, backgroundId: section.backgroundId, categoryIds: section.categoryIds, itemIds: section.itemIds, comboIds: section.comboIds, config: section.config }
      : { pageId: defaultPageId, title: '', subtitle: '', description: '', imageMediaId: null, backgroundId: null, categoryIds: [], itemIds: [], comboIds: [], config: defaultSectionConfig },
  });
  const { control, register, setValue, watch, formState } = form;
  const errors = formState.errors;
  const border = watch('config.border.enabled');

  const save = useMutation({
    mutationFn: (v: SectionInput) => (section ? sectionService.update(section.id, v) : sectionService.create(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.sections }); qc.invalidateQueries({ queryKey: keys.pages }); notify(section ? 'Section updated' : 'Section created'); onClose(); },
    onError: (e) => notify(e.message, 'error'),
  });
  const hide = (n: number) => ({ display: tab === n ? 'flex' : 'none', flexDirection: 'column' as const, gap: 2, pt: 1 });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v), (e) => setTab(e.title || e.subtitle || e.description ? 0 : e.config ? 2 : 1))} noValidate>
        <DialogTitle>{section ? `Edit section – ${section.title}` : 'New section'}</DialogTitle>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="General" /><Tab label="Content" /><Tab label="Layout & style" />
        </Tabs>
        <DialogContent sx={{ minHeight: 400 }}>
          <Box sx={hide(0)}>
            <TextField size="small" label="Section title" {...register('title')} error={!!errors.title} helperText={errors.title?.message} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" label="Subtitle" {...register('subtitle')} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" label="Description" multiline minRows={2} {...register('description')} slotProps={{ inputLabel: { shrink: true } }} />
            <Controller control={control} name="pageId" render={({ field }) => (
              <TextField select size="small" label="Page" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }} helperText="Choose Unassigned to park a section off the menu">
                <MenuItem value="">Unassigned</MenuItem>
                {pages.map((p) => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
              </TextField>
            )} />
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageField label="Section image" size={80} value={image} onChange={(m) => { setImage(m); setValue('imageMediaId', m?.id ?? null, { shouldDirty: true }); }} />
              <Controller control={control} name="backgroundId" render={({ field }) => (
                <TextField select size="small" label="Background" value={field.value !== null && (backgrounds.data ?? []).some((b) => b.id === field.value) ? field.value : ''} onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }} sx={{ alignSelf: 'start' }}>
                  <MenuItem value="">None</MenuItem>
                  {(backgrounds.data ?? []).map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </TextField>
              )} />
            </div>
          </Box>

          <Box sx={hide(1)}>
            <Typography variant="body2" color="text.secondary">Show whole categories, hand-picked items, or both.</Typography>
            <Controller control={control} name="categoryIds" render={({ field }) => (
              <Autocomplete multiple size="small" options={categories} value={categories.filter((c) => field.value.includes(c.id))} getOptionLabel={(c) => c.name} onChange={(_, v) => field.onChange(v.map((c) => c.id))} renderInput={(p) => <TextField {...p} label="Categories" slotProps={{ inputLabel: { shrink: true } }} />} />
            )} />
            <Controller control={control} name="itemIds" render={({ field }) => (
              <Autocomplete multiple size="small" options={items} value={items.filter((i) => field.value.includes(i.id))} groupBy={(i) => i.category?.name ?? ''} getOptionLabel={(i) => i.name} onChange={(_, v) => field.onChange(v.map((i) => i.id))} renderInput={(p) => <TextField {...p} label="Individual items" slotProps={{ inputLabel: { shrink: true } }} />} />
            )} />
            <Controller control={control} name="comboIds" render={({ field }) => (
              <Autocomplete multiple size="small" options={combos} value={combos.filter((c) => field.value.includes(c.id))} getOptionLabel={(c) => c.name} onChange={(_, v) => field.onChange(v.map((c) => c.id))} renderInput={(p) => <TextField {...p} label="Combos (use the Combo card template)" slotProps={{ inputLabel: { shrink: true } }} />} />
            )} />
          </Box>

          <Box sx={hide(2)}>
            <SelectField control={control} name="config.cardTemplate" label="Card template" options={cardTemplates.map((t) => ({ value: t, label: TEMPLATE_LABELS[t] }))} />
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberField control={control} name="config.columns" label="Columns" min={1} max={6} />
              <NumberField control={control} name="config.rows" label="Rows (auto)" min={1} max={20} nullable />
              <NumberField control={control} name="config.widthPct" label="Width (%)" min={10} max={100} />
              <NumberField control={control} name="config.heightMm" label="Height (mm, auto)" min={10} max={1000} nullable />
              <SelectField control={control} name="config.headingStyle" label="Heading style" options={['theme', 'brush-red', 'gold-bar', 'plain']} />
              <SelectField control={control} name="config.priceStyle" label="Price style" options={['badge', 'plain', 'inline']} />
              <SelectField control={control} name="config.imagePosition" label="Image position" options={['top', 'bottom', 'left', 'right']} />
            </div>
            <div className="flex flex-wrap gap-x-4">
              <SwitchField control={control} name="config.showDescription" label="Description" />
              <SwitchField control={control} name="config.showPrice" label="Price" />
              <SwitchField control={control} name="config.showQuantity" label="Quantity" />
            </div>
            <SwitchField control={control} name="config.border.enabled" label="Section border" />
            {border && (
              <div className="grid gap-3 sm:grid-cols-3">
                <SelectField control={control} name="config.border.style" label="Style" options={['solid', 'double', 'dashed']} />
                <ColorField control={control} name="config.border.color" label="Colour" />
                <NumberField control={control} name="config.border.widthMm" label="Width (mm)" min={0} max={10} step={0.1} />
              </div>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save section'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
