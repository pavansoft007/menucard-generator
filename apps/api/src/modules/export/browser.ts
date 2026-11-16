import fs from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/httpError.js';

const CANDIDATES: Record<string, string[]> = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
};

/** CHROME_PATH wins; otherwise the usual install locations. No browser is downloaded by this project. */
export function findChrome(): string | null {
  if (env.CHROME_PATH) return fs.existsSync(env.CHROME_PATH) ? env.CHROME_PATH : null;
  return (CANDIDATES[process.platform] ?? []).find((p) => fs.existsSync(p)) ?? null;
}

let browser: Promise<Browser> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
const IDLE_MS = 60_000;

async function launch(): Promise<Browser> {
  const executablePath = findChrome();
  if (!executablePath) throw new HttpError(503, 'CHROME_NOT_FOUND', 'No Chrome/Chromium was found for PDF rendering. Install Chrome or set CHROME_PATH in .env.');
  const b = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--font-render-hinting=none', '--disable-dev-shm-usage', '--hide-scrollbars', ...(env.CHROME_NO_SANDBOX ? ['--no-sandbox', '--disable-setuid-sandbox'] : [])],
  });
  b.on('disconnected', () => { browser = null; });
  return b;
}

export async function getBrowser(): Promise<Browser> {
  clearTimeout(idleTimer);
  browser ??= launch().catch((e) => { browser = null; throw e; });
  return browser;
}

export async function closeBrowser() {
  clearTimeout(idleTimer);
  const b = browser;
  browser = null;
  if (b) await (await b).close().catch(() => undefined);
}

/**
 * Runs `fn` in a fresh page that may only talk to the render origin (no external requests,
 * so a page can't be used to reach other hosts), then closes it. The browser is closed after a quiet minute.
 */
export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const b = await getBrowser();
  const page = await b.newPage();
  const origin = new URL(env.RENDER_BASE_URL).origin;
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank' || new URL(url).origin === origin) void req.continue();
    else void req.abort('blockedbyclient');
  });
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => undefined);
    idleTimer = setTimeout(() => void closeBrowser(), IDLE_MS);
  }
}
