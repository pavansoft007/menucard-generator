import { Router } from 'express';
import { restaurantInputSchema, type RestaurantDTO } from '@gc/shared-types';
import { RestaurantSettings } from '../../models/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { getPrimaryLogo } from '../logos/logos.service.js';

async function settings() {
  const [row, created] = await RestaurantSettings.findOrCreate({ where: { id: 1 }, defaults: { id: 1, name: 'GOLDEN CRUNCH' } as RestaurantSettings });
  // A freshly created instance only carries the columns we set; reload so every field is present (as null).
  return created ? row.reload() : row;
}

async function toDTO(r: RestaurantSettings): Promise<RestaurantDTO> {
  return {
    id: r.id,
    name: r.name,
    tagline: r.tagline,
    phone1: r.phone1,
    phone2: r.phone2,
    address: r.address,
    city: r.city,
    pincode: r.pincode,
    instagram: r.instagram,
    facebook: r.facebook,
    website: r.website,
    gstNumber: r.gstNumber,
    footerText: r.footerText,
    primaryLogo: await getPrimaryLogo(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export const restaurantRouter = Router();
restaurantRouter.use(requireAuth);

restaurantRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await toDTO(await settings()) });
  }),
);

restaurantRouter.put(
  '/',
  validateBody(restaurantInputSchema),
  asyncHandler(async (req, res) => {
    const row = await settings();
    await row.update(req.body);
    res.json({ success: true, data: await toDTO(row) });
  }),
);
