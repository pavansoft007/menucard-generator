import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Pagination,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { MediaDTO } from '@gc/shared-types';
import { keys, mediaService } from '../../services/menuService';
import { useUiStore } from '../../store/uiStore';
import { checker, Dropzone, ErrorAlert, ListSkeleton } from '../../components/common';

/** Modal image chooser backed by the central library. Uploading here adds to the library too. */
export default function MediaPicker({
  open,
  multiple,
  title = 'Choose image',
  excludeIds = [],
  onClose,
  onSelect,
}: {
  open: boolean;
  multiple?: boolean;
  title?: string;
  excludeIds?: number[];
  onClose: () => void;
  onSelect: (media: MediaDTO[]) => void;
}) {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<MediaDTO[]>([]);

  const list = useQuery({
    queryKey: [...keys.media, 'picker', search, page],
    queryFn: () => mediaService.list({ page, pageSize: 18, search: search || undefined }),
    placeholderData: keepPreviousData,
    enabled: open,
  });

  const upload = useMutation({
    mutationFn: (files: File[]) => mediaService.upload(files),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: keys.media });
      if (r.failed.length) notify(`${r.failed.length} file(s) rejected: ${r.failed[0]!.error}`, 'warning');
      setPicked((p) => (multiple ? [...p, ...r.uploaded] : r.uploaded.slice(0, 1)));
    },
    onError: (e) => notify(e.message, 'error'),
  });

  const toggle = (m: MediaDTO) =>
    setPicked((p) => (p.some((x) => x.id === m.id) ? p.filter((x) => x.id !== m.id) : multiple ? [...p, m] : [m]));

  const close = () => {
    setPicked([]);
    setSearch('');
    setPage(1);
    onClose();
  };
  const confirm = () => {
    onSelect(picked);
    close();
  };

  const rows = (list.data?.data ?? []).filter((m) => !excludeIds.includes(m.id));
  const total = list.data?.meta.total ?? 0;

  return (
    <Dialog open={open} onClose={close} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers className="flex flex-col gap-3">
        <Dropzone compact onFiles={(f) => upload.mutate(f)} busy={upload.isPending} />
        <TextField
          size="small"
          placeholder="Search images…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
        {list.isError ? (
          <ErrorAlert error={list.error} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <ListSkeleton rows={3} height={120} />
        ) : rows.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={4}>
            {search ? 'No images match your search.' : 'The library is empty. Upload an image above.'}
          </Typography>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {rows.map((m) => {
              const on = picked.some((x) => x.id === m.id);
              return (
                <Box
                  key={m.id}
                  role="checkbox"
                  aria-checked={on}
                  aria-label={m.originalName}
                  tabIndex={0}
                  onClick={() => toggle(m)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(m)}
                  sx={{ position: 'relative', cursor: 'pointer', borderRadius: 1.5, overflow: 'hidden', border: 2, borderColor: on ? 'primary.main' : 'transparent' }}
                >
                  <Box sx={{ ...checker, aspectRatio: '1' }} className="flex items-center justify-center">
                    <img src={m.thumbUrl} alt={m.altText ?? m.originalName} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </Box>
                  {on && <CheckCircleIcon color="primary" sx={{ position: 'absolute', top: 4, right: 4, bgcolor: '#000', borderRadius: '50%' }} />}
                  <Typography variant="caption" noWrap display="block" px={0.5}>
                    {m.originalName}
                  </Typography>
                </Box>
              );
            })}
          </div>
        )}
        {total > 18 && <Pagination sx={{ alignSelf: 'center' }} count={Math.ceil(total / 18)} page={page} onChange={(_, p) => setPage(p)} />}
      </DialogContent>
      <DialogActions>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, pl: 1 }}>
          {picked.length ? `${picked.length} selected` : multiple ? 'Select one or more images' : 'Select an image'}
        </Typography>
        <Button onClick={close}>Cancel</Button>
        <Button variant="contained" disabled={!picked.length} onClick={confirm}>
          Use {multiple ? 'selected' : 'image'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
