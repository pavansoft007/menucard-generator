import { useState } from 'react';
import { Controller, useFieldArray, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { itemInputSchema, type CategoryDTO, type ItemDTO, type ItemInput, type MediaDTO } from '@gc/shared-types';
import { itemService, keys } from '../../services/menuService';
import { useUiStore } from '../../store/uiStore';
import { GalleryField, ImageField } from '../../components/ImageField';

const UNITS = ['Pieces', 'Glass', 'Plate', 'Regular Serving', 'Full', 'Mini', 'ML', 'Litre', 'Grams'];
const FLAGS: { name: 'isBestseller' | 'isSpicy' | 'isNew' | 'isFeatured' | 'isAvailable' | 'isActive'; label: string }[] = [
  { name: 'isBestseller', label: 'Bestseller' },
  { name: 'isSpicy', label: 'Spicy' },
  { name: 'isNew', label: 'New' },
  { name: 'isFeatured', label: 'Featured' },
  { name: 'isAvailable', label: 'Available today' },
  { name: 'isActive', label: 'Active (on menus)' },
];

/** Number input that maps "" <-> null so empty means "not set" instead of 0 or NaN. */
function NullableNumber({ control, name, label, integer, error, helper }: { control: Control<ItemInput>; name: `variants.${number}.${'price' | 'discountPrice' | 'quantity'}`; label: string; integer?: boolean; error?: string; helper?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <TextField
          size="small"
          type="number"
          label={label}
          value={field.value ?? ''}
          onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
          onBlur={field.onBlur}
          error={!!error}
          helperText={error ?? helper}
          slotProps={{ htmlInput: { min: 0, step: integer ? 1 : 0.01 }, inputLabel: { shrink: true } }}
        />
      )}
    />
  );
}

