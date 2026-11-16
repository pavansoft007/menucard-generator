import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import type { ItemDTO, ItemInput } from '@gc/shared-types';
import { categoryService, itemService, keys } from '../../services/menuService';
import { useUiStore } from '../../store/uiStore';
import { checker, ConfirmDialog, ErrorAlert, ListSkeleton, PageHeader, rupees } from '../../components/common';
import EmptyState from '../../components/EmptyState';
import ItemDialog from './ItemDialog';

const PAGE_SIZE = 15;

function priceSummary(item: ItemDTO) {
  return item.variants
    .filter((v) => v.isActive)
    .map((v) => (
      <Chip
        key={v.id}
        size="small"
        variant="outlined"
        sx={{ mr: 0.5, mb: 0.5 }}
        label={
          <>
            {v.label}: <b>{v.price == null ? 'price not set' : v.discountPrice != null ? `${rupees(v.discountPrice)}` : rupees(v.price)}</b>
            {v.discountPrice != null && <s style={{ marginLeft: 4, opacity: 0.6 }}>{rupees(v.price)}</s>}
          </>
        }
      />
    ));
}

export default function ItemsPage() {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [status, setStatus] = useState<'' | 'true' | 'false'>('');
  const [diet, setDiet] = useState<'' | 'veg' | 'non_veg'>('');
  const [editing, setEditing] = useState<ItemDTO | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ItemDTO | null>(null);

  // Debounce search so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const categories = useQuery({ queryKey: keys.categories, queryFn: () => categoryService.list() });
  const filters = { page, pageSize: PAGE_SIZE, search: search || undefined, categoryId: categoryId || undefined, isActive: status === '' ? undefined : status === 'true', dietType: diet || undefined };
  const items = useQuery({ queryKey: [...keys.items, filters], queryFn: () => itemService.list(filters), placeholderData: keepPreviousData });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.items });
    qc.invalidateQueries({ queryKey: keys.categories });
    qc.invalidateQueries({ queryKey: keys.stats });
  };
  const remove = useMutation({
    mutationFn: (i: ItemDTO) => itemService.remove(i.id),
    onSuccess: () => {
      refresh();
      setDeleting(null);
      notify('Item deleted');
    },
    onError: (e) => notify(e.message, 'error'),
  });
  const toggle = useMutation({
    mutationFn: ({ i, v }: { i: ItemDTO; v: boolean }) => {
      const body: ItemInput = {
        categoryId: i.categoryId, name: i.name, shortDescription: i.shortDescription, description: i.description,
        mainMediaId: i.mainMedia?.id ?? null, galleryMediaIds: i.gallery.map((g) => g.id), dietType: i.dietType,
        isBestseller: i.isBestseller, isSpicy: i.isSpicy, isNew: i.isNew, isFeatured: i.isFeatured, isAvailable: i.isAvailable, isActive: v,
        variants: i.variants.map((x) => ({ id: x.id, label: x.label, quantity: x.quantity, unit: x.unit, price: x.price, discountPrice: x.discountPrice, mediaId: x.media?.id ?? null, isActive: x.isActive })),
      };
      return itemService.update(i.id, body);
    },
    onSuccess: refresh,
    onError: (e) => notify(e.message, 'error'),
  });

  const total = items.data?.meta.total ?? 0;
  const noCategories = categories.isSuccess && categories.data.length === 0;
  const filtered = !!(search || categoryId || status || diet);

  return (
    <>
      <PageHeader
        title="Menu Items"
        subtitle="One item can have many sizes, quantities and prices."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} disabled={noCategories || !categories.isSuccess} onClick={() => setEditing('new')}>
            New item
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <TextField
          size="small"
          placeholder="Search items…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ minWidth: 220 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
        <TextField select size="small" label="Category" value={categoryId} onChange={(e) => { setCategoryId(e.target.value === '' ? '' : Number(e.target.value)); setPage(1); }} sx={{ minWidth: 190 }}>
          <MenuItem value="">All categories</MenuItem>
          {categories.data?.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Status" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }} sx={{ minWidth: 130 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Inactive</MenuItem>
        </TextField>
        <TextField select size="small" label="Diet" value={diet} onChange={(e) => { setDiet(e.target.value as typeof diet); setPage(1); }} sx={{ minWidth: 130 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="veg">Veg</MenuItem>
          <MenuItem value="non_veg">Non-veg</MenuItem>
        </TextField>
      </div>

      {items.isLoading ? (
        <ListSkeleton rows={6} />
      ) : items.isError ? (
        <ErrorAlert error={items.error} onRetry={() => items.refetch()} />
      ) : noCategories ? (
        <EmptyState title="Create a category first" description="Every menu item belongs to a category." />
      ) : items.data!.data.length === 0 ? (
        <EmptyState
          title={filtered ? 'No items match these filters' : 'No menu items yet'}
          description={filtered ? 'Try clearing the search or filters.' : 'Add your first item with its sizes and prices.'}
          action={!filtered ? <Button variant="contained" onClick={() => setEditing('new')}>New item</Button> : undefined}
        />
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined" sx={{ opacity: items.isPlaceholderData ? 0.6 : 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={64}>Image</TableCell>
                  <TableCell>Item</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Sizes & prices</TableCell>
                  <TableCell align="center">Active</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.data!.data.map((i) => (
                  <TableRow key={i.id} hover>
                    <TableCell>
                      <Box sx={{ ...checker, width: 48, height: 48, borderRadius: 1 }} className="flex items-center justify-center overflow-hidden">
                        {i.mainMedia && <img src={i.mainMedia.thumbUrl} alt="" loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={700} component="div">
                        {i.name}
                      </Typography>
                      <div className="flex flex-wrap gap-0.5">
                        {i.dietType && <Chip size="small" label={i.dietType === 'veg' ? 'Veg' : 'Non-veg'} color={i.dietType === 'veg' ? 'success' : 'error'} variant="outlined" />}
                        {i.isBestseller && <Chip size="small" color="primary" label="Bestseller" />}
                        {i.isSpicy && <Chip size="small" label="Spicy" />}
                        {i.isNew && <Chip size="small" label="New" />}
                        {i.isFeatured && <Chip size="small" label="Featured" />}
                        {!i.isAvailable && <Chip size="small" label="Unavailable" />}
                      </div>
                    </TableCell>
                    <TableCell>{i.category?.name}</TableCell>
                    <TableCell sx={{ maxWidth: 340 }}>{priceSummary(i)}</TableCell>
                    <TableCell align="center">
                      <Switch size="small" checked={i.isActive} onChange={(e) => toggle.mutate({ i, v: e.target.checked })} inputProps={{ 'aria-label': `${i.name} active` }} />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Edit">
                        <IconButton aria-label={`Edit ${i.name}`} onClick={() => setEditing(i)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton aria-label={`Delete ${i.name}`} onClick={() => setDeleting(i)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <div className="mt-3 flex items-center justify-between">
            <Typography variant="body2" color="text.secondary">
              {total} item{total === 1 ? '' : 's'}
            </Typography>
            {total > PAGE_SIZE && <Pagination count={Math.ceil(total / PAGE_SIZE)} page={page} onChange={(_, p) => setPage(p)} />}
          </div>
        </>
      )}

      {editing && categories.data && (
        <ItemDialog
          key={editing === 'new' ? 'new' : editing.id}
          item={editing === 'new' ? null : editing}
          categories={categories.data}
          defaultCategoryId={categoryId || undefined}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete item?"
        message={<>“{deleting?.name}” and its price options will be removed from your menu.</>}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
