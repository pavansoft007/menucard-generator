import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Card, CardActions, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { backgroundInputSchema, backgroundKinds, defaultBackgroundConfig, type BackgroundConfig, type BackgroundDTO, type BackgroundInput, type MediaDTO } from '@gc/shared-types';
import { backgroundService, keys } from '../../services/menuService';
import { useUiStore } from '../../store/uiStore';
import { ConfirmDialog, ErrorAlert, ListSkeleton, PageHeader } from '../../components/common';
import EmptyState from '../../components/EmptyState';
import { ImageField } from '../../components/ImageField';
import { ColorField, NumberField, SelectField } from '../../components/fields';
import { backgroundStyle } from '../../renderer/styles';

const GRADIENT_PRESETS = [
  { label: 'Black glow', value: 'radial-gradient(circle at 50% 0%, #1d1710 0%, #080808 70%)' },
  { label: 'Gold', value: 'linear-gradient(135deg, #F5B51B 0%, #D99A19 50%, #a8730f 100%)' },
  { label: 'Charcoal', value: 'linear-gradient(180deg, #17130F 0%, #080808 100%)' },
];

function Preview({ config, media, height = 130 }: { config: BackgroundConfig; media: MediaDTO | null; height?: number }) {
  // The px size here is only for screen preview; the stored values are millimetres and used as-is by export.
  const style = backgroundStyle({ ...config, borderWidthMm: Math.min(config.borderWidthMm, 3), borderRadiusMm: Math.min(config.borderRadiusMm, 8) }, media);
  return <Box sx={{ height, borderRadius: 2, border: 1, borderColor: 'divider', overflow: 'hidden', p: 1 }}><Box sx={{ ...style, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff8', fontSize: 12 }}>Aa preview</Box></Box>;
}

function BackgroundDialog({ bg, onClose }: { bg: BackgroundDTO | null; onClose: () => void }) {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const [media, setMedia] = useState<MediaDTO | null>(bg?.media ?? null);
  const form = useForm<BackgroundInput>({
    resolver: zodResolver(backgroundInputSchema),
    defaultValues: { name: bg?.name ?? '', kind: bg?.kind ?? 'page', mediaId: bg?.media?.id ?? null, config: bg?.config ?? defaultBackgroundConfig },
  });
  const { control, register, watch, setValue, formState } = form;
  const cfg = watch('config');
  const save = useMutation({
    mutationFn: (v: BackgroundInput) => (bg ? backgroundService.update(bg.id, v) : backgroundService.create(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.backgrounds }); notify(bg ? 'Background updated' : 'Background created'); onClose(); },
    onError: (e) => notify(e.message, 'error'),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <DialogTitle>{bg ? 'Edit background' : 'New background'}</DialogTitle>
        <DialogContent dividers className="grid gap-4 md:grid-cols-[1fr_260px]">
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField size="small" label="Name" {...register('name')} error={!!formState.errors.name} helperText={formState.errors.name?.message} slotProps={{ inputLabel: { shrink: true } }} />
              <SelectField control={control} name="kind" label="Used for" options={backgroundKinds} />
            </div>
            <ImageField label="Background image (optional)" size={90} value={media} onChange={(m) => { setMedia(m); setValue('mediaId', m?.id ?? null, { shouldDirty: true }); }} />
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField control={control} name="config.color" label="Background colour" nullable />
              <ColorField control={control} name="config.overlayColor" label="Overlay colour" nullable />
              <NumberField control={control} name="config.overlayOpacity" label="Overlay opacity (0–1)" min={0} max={1} step={0.05} />
            </div>
            <Controller control={control} name="config.gradient" render={({ field, fieldState }) => (
              <div>
                <TextField size="small" fullWidth label="Gradient (CSS)" placeholder="linear-gradient(135deg, #000, #222)" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value.trim() === '' ? null : e.target.value)} error={!!fieldState.error} helperText={fieldState.error?.message ?? 'Only linear / radial / conic gradients are accepted'} slotProps={{ inputLabel: { shrink: true } }} />
                <div className="mt-1 flex flex-wrap gap-1">
                  {GRADIENT_PRESETS.map((p) => <Chip key={p.label} size="small" label={p.label} onClick={() => field.onChange(p.value)} />)}
                  <Chip size="small" variant="outlined" label="Clear" onClick={() => field.onChange(null)} />
                </div>
              </div>
            )} />
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField control={control} name="config.position" label="Position" options={['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right']} />
              <SelectField control={control} name="config.size" label="Size" options={['cover', 'contain', 'auto']} />
              <SelectField control={control} name="config.repeat" label="Repeat" options={['no-repeat', 'repeat', 'repeat-x', 'repeat-y']} />
              <ColorField control={control} name="config.borderColor" label="Border colour" nullable />
              <NumberField control={control} name="config.borderWidthMm" label="Border (mm)" min={0} max={10} step={0.1} />
              <NumberField control={control} name="config.borderRadiusMm" label="Radius (mm)" min={0} max={30} step={0.5} />
              <SelectField control={control} name="config.shadow" label="Shadow" options={['none', 'soft', 'strong', 'gold-glow']} />
              <NumberField control={control} name="config.paddingMm" label="Padding (mm)" min={0} max={50} step={0.5} />
              <NumberField control={control} name="config.marginMm" label="Margin (mm)" min={0} max={50} step={0.5} />
            </div>
          </div>
          <div className="md:sticky md:top-0 md:self-start">
            <Typography variant="caption" color="text.secondary">Live preview</Typography>
            <Preview config={cfg as BackgroundConfig} media={media} height={220} />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default function BackgroundsPage() {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const [kind, setKind] = useState('');
  const list = useQuery({ queryKey: [...keys.backgrounds, kind], queryFn: () => backgroundService.list(kind || undefined) });
  const [editing, setEditing] = useState<BackgroundDTO | 'new' | null>(null);
  const [deleting, setDeleting] = useState<BackgroundDTO | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (b: BackgroundDTO) => backgroundService.remove(b.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.backgrounds }); qc.invalidateQueries({ queryKey: keys.media }); setDeleting(null); notify('Background deleted'); },
    onError: (e) => setDeleteError(e.message),
  });

  return (
    <>
      <PageHeader title="Backgrounds" subtitle="Page, section, card, header and footer backgrounds – colours, gradients and uploaded images." actions={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>New background</Button>} />
      <TextField select size="small" label="Used for" value={kind} onChange={(e) => setKind(e.target.value)} sx={{ minWidth: 170, mb: 2 }}>
        <MenuItem value="">All</MenuItem>
        {backgroundKinds.map((k) => <MenuItem key={k} value={k} sx={{ textTransform: 'capitalize' }}>{k}</MenuItem>)}
      </TextField>
      {list.isLoading ? <ListSkeleton rows={2} height={200} /> : list.isError ? <ErrorAlert error={list.error} onRetry={() => list.refetch()} /> : list.data!.length === 0 ? (
        <EmptyState title="No backgrounds" description="Create a colour, gradient or image background to use on pages and sections." action={<Button variant="contained" onClick={() => setEditing('new')}>New background</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {list.data!.map((b) => (
            <Card key={b.id} variant="outlined">
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center gap-2"><Typography fontWeight={700} noWrap flex={1}>{b.name}</Typography><Chip size="small" label={b.kind} sx={{ textTransform: 'capitalize' }} /></div>
                <Preview config={b.config} media={b.media} />
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => setEditing(b)}>Edit</Button>
                <Button size="small" color="error" sx={{ ml: 'auto' }} onClick={() => { setDeleteError(null); setDeleting(b); }}>Delete</Button>
              </CardActions>
            </Card>
          ))}
        </div>
      )}
      {editing && <BackgroundDialog key={editing === 'new' ? 'new' : editing.id} bg={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!deleting} title="Delete background?" message={<>“{deleting?.name}” will be removed. Backgrounds in use by pages or sections can’t be deleted.</>} busy={remove.isPending} error={deleteError} onConfirm={() => deleting && remove.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  );
}
