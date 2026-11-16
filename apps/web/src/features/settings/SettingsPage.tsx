import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Alert, Box, Button, Card, CardContent, Chip, FormControlLabel, MenuItem, Switch, Tab, Tabs, TextField, Typography } from '@mui/material';
import { changePasswordSchema, defaultExportOptions, exportOptionsSchema, paperSizes, type ExportOptions } from '@gc/shared-types';
import { accountService, adminKeys, settingsService } from '../../services/adminService';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { ErrorAlert, formatBytes, ListSkeleton, PageHeader } from '../../components/common';

const confirmSchema = changePasswordSchema.extend({ confirm: z.string() }).refine((v) => v.newPassword === v.confirm, { message: 'The passwords do not match', path: ['confirm'] });
type PwForm = z.infer<typeof confirmSchema>;

function AccountTab() {
  const notify = useUiStore((s) => s.notify);
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const form = useForm<PwForm>({ resolver: zodResolver(confirmSchema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });
  const change = useMutation({
    mutationFn: (v: PwForm) => accountService.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword }),
    onSuccess: (r) => {
      setSession(r.token, r.user); // this device stays signed in; every other session ends
      form.reset();
      notify('Password changed. Other devices have been signed out.');
    },
    onError: (e) => notify(e.message, 'error'),
  });
  const e = form.formState.errors;
  return (
    <Card variant="outlined" sx={{ maxWidth: 520 }}>
      <CardContent>
        <Typography fontWeight={700}>{user?.name}</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>{user?.email} · {user?.role === 'admin' ? 'Administrator' : 'Editor'}</Typography>
        <form onSubmit={form.handleSubmit((v) => change.mutate(v))} noValidate className="flex flex-col gap-3">
          <Typography fontWeight={700}>Change password</Typography>
          <TextField size="small" type="password" label="Current password" autoComplete="current-password" {...form.register('currentPassword')} error={!!e.currentPassword} helperText={e.currentPassword?.message} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" type="password" label="New password" autoComplete="new-password" {...form.register('newPassword')} error={!!e.newPassword} helperText={e.newPassword?.message ?? 'At least 10 characters, with a letter and a number'} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" type="password" label="Repeat new password" autoComplete="new-password" {...form.register('confirm')} error={!!e.confirm} helperText={e.confirm?.message} slotProps={{ inputLabel: { shrink: true } }} />
          <Button type="submit" variant="contained" disabled={change.isPending} sx={{ alignSelf: 'flex-start' }}>{change.isPending ? 'Changing…' : 'Change password'}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ExportDefaultsTab() {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const settings = useQuery({ queryKey: adminKeys.settings, queryFn: settingsService.get });
  const [o, setO] = useState<ExportOptions>(defaultExportOptions);
  useEffect(() => { if (settings.data) setO(settings.data.exportDefaults); }, [settings.data]);
  const set = <K extends keyof ExportOptions>(k: K, v: ExportOptions[K]) => setO((p) => ({ ...p, [k]: v }));
  const valid = exportOptionsSchema.safeParse(o);
  const save = useMutation({
    mutationFn: () => settingsService.saveExportDefaults({ ...o, pages: 'all' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.settings }); notify('Export defaults saved'); },
    onError: (e) => notify(e.message, 'error'),
  });
  if (settings.isLoading) return <ListSkeleton rows={3} />;
  if (settings.isError) return <ErrorAlert error={settings.error} onRetry={() => settings.refetch()} />;
  return (
    <Card variant="outlined" sx={{ maxWidth: 720 }}>
      <CardContent className="flex flex-col gap-3">
        <Typography variant="body2" color="text.secondary">These values pre-fill the PDF &amp; Image Export page for everyone.</Typography>
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField select size="small" label="Paper" value={o.paper} onChange={(e) => set('paper', e.target.value as ExportOptions['paper'])}>{paperSizes.map((p) => <MenuItem key={p} value={p}>{p === 'native' ? 'Page size (as designed)' : p}</MenuItem>)}</TextField>
          <TextField select size="small" label="Orientation" value={o.orientation} onChange={(e) => set('orientation', e.target.value as ExportOptions['orientation'])}><MenuItem value="native">As designed</MenuItem><MenuItem value="portrait">Portrait</MenuItem><MenuItem value="landscape">Landscape</MenuItem></TextField>
          <TextField select size="small" label="Image quality" value={o.quality} onChange={(e) => set('quality', e.target.value as ExportOptions['quality'])}><MenuItem value="max">Maximum (originals)</MenuItem><MenuItem value="standard">Standard (optimized)</MenuItem></TextField>
          <TextField size="small" type="number" label="Bleed (mm)" value={o.bleedMm} onChange={(e) => set('bleedMm', Number(e.target.value))} slotProps={{ htmlInput: { min: 0, max: 10, step: 0.5 } }} />
          <TextField size="small" type="number" label="PNG resolution (DPI)" value={o.dpi} onChange={(e) => set('dpi', Number(e.target.value))} slotProps={{ htmlInput: { min: 72, max: 600, step: 50 } }} />
          <TextField select size="small" label="Double-sided" value={o.sides} onChange={(e) => set('sides', e.target.value as ExportOptions['sides'])}><MenuItem value="all">Front &amp; back</MenuItem><MenuItem value="front">Fronts only</MenuItem><MenuItem value="back">Backs only</MenuItem></TextField>
        </div>
        <div className="flex flex-wrap gap-x-5">
          <FormControlLabel control={<Switch size="small" checked={o.includeFooter} onChange={(e) => set('includeFooter', e.target.checked)} />} label="Footer" />
          <FormControlLabel control={<Switch size="small" checked={o.includePageNumbers} onChange={(e) => set('includePageNumbers', e.target.checked)} />} label="Page numbers" />
          <FormControlLabel control={<Switch size="small" checked={o.padToEven} onChange={(e) => set('padToEven', e.target.checked)} />} label="Pad to an even page count" />
        </div>
        <Button variant="contained" sx={{ alignSelf: 'flex-start' }} disabled={!valid.success || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save defaults'}</Button>
        {!valid.success && <Typography variant="caption" color="error">{valid.error.issues[0]?.message}</Typography>}
      </CardContent>
    </Card>
  );
}

function SystemTab() {
  const sys = useQuery({ queryKey: adminKeys.system, queryFn: settingsService.system, refetchInterval: 30_000 });
  if (sys.isLoading) return <ListSkeleton rows={3} />;
  if (sys.isError) return <ErrorAlert error={sys.error} onRetry={() => sys.refetch()} />;
  const s = sys.data!;
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between gap-4 border-b py-2" style={{ borderColor: 'rgba(128,128,128,.25)' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" component="div" sx={{ textAlign: 'right' }}>{value}</Typography>
    </div>
  );
  const days = Math.floor(s.uptimeSeconds / 86400);
  const hrs = Math.floor((s.uptimeSeconds % 86400) / 3600);
  const mins = Math.floor((s.uptimeSeconds % 3600) / 60);
  return (
    <Card variant="outlined" sx={{ maxWidth: 560 }}>
      <CardContent>
        {row('Version', `${s.appVersion} · Node ${s.nodeVersion}`)}
        {row('Environment', <Chip size="small" label={s.environment} color={s.environment === 'production' ? 'success' : 'default'} />)}
        {row('Uptime', `${days ? `${days}d ` : ''}${hrs}h ${mins}m`)}
        {row('Database', <Chip size="small" label={s.database === 'ok' ? 'Connected' : 'Error'} color={s.database === 'ok' ? 'success' : 'error'} />)}
        {row('PDF rendering (Chrome)', <Chip size="small" label={s.chromeFound ? 'Found' : 'Not found'} color={s.chromeFound ? 'success' : 'error'} />)}
        {row('Render address', s.renderBaseUrl)}
        {row('Images', `${s.storage.mediaCount} files · ${formatBytes(s.storage.uploadsBytes)} on disk`)}
        {row('Exports', `${s.storage.exportCount} files · ${formatBytes(s.storage.exportsBytes)} on disk`)}
        {!s.chromeFound && <Alert severity="warning" sx={{ mt: 2 }}>Install Chrome or set <code>CHROME_PATH</code> to enable PDF and PNG export.</Alert>}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const [tab, setTab] = useState(0);
  const tabs = [{ label: 'My account', el: <AccountTab /> }, ...(isAdmin ? [{ label: 'Export defaults', el: <ExportDefaultsTab /> }, { label: 'System', el: <SystemTab /> }] : [])];
  return (
    <>
      <PageHeader title="Application Settings" subtitle="Your account, export defaults and system status." />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>{tabs.map((t) => <Tab key={t.label} label={t.label} />)}</Tabs>
      <Box>{tabs[tab]?.el}</Box>
    </>
  );
}
