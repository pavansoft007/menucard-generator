import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Link,
  MenuItem,
  Pagination,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import type { MediaDTO } from '@gc/shared-types';
import { keys, mediaService, type MediaUsage } from '../../services/menuService';
import { useUiStore } from '../../store/uiStore';
import { checker, ConfirmDialog, Dropzone, ErrorAlert, formatBytes, ListSkeleton, PageHeader } from '../../components/common';
import EmptyState from '../../components/EmptyState';

const PAGE_SIZE = 24;

function UsageText({ u }: { u?: MediaUsage }) {
  if (!u) return <Skeleton width={160} />;
  if (u.total === 0) return <Typography variant="body2" color="text.secondary">Not used anywhere – safe to delete.</Typography>;
  const parts = [
    u.items && `${u.items} item image slot${u.items > 1 ? 's' : ''}`,
    u.variants && `${u.variants} price option${u.variants > 1 ? 's' : ''}`,
    u.categories && `${u.categories} categor${u.categories > 1 ? 'ies' : 'y'}`,
    u.logos && `${u.logos} logo${u.logos > 1 ? 's' : ''}`,
  ].filter(Boolean);
  return <Typography variant="body2">Used by {parts.join(', ')}.</Typography>;
}

function MediaDialog({ media, categories, onClose }: { media: MediaDTO; categories: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const fileInput = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(media);
  const [category, setCategory] = useState(media.category ?? '');
  const [alt, setAlt] = useState(media.altText ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const usage = useQuery({ queryKey: [...keys.media, 'usage', media.id, current.url], queryFn: () => mediaService.usage(media.id) });

  const refresh = () => qc.invalidateQueries({ queryKey: keys.media });
  const save = useMutation({
    mutationFn: () => mediaService.update(media.id, { category: category.trim() || null, altText: alt.trim() || null }),
    onSuccess: (m) => {
      setCurrent(m);
      refresh();
      notify('Image details saved');
    },
    onError: (e) => notify(e.message, 'error'),
  });
  const replace = useMutation({
    mutationFn: (f: File) => mediaService.replace(media.id, f),
    onSuccess: (m) => {
      setCurrent(m);
      refresh();
      qc.invalidateQueries({ queryKey: keys.items });
      qc.invalidateQueries({ queryKey: keys.categories });
      qc.invalidateQueries({ queryKey: keys.logos });
      notify('Image replaced everywhere it is used');
    },
    onError: (e) => notify(e.message, 'error'),
  });
  const remove = useMutation({
    mutationFn: () => mediaService.remove(media.id),
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: keys.stats });
      notify('Image deleted');
      onClose();
    },
    onError: (e) => setDeleteError(e.message),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle noWrap>{current.originalName}</DialogTitle>
      <DialogContent dividers className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <Box sx={{ ...checker, borderRadius: 2, minHeight: 280 }} className="flex items-center justify-center overflow-hidden">
          <img src={current.url} alt={current.altText ?? current.originalName} style={{ maxWidth: '100%', maxHeight: 440, objectFit: 'contain' }} />
        </Box>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1">
            <Chip size="small" label={current.kind === 'svg' ? 'SVG' : current.mime.replace('image/', '').toUpperCase()} />
            {current.width && <Chip size="small" label={`${current.width} × ${current.height}px`} />}
            <Chip size="small" label={formatBytes(current.size)} />
            {current.hasAlpha && <Chip size="small" label="Transparent" />}
          </div>
          <UsageText u={usage.data} />
          <TextField size="small" label="Category" value={category} onChange={(e) => setCategory(e.target.value)} helperText="Used to filter the library, e.g. Food, Logo, Background" slotProps={{ htmlInput: { list: 'media-cats', maxLength: 60 } }} />
          <datalist id="media-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <TextField size="small" label="Alt text" value={alt} onChange={(e) => setAlt(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
          <div className="flex flex-wrap gap-2">
            <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
              Save details
            </Button>
            <Button onClick={() => fileInput.current?.click()} disabled={replace.isPending}>
              {replace.isPending ? 'Replacing…' : 'Replace file'}
            </Button>
            <input ref={fileInput} type="file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { const f = e.target.files?.[0]; if (f) replace.mutate(f); e.target.value = ''; }} />
          </div>
          <Typography variant="caption" color="text.secondary">
            Replacing keeps the same image id, so every item, category and logo using it updates automatically.
          </Typography>
          <Link href={current.originalUrl} target="_blank" rel="noopener" variant="body2">
            Open original file
          </Link>
          <Button color="error" sx={{ alignSelf: 'flex-start' }} onClick={() => { setDeleteError(null); setConfirmDelete(true); }}>
            Delete image
          </Button>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete image permanently?"
        message="The original and optimized files are removed from the server. This can’t be undone."
        busy={remove.isPending}
        error={deleteError}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirmDelete(false)}
      />
    </Dialog>
  );
}