export default function ItemDialog({ item, categories, defaultCategoryId, onClose }: { item: ItemDTO | null; categories: CategoryDTO[]; defaultCategoryId?: number; onClose: () => void }) {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  // Preview objects for the ids held in the form.
  const [mainMedia, setMainMedia] = useState<MediaDTO | null>(item?.mainMedia ?? null);
  const [gallery, setGallery] = useState<MediaDTO[]>(item?.gallery ?? []);
  const [variantMedia, setVariantMedia] = useState<Record<number, MediaDTO>>(
    Object.fromEntries((item?.variants ?? []).flatMap((v) => (v.media ? [[v.media.id, v.media]] : []))),
  );

  const form = useForm<ItemInput>({
    resolver: zodResolver(itemInputSchema),
    defaultValues: item
      ? {
          categoryId: item.categoryId,
          name: item.name,
          shortDescription: item.shortDescription ?? '',
          description: item.description ?? '',
          mainMediaId: item.mainMedia?.id ?? null,
          galleryMediaIds: item.gallery.map((g) => g.id),
          dietType: item.dietType,
          isBestseller: item.isBestseller,
          isSpicy: item.isSpicy,
          isNew: item.isNew,
          isFeatured: item.isFeatured,
          isAvailable: item.isAvailable,
          isActive: item.isActive,
          variants: item.variants.map((v) => ({ id: v.id, label: v.label, quantity: v.quantity, unit: v.unit ?? '', price: v.price, discountPrice: v.discountPrice, mediaId: v.media?.id ?? null, isActive: v.isActive })),
        }
      : {
          categoryId: (defaultCategoryId ?? categories[0]?.id) as number,
          name: '',
          shortDescription: '',
          description: '',
          mainMediaId: null,
          galleryMediaIds: [],
          dietType: null,
          isBestseller: false,
          isSpicy: false,
          isNew: false,
          isFeatured: false,
          isAvailable: true,
          isActive: true,
          variants: [{ label: 'Regular Serving', quantity: null, unit: '', price: null, discountPrice: null, mediaId: null, isActive: true }],
        },
  });
  const { control, formState, register, setValue, watch } = form;
  const variants = useFieldArray({ control, name: 'variants' });
  const errors = formState.errors;

  const save = useMutation({
    mutationFn: (v: ItemInput) => (item ? itemService.update(item.id, v) : itemService.create(v)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.items });
      qc.invalidateQueries({ queryKey: keys.categories });
      qc.invalidateQueries({ queryKey: keys.stats });
      notify(item ? 'Item updated' : 'Item created');
      onClose();
    },
    onError: (e) => notify(e.message, 'error'),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <DialogTitle>{item ? `Edit ${item.name}` : 'New menu item'}</DialogTitle>
        <DialogContent dividers className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Item name" autoFocus {...register('name')} error={!!errors.name} helperText={errors.name?.message} />
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <TextField select label="Category" value={field.value ?? ''} onChange={(e) => field.onChange(Number(e.target.value))} error={!!errors.categoryId} helperText={errors.categoryId ? 'Choose a category' : undefined}>
                  {categories.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <TextField label="Short description" {...register('shortDescription')} error={!!errors.shortDescription} helperText={errors.shortDescription?.message} className="sm:col-span-2" />
            <TextField label="Detailed description" multiline minRows={2} {...register('description')} error={!!errors.description} helperText={errors.description?.message} className="sm:col-span-2" />
            <Controller
              control={control}
              name="dietType"
              render={({ field }) => (
                <TextField select label="Vegetarian / Non-vegetarian" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}>
                  <MenuItem value="">Not specified</MenuItem>
                  <MenuItem value="veg">Vegetarian</MenuItem>
                  <MenuItem value="non_veg">Non-vegetarian</MenuItem>
                </TextField>
              )}
            />
          </div>

          <div className="flex flex-wrap gap-x-4">
            {FLAGS.map((f) => (
              <Controller key={f.name} control={control} name={f.name} render={({ field }) => <FormControlLabel control={<Switch size="small" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />} label={f.label} />} />
            ))}
          </div>

          <Divider />
          <Typography fontWeight={700}>Images</Typography>
          <div className="flex flex-wrap gap-6">
            <ImageField
              label="Main food image"
              size={120}
              value={mainMedia}
              onChange={(m) => {
                setMainMedia(m);
                setValue('mainMediaId', m?.id ?? null, { shouldDirty: true });
              }}
              helperText="Each item has its own image – none are reused automatically"
            />
            <div className="min-w-[260px] flex-1">
              <GalleryField
                label="Gallery images"
                value={gallery}
                onChange={(m) => {
                  setGallery(m);
                  setValue('galleryMediaIds', m.map((x) => x.id), { shouldDirty: true });
                }}
              />
            </div>
          </div>

          <Divider />
          <div className="flex items-center justify-between">
            <div>
              <Typography fontWeight={700}>Sizes & prices</Typography>
              <Typography variant="caption" color="text.secondary">
                One item, many options – e.g. 4 / 6 / 12 pieces. Leave price empty if it isn’t decided yet.
              </Typography>
            </div>
            <Button size="small" startIcon={<AddIcon />} onClick={() => variants.append({ label: '', quantity: null, unit: '', price: null, discountPrice: null, mediaId: null, isActive: true })}>
              Add option
            </Button>
          </div>
          {typeof errors.variants?.message === 'string' && <Typography color="error" variant="caption">{errors.variants.message}</Typography>}
          {errors.variants?.root?.message && <Typography color="error" variant="caption">{errors.variants.root.message}</Typography>}

          {variants.fields.map((f, i) => {
            const ve = errors.variants?.[i];
            const mid = watch(`variants.${i}.mediaId`);
            return (
              <Box key={f.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }} className="flex flex-col gap-2">
                <div className="grid gap-2 sm:grid-cols-[1.4fr_.7fr_1fr_.9fr_.9fr_auto]">
                  <TextField size="small" label="Label" placeholder="e.g. 6 Pieces" {...register(`variants.${i}.label`)} error={!!ve?.label} helperText={ve?.label?.message} slotProps={{ inputLabel: { shrink: true } }} />
                  <NullableNumber control={control} name={`variants.${i}.quantity`} label="Qty" integer error={ve?.quantity?.message} />
                  <Controller
                    control={control}
                    name={`variants.${i}.unit`}
                    render={({ field }) => (
                      <Autocomplete size="small" freeSolo options={UNITS} value={field.value ?? ''} onInputChange={(_, v) => field.onChange(v)} renderInput={(p) => <TextField {...p} label="Unit" slotProps={{ inputLabel: { shrink: true } }} />} />
                    )}
                  />
                  <NullableNumber control={control} name={`variants.${i}.price`} label="Price (₹)" error={ve?.price?.message} />
                  <NullableNumber control={control} name={`variants.${i}.discountPrice`} label="Discounted (₹)" error={ve?.discountPrice?.message} />
                  <Tooltip title={variants.fields.length === 1 ? 'An item needs at least one option' : 'Remove option'}>
                    <span>
                      <IconButton aria-label="Remove option" disabled={variants.fields.length === 1} onClick={() => variants.remove(i)}>
                        <DeleteIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <Controller control={control} name={`variants.${i}.isActive`} render={({ field }) => <FormControlLabel control={<Switch size="small" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />} label="Active" />} />
                  <ImageField
                    label="Option image (optional)"
                    size={44}
                    value={mid ? (variantMedia[mid] ?? null) : null}
                    onChange={(m) => {
                      if (m) setVariantMedia((s) => ({ ...s, [m.id]: m }));
                      setValue(`variants.${i}.mediaId`, m?.id ?? null, { shouldDirty: true });
                    }}
                  />
                </div>
              </Box>
            );
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save item'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
