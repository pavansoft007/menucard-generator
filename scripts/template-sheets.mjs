#!/usr/bin/env node
/**
 * Renders every design template applied to a real page of your menu and writes PNGs (plus per-family contact sheets)
 * for visual review. Needs the API + web app running and Chrome installed.
 *
 *   npx tsx scripts/template-sheets.mjs --out ./template-review [--cards photos|lists|auto] [--page <id>] [--only neon-feast-gold,...]
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { designTemplates } from '../packages/shared-types/src/templates.ts';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const WEB = arg('web', 'http://localhost:5180');
const API = arg('api', 'http://localhost:4000');
const OUT = path.resolve(arg('out', './template-review'));
const CARDS = arg('cards', 'photos');
const PAGE = arg('page', '');
const ONLY = arg('only', '')?.split(',').filter(Boolean);
const EMAIL = arg('email', 'admin@goldencrunch.local');
const PASSWORD = arg('password', 'ChangeMe123!');
const WIDTH = Number(arg('width', '760'));

const chromeCandidates = [process.env.CHROME_PATH, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const executablePath = chromeCandidates.find((p) => fs.existsSync(p));
if (!executablePath) { console.error('No Chrome found: set CHROME_PATH'); process.exit(2); }

const login = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) }).then((r) => r.json());
if (!login.success) { console.error('Login failed:', login.error?.message); process.exit(2); }
const token = login.data.token;

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--font-render-hinting=none', '--hide-scrollbars'] });
const results = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 1130, deviceScaleFactor: 1 });
  for (const id of designTemplates.map((t) => t.id).filter((t) => !ONLY.length || ONLY.includes(t))) {
    const url = `${WEB}/render/template/${id}?token=${encodeURIComponent(token)}&cards=${CARDS}${PAGE ? `&page=${PAGE}` : ''}`;
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('window.__GC_READY__ === true', { timeout: 60000 });
    const box = await (await page.$('#root > div')).boundingBox();
    const file = path.join(OUT, `${id}.png`);
    const raw = await page.screenshot({ clip: { x: 0, y: 0, width: Math.ceil(box.width), height: Math.ceil(box.height) }, type: 'png' });
    await sharp(raw).resize({ width: WIDTH }).png().toFile(file);
    results.push(id);
    console.log('rendered', id);
  }
} finally {
  await browser.close();
}

// contact sheets: one per family, 4 colourways side by side
const families = [...new Set(results.map((id) => id.replace(/-[^-]+$/, '')))];
for (const f of families) {
  const ids = results.filter((id) => id.startsWith(`${f}-`));
  const tiles = await Promise.all(ids.map((id) => sharp(path.join(OUT, `${id}.png`)).resize({ width: 520 }).toBuffer()));
  const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
  const h = Math.max(...metas.map((m) => m.height));
  await sharp({ create: { width: 520 * tiles.length + 10 * (tiles.length + 1), height: h + 20, channels: 3, background: '#808080' } })
    .composite(tiles.map((input, i) => ({ input, left: 10 + i * 530, top: 10 })))
    .png()
    .toFile(path.join(OUT, `sheet-${f}.png`));
}
console.log(`\n${results.length} templates -> ${OUT}`);
