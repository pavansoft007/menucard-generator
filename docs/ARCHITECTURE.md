# Golden Crunch Menu Builder – Architecture notes

> Written at the start of the project; updated at the end of Phase 6 to describe what was actually built. See the README for setup and operations.

## 1. Core idea
A menu book is **data**: `Menu → Pages → Elements (JSON tree)`. Menu content (items, prices, images) lives in
normalized tables; page layout lives in a JSON document per page. The same React renderer
(`<PageRenderer/>`) draws a page in the editor, the preview, and the PDF export, so what you see is what prints.

## 2. Monorepo
```
apps/
  api/   Express + TS + Sequelize (src/{config,models,migrations,seeders,middleware,modules/<feature>/{routes,controller,service,schema}})
  web/   Vite + React 19 + TS + MUI + Tailwind (src/{app,components,features/<feature>,hooks,services,store,renderer,editor})
packages/
  shared-types/   Zod schemas + TS types shared by api & web (PageLayout, Element, Theme, DTOs)
uploads/          originals/, optimized/, thumbs/ (git-ignored, configurable root; storage driver interface for S3 later)
```

## 3. Visual editor approach
- **Document model**: `PageLayout { size, orientation, margins, bindingMargin, background, elements[] }`.
  `Element` is a discriminated union: `text | image | shape | logo | section | itemCard | priceBadge | decoration`,
  each with `{id, x, y, w, h, rotation, z, locked, style, bind}` in **millimetres** (A4 = 210×297 mm).
  `bind` links an element to DB data (itemId / categoryId / settingKey) so price/name edits flow through automatically.
- **Section elements** are *auto-layout containers* (columns/rows + card template) that pull items from the DB,
  so the admin does not hand-position every card; free-form elements can still be dragged anywhere.
- **Canvas**: React + CSS transforms, scaled by zoom; mm→px via a single scale factor. Drag/resize/rotate handled by
  `react-moveable` (selection, snapping guides) – dnd-kit is used for list ordering and sidebar → canvas drops.
- **State**: Zustand store with an immer-patch history stack (undo/redo), debounced autosave (PUT page) and a
  localStorage draft so a refresh never loses work.
- **Templates**: the 6 card templates are renderer components selected by `section.cardTemplate`.

## 4. PDF / PNG export
`puppeteer-core` drives the installed Chrome/Chromium (nothing is downloaded by the project). It opens `/render/:pageId?token=…` (a chrome-free route using `<PageRenderer/>`),
`page.pdf({ width:'210mm', height:'297mm', printBackground:true, preferCSSPageSize:true })`.
- Fonts are self-hosted (`@fontsource`) → embedded in PDF.
- PNG: `deviceScaleFactor` = 300/96 ≈ 3.125 → true 300 DPI A4 (2480×3508).
- Multi-page: one PDF per page (pages may have different sizes), merged with `pdf-lib`. Chrome floors the PDF page size to 1/300 inch (A4 → 209.89 × 297.01 mm), so each page is redrawn as vector content onto a page of the exact size.
- Spiral binding: the binding strip is on the left of odd pages and the right of even pages. Element coordinates are page-relative, so it is enforced by guides, the layout generator's safe area and the export's print checks (not by silently shifting content). Bleed enlarges the sheet and sets TrimBox/BleedBox; it extends the page background colour.
- The render route is authenticated with a 15-minute, **read-only** token (rejected for any non-GET request and for the export endpoints); Chrome may only request the app's own origin.

## 5. Image storage
Multer → validate (magic-byte sniff, not just extension, size cap) → random UUID filename → keep **original**
untouched → `sharp` produces optimized WebP (max 2400 px) and 400 px thumbnail (alpha preserved) → row in
`media_library` (path, mime, w, h, bytes, hash, tags, category). `usage` tracked via FK references; delete is blocked
(409) while referenced. SVG is sanitised (DOMPurify/jsdom) before storing. Storage driver interface: `LocalDriver`, `S3Driver` stub.

## 6. Database (MySQL 8 / MariaDB via XAMPP)
users, restaurant_settings, restaurant_logos, media_library, menu_categories, menu_items, menu_item_variants
(label, quantity, unit, price, discount_price, media_id), menu_themes, menu_templates, menu_backgrounds,
menu_pages (layout JSON), menu_sections (config JSON), menu_section_items, menu_combos, menu_combo_items,
design_elements (reusable presets), menu_versions (snapshot JSON, status draft/published).
All with PK, FKs (`RESTRICT` on category→items and media→usage), indexes, timestamps, `paranoid` soft delete where sensible, `is_active`, `display_order`.

## 7. Security
JWT (httpOnly-capable, bearer for API), bcrypt, RBAC (admin/editor), helmet, express-rate-limit, CORS allow-list,
zod validation on every route, upload validation, env via `.env` + zod-checked config.

## 8. Delivery (all six phases complete)
1. Monorepo, API skeleton, Sequelize + migrations, auth, admin shell.
2. Restaurant settings, media library + sharp pipeline, logos, categories, items + variants, seed data, dashboard stats.
3. Backgrounds, themes, combos, sections, pages (JSON layouts), versions / publish.
4. Visual editor, shared renderer, six card templates, live preview, autosave and print checks.
5. PDF / PNG export, bleed, page ranges, duplex options, export history.
6. Security hardening (database-checked sessions, roles, rate limits, production guards), users and settings, image crop,
   code-splitting, production build, Docker, smoke test, documentation.

## 9. Decisions that differ from the first proposal
- **Database:** MySQL 8 in Docker on host port **3307** (the machine's 3306 belongs to another project), not XAMPP's MariaDB.
- **Export engine:** `puppeteer-core` + the installed browser instead of `puppeteer` (whose browser download is an install script).
- **Editor canvas:** a small purpose-built drag/resize/rotate/snap layer instead of `react-moveable`; `dnd-kit` is used for list ordering.
- **Soft vs hard delete:** categories, items and themes are soft-deleted; logos, backgrounds and combos are hard-deleted because a
  soft-deleted row would keep a `RESTRICT` foreign key on its image and silently lock it.
- **Image crop is non-destructive:** it always creates a new image from the untouched original.
- Food images are uploaded by the user; the seed ships no images and no invented prices.
