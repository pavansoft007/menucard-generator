import bcrypt from 'bcryptjs';
import { sequelize } from './sequelize.js';
import {
  MenuBackground, MenuCategory, MenuItem, MenuItemVariant, MenuPage, MenuSection, MenuSectionCategory, MenuTheme, RestaurantSettings, User,
} from '../models/index.js';
import { defaultBackgroundConfig, defaultPageSettings, defaultSectionConfig, defaultThemeConfig, emptyLayout, normalizePageSettings } from '@gc/shared-types';
import { env } from '../config/env.js';
import { categorySeed, restaurantSeed } from './seedData.js';

async function seedAdmin() {
  if (env.NODE_ENV === 'production' && env.ADMIN_PASSWORD === 'ChangeMe123!') {
    console.error('Refusing to seed the default admin password in production. Set ADMIN_PASSWORD in .env.');
    process.exit(1);
  }
  if (await User.findOne({ where: { email: env.ADMIN_EMAIL } })) return console.log('Admin user already exists');
  await User.create({
    email: env.ADMIN_EMAIL,
    name: 'Administrator',
    passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 12),
    role: 'admin',
  });
  console.log(`Created admin user ${env.ADMIN_EMAIL}`);
}

async function seedRestaurant() {
  const [row, created] = await RestaurantSettings.findOrCreate({ where: { id: 1 }, defaults: { id: 1, ...restaurantSeed } as RestaurantSettings });
  console.log(created ? `Created restaurant settings (${row.name})` : 'Restaurant settings already exist');
}

/** Only seeds menu data into an empty menu, so re-running never duplicates or overwrites your edits. */
async function seedMenu() {
  if ((await MenuCategory.count({ paranoid: false })) > 0) return console.log('Menu already has data – skipping menu seed');
  await sequelize.transaction(async (t) => {
    for (const [ci, cat] of categorySeed.entries()) {
      const category = await MenuCategory.create({ name: cat.name, icon: cat.icon, description: null, imageMediaId: null, iconMediaId: null, bannerMediaId: null, backgroundMediaId: null, isActive: true, displayOrder: ci + 1 }, { transaction: t });
      for (const [ii, it] of cat.items.entries()) {
        const item = await MenuItem.create(
          { categoryId: category.id, name: it.name, shortDescription: null, description: null, mainMediaId: null, dietType: it.diet, isBestseller: false, isSpicy: false, isNew: false, isFeatured: false, isAvailable: true, isActive: true, displayOrder: ii + 1 },
          { transaction: t },
        );
        await MenuItemVariant.bulkCreate(
          it.variants.map((v, vi) => ({ itemId: item.id, label: v.label, quantity: v.quantity ?? null, unit: v.unit ?? null, price: v.price, discountPrice: null, mediaId: null, displayOrder: vi + 1, isActive: true })),
          { transaction: t },
        );
      }
    }
  });
  console.log(`Seeded ${categorySeed.length} categories and ${categorySeed.reduce((n, c) => n + c.items.length, 0)} items`);
}

/** Photo-less drink lists read best as a compact two-column list, which also lets three sections share one A4 page. */
const DENSE = new Set(['Mocktails & Mojitos', 'Milk Shakes', 'Cool Drinks']);

/** Default theme, two colour/gradient backgrounds and a starting page structure (editable, deletable). */
async function seedDesign() {
  if ((await MenuTheme.count({ paranoid: false })) === 0) {
    await MenuTheme.create({ name: 'Golden Crunch', isDefault: true, config: defaultThemeConfig });
    console.log('Seeded default Golden Crunch theme');
  }
  if ((await MenuBackground.count({ paranoid: false })) === 0) {
    await MenuBackground.bulkCreate([
      { name: 'Black luxury', kind: 'page', mediaId: null, config: { ...defaultBackgroundConfig, color: '#080808', gradient: 'radial-gradient(circle at 50% 0%, #1d1710 0%, #080808 70%)' } },
      { name: 'Gold gradient', kind: 'texture', mediaId: null, config: { ...defaultBackgroundConfig, color: '#D99A19', gradient: 'linear-gradient(135deg, #F5B51B 0%, #D99A19 50%, #a8730f 100%)' } },
    ]);
    console.log('Seeded 2 backgrounds');
  }
  if ((await MenuPage.count()) > 0) return console.log('Pages already exist – skipping page seed');

  const theme = (await MenuTheme.findOne({ where: { isDefault: true } }))!;
  const bg = (await MenuBackground.findOne({ where: { name: 'Black luxury' } }))!;
  const cats = new Map((await MenuCategory.findAll()).map((c) => [c.name, c.id]));
  const settings = normalizePageSettings({ ...defaultPageSettings, backgroundId: bg.id });
  const plan: { title: string; subtitle: string | null; type: 'cover' | 'content' | 'back'; sections: string[] }[] = [
    { title: 'Cover', subtitle: null, type: 'cover', sections: [] },
    { title: 'Page 1 – Crispy Fried Chicken', subtitle: null, type: 'content', sections: ['Crispy Fried Chicken', 'Loaded Specials'] },
    { title: 'Page 2 – Rolls & Sandwiches', subtitle: null, type: 'content', sections: ['Frankie Rolls', 'Sandwiches'] },
    { title: 'Page 3 – Drinks', subtitle: null, type: 'content', sections: ['Mocktails & Mojitos', 'Milk Shakes', 'Cool Drinks'] },
    { title: 'Back cover', subtitle: null, type: 'back', sections: [] },
  ];
  for (const [pi, pg] of plan.entries()) {
    const page = await MenuPage.create({ title: pg.title, subtitle: pg.subtitle, pageType: pg.type, themeId: theme.id, isActive: true, displayOrder: pi + 1, settings, layout: emptyLayout });
    for (const [si, name] of pg.sections.entries()) {
      const categoryId = cats.get(name);
      if (!categoryId) continue;
      const section = await MenuSection.create({ pageId: page.id, title: name, subtitle: null, description: null, imageMediaId: null, backgroundId: null, displayOrder: si + 1, config: DENSE.has(name) ? { ...defaultSectionConfig, cardTemplate: 'compact-list', columns: 2 } : defaultSectionConfig });
      await MenuSectionCategory.create({ sectionId: section.id, categoryId, displayOrder: 1 });
    }
  }
  console.log(`Seeded ${plan.length} pages`);
}

try {
  await seedAdmin();
  await seedRestaurant();
  await seedMenu();
  await seedDesign();
} finally {
  await sequelize.close();
}
