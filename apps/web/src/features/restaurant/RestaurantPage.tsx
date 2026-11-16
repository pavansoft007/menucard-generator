import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, CardContent, Link, TextField, Typography } from '@mui/material';
import { restaurantInputSchema, type RestaurantInput } from '@gc/shared-types';
import { keys, restaurantService } from '../../services/menuService';
import { useUiStore } from '../../store/uiStore';
import { checker, ErrorAlert, ListSkeleton, PageHeader } from '../../components/common';

const fields: { name: keyof RestaurantInput; label: string; multiline?: boolean; span?: boolean; help?: string }[] = [
  { name: 'name', label: 'Restaurant name' },
  { name: 'tagline', label: 'Tagline' },
  { name: 'phone1', label: 'Primary phone' },
  { name: 'phone2', label: 'Secondary phone' },
  { name: 'address', label: 'Address', multiline: true, span: true },
  { name: 'city', label: 'City / State' },
  { name: 'pincode', label: 'PIN code' },
  { name: 'instagram', label: 'Instagram', help: 'Username or full URL' },
  { name: 'facebook', label: 'Facebook URL' },
  { name: 'website', label: 'Website' },
  { name: 'gstNumber', label: 'GST number (optional)' },
  { name: 'footerText', label: 'Footer text', multiline: true, span: true, help: 'Shown in the footer of menu pages that enable it' },
];

const blank = Object.fromEntries(fields.map((f) => [f.name, ''])) as unknown as RestaurantInput;

export default function RestaurantPage() {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const query = useQuery({ queryKey: keys.restaurant, queryFn: restaurantService.get });
  const form = useForm<RestaurantInput>({ resolver: zodResolver(restaurantInputSchema), defaultValues: blank });

  useEffect(() => {
    if (query.data) {
      const { id: _i, primaryLogo: _p, updatedAt: _u, ...values } = query.data;
      void _i; void _p; void _u;
      // Nulls become empty strings so inputs stay controlled.
      form.reset(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v ?? ''])) as unknown as RestaurantInput);
    }
  }, [query.data, form]);

  const save = useMutation({
    mutationFn: restaurantService.update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.restaurant });
      notify('Restaurant details saved');
    },
    onError: (e) => notify(e.message, 'error'),
  });

  // Empty inputs are sent as "" and normalised to null by the shared schema.
  const submit = form.handleSubmit((v) => save.mutate(v));

  if (query.isLoading) return <ListSkeleton rows={6} />;
  if (query.isError) return <ErrorAlert error={query.error} onRetry={() => query.refetch()} />;
  const logo = query.data?.primaryLogo;

  return (
    <>
      <PageHeader title="Restaurant Settings" subtitle="These details flow automatically into every menu page that uses them." />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card variant="outlined">
          <CardContent>
            <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <TextField
                  key={f.name}
                  label={f.label}
                  multiline={f.multiline}
                  minRows={f.multiline ? 2 : undefined}
                  className={f.span ? 'sm:col-span-2' : undefined}
                  {...form.register(f.name)}
                  error={!!form.formState.errors[f.name]}
                  helperText={form.formState.errors[f.name]?.message ?? f.help}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              ))}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button onClick={() => query.data && form.reset()} disabled={!form.formState.isDirty}>
                  Reset
                </Button>
                <Button type="submit" variant="contained" disabled={save.isPending || !form.formState.isDirty}>
                  {save.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ alignSelf: 'start' }}>
          <CardContent className="flex flex-col gap-2">
            <Typography fontWeight={700}>Primary logo</Typography>
            <Box sx={{ ...checker, borderRadius: 1.5, height: 140 }} className="flex items-center justify-center overflow-hidden">
              {logo ? (
                <img src={logo.media.url} alt={logo.label} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
              ) : (
                <Typography variant="body2" color="text.disabled">
                  No logo yet
                </Typography>
              )}
            </Box>
            <Link component={RouterLink} to="/logos" underline="hover">
              Manage logos →
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
