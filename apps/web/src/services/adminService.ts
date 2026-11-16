import type { ChangePasswordInput, ExportOptions, LoginResult, SystemStatus, UserAdminDTO, UserCreateInput, UserUpdateInput } from '@gc/shared-types';
import { api, json } from './api';

export const adminKeys = { users: ['users'] as const, settings: ['settings'] as const, system: ['settings', 'system'] as const };

export const userService = {
  list: () => api<UserAdminDTO[]>('/users'),
  create: (v: UserCreateInput) => api<UserAdminDTO>('/users', json('POST', v)),
  update: (id: number, v: UserUpdateInput) => api<UserAdminDTO>(`/users/${id}`, json('PUT', v)),
  resetPassword: (id: number, password: string) => api<{ reset: boolean }>(`/users/${id}/reset-password`, json('POST', { password })),
  remove: (id: number) => api<{ deleted: boolean }>(`/users/${id}`, json('DELETE')),
};

export const settingsService = {
  get: () => api<{ exportDefaults: ExportOptions }>('/settings'),
  saveExportDefaults: (v: ExportOptions) => api<{ exportDefaults: ExportOptions }>('/settings/export-defaults', json('PUT', v)),
  system: () => api<SystemStatus>('/settings/system'),
};

export const accountService = {
  changePassword: (v: ChangePasswordInput) => api<LoginResult>('/auth/change-password', json('POST', v)),
};
