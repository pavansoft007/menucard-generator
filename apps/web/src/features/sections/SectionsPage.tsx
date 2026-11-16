import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Card, Chip, IconButton, MenuItem, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import type { CategoryDTO, ItemDTO, PageDTO, SectionDTO, SectionInput } from '@gc/shared-types';
import { categoryService, comboService, itemService, keys, pageService, sectionService } from '../../services/menuService';
import { useUiStore } from '../../store/uiStore';
import { ConfirmDialog, ErrorAlert, ListSkeleton, PageHeader } from '../../components/common';
import EmptyState from '../../components/EmptyState';
import SectionDialog from './SectionDialog';

const toInput = (s: SectionDTO, pageId: number | null): SectionInput => ({
  pageId, title: s.title, subtitle: s.subtitle, description: s.description, imageMediaId: s.image?.id ?? null,
  backgroundId: s.backgroundId, categoryIds: s.categoryIds, itemIds: s.itemIds, comboIds: s.comboIds, config: s.config,
});

function Row({ s, pages, categories, onEdit, onDuplicate, onDelete, onMove }: { s: SectionDTO; pages: PageDTO[]; categories: CategoryDTO[]; onEdit: () => void; onDuplicate: () => void; onDelete: () => void; onMove: (pageId: number | null) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const cats = s.categoryIds.map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean);
  return (
    <Card ref={setNodeRef} variant="outlined" style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, position: 'relative', zIndex: isDragging ? 1 : undefined }} className="flex flex-wrap items-center gap-2 p-2">
      <Tooltip title="Drag to reorder"><IconButton size="small" aria-label={`Reorder ${s.title}`} {...attributes} {...listeners} sx={{ cursor: 'grab', touchAction: 'none' }}><DragIndicatorIcon /></IconButton></Tooltip>
      <div className="min-w-[180px] flex-1">
        <Typography fontWeight={700} noWrap>{s.title}</Typography>
        <div className="flex flex-wrap gap-1">
          {cats.map((n) => <Chip key={n} size="small" variant="outlined" label={n} />)}
          {s.itemIds.length > 0 && <Chip size="small" variant="outlined" label={`${s.itemIds.length} item${s.itemIds.length === 1 ? '' : 's'}`} />}
          {!cats.length && !s.itemIds.length && <Typography variant="caption" color="text.disabled">No content assigned</Typography>}
          <Chip size="small" label={s.config.cardTemplate} />
        </div>
      </div>
      <TextField select size="small" label="Move to page" value={s.pageId ?? ''} onChange={(e) => onMove(e.target.value === '' ? null : Number(e.target.value))} sx={{ minWidth: 170 }} slotProps={{ select: { displayEmpty: true } }}>
        <MenuItem value="">Unassigned</MenuItem>
        {pages.map((p) => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
      </TextField>
      <Tooltip title="Edit"><IconButton aria-label={`Edit ${s.title}`} onClick={onEdit}><EditIcon /></IconButton></Tooltip>
      <Tooltip title="Duplicate"><IconButton aria-label={`Duplicate ${s.title}`} onClick={onDuplicate}><ContentCopyIcon /></IconButton></Tooltip>
      <Tooltip title="Delete"><IconButton aria-label={`Delete ${s.title}`} onClick={onDelete}><DeleteIcon /></IconButton></Tooltip>
    </Card>
  );
}

