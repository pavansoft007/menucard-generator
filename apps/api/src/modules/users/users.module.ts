import { Router } from 'express';
import { Op } from 'sequelize';
import { UniqueConstraintError } from 'sequelize';
import { resetPasswordSchema, userCreateSchema, userUpdateSchema, type UserAdminDTO, type UserCreateInput, type UserUpdateInput } from '@gc/shared-types';
import { User } from '../../models/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { invalidateUserCache, requireFullAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { HttpError } from '../../utils/httpError.js';
import { idParam } from '../../utils/query.js';
import { hashPassword } from '../auth/auth.service.js';

const toDTO = (u: User): UserAdminDTO => ({ id: u.id, email: u.email, name: u.name, role: u.role, isActive: u.isActive, createdAt: u.createdAt.toISOString() });

async function load(id: number) {
  const u = await User.findByPk(id);
  if (!u) throw HttpError.notFound('User not found');
  return u;
}

/** The account must never be left without an active administrator. */
async function assertAnotherAdmin(excludeId: number) {
  const others = await User.count({ where: { role: 'admin', isActive: true, id: { [Op.ne]: excludeId } } });
  if (others === 0) throw HttpError.conflict('There must always be at least one active administrator.');
}

export const usersService = {
  async list() {
    return (await User.findAll({ order: [['name', 'ASC'], ['id', 'ASC']] })).map(toDTO);
  },

  async create(input: UserCreateInput) {
    try {
      const u = await User.create({ email: input.email, name: input.name, role: input.role, passwordHash: await hashPassword(input.password) });
      return toDTO(u);
    } catch (e) {
      if (e instanceof UniqueConstraintError) throw HttpError.conflict('A user with that email already exists');
      throw e;
    }
  },

  async update(id: number, input: UserUpdateInput, actorId: number) {
    const u = await load(id);
    const losesAdmin = u.role === 'admin' && u.isActive && (input.role !== 'admin' || !input.isActive);
    if (id === actorId && (input.role !== u.role || !input.isActive)) throw HttpError.badRequest('You cannot change your own role or deactivate your own account.');
    if (losesAdmin) await assertAnotherAdmin(id);
    const sensitive = input.role !== u.role || input.isActive !== u.isActive;
    await u.update({ name: input.name, role: input.role, isActive: input.isActive, ...(sensitive ? { tokenVersion: u.tokenVersion + 1 } : {}) });
    invalidateUserCache(id);
    return toDTO(u);
  },

  async resetPassword(id: number, password: string) {
    const u = await load(id);
    await u.update({ passwordHash: await hashPassword(password), tokenVersion: u.tokenVersion + 1 });
    invalidateUserCache(id);
  },

  async remove(id: number, actorId: number) {
    const u = await load(id);
    if (id === actorId) throw HttpError.badRequest('You cannot delete your own account.');
    if (u.role === 'admin' && u.isActive) await assertAnotherAdmin(id);
    // Free the email for reuse; the row is soft-deleted so history that points at the user stays intact.
    await u.update({ email: `deleted.${id}.${Date.now()}.${u.email}`.slice(0, 190), isActive: false, tokenVersion: u.tokenVersion + 1 });
    await u.destroy();
    invalidateUserCache(id);
  },
};

export const usersRouter = Router();
usersRouter.use(requireFullAuth, requireRole('admin'));
usersRouter.get('/', asyncHandler(async (_req, res) => void res.json({ success: true, data: await usersService.list() })));
usersRouter.post('/', validateBody(userCreateSchema), asyncHandler(async (req, res) => void res.status(201).json({ success: true, data: await usersService.create(req.body) })));
usersRouter.put('/:id', validateBody(userUpdateSchema), asyncHandler(async (req, res) => void res.json({ success: true, data: await usersService.update(idParam(req), req.body, req.auth!.sub) })));
usersRouter.post('/:id/reset-password', validateBody(resetPasswordSchema), asyncHandler(async (req, res) => {
  await usersService.resetPassword(idParam(req), req.body.password);
  res.json({ success: true, data: { reset: true } });
}));
usersRouter.delete('/:id', asyncHandler(async (req, res) => {
  await usersService.remove(idParam(req), req.auth!.sub);
  res.json({ success: true, data: { deleted: true } });
}));
