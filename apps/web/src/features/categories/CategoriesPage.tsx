import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { categoryInputSchema, type CategoryDTO, type CategoryInput, type MediaDTO } from '@gc/shared-types';
import { categoryService, keys } from '../../services/menuService';
import { useUiStore } from '../../store/uiStore';
import { checker, ConfirmDialog, ErrorAlert, ListSkeleton, PageHeader } from '../../components/common';
import EmptyState from '../../components/EmptyState';
import { ImageField } from '../../components/ImageField';

const ICONS = ['LocalFireDepartment', 'Fastfood', 'LunchDining', 'BakeryDining', 'LocalBar', 'Icecream', 'LocalDrink', 'RamenDining', 'Restaurant', 'Cake', 'EmojiFoodBeverage', 'SetMeal'];

type MediaKey = 'image' | 'iconMedia' | 'banner' | 'background';
const mediaFields: { key: MediaKey; field: keyof CategoryInput; label: string }[] = [
  { key: 'image', field: 'imageMediaId', label: 'Image' },
  { key: 'banner', field: 'bannerMediaId', label: 'Banner' },
  { key: 'background', field: 'backgroundMediaId', label: 'Background' },
  { key: 'iconMedia', field: 'iconMediaId', label: 'Icon image' },
];

function CategoryDialog({ category, onClose }: { category: CategoryDTO | null; onClose: () => void }) {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const [media, setMedia] = useState<Record<MediaKey, MediaDTO | null>>({
    image: category?.image ?? null,
    iconMedia: category?.iconMedia ?? null,
    banner: category?.banner ?? null,
    background: category?.background ?? null,
  });
  const form = useForm<CategoryInput>({
    resolver: zodResolver(categoryInputSchema),
    defaultValues: {
      name: category?.name ?? '',
      description: category?.description ?? '',
      icon: category?.icon ?? '',
      imageMediaId: category?.image?.id ?? null,
      iconMediaId: category?.iconMedia?.id ?? null,
      bannerMediaId: category?.banner?.id ?? null,
      backgroundMediaId: category?.background?.id ?? null,
      isActive: category?.isActive ?? true,
    },
  });

  const save = useMutation({
    mutationFn: (v: CategoryInput) => (category ? categoryService.update(category.id, v) : categoryService.create(v)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.categories });
      qc.invalidateQueries({ queryKey: keys.stats });
      notify(category ? 'Category updated' : 'Category created');
      onClose();
    },
    onError: (e) => notify(e.message, 'error'),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <DialogTitle>{category ? 'Edit category' : 'New category'}</DialogTitle>
        <DialogContent className="flex flex-col gap-4 !pt-2">
          <TextField label="Name" autoFocus {...form.register('name')} error={!!form.formState.errors.name} helperText={form.formState.errors.name?.message} />
          <TextField label="Description" multiline minRows={2} {...form.register('description')} error={!!form.formState.errors.description} helperText={form.formState.errors.description?.message} />
          <Controller
            control={form.control}
            name="icon"
            render={({ field }) => (
              <Autocomplete freeSolo options={ICONS} value={field.value ?? ''} onInputChange={(_, v) => field.onChange(v)} renderInput={(p) => <TextField {...p} label="Icon name" helperText="A Material icon name, e.g. Fastfood" />} />
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            {mediaFields.map(({ key, field, label }) => (
              <ImageField
                key={key}
                label={label}
                value={media[key]}
                onChange={(m) => {
                  setMedia((s) => ({ ...s, [key]: m }));
                  form.setValue(field, (m?.id ?? null) as never, { shouldDirty: true });
                }}
              />
            ))}
          </div>
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => <FormControlLabel control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />} label="Active (shown on menus)" />}
          />
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

function Row({ c, onEdit, onDelete, onToggle }: { c: CategoryDTO; onEdit: () => void; onDelete: () => void; onToggle: (v: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  return (
    <Card
      ref={setNodeRef}
      variant="outlined"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 1 : undefined, position: 'relative' }}
      className="flex items-center gap-3 p-2"
    >
      <Tooltip title="Drag to reorder (or focus and press Space, then arrow keys)">
        <IconButton size="small" aria-label={`Reorder ${c.name}`} {...attributes} {...listeners} sx={{ cursor: 'grab', touchAction: 'none' }}>
          <DragIndicatorIcon />
        </IconButton>
      </Tooltip>
      <Box sx={{ ...checker, width: 48, height: 48, borderRadius: 1, flexShrink: 0 }} className="flex items-center justify-center overflow-hidden">
        {c.image && <img src={c.image.thumbUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
      </Box>
      <div className="min-w-0 flex-1">
        <Typography fontWeight={700} noWrap>
          {c.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap display="block">
          {c.description || 'No description'}
        </Typography>
      </div>
      <Chip size="small" label={`${c.itemCount} item${c.itemCount === 1 ? '' : 's'}`} />
      <Tooltip title={c.isActive ? 'Active' : 'Hidden'}>
        <Switch checked={c.isActive} onChange={(e) => onToggle(e.target.checked)} inputProps={{ 'aria-label': `${c.name} active` }} />
      </Tooltip>
      <IconButton aria-label={`Edit ${c.name}`} onClick={onEdit}>
        <EditIcon />
      </IconButton>
      <IconButton aria-label={`Delete ${c.name}`} onClick={onDelete}>
        <DeleteIcon />
      </IconButton>
    </Card>
  );
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const query = useQuery({ queryKey: keys.categories, queryFn: () => categoryService.list() });
  const [order, setOrder] = useState<CategoryDTO[]>([]);
  const [editing, setEditing] = useState<CategoryDTO | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CategoryDTO | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (query.data) setOrder(query.data);
  }, [query.data]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const reorder = useMutation({
    mutationFn: (ids: number[]) => categoryService.reorder({ ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
    onError: (e) => {
      notify(e.message, 'error');
      qc.invalidateQueries({ queryKey: keys.categories }); // snap back to the server order
    },
  });
  const remove = useMutation({
    mutationFn: (c: CategoryDTO) => categoryService.remove(c.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.categories });
      qc.invalidateQueries({ queryKey: keys.stats });
      setDeleting(null);
      notify('Category deleted');
    },
    onError: (e) => setDeleteError(e.message),
  });
  const toggle = useMutation({
    mutationFn: ({ c, v }: { c: CategoryDTO; v: boolean }) =>
      categoryService.update(c.id, {
        name: c.name, description: c.description, icon: c.icon, isActive: v,
        imageMediaId: c.image?.id ?? null, iconMediaId: c.iconMedia?.id ?? null, bannerMediaId: c.banner?.id ?? null, backgroundMediaId: c.background?.id ?? null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
    onError: (e) => notify(e.message, 'error'),
  });

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = order.findIndex((c) => c.id === e.active.id);
    const to = order.findIndex((c) => c.id === e.over!.id);
    const next = arrayMove(order, from, to);
    setOrder(next); // optimistic
    reorder.mutate(next.map((c) => c.id));
  };

  return (
    <>
      <PageHeader
        title="Menu Categories"
        subtitle="Drag to set the order categories appear in on your menu."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
            New category
          </Button>
        }
      />
      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorAlert error={query.error} onRetry={() => query.refetch()} />
      ) : order.length === 0 ? (
        <EmptyState title="No categories yet" description="Create categories such as Crispy Fried Chicken or Milk Shakes, then add items to them." action={<Button variant="contained" onClick={() => setEditing('new')}>New category</Button>} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {order.map((c) => (
                <Row key={c.id} c={c} onEdit={() => setEditing(c)} onDelete={() => { setDeleteError(null); setDeleting(c); }} onToggle={(v) => toggle.mutate({ c, v })} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      {editing && <CategoryDialog key={editing === 'new' ? 'new' : editing.id} category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title="Delete category?"
        message={<>“{deleting?.name}” will be removed. Categories that still contain items cannot be deleted.</>}
        busy={remove.isPending}
        error={deleteError}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
