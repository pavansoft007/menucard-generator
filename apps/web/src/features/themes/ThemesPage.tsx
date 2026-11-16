import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Autocomplete, Box, Button, Card, CardActions, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { defaultThemeConfig, themeInputSchema, type ThemeConfig, type ThemeDTO, type ThemeInput } from '@gc/shared-types';
import { keys, themeService } from '../../services/menuService';
import { useUiStore } from '../../store/uiStore';
import { ConfirmDialog, ErrorAlert, ListSkeleton, PageHeader } from '../../components/common';
import EmptyState from '../../components/EmptyState';
import { ColorField, NumberField, SelectField } from '../../components/fields';
import { shadowCss } from '../../renderer/styles';

const FONTS = ['Playfair Display', 'Poppins', 'Oswald', 'Bebas Neue', 'Montserrat', 'Inter', 'Cinzel', 'Lora', 'Roboto', 'Lobster'];
const SHADOWS = ['none', 'soft', 'strong', 'gold-glow'] as const;

export function ThemePreview({ config: c, height = 150 }: { config: ThemeConfig; height?: number }) {
  return (
    <Box sx={{ bgcolor: c.colors.background, color: c.colors.text, height, p: 1.5, borderRadius: 2, overflow: 'hidden', fontFamily: `"${c.fonts.body}", sans-serif`, border: 1, borderColor: 'divider' }}>
      <Box sx={{ border: c.border.style === 'none' ? 0 : `${Math.max(1, c.border.widthMm)}px ${c.border.style} ${c.border.color}`, borderRadius: `${c.borderRadiusMm}px`, p: 1, height: '100%', boxShadow: shadowCss(c.shadow, c.colors.accent) }}>
        <Box sx={{ display: 'inline-block', px: 1, py: 0.25, mb: 0.75, bgcolor: c.headerStyle === 'brush-red' ? c.colors.special : 'transparent', borderBottom: c.headerStyle === 'gold-bar' ? `2px solid ${c.colors.accent}` : 0, borderRadius: c.headerStyle === 'ribbon' ? '2px 12px 2px 12px' : 0, color: c.headerStyle === 'brush-red' ? '#fff' : c.colors.heading, fontFamily: `"${c.fonts.heading}", serif`, fontWeight: 700, fontSize: 14 }}>
          CRISPY CHICKEN
        </Box>
        <Box sx={{ bgcolor: c.colors.surface, borderRadius: `${Math.min(c.borderRadiusMm, 8)}px`, p: 0.75, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
          <span>Chicken Wings · 6 pcs</span>
          <Box component="span" sx={{ bgcolor: c.colors.priceBadgeBg, color: c.colors.priceBadgeText, px: 0.75, borderRadius: 1, fontFamily: `"${c.fonts.price}", sans-serif`, fontWeight: 700 }}>
            ₹229
          </Box>
        </Box>
        <Box sx={{ mt: 0.75, height: 3, bgcolor: c.footerStyle === 'plain' ? 'transparent' : c.colors.accentAlt, opacity: c.footerStyle === 'bar' ? 1 : 0.7 }} />
      </Box>
    </Box>
  );
}

function ThemeDialog({ theme, onClose }: { theme: ThemeDTO | null; onClose: () => void }) {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const form = useForm<ThemeInput>({ resolver: zodResolver(themeInputSchema), defaultValues: { name: theme?.name ?? '', config: theme?.config ?? defaultThemeConfig } });
  const { control, register, watch, formState } = form;
  const cfg = watch('config');

  const save = useMutation({
    mutationFn: (v: ThemeInput) => (theme ? themeService.update(theme.id, v) : themeService.create(v)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.themes });
      notify(theme ? 'Theme updated' : 'Theme created');
      onClose();
    },
    onError: (e) => notify(e.message, 'error'),
  });
  const colorFields: [`config.colors.${keyof ThemeConfig['colors']}`, string][] = [
    ['config.colors.background', 'Page background'],
    ['config.colors.surface', 'Card / secondary background'],
    ['config.colors.accent', 'Primary accent'],
    ['config.colors.accentAlt', 'Secondary accent'],
    ['config.colors.heading', 'Heading colour'],
    ['config.colors.text', 'Body text'],
    ['config.colors.priceBadgeBg', 'Price badge'],
    ['config.colors.priceBadgeText', 'Price badge text'],
    ['config.colors.special', 'Special accent (brush headers)'],
  ];

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <DialogTitle>{theme ? `Edit theme – ${theme.name}` : 'New theme'}</DialogTitle>
        <DialogContent dividers className="grid gap-4 md:grid-cols-[1fr_260px]">
          <div className="flex flex-col gap-3">
            <TextField label="Theme name" {...register('name')} error={!!formState.errors.name} helperText={formState.errors.name?.message} />
            <Typography fontWeight={700}>Colours</Typography>
            <div className="grid gap-3 sm:grid-cols-2">
              {colorFields.map(([name, label]) => (
                <ColorField key={name} control={control} name={name} label={label} />
              ))}
            </div>
            <Typography fontWeight={700}>Typography</Typography>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['heading', 'body', 'price'] as const).map((k) => (
                <Controller
                  key={k}
                  control={control}
                  name={`config.fonts.${k}`}
                  render={({ field, fieldState }) => (
                    <Autocomplete size="small" freeSolo options={FONTS} value={field.value} onInputChange={(_, v) => field.onChange(v)} renderInput={(p) => <TextField {...p} label={`${k[0]!.toUpperCase()}${k.slice(1)} font`} error={!!fieldState.error} helperText={fieldState.error?.message} slotProps={{ inputLabel: { shrink: true } }} />} />
                  )}
                />
              ))}
            </div>
            <Typography fontWeight={700}>Style</Typography>
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField control={control} name="config.border.style" label="Border style" options={['none', 'solid', 'double', 'dashed']} />
              <NumberField control={control} name="config.border.widthMm" label="Border width (mm)" min={0} max={10} step={0.1} />
              <ColorField control={control} name="config.border.color" label="Border colour" />
              <NumberField control={control} name="config.borderRadiusMm" label="Corner radius (mm)" min={0} max={30} step={0.5} />
              <SelectField control={control} name="config.shadow" label="Shadow" options={SHADOWS} />
              <SelectField control={control} name="config.headerStyle" label="Header style" options={['brush-red', 'gold-bar', 'ribbon', 'plain']} />
              <SelectField control={control} name="config.footerStyle" label="Footer style" options={['gold-line', 'bar', 'plain']} />
            </div>
            <Typography variant="caption" color="text.secondary">Fonts are embedded into exported PDFs in the export phase; pick any installed or web font name.</Typography>
          </div>
          <div className="md:sticky md:top-0 md:self-start">
            <Typography variant="caption" color="text.secondary">Live preview</Typography>
            <ThemePreview config={cfg as ThemeConfig} height={200} />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save theme'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default function ThemesPage() {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const themes = useQuery({ queryKey: keys.themes, queryFn: themeService.list });
  const [editing, setEditing] = useState<ThemeDTO | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ThemeDTO | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const makeDefault = useMutation({
    mutationFn: (t: ThemeDTO) => themeService.makeDefault(t.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.themes }); notify('Default theme changed'); },
    onError: (e) => notify(e.message, 'error'),
  });
  const remove = useMutation({
    mutationFn: (t: ThemeDTO) => themeService.remove(t.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.themes }); setDeleting(null); notify('Theme deleted'); },
    onError: (e) => setDeleteError(e.message),
  });

  return (
    <>
      <PageHeader title="Theme & Design" subtitle="Reusable looks for your menu pages. New pages use the default theme." actions={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>New theme</Button>} />
      {themes.isLoading ? <ListSkeleton rows={2} height={220} /> : themes.isError ? <ErrorAlert error={themes.error} onRetry={() => themes.refetch()} /> : themes.data!.length === 0 ? (
        <EmptyState title="No themes yet" description="Create a theme to control colours, fonts and borders across your menu." action={<Button variant="contained" onClick={() => setEditing('new')}>New theme</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {themes.data!.map((t) => (
            <Card key={t.id} variant="outlined">
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Typography fontWeight={700} flex={1} noWrap>{t.name}</Typography>
                  {t.isDefault && <Chip size="small" color="primary" label="Default" />}
                  <Chip size="small" variant="outlined" label={`${t.pageCount} page${t.pageCount === 1 ? '' : 's'}`} />
                </div>
                <ThemePreview config={t.config} />
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => setEditing(t)}>Edit</Button>
                {!t.isDefault && <Button size="small" onClick={() => makeDefault.mutate(t)} disabled={makeDefault.isPending}>Make default</Button>}
                <Button size="small" color="error" sx={{ ml: 'auto' }} onClick={() => { setDeleteError(null); setDeleting(t); }}>Delete</Button>
              </CardActions>
            </Card>
          ))}
        </div>
      )}
      {editing && <ThemeDialog key={editing === 'new' ? 'new' : editing.id} theme={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!deleting} title="Delete theme?" message={<>“{deleting?.name}” will be removed.</>} busy={remove.isPending} error={deleteError} onConfirm={() => deleting && remove.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  );
}
