import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { logoCreateSchema, logoPositions, type LogoCreateInput, type LogoDTO, type MediaDTO } from '@gc/shared-types';
import { keys, logoService } from '../../services/menuService';
import { useUiStore } from '../../store/uiStore';
import { checker, ConfirmDialog, ErrorAlert, ListSkeleton, PageHeader } from '../../components/common';
import EmptyState from '../../components/EmptyState';
import { ImageField } from '../../components/ImageField';

function LogoDialog({ logo, open, onClose }: { logo: LogoDTO | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const [media, setMedia] = useState<MediaDTO | null>(logo?.media ?? null);
  const form = useForm<LogoCreateInput>({
    resolver: zodResolver(logoCreateSchema),
    defaultValues: logo
      ? { mediaId: logo.media.id, label: logo.label, isPrimary: logo.isPrimary, defaultWidthMm: logo.defaultWidthMm, defaultPosition: logo.defaultPosition }
      : { mediaId: undefined, label: '', isPrimary: false, defaultWidthMm: 40, defaultPosition: 'center' },
  });

  const save = useMutation({
    mutationFn: (v: LogoCreateInput) => {
      if (logo) {
        const { mediaId: _m, ...rest } = v;
        void _m;
        return logoService.update(logo.id, rest);
      }
      return logoService.create(v);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.logos });
      qc.invalidateQueries({ queryKey: keys.restaurant });
      notify(logo ? 'Logo updated' : 'Logo added');
      onClose();
    },
    onError: (e) => notify(e.message, 'error'),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <DialogTitle>{logo ? 'Edit logo' : 'Add logo'}</DialogTitle>
        <DialogContent className="flex flex-col gap-4 !pt-2">
          {logo ? (
            <Box sx={{ ...checker, height: 120, borderRadius: 1.5 }} className="flex items-center justify-center">
              <img src={logo.media.url} alt={logo.label} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
            </Box>
          ) : (
            <ImageField
              label="Logo image"
              size={120}
              value={media}
              helperText={form.formState.errors.mediaId ? 'Choose an image' : 'Transparent PNG or SVG works best'}
              onChange={(m) => {
                setMedia(m);
                form.setValue('mediaId', m?.id as number, { shouldValidate: true });
              }}
            />
          )}
          <TextField label="Label" placeholder="e.g. Gold on black, Horizontal" {...form.register('label')} error={!!form.formState.errors.label} helperText={form.formState.errors.label?.message} />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Default width (mm)"
              type="number"
              {...form.register('defaultWidthMm', { valueAsNumber: true })}
              error={!!form.formState.errors.defaultWidthMm}
              helperText={form.formState.errors.defaultWidthMm?.message ?? '5 – 200'}
            />
            <Controller
              control={form.control}
              name="defaultPosition"
              render={({ field }) => (
                <TextField select label="Default position" {...field}>
                  {logoPositions.map((p) => (
                    <MenuItem key={p} value={p} sx={{ textTransform: 'capitalize' }}>
                      {p}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </div>
          <Controller
            control={form.control}
            name="isPrimary"
            render={({ field }) => (
              <FormControlLabel control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} disabled={logo?.isPrimary} />} label="Primary logo" />
            )}
          />
          <Typography variant="caption" color="text.secondary">
            Placement and visibility per page are set in the page builder; these are the defaults.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default function LogosPage() {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const logos = useQuery({ queryKey: keys.logos, queryFn: logoService.list });
  const [editing, setEditing] = useState<LogoDTO | 'new' | null>(null);
  const [deleting, setDeleting] = useState<LogoDTO | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.logos });
    qc.invalidateQueries({ queryKey: keys.restaurant });
  };
  const makePrimary = useMutation({
    mutationFn: (l: LogoDTO) => logoService.update(l.id, { isPrimary: true }),
    onSuccess: () => {
      refresh();
      notify('Primary logo changed');
    },
    onError: (e) => notify(e.message, 'error'),
  });
  const remove = useMutation({
    mutationFn: (l: LogoDTO) => logoService.remove(l.id),
    onSuccess: () => {
      refresh();
      setDeleting(null);
      notify('Logo deleted');
    },
    onError: (e) => setDeleteError(e.message),
  });

  return (
    <>
      <PageHeader
        title="Logo Management"
        subtitle="Upload logo variations and choose the primary one. Logos are never hardcoded into a menu design."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
            Add logo
          </Button>
        }
      />
      {logos.isLoading ? (
        <ListSkeleton rows={2} height={200} />
      ) : logos.isError ? (
        <ErrorAlert error={logos.error} onRetry={() => logos.refetch()} />
      ) : logos.data!.length === 0 ? (
        <EmptyState title="No logos yet" description="Add your Golden Crunch logo. Transparent PNG and SVG files are supported." action={<Button variant="contained" onClick={() => setEditing('new')}>Add logo</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {logos.data!.map((l) => (
            <Card key={l.id} variant="outlined">
              <Box sx={{ ...checker, height: 170 }} className="flex items-center justify-center overflow-hidden">
                <img src={l.media.url} alt={l.label} style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }} />
              </Box>
              <CardContent className="!pb-1">
                <div className="flex items-center gap-2">
                  <Typography fontWeight={700} noWrap flex={1}>
                    {l.label}
                  </Typography>
                  {l.isPrimary && <Chip size="small" color="primary" label="Primary" />}
                </div>
                <Typography variant="caption" color="text.secondary">
                  {l.defaultWidthMm} mm · {l.defaultPosition} · {l.media.kind === 'svg' ? 'SVG' : `${l.media.width}×${l.media.height}`}
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => setEditing(l)}>
                  Edit
                </Button>
                {!l.isPrimary && (
                  <Button size="small" onClick={() => makePrimary.mutate(l)} disabled={makePrimary.isPending}>
                    Make primary
                  </Button>
                )}
                <Button size="small" color="error" sx={{ ml: 'auto' }} onClick={() => { setDeleteError(null); setDeleting(l); }}>
                  Delete
                </Button>
              </CardActions>
            </Card>
          ))}
        </div>
      )}
      {editing && <LogoDialog key={editing === 'new' ? 'new' : editing.id} logo={editing === 'new' ? null : editing} open onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title="Delete logo?"
        message={<>“{deleting?.label}” will be removed. The image stays in the Image Library.</>}
        busy={remove.isPending}
        error={deleteError}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
