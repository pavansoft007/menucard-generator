# Golden Crunch – Dynamic Restaurant Menu Builder

A database-driven menu-book designer. Upload your logo and food photos, create categories and items with
multiple sizes/prices, design unlimited A4 pages in a visual editor, preview the whole book, and export a
**print-ready PDF** (exact A4, embedded fonts, bleed, spiral-binding margins) or **300 DPI PNGs**.

Nothing about the menu is hardcoded: every name, price, image, background, theme and layout lives in the database
and is edited from the admin dashboard.

---

## Contents

1. [Features](#features) · 2. [Architecture](#architecture) · 3. [Quick start (development)](#quick-start-development)
4. [Configuration](#configuration) · 5. [Commands](#commands) · 6. [Using the app](#using-the-app)
7. [Printing & spiral binding](#printing--spiral-binding) · 8. [API overview](#api-overview) · 9. [Testing](#testing)
10. [Security](#security) · 11. [Performance](#performance) · 12. [Production deployment](#production-deployment)
13. [Backups & maintenance](#backups--maintenance) · 14. [Troubleshooting](#troubleshooting)
15. [Project structure](#project-structure) · 16. [Known limitations](#known-limitations)

---

## Features

| Area | What you get |
|---|---|
| **Restaurant & logos** | Name, tagline, phones, address, Instagram/Facebook/website, GST, footer text – used automatically via `{{tokens}}`. Multiple logo variants (PNG/SVG), a primary logo, per-page logo size/position/visibility. |
| **Catalogue** | Categories (drag-to-order, images, banners), items with **many sizes/prices per item** (4/6/12 pcs…), veg/non-veg, badges, gallery images, an unset price allowed (e.g. water bottle). |
| **Image library** | Drag & drop / bulk upload, search, categories, usage tracking, replace-in-place, **crop & resize** (non-destructive – always makes a new copy), originals always kept, WebP + thumbnails generated. In-use images can't be deleted. |
| **Design system** | Themes (colours, fonts, borders, shadows, header/footer styles – default *Golden Crunch* black & gold), backgrounds (colour / gradient / image, overlays, borders), combos with computed savings. |
| **Pages & sections** | Unlimited pages (A4 portrait/landscape or custom), sections per page, 6 reusable card templates (premium, image-left, image-top, compact list, featured, combo), move/duplicate/reorder, drafts, publishing and **version history with restore**. |
| **Visual editor** | Live A4 canvas: drag, resize, rotate, snapping guides, inline text editing, layers, align, undo/redo, zoom, **autosave** + local draft recovery, print checks (cropped / overlapping / binding-zone / overflowing content). |
| **Design templates** | 24 ready-made page designs (6 families × 4 colourways: *Neon Feast*, *Royal Classic*, *Street Pop*, *Rustic Kraft*, *Modern Minimal*, *Glass Gradient*) with glowing/ornate frames, icon header bands, ribbon/pill/stamp headings, photo-first card styles and glossy price pills. Previewed live on your own menu; applied in one transaction with an automatic backup version. |
| **Preview** | Single page, front-&-back sheets, all pages; follows edits made in other tabs. |
| **Export** | Multi-page PDF, one-PDF-per-page zip, PNG (72–600 DPI), page ranges, fronts/backs only, other paper sizes, bleed + trim box, pad-to-even for duplex, original-quality images. |
| **Admin** | Users with roles (administrator / editor), password policy, immediate session revocation, export defaults, system status. |

## Architecture

```
 Browser ── React 19 + MUI + Tailwind ──┐
                                        │  /api  (JWT)          ┌─ MySQL 8  (all content + layout JSON)
 apps/web  (Vite, TypeScript)  ─────────┼──────────────────────►│
 apps/api  (Express, Sequelize) ◄───────┘                       └─ disk: uploads/ (images)  exports/ (PDF/PNG)
        │
        └─ PDF/PNG export: headless Chrome opens  /render/:pageId  (same renderer as the editor)
```

* **One renderer.** `PageRenderer` draws a page at real size in CSS millimetres. The editor, the live preview and the
  export all use it, so *what you see is what prints*.
* **Layouts are data.** A page is `settings` + a `layout` JSON (a typed list of elements in mm: text, image, shape,
  logo, section, item card). Sections are auto-layout containers that pull items from the database, so a price change
  appears everywhere with no re-design.
* **Exports** are rendered by Chrome through a read-only, 15-minute token; PDFs are re-assembled with `pdf-lib` so
  every page is *exactly* the requested size (Chrome alone rounds A4 to 209.89 × 297.01 mm).
* **Monorepo** (npm workspaces): `apps/api`, `apps/web`, `packages/shared-types` (Zod schemas + types shared by both).

## Quick start (development)

**Requirements:** Node.js 22+, npm 10+, Docker (for MySQL), and Google Chrome / Chromium (only needed for export).

```bash
npm install
cp .env.example .env          # Windows: copy .env.example .env   — then edit JWT_SECRET
npm run db:up                 # MySQL 8 in Docker on host port 3307
npm run migrate               # create tables
npm run seed                  # first admin + the sample Golden Crunch menu, theme and pages
npm run dev:api               # API   → http://localhost:4000
npm run dev:web               # Admin → http://localhost:5180
```

Sign in at **http://localhost:5180** with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`
(default `admin@goldencrunch.local` / `ChangeMe123!` – **change it** under *Application Settings → My account*).

The seed adds your sample menu (7 categories, 27 items with sizes/prices), a default theme, two backgrounds and a
5-page structure. It contains **no images and no invented prices** (Water Bottle's price is intentionally unset).
Everything is editable and deletable. Re-running the seed never overwrites your data.

**Designs and photos:** the templates are built around food photography. Empty photo slots show artwork in previews, and print nothing in exports, so a section without photos automatically gets a clean text-list style. Upload photos, then re-apply the design (*Item cards → Automatic*) to switch those sections to photo cards.

> Ports: web **5180**, API **4000**, MySQL **3307** (chosen to avoid clashing with other local projects).

## Configuration

Environment variables (read from `.env` in the repo root; see `.env.example`).

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `production` enables strict secret checks. |
| `PORT` | `4000` | API port. |
| `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` | `127.0.0.1` `3307` `goldencrunch` ×3 | MySQL connection. |
| `JWT_SECRET` | *(required)* | ≥16 chars (≥32 and not an example value in production – the server refuses to start otherwise). |
| `JWT_EXPIRES_IN` | `8h` | Session lifetime. |
| `CORS_ORIGINS` | `http://localhost:5180` | Comma-separated allowed browser origins. |
| `UPLOAD_DIR` | `../../uploads` | Image storage (relative to `apps/api`). |
| `EXPORT_DIR` | `../../exports` | Generated PDF/PNG files. |
| `RENDER_BASE_URL` | `http://localhost:5180` | Where headless Chrome opens `/render/:pageId` – the web app's address (in production: the API's own address). |
| `CHROME_PATH` | auto-detected | Chrome/Chromium/Edge executable if not in a standard location. |
| `CHROME_NO_SANDBOX` | `false` | `true` when running as root in Docker. |
| `WEB_DIST` | `../web/dist` | Built web app served by the API in production. |
| `FORCE_HTTPS` | `false` | `true` behind TLS: enables HSTS and `upgrade-insecure-requests`. |
| `TRUST_PROXY` | – | `1` behind one reverse proxy so rate limiting sees real client IPs. |
| `ADMIN_EMAIL` `ADMIN_PASSWORD` | `admin@goldencrunch.local` / `ChangeMe123!` | First administrator created by `seed`. Production refuses the default password. |

## Commands

| Command | What it does |
|---|---|
| `npm run db:up` / `db:down` | Start / stop the MySQL container (`docker-compose.yml`). |
| `npm run migrate` | Apply pending migrations (`npm run migrate:down -w @gc/api` reverts the last). |
| `npm run seed` | Create the admin user and sample data if missing. |
| `npm run dev:api` / `dev:web` | Development servers with reload. |
| `npm run typecheck` · `npm run lint` | TypeScript and ESLint for the whole repo. |
| `npm test` | API tests (isolated `goldencrunch_test` database) + web unit tests. |
| `npm run build:all` | Build the web app and bundle the API for production. |
| `npm run smoke -- --url http://localhost:4000 --password '…' [--export]` | Post-deploy check of a running install (`--export` renders and verifies a real PDF). |

API production commands (inside `apps/api`): `npm run migrate:prod`, `npm run seed:prod`, `npm run start:prod`.

## Using the app

1. **Restaurant Settings** – name, tagline, contact details, footer text.
2. **Logo Management** – upload logos (transparent PNG / SVG), mark one primary.
3. **Image Library** – upload food photos (originals are always kept; use *Crop & resize* for a tidy copy).
4. **Menu Categories → Menu Items** – add categories and items; give each item its own image and as many
   size/price options as you need.
5. **Menu Templates** – pick one of 24 complete designs (preview it on your own menu, then *Apply*; a backup version is saved first). **Theme & Design / Backgrounds / Combos** – fine-tune the look; build combo offers.
6. **Page Builder** – create pages (cover, content, back), reorder by dragging, open one with **Design**.
7. **Visual editor** – drag content onto the page, tune it, check the *Checks* list (right panel, no page selected).
8. **Menu Preview** – flip through the whole book (*Front & back* shows duplex sheets).
9. **Versions** (Page Builder) – save a draft or publish; restore any earlier design (prices are never reverted).
10. **PDF Export** – choose pages/paper/bleed/quality → download. Review any reported problems before printing.

Text elements accept tokens that always reflect your settings, e.g. `{{restaurant.name}}`, `{{restaurant.tagline}}`,
`{{restaurant.phone1}}`, `{{restaurant.fullAddress}}`, `{{restaurant.instagram}}`, `{{page.title}}`, `{{page.number}}`.

## Printing & spiral binding

* Pages are real **A4 (210 × 297 mm)**; exports are exactly that size. PNG at 300 DPI is **2480 × 3508 px**.
* Each page has a **binding margin** (default 10 mm). With double-sided, left-bound printing the binding strip is on
  the **left of odd pages and the right of even pages**. The editor shows it as a hatched strip (turn on *Guides*) and the
  *Checks* list / export report anything inside it.
* **Bleed** (e.g. 3 mm) enlarges the sheet and sets the PDF *TrimBox*/*BleedBox*; it extends each page's background
  **colour** (images and gradients are not stretched).
* **Pad to an even page count** adds a blank last page so duplex sheets pair correctly. *Sides* exports only fronts
  (odd) or backs (even).
* **Image quality: Maximum** embeds your original uploads; *Standard* uses the optimized WebP copies.
* Fonts (Playfair Display, Poppins, Oswald, Montserrat, Bebas Neue, Cinzel, Lora, Inter) are bundled and embedded in
  the PDF – no external font requests.

## API overview

All endpoints are under `/api`, return `{ success, data, meta? }` or `{ success:false, error:{ code, message, details? } }`,
and need `Authorization: Bearer <token>` except `POST /auth/login` and `GET /health`.

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/login` · `POST /auth/logout` · `GET /auth/profile` · `POST /auth/change-password` |
| Restaurant | `GET/PUT /restaurant` |
| Logos | `GET/POST /logos` · `PUT/DELETE /logos/:id` |
| Categories | `GET/POST /categories` · `PUT/DELETE /categories/:id` · `PATCH /categories/reorder` |
| Menu items | `GET/POST /menu-items` (paging, search, filters) · `GET/PUT/DELETE /menu-items/:id` · `PATCH /menu-items/reorder` |
| Media | `POST /media/upload` · `POST /media/bulk-upload` · `GET /media` · `GET /media/by-ids` · `PUT/DELETE /media/:id` · `POST /media/:id/replace` · `POST /media/:id/crop` · `GET /media/:id/usage` |
| Themes / Backgrounds / Combos | `GET/POST` + `PUT/DELETE /:id` on `/themes`, `/backgrounds`, `/combos` (`POST /themes/:id/default`) |
| Design templates | `POST /design/apply` (restyle pages + sections atomically, with optional backup) |
| Pages | `GET/POST /menu-pages` · `GET/PUT/DELETE /menu-pages/:id` · `POST /:id/duplicate` · `PATCH /reorder` |
| Sections | `GET/POST /menu-sections` · `GET/PUT/DELETE /:id` · `POST /:id/duplicate` · `PATCH /reorder` |
| Versions | `GET/POST /menu-versions` · `POST /menu-versions/:id/restore` |
| Export | `POST /export/pdf` · `POST /export/image` · `GET /export` · `GET /export/:id/download` · `DELETE /export/:id` · `GET /export/status` |
| Admin | `GET/POST /users` · `PUT/DELETE /users/:id` · `POST /users/:id/reset-password` · `GET /settings` · `PUT /settings/export-defaults` · `GET /settings/system` |
| Misc | `GET /dashboard/stats` · `GET /health` |

Uploaded images are served from `/uploads/*`. Exports are **not** public; they need an authenticated download.

## Testing

```bash
npm test                      # 131 API tests + 36 web unit tests
npm run typecheck && npm run lint
```

* **API tests** (Vitest + Supertest) run against a throw-away `goldencrunch_test` database and an isolated upload
  folder created by `apps/api/test/globalSetup.ts` – they never touch development data. They cover auth, roles,
  session revocation, token forgery, validation, price rules, image pipeline (incl. SVG script rejection and
  pixel-level crop checks), deletion guards, layouts/versions, export options and the read-only render token.
* **Web unit tests** cover the editor's pure logic: snapping/resizing, undo/redo history, print-issue detection, token
  substitution, layout generation and crop geometry.
* **Template tests** check that all 24 designs validate against the schemas, that every colourway keeps text readable (WCAG contrast for body text, headings, price pills, ribbons), and that applying is atomic, idempotent and backed up.
* **Template review** (`npx tsx scripts/template-sheets.mjs --out ./template-review`) renders every design on your menu to PNGs and per-family contact sheets for visual review.
* **Smoke test** (`npm run smoke`) verifies a deployed install, optionally rendering a real PDF and checking it is A4.

## Security

Implemented:

* **Authentication:** bcrypt (cost 12) hashed passwords; JWT (HS256 pinned); login rate limit; identical errors and
  equalised timing for unknown email vs. wrong password; password policy (10+ chars, letter + number).
* **Sessions are checked against the database on every request.** Deactivating a user, changing their role or password,
  or resetting it ends their sessions immediately (token version). The role in the database – not the token – decides.
* **Authorisation:** administrator / editor roles; user management, settings and system status are admin-only; the
  last administrator can't be removed and nobody can lock themselves out.
* **Uploads:** content-sniffed (magic bytes, not file names), size-limited (25 MB), random file names, path-traversal
  guarded; SVGs with scripts / event handlers / external references are rejected; `/uploads` is served with a sandboxing
  CSP; originals are kept, never overwritten by crops.
* **Input:** every request body is validated with Zod (unknown fields dropped); JSON bodies are capped at 512 KB;
  Sequelize parameterises all SQL; user-supplied CSS (gradients) is restricted to plain gradient expressions.
* **Transport / headers:** Helmet (CSP, nosniff, frame protection, referrer policy); HSTS and
  `upgrade-insecure-requests` when `FORCE_HTTPS=true`; CORS allow-list; bearer tokens (no cookies) so no CSRF surface.
* **Abuse limits:** global, upload and export rate limits; exports are serialised and queued.
* **Export isolation:** headless Chrome gets a 15-minute **read-only** token, may only request the app's own origin,
  and tokens are redacted from access logs. Exported files require authentication.
* **Production guards:** the server refuses to start with a weak/example `JWT_SECRET`, and the seed refuses the
  default admin password.
* **Errors:** generic 500s – no stack traces or internals in responses.

Accepted / known:

* Tokens live in the browser's `localStorage` (standard for SPAs); a strict CSP and React's escaping are the
  mitigations. Sessions last `JWT_EXPIRES_IN` (default 8 h) unless revoked.
* `npm audit` still lists: **zod** (high – memory use when validating very large collections; bounded here by the 512 KB
  body cap; the fix is the zod 3→4 major upgrade, planned), **sequelize → uuid** (moderate – affects UUID v3/v5/v6 with
  a caller-supplied buffer, which Sequelize doesn't use) and dev-only lint tooling (`minimatch`). There are no critical
  findings.
* User state is cached ~5 s per API instance; with several instances behind a load balancer, a revoked session can
  remain valid for up to that long on the other instances.

## Performance

* The web app is split by route (editor, preview, export, render load on demand) and by stable vendor chunks; the
  application code itself is ~33 KB (≈12 KB gzipped). The API gzips responses and caches uploaded images for 30 days
  (immutable, content-addressed names).
* Images are optimized once on upload (WebP ≤ 2400 px + 400 px thumbnails); lists use grouped queries (no N+1) and
  server-side pagination; indexes cover category/page/section ordering.
* Exports reuse one headless browser, render pages sequentially (bounded memory), and refuse PNGs above 90 megapixels.

## Production deployment

### Option A – Docker (recommended)

```bash
cp .env.production.example .env.production        # fill in DB passwords, JWT_SECRET, ADMIN_PASSWORD
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

This starts MySQL (not exposed) and one app container that applies migrations, seeds the first admin on first run,
and serves the API, the web app and the PDF renderer on `APP_PORT` (default 4000). Put a TLS-terminating reverse proxy
(Caddy / nginx / Traefik) in front, then set `FORCE_HTTPS=true`, `TRUST_PROXY=1` and `PUBLIC_URL=https://your-domain`.
Images and exports live in the `uploads` and `exports` volumes.

Verify the install:

```bash
npm run smoke -- --url http://localhost:4000 --email <ADMIN_EMAIL> --password '<ADMIN_PASSWORD>' --export
```

### Option B – directly on a server

```bash
npm ci
npm run build:all
# .env: NODE_ENV=production, strong JWT_SECRET, DB_*, ADMIN_PASSWORD, RENDER_BASE_URL=http://localhost:4000,
#       CHROME_PATH if Chrome is not in a standard location
cd apps/api
npm run migrate:prod && npm run seed:prod
npm run start:prod                  # run under systemd / pm2; reverse-proxy to PORT
```

Install Chrome or Chromium on the server (e.g. `apt install chromium`) and set `CHROME_PATH=/usr/bin/chromium`.

## Backups & maintenance

* **Database:** `docker exec <mysql-container> mysqldump -u root -p goldencrunch > backup.sql`.
* **Files:** back up the `uploads` and `exports` folders/volumes (exports can be regenerated).
* **Upgrades:** deploy the new build and run `migrate:prod` (migrations are additive and recorded in `SequelizeMeta`).
* **Menu history:** *Page Builder → Versions* snapshots designs; use it before big redesigns.
* Rotate `JWT_SECRET` to sign everyone out; reset a user's password to end just their sessions.

## Troubleshooting

| Symptom | Fix |
|---|---|
| *“No Chrome/Chromium was found”* | Install Chrome or set `CHROME_PATH`; check *Application Settings → System*. |
| Export fails with *“could not be rendered”* | The exporter can't open the web app: check `RENDER_BASE_URL` (dev: the web dev server must be running). |
| Port 3306/5173 already in use | This project uses MySQL **3307** and web **5180**; change them in `docker-compose.yml`, `.env` and `vite.config.ts`. |
| Can't sign in after changing a password elsewhere | Sessions end on password change – sign in again. |
| Server exits: *JWT_SECRET is too weak* | Set a random secret of 32+ characters when `NODE_ENV=production`. |
| Export says content is cropped / in the binding zone | Open the page in the editor; *Checks* lists each element; use *Fit sections to content & stack*. |
| No images in an export | Upload photos – cards without a photo print compactly, with no placeholder. |

## Project structure

```
apps/
  api/            Express + Sequelize (src/modules/<feature>/…, migrations, seeders, test/)
  web/            React app (src/features/*, src/editor/*, src/renderer/*)
packages/
  shared-types/   Zod schemas + TypeScript types shared by api and web
scripts/smoke.mjs Post-deploy smoke test
docs/             Architecture notes
Dockerfile · docker-compose.yml (dev DB) · docker-compose.prod.yml
```

## Known limitations

* Bleed extends background *colour* only (not images/gradients); no crop marks.
* Rotated elements can't be resized until their rotation is reset; no marquee (rubber-band) selection.
* One editor per page at a time: two people editing the same page will overwrite each other (last save wins).
* Section content is positioned in boxes, so a very long list needs a taller box or another page – the *Checks* list
  tells you when.
* Tokens are stored in `localStorage`; there is no refresh-token flow (sign in again after expiry).
* The zod 3 → 4 upgrade (see Security) is pending.
