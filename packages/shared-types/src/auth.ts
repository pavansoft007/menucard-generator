import { z } from 'zod';

export const UserRole = z.enum(['admin', 'editor']);
export type UserRole = z.infer<typeof UserRole>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(190),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** At least 10 characters with a letter and a number; capped so a huge string can't be used to burn CPU in bcrypt. */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use at most 128 characters')
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Include at least one letter and one number');

export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(190),
  name: z.string().trim().min(1, 'Required').max(120),
  role: UserRole,
  password: passwordSchema,
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(120),
  role: UserRole,
  isActive: z.boolean(),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const resetPasswordSchema = z.object({ password: passwordSchema });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface UserDTO {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}
export interface UserAdminDTO extends UserDTO {
  isActive: boolean;
  createdAt: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: { page: number; pageSize: number; total: number };
}
export interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: unknown };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface LoginResult {
  token: string;
  user: UserDTO;
}

export interface SystemStatus {
  appVersion: string;
  nodeVersion: string;
  environment: string;
  uptimeSeconds: number;
  database: 'ok' | 'error';
  chromeFound: boolean;
  renderBaseUrl: string;
  storage: { uploadsBytes: number; exportsBytes: number; mediaCount: number; exportCount: number };
}
