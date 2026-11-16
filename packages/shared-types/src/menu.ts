import { z } from 'zod';

/* ------------------------------------------------------------------ helpers */
const id = z.number().int().positive();
const nullableId = id.nullable();
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === '' ? null : v));

/** Money: non-negative, at most 2 decimal places. */
export const moneySchema = z
  .number({ invalid_type_error: 'Enter a valid amount' })
  .nonnegative('Must be 0 or more')
  .max(1_000_000)
  .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, 'At most 2 decimal places');

export const reorderSchema = z.object({ ids: z.array(id).min(1).max(1000) });
export type ReorderInput = z.infer<typeof reorderSchema>;

/* -------------------------------------------------------------------- media */
export type MediaKind = 'image' | 'svg';

export interface MediaDTO {
  id: number;
  originalName: string;
  mime: string;
  kind: MediaKind;
  size: number;
  width: number | null;
  height: number | null;
  hasAlpha: boolean;
  category: string | null;
  altText: string | null;
  url: string; // optimized, for display / export
  thumbUrl: string;
  originalUrl: string; // untouched upload
  createdAt: string;
  usageCount?: number;
}

export const mediaUpdateSchema = z.object({
  category: optText(60),
  altText: optText(200),
});
export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;

/** Crop box as fractions (0–1) of the displayed, EXIF-corrected image; always creates a NEW image, the original is never touched. */
export const mediaCropSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0.005).max(1),
    h: z.number().min(0.005).max(1),
    /** Resize the result to this width (px); height follows the aspect ratio. Never upscales. */
    outputWidth: z.number().int().min(16).max(6000).nullable(),
  })
  .refine((c) => c.x + c.w <= 1.0001 && c.y + c.h <= 1.0001, 'The crop area must stay inside the image');
export type MediaCropInput = z.infer<typeof mediaCropSchema>;

/* ---------------------------------------------------------------- restaurant */
export const restaurantInputSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(120),
  tagline: optText(160),
  phone1: optText(30),
  phone2: optText(30),
  address: optText(400),
  city: optText(80),
  pincode: optText(12),
  instagram: optText(190),
  facebook: optText(190),
  website: optText(190),
  gstNumber: optText(30),
  footerText: optText(400),
});
export type RestaurantInput = z.infer<typeof restaurantInputSchema>;
export interface RestaurantDTO extends RestaurantInput {
  id: number;
  primaryLogo: LogoDTO | null;
  updatedAt: string;
}

/* --------------------------------------------------------------------- logos */
export const logoPositions = ['left', 'center', 'right'] as const;
export const logoCreateSchema = z.object({
  mediaId: id,
  label: z.string().trim().min(1, 'Required').max(80),
  isPrimary: z.boolean(),
  defaultWidthMm: z.number().min(5).max(200),
  defaultPosition: z.enum(logoPositions),
});
export type LogoCreateInput = z.infer<typeof logoCreateSchema>;
export const logoUpdateSchema = logoCreateSchema.omit({ mediaId: true }).partial();
export type LogoUpdateInput = z.infer<typeof logoUpdateSchema>;
export interface LogoDTO {
  id: number;
  label: string;
  isPrimary: boolean;
  defaultWidthMm: number;
  defaultPosition: (typeof logoPositions)[number];
  media: MediaDTO;
}

/* ---------------------------------------------------------------- categories */
export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(120),
  description: optText(1000),
  icon: optText(60),
  imageMediaId: nullableId,
  iconMediaId: nullableId,
  bannerMediaId: nullableId,
  backgroundMediaId: nullableId,
  isActive: z.boolean(),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export interface CategoryDTO {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  displayOrder: number;
  isActive: boolean;
  itemCount: number;
  image: MediaDTO | null;
  iconMedia: MediaDTO | null;
  banner: MediaDTO | null;
  background: MediaDTO | null;
}

/* --------------------------------------------------------------------- items */
export const dietTypes = ['veg', 'non_veg'] as const;
export type DietType = (typeof dietTypes)[number];

export const variantInputSchema = z
  .object({
    id: id.optional(),
    label: z.string().trim().min(1, 'Required').max(80),
    quantity: z.number().int().positive().nullable(),
    unit: optText(40),
    price: moneySchema.nullable(), // null = "price not set yet" (e.g. water bottle)
    discountPrice: moneySchema.nullable(),
    mediaId: nullableId,
    isActive: z.boolean(),
  })
  .refine((v) => v.discountPrice == null || (v.price != null && v.discountPrice < v.price), {
    message: 'Discounted price must be lower than the regular price',
    path: ['discountPrice'],
  });
export type VariantInput = z.infer<typeof variantInputSchema>;

export const itemInputSchema = z.object({
  categoryId: id,
  name: z.string().trim().min(1, 'Required').max(160),
  shortDescription: optText(200),
  description: optText(2000),
  mainMediaId: nullableId,
  galleryMediaIds: z.array(id).max(20),
  dietType: z.enum(dietTypes).nullable(),
  isBestseller: z.boolean(),
  isSpicy: z.boolean(),
  isNew: z.boolean(),
  isFeatured: z.boolean(),
  isAvailable: z.boolean(),
  isActive: z.boolean(),
  variants: z.array(variantInputSchema).min(1, 'Add at least one price option').max(20),
});
export type ItemInput = z.infer<typeof itemInputSchema>;

export interface VariantDTO {
  id: number;
  label: string;
  quantity: number | null;
  unit: string | null;
  price: number | null;
  discountPrice: number | null;
  displayOrder: number;
  isActive: boolean;
  media: MediaDTO | null;
}
export interface ItemDTO {
  id: number;
  categoryId: number;
  category: { id: number; name: string } | null;
  name: string;
  shortDescription: string | null;
  description: string | null;
  dietType: DietType | null;
  isBestseller: boolean;
  isSpicy: boolean;
  isNew: boolean;
  isFeatured: boolean;
  isAvailable: boolean;
  isActive: boolean;
  displayOrder: number;
  mainMedia: MediaDTO | null;
  gallery: MediaDTO[];
  variants: VariantDTO[];
}

/* ----------------------------------------------------------------- dashboard */
export interface DashboardStats {
  totalCategories: number;
  totalItems: number;
  activeItems: number;
  inactiveItems: number;
  totalImages: number;
  totalPages: number;
  lastGeneratedMenu: string | null; // wired up in Phase 5
  lastPublishedAt: string | null;
}
