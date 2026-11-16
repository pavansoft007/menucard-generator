import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { LoginResult, UserDTO } from '@gc/shared-types';
import { User } from '../../models/index.js';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/httpError.js';

export const toUserDTO = (u: User): UserDTO => ({ id: u.id, email: u.email, name: u.name, role: u.role });

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await User.findOne({ where: { email } });
  const ok = user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !ok) throw HttpError.unauthorized('Invalid email or password');
  const token = jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: String(user.id),
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  return { token, user: toUserDTO(user) };
}

export async function getProfile(id: number): Promise<UserDTO> {
  const user = await User.findByPk(id);
  if (!user || !user.isActive) throw HttpError.unauthorized();
  return toUserDTO(user);
}