export default function MediaPage() {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [kind, setKind] = useState<'' | 'image' | 'svg'>('');
  const [selected, setSelected] = useState<MediaDTO | null>(null);
  const [uploadCategory, setUploadCategory] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters = { page, pageSize: PAGE_SIZE, search: search || undefined, category: category || undefined, kind: kind || undefined };
  const list = useQuery({ queryKey: [...keys.media, 'list', filters], queryFn: () => mediaService.list(filters), placeholderData: keepPreviousData });
  const cats = useQuery({ queryKey: [...keys.media, 'categories'], queryFn: mediaService.categories });

  const upload = useMutation({
    mutationFn: (files: File[]) => mediaService.upload(files, uploadCategory.trim() || undefined),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: keys.media });
      qc.invalidateQueries({ queryKey: keys.stats });
      if (r.uploaded.length) notify(`${r.uploaded.length} image${r.uploaded.length > 1 ? 's' : ''} uploaded`);
      if (r.failed.length) notify(`${r.failed.length} rejected – ${r.failed.map((f) => `${f.name}: ${f.error}`).join('; ')}`, 'warning');
    },
    onError: (e) => notify(e.message, 'error'),
  });

  const total = list.data?.meta.total ?? 0;
  const filtered = !!(search || category || kind);

  return (
    <>
      <PageHeader title="Image Library" subtitle="All food photos, logos and backgrounds live here. Originals are always preserved." />
      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_220px]">
        <Dropzone onFiles={(f) => upload.mutate(f)} busy={upload.isPending} />
        <TextField size="small" label="Upload into category" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} helperText="Optional tag for new uploads" sx={{ alignSelf: 'start' }} slotProps={{ htmlInput: { maxLength: 60 } }} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <TextField size="small" placeholder="Search by name or alt text…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} sx={{ minWidth: 240 }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
        <TextField select size="small" label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} sx={{ minWidth: 170 }}>
          <MenuItem value="">All</MenuItem>
          {cats.data?.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Type" value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setPage(1); }} sx={{ minWidth: 130 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="image">Raster</MenuItem>
          <MenuItem value="svg">SVG</MenuItem>
        </TextField>
      </div>

      {list.isLoading ? (
        <ListSkeleton rows={3} height={150} />
      ) : list.isError ? (
        <ErrorAlert error={list.error} onRetry={() => list.refetch()} />
      ) : list.data!.data.length === 0 ? (
        <EmptyState title={filtered ? 'No images match' : 'No images yet'} description={filtered ? 'Try clearing the search or filters.' : 'Drop your logo and food photos above to get started.'} />
      ) : (
        <>
          {upload.isPending && <Alert severity="info" sx={{ mb: 2 }}>Uploading and optimizing…</Alert>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6" style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}>
            {list.data!.data.map((m) => (
              <Box
                key={m.id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${m.originalName}`}
                onClick={() => setSelected(m)}
                onKeyDown={(e) => e.key === 'Enter' && setSelected(m)}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', cursor: 'pointer', '&:hover, &:focus-visible': { borderColor: 'primary.main' } }}
              >
                <Box sx={{ ...checker, aspectRatio: '1' }} className="flex items-center justify-center">
                  <img src={m.thumbUrl} alt={m.altText ?? m.originalName} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </Box>
                <Box sx={{ p: 1 }}>
                  <Typography variant="body2" noWrap fontWeight={600}>{m.originalName}</Typography>
                  <div className="flex items-center justify-between">
                    <Typography variant="caption" color="text.secondary">{m.width ? `${m.width}×${m.height}` : 'SVG'} · {formatBytes(m.size)}</Typography>
                    {(m.usageCount ?? 0) > 0 && <Chip size="small" label={`${m.usageCount} use${m.usageCount === 1 ? '' : 's'}`} color="primary" variant="outlined" sx={{ height: 18 }} />}
                  </div>
                </Box>
              </Box>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Typography variant="body2" color="text.secondary">{total} image{total === 1 ? '' : 's'}</Typography>
            {total > PAGE_SIZE && <Pagination count={Math.ceil(total / PAGE_SIZE)} page={page} onChange={(_, p) => setPage(p)} />}
          </div>
        </>
      )}
      {selected && <MediaDialog key={selected.id} media={selected} categories={cats.data ?? []} onClose={() => setSelected(null)} />}
    </>
  );
}
