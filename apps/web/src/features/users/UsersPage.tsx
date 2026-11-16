import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Paper, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import KeyIcon from '@mui/icons-material/Key';
import DeleteIcon from '@mui/icons-material/Delete';
import { passwordSchema, userCreateSchema, userUpdateSchema, type UserAdminDTO, type UserCreateInput, type UserUpdateInput } from '@gc/shared-types';
import { z } from 'zod';
import { adminKeys, userService } from '../../services/adminService';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { ConfirmDialog, ErrorAlert, ListSkeleton, PageHeader } from '../../components/common';

const ROLE_HELP = { admin: 'Everything, including users and settings.', editor: 'Edits the menu, images, designs and exports. No user or settings access.' };

function UserDialog({ user, isSelf, onClose }: { user: UserAdminDTO | null; isSelf: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const schema = user ? userUpdateSchema : userCreateSchema;
  const form = useForm<UserCreateInput & UserUpdateInput>({
    resolver: zodResolver(schema) as never,
    defaultValues: { email: user?.email ?? '', name: user?.name ?? '', role: user?.role ?? 'editor', isActive: user?.isActive ?? true, password: '' },
  });
  const save = useMutation({
    mutationFn: (v: UserCreateInput & UserUpdateInput) => (user ? userService.update(user.id, { name: v.name, role: v.role, isActive: v.isActive }) : userService.create({ email: v.email, name: v.name, role: v.role, password: v.password })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.users }); notify(user ? 'User updated' : 'User created'); onClose(); },
    onError: (e) => notify(e.message, 'error'),
  });
  const errors = form.formState.errors;
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <DialogTitle>{user ? 'Edit user' : 'New user'}</DialogTitle>
        <DialogContent className="flex flex-col gap-3 !pt-2">
          <TextField label="Name" size="small" {...form.register('name')} error={!!errors.name} helperText={errors.name?.message} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Email" size="small" type="email" disabled={!!user} {...form.register('email')} error={!!errors.email} helperText={errors.email?.message ?? (user ? 'The email can’t be changed' : undefined)} slotProps={{ inputLabel: { shrink: true } }} />
          <Controller control={form.control} name="role" render={({ field }) => (
            <TextField select size="small" label="Role" {...field} disabled={isSelf} helperText={isSelf ? 'You can’t change your own role' : ROLE_HELP[field.value]} slotProps={{ inputLabel: { shrink: true } }}>
              <MenuItem value="editor">Editor</MenuItem>
              <MenuItem value="admin">Administrator</MenuItem>
            </TextField>
          )} />
          {!user && <TextField label="Password" size="small" type="password" autoComplete="new-password" {...form.register('password')} error={!!errors.password} helperText={errors.password?.message ?? 'At least 10 characters, with a letter and a number'} slotProps={{ inputLabel: { shrink: true } }} />}
          {user && <Controller control={form.control} name="isActive" render={({ field }) => <FormControlLabel control={<Switch size="small" checked={field.value} disabled={isSelf} onChange={(e) => field.onChange(e.target.checked)} />} label="Active (can sign in)" />} />}
        </DialogContent>
        <DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button></DialogActions>
      </form>
    </Dialog>
  );
}

const resetSchema = z.object({ password: passwordSchema });
function ResetDialog({ user, onClose }: { user: UserAdminDTO; onClose: () => void }) {
  const notify = useUiStore((s) => s.notify);
  const form = useForm<{ password: string }>({ resolver: zodResolver(resetSchema), defaultValues: { password: '' } });
  const reset = useMutation({
    mutationFn: (v: { password: string }) => userService.resetPassword(user.id, v.password),
    onSuccess: () => { notify(`Password reset – ${user.name} has been signed out everywhere`); onClose(); },
    onError: (e) => notify(e.message, 'error'),
  });
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <form onSubmit={form.handleSubmit((v) => reset.mutate(v))} noValidate>
        <DialogTitle>Reset password – {user.name}</DialogTitle>
        <DialogContent className="flex flex-col gap-3 !pt-2">
          <Alert severity="info">They will be signed out on every device and must use the new password.</Alert>
          <TextField label="New password" size="small" type="password" autoComplete="new-password" autoFocus {...form.register('password')} error={!!form.formState.errors.password} helperText={form.formState.errors.password?.message ?? 'At least 10 characters, with a letter and a number'} slotProps={{ inputLabel: { shrink: true } }} />
        </DialogContent>
        <DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={reset.isPending}>Reset password</Button></DialogActions>
      </form>
    </Dialog>
  );
}

export default function UsersPage() {
  const qc = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const me = useAuthStore((s) => s.user);
  const users = useQuery({ queryKey: adminKeys.users, queryFn: userService.list });
  const [editing, setEditing] = useState<UserAdminDTO | 'new' | null>(null);
  const [resetting, setResetting] = useState<UserAdminDTO | null>(null);
  const [deleting, setDeleting] = useState<UserAdminDTO | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (u: UserAdminDTO) => userService.remove(u.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.users }); setDeleting(null); notify('User deleted'); },
    onError: (e) => setDeleteError(e.message),
  });

  return (
    <>
      <PageHeader title="Users" subtitle="Who can sign in. Changes to a role, password or active status take effect immediately." actions={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>New user</Button>} />
      {users.isLoading ? <ListSkeleton rows={4} height={48} /> : users.isError ? <ErrorAlert error={users.error} onRetry={() => users.refetch()} /> : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
            <TableBody>
              {users.data!.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell><Typography fontWeight={700} component="span">{u.name}</Typography>{u.id === me?.id && <Chip size="small" label="You" sx={{ ml: 1 }} />}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Chip size="small" color={u.role === 'admin' ? 'primary' : 'default'} label={u.role === 'admin' ? 'Administrator' : 'Editor'} /></TableCell>
                  <TableCell>{u.isActive ? <Chip size="small" color="success" variant="outlined" label="Active" /> : <Chip size="small" variant="outlined" label="Deactivated" />}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Edit"><IconButton aria-label={`Edit ${u.name}`} onClick={() => setEditing(u)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Reset password"><IconButton aria-label={`Reset password for ${u.name}`} onClick={() => setResetting(u)}><KeyIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title={u.id === me?.id ? 'You can’t delete yourself' : 'Delete'}><span><IconButton aria-label={`Delete ${u.name}`} disabled={u.id === me?.id} onClick={() => { setDeleteError(null); setDeleting(u); }}><DeleteIcon fontSize="small" /></IconButton></span></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {editing && <UserDialog key={editing === 'new' ? 'new' : editing.id} user={editing === 'new' ? null : editing} isSelf={editing !== 'new' && editing.id === me?.id} onClose={() => setEditing(null)} />}
      {resetting && <ResetDialog user={resetting} onClose={() => setResetting(null)} />}
      <ConfirmDialog open={!!deleting} title="Delete user?" message={<>“{deleting?.name}” will lose access immediately and their email becomes available again.</>} busy={remove.isPending} error={deleteError} onConfirm={() => deleting && remove.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  );
}
