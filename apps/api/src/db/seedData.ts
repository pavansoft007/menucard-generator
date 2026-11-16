/**
 * Initial Golden Crunch sample data. These are only *starting values* – everything is stored in
 * the database and is fully editable from the admin dashboard.
 * No images are seeded (upload your own) and no prices are invented: Water Bottle has no price yet.
 */
import type { DietType } from '@gc/shared-types';

export const restaurantSeed = {
  name: 'GOLDEN CRUNCH',
  tagline: 'CRISPY • CRUNCHY • CHEESY',
  address: 'Near Karam Mill, Opposite Chiru Bus Stand',
  city: 'Anakapalli, Andhra Pradesh',
  pincode: '531001',
  instagram: 'gold.encrunch',
};

interface V {
  label: string;
  quantity?: number;
  unit?: string;
  price: number | null;
}
interface SeedItem {
  name: string;
  diet: DietType | null; // null = not stated, so left unset
  variants: V[];
}
interface SeedCategory {
  name: string;
  icon: string;
  items: SeedItem[];
}

const pcs = (quantity: number, price: number): V => ({ label: `${quantity} Pieces`, quantity, unit: 'Pieces', price });
const single = (label: string, price: number | null, unit?: string, quantity?: number): V => ({ label, price, unit, quantity });

export const categorySeed: SeedCategory[] = [
  {
    name: 'Crispy Fried Chicken',
    icon: 'LocalFireDepartment',
    items: [
      { name: 'Chicken Wings', diet: 'non_veg', variants: [pcs(4, 159), pcs(6, 229), pcs(12, 399)] },
      { name: 'Chicken Legs', diet: 'non_veg', variants: [pcs(2, 189), pcs(4, 349)] },
      { name: 'Chicken Lollipops', diet: 'non_veg', variants: [pcs(3, 179), pcs(5, 279), pcs(8, 399)] },
      { name: 'Chicken Popcorn', diet: 'non_veg', variants: [single('Regular Serving', 149)] },
      { name: 'Loaded Chicken Popcorn', diet: 'non_veg', variants: [single('Loaded Serving', 229)] },
    ],
  },
  {
    name: 'Loaded Specials',
    icon: 'Fastfood',
    items: [
      { name: 'Loaded Fries', diet: null, variants: [single('Regular Serving', 179)] },
      { name: 'French Fries Plain', diet: 'veg', variants: [single('Regular Serving', 79)] },
      { name: 'French Fries Peri Peri', diet: 'veg', variants: [single('Regular Serving', 89)] },
    ],
  },
  {
    name: 'Frankie Rolls',
    icon: 'LunchDining',
    items: [
      { name: 'Veg Roll', diet: 'veg', variants: [single('Regular', 59)] },
      { name: 'Paneer Roll', diet: 'veg', variants: [single('Regular', 89)] },
      { name: 'Egg Roll', diet: 'non_veg', variants: [single('Regular', 69)] },
      { name: 'Double Egg Roll', diet: 'non_veg', variants: [single('Regular', 79)] },
      { name: 'Chicken Roll', diet: 'non_veg', variants: [single('Regular', 109)] },
    ],
  },
  {
    name: 'Sandwiches',
    icon: 'BakeryDining',
    items: [
      { name: 'Veg Sandwich', diet: 'veg', variants: [single('Regular', 89)] },
      { name: 'Corn Sandwich', diet: 'veg', variants: [single('Regular', 99)] },
      { name: 'Paneer Sandwich', diet: 'veg', variants: [single('Regular', 109)] },
    ],
  },
  {
    name: 'Mocktails & Mojitos',
    icon: 'LocalBar',
    items: [
      { name: 'Lemon Mojito', diet: 'veg', variants: [single('Glass', 59, 'Glass', 1)] },
      { name: 'Raspberry Mojito', diet: 'veg', variants: [single('Glass', 69, 'Glass', 1)] },
      { name: 'Blue Lagoon', diet: 'veg', variants: [single('Glass', 79, 'Glass', 1)] },
      { name: 'Strawberry Mojito', diet: 'veg', variants: [single('Glass', 69, 'Glass', 1)] },
    ],
  },
  {
    name: 'Milk Shakes',
    icon: 'Icecream',
    items: [
      { name: 'Vanilla Milk Shake', diet: 'veg', variants: [single('Glass', 89, 'Glass', 1)] },
      { name: 'Chocolate Milk Shake', diet: 'veg', variants: [single('Glass', 89, 'Glass', 1)] },
      { name: 'Oreo Milk Shake', diet: 'veg', variants: [single('Glass', 99, 'Glass', 1)] },
      { name: 'Strawberry Milk Shake', diet: 'veg', variants: [single('Glass', 89, 'Glass', 1)] },
      { name: 'Pista Milk Shake', diet: 'veg', variants: [single('Glass', 99, 'Glass', 1)] },
    ],
  },
  {
    name: 'Cool Drinks',
    icon: 'LocalDrink',
    items: [
      { name: 'Coca-Cola', diet: 'veg', variants: [single('Regular', 10)] },
      { name: 'Water Bottle', diet: 'veg', variants: [single('500 ML', null, 'ML', 500)] }, // price intentionally not set
    ],
  },
];
