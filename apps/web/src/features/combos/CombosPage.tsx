import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Autocomplete, Box, Button, Card, CardActions, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { comboInputSchema, type ComboDTO, type ComboInput, type ItemDTO, type MediaDTO } from '@gc/shared-types';
import { comboService, itemService, keys } from '../../services/menuService';
import { useUiStore } from '../../store/uiStore';
import { checker, ConfirmDialog, ErrorAlert, ListSkeleton, PageHeader, rupees } from '../../components/common';
import EmptyState from '../../components/EmptyState';
import { ImageField } from '../../components/ImageField';
import { NumberField, SwitchField } from '../../components/fields';

function ComboDialog({ combo, items, onClose }: { combo: ComboDTO | null; items: ItemDTO[]; onClose: () => void }) {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const [image, setImage] = useState<MediaDTO | null>(combo?.image ?? null);
  const form = useForm<ComboInput>({
    resolver: zodResolver(comboInputSchema),
    defaultValues: combo
      ? { name: combo.name, description: combo.description ?? '', imageMediaId: combo.image?.id ?? null, sellingPrice: combo.sellingPrice, isActive: combo.isActive, items: combo.items.map((i) => ({ itemId: i.itemId, variantId: i.variantId, quantity: i.quantity })) }
      : { name: '', description: '', imageMediaId: null, sellingPrice: 0, isActive: true, items: [] },
  });
  const { control, register, watch, setValue, formState } = form;
  const rows = useFieldArray({ control, name: 'items' });
  const watched = watch('items');
  const selling = Number(watch('sellingPrice')) || 0;

  // Live totals (the server recomputes the same numbers on save).
  const lines = watched.map((r) => {
    const price = items.find((i) => i.id === r.itemId)?.variants.find((v) => v.id === r.variantId)?.price ?? null;
    return price == null ? null : price * (Number(r.quantity) || 0);
  });
  const regular = watched.length && lines.every((l) => l !== null) ? Math.round((lines as number[]).reduce((s, n) => s + n, 0) * 100) / 100 : null;

  const save = useMutation({
    mutationFn: (v: ComboInput) => (combo ? comboService.update(combo.id, v) : comboService.create(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.combos }); notify(combo ? 'Combo updated' : 'Combo created'); onClose(); },
    onError: (e) => notify(e.message, 'error'),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <DialogTitle>{combo ? `Edit ${combo.name}` : 'New combo'}</DialogTitle>
        <DialogContent dividers className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-3">
              <TextField size="small" label="Combo name" {...register('name')} error={!!formState.errors.name} helperText={formState.errors.name?.message} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField size="small" label="Description" multiline minRows={2} {...register('description')} slotProps={{ inputLabel: { shrink: true } }} />
            </div>
            <ImageField label="Combo image" size={110} value={image} onChange={(m) => { setImage(m); setValue('imageMediaId', m?.id ?? null, { shouldDirty: true }); }} />
          </div>

          <div className="flex items-center justify-between">
            <Typography fontWeight={700}>Included items</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={() => { const first = items[0]; if (first) rows.append({ itemId: first.id, variantId: first.variants[0]!.id, quantity: 1 }); }} disabled={!items.length}>Add item</Button>
          </div>
          {typeof formState.errors.items?.message === 'string' && <Typography color="error" variant="caption">{formState.errors.items.message}</Typography>}
          {rows.fields.map((f, i) => {
            const cur = items.find((it) => it.id === watched[i]?.itemId);
            return (
              <div key={f.id} className="grid items-start gap-2 sm:grid-cols-[1.6fr_1.2fr_.6fr_auto_auto]">
                <Autocomplete
                  size="small"
                  options={items}
                  value={cur ?? null}
                  getOptionLabel={(o) => o.name}
                  groupBy={(o) => o.category?.name ?? ''}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  onChange={(_, v) => { if (v) { setValue(`items.${i}.itemId`, v.id, { shouldDirty: true }); setValue(`items.${i}.variantId`, v.variants[0]!.id, { shouldDirty: true }); } }}
                  renderInput={(p) => <TextField {...p} label="Item" slotProps={{ inputLabel: { shrink: true } }} />}
                />
                <Controller control={control} name={`items.${i}.variantId`} render={({ field }) => (
                  <TextField select size="small" label="Size" value={field.value ?? ''} onChange={(e) => field.onChange(Number(e.target.value))} slotProps={{ inputLabel: { shrink: true } }}>
                    {(cur?.variants ?? []).map((v) => <MenuItem key={v.id} value={v.id}>{v.label} – {v.price == null ? 'no price' : rupees(v.price)}</MenuItem>)}
                  </TextField>
                )} />
                <NumberField control={control} name={`items.${i}.quantity`} label="Qty" min={1} max={50} />
                <Typography variant="body2" sx={{ pt: 1, minWidth: 64, textAlign: 'right' }}>{lines[i] == null ? '—' : rupees(lines[i])}</Typography>
                <IconButton aria-label="Remove item" onClick={() => rows.remove(i)}><DeleteIcon /></IconButton>
              </div>
            );
          })}

          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }} className="grid items-center gap-3 sm:grid-cols-[1fr_1fr_1fr]">
            <div><Typography variant="caption" color="text.secondary">Regular total</Typography><Typography fontWeight={700}>{regular == null ? (watched.length ? 'Some prices not set' : '—') : rupees(regular)}</Typography></div>
            <NumberField control={control} name="sellingPrice" label="Combo selling price (₹)" min={0} step={0.01} />
            <div><Typography variant="caption" color="text.secondary">Customer saves</Typography><Typography fontWeight={700} color={regular != null && regular - selling > 0 ? 'success.main' : undefined}>{regular == null ? '—' : rupees(Math.round((regular - selling) * 100) / 100)}</Typography></div>
          </Box>
          <SwitchField control={control} name="isActive" label="Active (shown on menus)" />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save combo'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default function CombosPage() {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const combos = useQuery({ queryKey: keys.combos, queryFn: comboService.list });
  const items = useQuery({ queryKey: [...keys.items, 'all'], queryFn: () => itemService.list({ page: 1, pageSize: 500 }) });
  const [editing, setEditing] = useState<ComboDTO | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ComboDTO | null>(null);
  const remove = useMutation({
    mutationFn: (c: ComboDTO) => comboService.remove(c.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.combos }); qc.invalidateQueries({ queryKey: keys.media }); setDeleting(null); notify('Combo deleted'); },
    onError: (e) => notify(e.message, 'error'),
  });
  const allItems = items.data?.data ?? [];

  return (
    <>
      <PageHeader title="Combos" subtitle="Bundle items into offers. Included items and the saving are shown on the menu automatically." actions={<Button variant="contained" startIcon={<AddIcon />} disabled={!allItems.length} onClick={() => setEditing('new')}>New combo</Button>} />
      {combos.isLoading ? <ListSkeleton rows={3} height={110} /> : combos.isError ? <ErrorAlert error={combos.error} onRetry={() => combos.refetch()} /> : combos.data!.length === 0 ? (
        <EmptyState title="No combos yet" description="Create a combo such as Chicken Wings + Fries + Cool Drink and set your own price." action={<Button variant="contained" disabled={!allItems.length} onClick={() => setEditing('new')}>New combo</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {combos.data!.map((c) => (
            <Card key={c.id} variant="outlined">
              <CardContent className="flex gap-3">
                <Box sx={{ ...checker, width: 84, height: 84, borderRadius: 1.5, flexShrink: 0 }} className="flex items-center justify-center overflow-hidden">{c.image && <img src={c.image.thumbUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}</Box>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1"><Typography fontWeight={700} noWrap flex={1}>{c.name}</Typography>{!c.isActive && <Chip size="small" label="Inactive" />}</div>
                  <Typography variant="body2" color="text.secondary">{c.items.map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ''}${i.itemName} (${i.variantLabel})`).join(' + ')}</Typography>
                  <Typography fontWeight={800} color="primary.main">{rupees(c.sellingPrice)} {c.regularTotal != null && <Typography component="span" variant="caption" color="text.secondary"><s>{rupees(c.regularTotal)}</s> · save {rupees(c.savings)}</Typography>}</Typography>
                </div>
              </CardContent>
              <CardActions><Button size="small" onClick={() => setEditing(c)}>Edit</Button><Button size="small" color="error" sx={{ ml: 'auto' }} onClick={() => setDeleting(c)}>Delete</Button></CardActions>
            </Card>
          ))}
        </div>
      )}
      {editing && <ComboDialog key={editing === 'new' ? 'new' : editing.id} combo={editing === 'new' ? null : editing} items={allItems} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!deleting} title="Delete combo?" message={<>“{deleting?.name}” will be removed from your menu.</>} busy={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  );
}
