import { z } from 'zod';

export const UserRole = z.enum(['admin', 'editor']);
export type UserRole = z.infer<typeof UserRole>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export interface UserDTO {
  id: number;
  email: string;
  name: string;
  role: UserRole;
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
