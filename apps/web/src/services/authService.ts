import type { LoginInput, LoginResult, UserDTO } from '@gc/shared-types';
import { api } from './api';

export const authService = {
  login: (input: LoginInput) => api<LoginResult>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => api<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' }),
  profile: () => api<UserDTO>('/auth/profile'),
};