/** One page's sections with their own sortable list. */
function Group({ title, pageId, sections, ...rest }: { title: string; pageId: number | null; sections: SectionDTO[]; pages: PageDTO[]; categories: CategoryDTO[]; onEdit: (s: SectionDTO) => void; onDuplicate: (s: SectionDTO) => void; onDelete: (s: SectionDTO) => void; onMove: (s: SectionDTO, p: number | null) => void; onAdd: () => void }) {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const [order, setOrder] = useState(sections);
  useEffect(() => setOrder(sections), [sections]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const reorder = useMutation({
    mutationFn: (ids: number[]) => sectionService.reorder(pageId, ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sections }),
    onError: (e) => { notify(e.message, 'error'); qc.invalidateQueries({ queryKey: keys.sections }); },
  });
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const next = arrayMove(order, order.findIndex((s) => s.id === e.active.id), order.findIndex((s) => s.id === e.over!.id));
    setOrder(next);
    reorder.mutate(next.map((s) => s.id));
  };
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <Typography variant="h6" fontWeight={700} flex={1}>{title}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={rest.onAdd}>Add section</Button>
      </div>
      {order.length === 0 ? <Typography color="text.secondary" variant="body2" sx={{ pl: 1 }}>No sections on this page yet.</Typography> : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {order.map((s) => <Row key={s.id} s={s} pages={rest.pages} categories={rest.categories} onEdit={() => rest.onEdit(s)} onDuplicate={() => rest.onDuplicate(s)} onDelete={() => rest.onDelete(s)} onMove={(p) => rest.onMove(s, p)} />)}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

export default function SectionsPage() {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const [params, setParams] = useSearchParams();
  const filter = params.get('page') ?? '';
  const pages = useQuery({ queryKey: [...keys.pages, 'list'], queryFn: () => pageService.list(false) });
  const sections = useQuery({ queryKey: keys.sections, queryFn: () => sectionService.list() });
  const categories = useQuery({ queryKey: keys.categories, queryFn: () => categoryService.list() });
  const items = useQuery({ queryKey: [...keys.items, 'all'], queryFn: () => itemService.list({ page: 1, pageSize: 500 }) });
  const combos = useQuery({ queryKey: keys.combos, queryFn: comboService.list });
  const [editing, setEditing] = useState<{ section: SectionDTO | null; pageId: number | null } | null>(null);
  const [deleting, setDeleting] = useState<SectionDTO | null>(null);

  const refresh = () => { qc.invalidateQueries({ queryKey: keys.sections }); qc.invalidateQueries({ queryKey: keys.pages }); };
  const duplicate = useMutation({ mutationFn: (s: SectionDTO) => sectionService.duplicate(s.id), onSuccess: () => { refresh(); notify('Section duplicated'); }, onError: (e) => notify(e.message, 'error') });
  const move = useMutation({ mutationFn: ({ s, p }: { s: SectionDTO; p: number | null }) => sectionService.update(s.id, toInput(s, p)), onSuccess: () => { refresh(); notify('Section moved'); }, onError: (e) => notify(e.message, 'error') });
  const remove = useMutation({ mutationFn: (s: SectionDTO) => sectionService.remove(s.id), onSuccess: () => { refresh(); setDeleting(null); notify('Section deleted'); }, onError: (e) => notify(e.message, 'error') });

  const loading = pages.isLoading || sections.isLoading || categories.isLoading || items.isLoading;
  const error = pages.error ?? sections.error ?? categories.error ?? items.error;
  const pageList = pages.data ?? [];
  const all = sections.data ?? [];
  const groups: { key: string; title: string; pageId: number | null }[] = [
    ...pageList.map((p) => ({ key: String(p.id), title: p.title, pageId: p.id as number | null })),
    { key: 'none', title: 'Unassigned', pageId: null },
  ].filter((g) => !filter || g.key === filter);

  return (
    <>
      <PageHeader title="Menu Sections" subtitle="Blocks of menu content on each page – what they show, how cards look, and in what order." actions={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({ section: null, pageId: filter && filter !== 'none' ? Number(filter) : null })}>New section</Button>} />
      <TextField select size="small" label="Show page" value={filter} onChange={(e) => (e.target.value ? setParams({ page: e.target.value }) : setParams({}))} sx={{ minWidth: 240, mb: 3 }}>
        <MenuItem value="">All pages</MenuItem>
        {pageList.map((p) => <MenuItem key={p.id} value={String(p.id)}>{p.title}</MenuItem>)}
        <MenuItem value="none">Unassigned</MenuItem>
      </TextField>
      {loading ? <ListSkeleton /> : error ? <ErrorAlert error={error} onRetry={() => { pages.refetch(); sections.refetch(); }} /> : pageList.length === 0 && all.length === 0 ? (
        <EmptyState title="No pages or sections yet" description="Create pages in the Page Builder first, then add sections to them here." />
      ) : (
        groups.filter((g) => g.pageId !== null || all.some((s) => s.pageId === null) || filter === 'none').map((g) => (
          <Group key={g.key} title={g.title} pageId={g.pageId} sections={all.filter((s) => s.pageId === g.pageId)} pages={pageList} categories={categories.data ?? []}
            onAdd={() => setEditing({ section: null, pageId: g.pageId })} onEdit={(s) => setEditing({ section: s, pageId: s.pageId })} onDuplicate={(s) => duplicate.mutate(s)} onDelete={setDeleting} onMove={(s, p) => move.mutate({ s, p })} />
        ))
      )}
      {editing && (
        <SectionDialog key={editing.section?.id ?? 'new'} section={editing.section} defaultPageId={editing.pageId} pages={pageList} categories={categories.data ?? []} items={(items.data?.data ?? []) as ItemDTO[]} combos={combos.data ?? []} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog open={!!deleting} title="Delete section?" message={<>“{deleting?.title}” will be removed from its page. Your categories and items are not affected.</>} busy={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  );
}
