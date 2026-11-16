import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItem, ListItemText, Switch, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HistoryIcon from '@mui/icons-material/History';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import BrushIcon from '@mui/icons-material/Brush';
import { resolvePageSize, type PageDTO, type PageInput, type VersionDTO } from '@gc/shared-types';
import { keys, pageService, themeService, versionService } from '../../services/menuService';
import { useUiStore } from '../../store/uiStore';
import { ConfirmDialog, ErrorAlert, ListSkeleton, PageHeader } from '../../components/common';
import EmptyState from '../../components/EmptyState';
import PageDialog from './PageDialog';

const sizeLabel = (p: PageDTO) => {
  const { widthMm, heightMm } = resolvePageSize(p.settings);
  return p.settings.size === 'A4' ? `A4 ${p.settings.orientation}` : `${widthMm}×${heightMm} mm`;
};

function Row({ p, themeName, onEdit, onDuplicate, onDelete, onToggle }: { p: PageDTO; themeName: string; onEdit: () => void; onDuplicate: () => void; onDelete: () => void; onToggle: (v: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  return (
    <Card ref={setNodeRef} variant="outlined" style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : p.isActive ? 1 : 0.65, position: 'relative', zIndex: isDragging ? 1 : undefined }} className="flex flex-wrap items-center gap-3 p-2">
      <Tooltip title="Drag to reorder (or focus, Space, then arrow keys)">
        <IconButton size="small" aria-label={`Reorder ${p.title}`} {...attributes} {...listeners} sx={{ cursor: 'grab', touchAction: 'none' }}><DragIndicatorIcon /></IconButton>
      </Tooltip>
      <div className="min-w-[200px] flex-1">
        <div className="flex items-center gap-2">
          <Typography fontWeight={700} noWrap>{p.title}</Typography>
          {p.pageType !== 'content' && <Chip size="small" color="primary" variant="outlined" label={p.pageType === 'back' ? 'Back cover' : 'Cover'} />}
        </div>
        <Typography variant="caption" color="text.secondary" component="div" noWrap>
          {sizeLabel(p)} · {themeName} · {p.sections?.length ? p.sections.map((s) => s.title).join(', ') : 'no sections yet'}
        </Typography>
      </div>
      <Chip size="small" label={`${p.sectionCount} section${p.sectionCount === 1 ? '' : 's'}`} />
      <Tooltip title={p.isActive ? 'Included in the menu' : 'Hidden from the menu'}><Switch checked={p.isActive} onChange={(e) => onToggle(e.target.checked)} inputProps={{ 'aria-label': `${p.title} included` }} /></Tooltip>
      <Button size="small" variant="outlined" startIcon={<BrushIcon />} component={RouterLink} to={`/editor/${p.id}`} aria-label={`Design ${p.title}`}>Design</Button>
      <Tooltip title="Manage sections"><IconButton aria-label={`Sections of ${p.title}`} component={RouterLink} to={`/sections?page=${p.id}`}><ViewAgendaIcon /></IconButton></Tooltip>
      <Tooltip title="Page settings"><IconButton aria-label={`Edit ${p.title}`} onClick={onEdit}><EditIcon /></IconButton></Tooltip>
      <Tooltip title="Duplicate"><IconButton aria-label={`Duplicate ${p.title}`} onClick={onDuplicate}><ContentCopyIcon /></IconButton></Tooltip>
      <Tooltip title="Delete"><IconButton aria-label={`Delete ${p.title}`} onClick={onDelete}><DeleteIcon /></IconButton></Tooltip>
    </Card>
  );
}

function VersionsDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const [label, setLabel] = useState('');
  const [restoring, setRestoring] = useState<VersionDTO | null>(null);
  const versions = useQuery({ queryKey: keys.versions, queryFn: versionService.list });
  const create = useMutation({
    mutationFn: (status: 'draft' | 'published') => versionService.create({ label: label.trim() || null, status }),
    onSuccess: (v) => { qc.invalidateQueries({ queryKey: keys.versions }); qc.invalidateQueries({ queryKey: keys.stats }); setLabel(''); notify(v.status === 'published' ? 'Menu published' : 'Draft saved'); },
    onError: (e) => notify(e.message, 'error'),
  });
  const restore = useMutation({
    mutationFn: (v: VersionDTO) => versionService.restore(v.id),
    onSuccess: (r) => {
      qc.invalidateQueries();
      setRestoring(null);
      notify(r.droppedReferences ? `Version restored (${r.droppedReferences} reference(s) to deleted items/images were skipped)` : 'Version restored', r.droppedReferences ? 'warning' : 'success');
    },
    onError: (e) => notify(e.message, 'error'),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Versions & publishing</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" mb={1.5}>A version saves your pages and sections. Item names, prices and images stay live, so restoring never changes prices.</Typography>
        <div className="flex flex-wrap gap-2">
          <TextField size="small" label="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} sx={{ flex: 1, minWidth: 180 }} slotProps={{ htmlInput: { maxLength: 120 } }} />
          <Button variant="outlined" disabled={create.isPending} onClick={() => create.mutate('draft')}>Save draft</Button>
          <Button variant="contained" disabled={create.isPending} onClick={() => create.mutate('published')}>Publish</Button>
        </div>
        {versions.isLoading ? <ListSkeleton rows={3} height={48} /> : versions.isError ? <ErrorAlert error={versions.error} onRetry={() => versions.refetch()} /> : versions.data!.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={3}>No saved versions yet.</Typography>
        ) : (
          <List dense sx={{ mt: 1 }}>
            {versions.data!.map((v) => (
              <ListItem key={v.id} divider secondaryAction={<Button size="small" onClick={() => setRestoring(v)}>Restore</Button>}>
                <ListItemText
                  primary={<><b>{v.label || `Version #${v.id}`}</b> <Chip size="small" sx={{ ml: 0.5 }} color={v.status === 'published' ? 'success' : 'default'} label={v.status} /></>}
                  secondary={`${new Date(v.createdAt).toLocaleString()} · ${v.pageCount} pages, ${v.sectionCount} sections${v.createdBy ? ` · ${v.createdBy}` : ''}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
      <ConfirmDialog open={!!restoring} title="Restore this version?" confirmLabel="Restore" busy={restore.isPending} onClose={() => setRestoring(null)} onConfirm={() => restoring && restore.mutate(restoring)}
        message="Your current pages and sections are replaced. A backup of the current design is saved automatically, so you can undo this." />
    </Dialog>
  );
}

export default function PagesPage() {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const pages = useQuery({ queryKey: [...keys.pages, 'withSections'], queryFn: () => pageService.list(true) });
  const themes = useQuery({ queryKey: keys.themes, queryFn: themeService.list });
  const [order, setOrder] = useState<PageDTO[]>([]);
  const [editing, setEditing] = useState<PageDTO | 'new' | null>(null);
  const [deleting, setDeleting] = useState<PageDTO | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  useEffect(() => { if (pages.data) setOrder(pages.data); }, [pages.data]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const refresh = () => { qc.invalidateQueries({ queryKey: keys.pages }); qc.invalidateQueries({ queryKey: keys.sections }); qc.invalidateQueries({ queryKey: keys.stats }); };
  const reorder = useMutation({ mutationFn: (ids: number[]) => pageService.reorder(ids), onSuccess: refresh, onError: (e) => { notify(e.message, 'error'); refresh(); } });
  const duplicate = useMutation({ mutationFn: (p: PageDTO) => pageService.duplicate(p.id), onSuccess: () => { refresh(); notify('Page duplicated'); }, onError: (e) => notify(e.message, 'error') });
  const remove = useMutation({ mutationFn: (p: PageDTO) => pageService.remove(p.id), onSuccess: () => { refresh(); setDeleting(null); notify('Page deleted'); }, onError: (e) => notify(e.message, 'error') });
  const toggle = useMutation({
    mutationFn: ({ p, v }: { p: PageDTO; v: boolean }) => {
      const body: PageInput = { title: p.title, subtitle: p.subtitle, pageType: p.pageType, themeId: p.themeId, isActive: v, settings: p.settings, layout: p.layout };
      return pageService.update(p.id, body);
    },
    onSuccess: refresh,
    onError: (e) => notify(e.message, 'error'),
  });

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const next = arrayMove(order, order.findIndex((p) => p.id === e.active.id), order.findIndex((p) => p.id === e.over!.id));
    setOrder(next);
    reorder.mutate(next.map((p) => p.id));
  };
  const themeName = (p: PageDTO) => themes.data?.find((t) => t.id === (p.themeId ?? themes.data?.find((x) => x.isDefault)?.id))?.name ?? 'Default theme';

  return (
    <>
      <PageHeader
        title="Page Builder"
        subtitle="Pages of your menu book, in printing order. Open a page in the visual designer with Design."
        actions={<>
          <Button startIcon={<HistoryIcon />} onClick={() => setShowVersions(true)}>Versions</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>New page</Button>
        </>}
      />
      {pages.isLoading ? <ListSkeleton /> : pages.isError ? <ErrorAlert error={pages.error} onRetry={() => pages.refetch()} /> : order.length === 0 ? (
        <EmptyState title="No pages yet" description="Add a cover, then pages for each part of your menu." action={<Button variant="contained" onClick={() => setEditing('new')}>New page</Button>} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {order.map((p) => <Row key={p.id} p={p} themeName={themeName(p)} onEdit={() => setEditing(p)} onDuplicate={() => duplicate.mutate(p)} onDelete={() => setDeleting(p)} onToggle={(v) => toggle.mutate({ p, v })} />)}
            </div>
          </SortableContext>
        </DndContext>
      )}
      {editing && <PageDialog key={editing === 'new' ? 'new' : editing.id} page={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {showVersions && <VersionsDialog onClose={() => setShowVersions(false)} />}
      <ConfirmDialog open={!!deleting} title="Delete page?" message={<>“{deleting?.title}” and its {deleting?.sectionCount ?? 0} section layout(s) will be removed. Categories, items and images are not affected.</>} busy={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  );
}
