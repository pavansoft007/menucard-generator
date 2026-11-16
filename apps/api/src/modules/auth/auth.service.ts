import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { LoginResult, UserDTO } from '@gc/shared-types';
import { User } from '../../models/index.js';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/httpError.js';
import { invalidateUserCache } from '../../middleware/auth.js';

export const BCRYPT_COST = env.NODE_ENV === 'test' ? 4 : 12;
export const hashPassword = (p: string) => bcrypt.hash(p, BCRYPT_COST);

// Compared when the account doesn't exist so a missing user takes as long as a wrong password (no user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

export const toUserDTO = (u: User): UserDTO => ({ id: u.id, email: u.email, name: u.name, role: u.role });

export function signToken(user: User): string {
  return jwt.sign({ role: user.role, tv: user.tokenVersion }, env.JWT_SECRET, {
    subject: String(user.id),
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await User.findOne({ where: { email } });
  const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.isActive || !matches) throw HttpError.unauthorized('Invalid email or password');
  return { token: signToken(user), user: toUserDTO(user) };
}

export async function getProfile(id: number): Promise<UserDTO> {
  const user = await User.findByPk(id);
  if (!user || !user.isActive) throw HttpError.unauthorized();
  return toUserDTO(user);
}

/** Verifies the current password, sets the new one, and ends every other session (token version bump). */
export async function changePassword(id: number, currentPassword: string, newPassword: string): Promise<LoginResult> {
  const user = await User.findByPk(id);
  if (!user || !user.isActive) throw HttpError.unauthorized();
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw HttpError.badRequest('The current password is not correct');
  if (currentPassword === newPassword) throw HttpError.badRequest('Choose a password different from the current one');
  await user.update({ passwordHash: await hashPassword(newPassword), tokenVersion: user.tokenVersion + 1 });
  invalidateUserCache(id);
  return { token: signToken(user), user: toUserDTO(user) };
}
