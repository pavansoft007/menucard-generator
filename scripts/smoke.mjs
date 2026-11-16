#!/usr/bin/env node
/**
 * Post-deployment smoke test. Signs in and checks that the key parts of a running install work.
 *
 *   node scripts/smoke.mjs --url http://localhost:4000 --email admin@example.com --password '…' [--export]
 *   (or SMOKE_URL / SMOKE_EMAIL / SMOKE_PASSWORD)
 *
 * --export also renders a real PDF and verifies it is exactly A4, then deletes it. Exit code is non-zero on failure.
 */
import { PDFDocument } from 'pdf-lib';

const arg = (name, env, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : (process.env[env] ?? fallback);
};
const BASE = arg('url', 'SMOKE_URL', 'http://localhost:4000').replace(/\/$/, '');
const EMAIL = arg('email', 'SMOKE_EMAIL', 'admin@goldencrunch.local');
const PASSWORD = arg('password', 'SMOKE_PASSWORD');
const WITH_EXPORT = process.argv.includes('--export');

let failed = 0;
const ok = (name, detail = '') => console.log(`  ✔ ${name}${detail ? ` – ${detail}` : ''}`);
const bad = (name, detail) => { failed++; console.log(`  ✘ ${name} – ${detail}`); };
async function step(name, fn) {
  try { ok(name, (await fn()) ?? ''); } catch (e) { bad(name, e instanceof Error ? e.message : String(e)); }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

if (!PASSWORD) {
  console.error('Missing password: use --password or SMOKE_PASSWORD');
  process.exit(2);
}
console.log(`Smoke test against ${BASE}`);

let token = '';
const call = async (path, init = {}) => {
  const res = await fetch(BASE + path, { ...init, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', ...init.headers } });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${body?.error?.message ?? ''}`);
  return body;
};

await step('API is healthy', async () => { must((await call('/api/health')).data.status === 'ok', 'unexpected health payload'); });
await step('web app is served', async () => {
  const html = await (await fetch(BASE + '/')).text();
  must(/<div id="root">/.test(html), 'index.html not served (is the web app built into WEB_DIST?)');
});
await step('sign in', async () => { token = (await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })).data.token; must(token, 'no token'); });
await step('wrong password is rejected', async () => {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: 'definitely-wrong-1' }) });
  must(r.status === 401, `expected 401, got ${r.status}`);
});
await step('protected routes need a login', async () => {
  const r = await fetch(BASE + '/api/menu-items');
  must(r.status === 401, `expected 401, got ${r.status}`);
});
await step('restaurant settings', async () => `name "${(await call('/api/restaurant')).data.name}"`);
await step('menu data', async () => {
  const [cats, items, pages] = await Promise.all([call('/api/categories'), call('/api/menu-items?pageSize=1'), call('/api/menu-pages?withSections=true')]);
  return `${cats.data.length} categories, ${items.meta.total} items, ${pages.data.length} pages`;
});
await step('dashboard stats', async () => { const s = (await call('/api/dashboard/stats')).data; return `${s.totalImages} images`; });
await step('export engine', async () => {
  const s = (await call('/api/export/status')).data;
  must(s.chromeFound, 'Chrome/Chromium not found (set CHROME_PATH)');
  must(s.renderReachable, `the web app is not reachable at ${s.renderBaseUrl} (check RENDER_BASE_URL)`);
  return 'Chrome found, render route reachable';
});

if (WITH_EXPORT) {
  await step('PDF export is exactly A4 and has no print problems', async () => {
    const opts = { pages: 'all', sides: 'all', paper: 'native', orientation: 'native', bleedMm: 0, quality: 'standard', includeFooter: true, includePageNumbers: true, padToEven: false, dpi: 300, mode: 'book' };
    const t0 = Date.now();
    const exp = (await call('/api/export/pdf', { method: 'POST', body: JSON.stringify(opts) })).data;
    try {
      const file = await fetch(BASE + exp.downloadUrl, { headers: { Authorization: `Bearer ${token}` } });
      must(file.ok, `download failed (${file.status})`);
      const doc = await PDFDocument.load(Buffer.from(await file.arrayBuffer()));
      must(doc.getPageCount() === exp.pageCount, 'page count mismatch');
      for (const [i, p] of doc.getPages().entries()) {
        const { width, height } = p.getSize();
        const w = Math.round((width / 72) * 25.4 * 10) / 10;
        const h = Math.round((height / 72) * 25.4 * 10) / 10;
        must((w === 210 && h === 297) || (w === 297 && h === 210), `page ${i + 1} is ${w} x ${h} mm`);
      }
      const problems = exp.warnings.filter((w) => w.level === 'error');
      must(problems.length === 0, `${problems.length} print problem(s): ${problems[0]?.message}`);
      return `${exp.pageCount} pages in ${((Date.now() - t0) / 1000).toFixed(1)}s`;
    } finally {
      await call(`/api/export/${exp.id}`, { method: 'DELETE' }).catch(() => undefined);
    }
  });
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
