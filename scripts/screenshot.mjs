#!/usr/bin/env node
/**
 * Bastion Law — automated screenshot generator
 *
 * Usage:
 *   cp .env.screenshot.example .env.screenshot
 *   # fill in credentials, then:
 *   node screenshot.mjs              # all three apps
 *   node screenshot.mjs --only=web   # owner portal only
 *   node screenshot.mjs --only=client
 *   node screenshot.mjs --only=lawyer
 *
 * Output: ../screenshots/{web,client,lawyer}/*.png
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { mkdir, readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const OUT = join(ROOT, 'screenshots');

// ── credentials ────────────────────────────────────────────────────────────
async function loadEnv() {
  try {
    const raw = await readFile(join(__dir, '.env.screenshot'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m) process.env[m[1]] = m[2].trim();
    }
  } catch {
    // .env.screenshot is optional if vars are already in environment
  }
}

function env(key) {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}. See scripts/.env.screenshot.example`);
  return v;
}

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const onlyFlag = args.find(a => a.startsWith('--only='))?.split('=')[1];
const doWeb    = !onlyFlag || onlyFlag === 'web';
const doClient = !onlyFlag || onlyFlag === 'client';
const doLawyer = !onlyFlag || onlyFlag === 'lawyer';

// ── server management ───────────────────────────────────────────────────────
const servers = [];

function startServer(label, cmd, args, cwd, port) {
  return new Promise((resolve, reject) => {
    console.log(`▶  Starting ${label} on :${port}…`);
    const proc = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } });
    servers.push(proc);

    const timeout = setTimeout(() => reject(new Error(`${label} timed out`)), 90_000);
    const ready = /ready|started|localhost/i;

    function check(data) {
      const s = data.toString();
      if (ready.test(s)) {
        clearTimeout(timeout);
        console.log(`✓  ${label} ready`);
        resolve(proc);
      }
    }

    proc.stdout.on('data', check);
    proc.stderr.on('data', check);
    proc.on('error', reject);
  });
}

async function waitForPort(port, retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const { default: http } = await import('http');
      await new Promise((res, rej) => {
        const req = http.get(`http://localhost:${port}`, res);
        req.on('error', rej);
        req.setTimeout(1000, () => { req.destroy(); rej(new Error('timeout')); });
      });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error(`Port ${port} never became reachable`);
}

function stopServers() {
  for (const p of servers) {
    try { process.kill(-p.pid, 'SIGTERM'); } catch { try { p.kill('SIGTERM'); } catch { } }
  }
}

// ── page definitions (filled with real IDs at runtime) ───────────────────────
const WEB_PAGES = [
  { name: '01-login',        path: '/login',        auth: false },
  { name: '02-dashboard',    path: '/dashboard',    auth: true  },
  { name: '03-analytics',    path: '/analytics',    auth: true  },
  { name: '04-clients',      path: '/clients',      auth: true  },
  { name: '05-lawyers',      path: '/lawyers',      auth: true  },
  { name: '06-matters',      path: '/matters',      auth: true  },
  { name: '07-appointments', path: '/appointments', auth: true  },
  { name: '08-billing',      path: '/billing',      auth: true  },
  { name: '09-settings',     path: '/settings',     auth: true  },
];

// Tab labels as they appear in the tab bar UI (used for click-based navigation)
const CLIENT_TABS  = ['Home', 'Cases', 'Docs', 'Messages', 'Schedule', 'Search'];
const LAWYER_TABS  = ['Dashboard', 'Board', 'Clients', 'Calendar', 'Search'];
// Matter detail tab labels (rendered as buttons inside the matter screen)
const MATTER_TABS  = ['overview', 'actions', 'docs', 'billing', 'expenses', 'contacts', 'notes', 'audit', 'chat'];

// ── Supabase session injection ───────────────────────────────────────────────
// Rather than fighting UI login forms (Expo buttons aren't real HTML buttons,
// Next.js navigation timing is unpredictable), we sign in via the Supabase
// REST API directly, get the session tokens, then inject them into the
// browser's localStorage before navigating to any authenticated page.

const SUPABASE_URL  = 'https://pqqusreplevsdmntvzww.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxcXVzcmVwbGV2c2RtbnR2end3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMDAyNjcsImV4cCI6MjA5Njc3NjI2N30.k7heulCxVYiA9jCq1bscsR9nBGnEJ0VD3Yb4-l-h5F8';
const STORAGE_KEY   = 'sb-pqqusreplevsdmntvzww-auth-token';

async function getSupabaseSession(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase auth failed for ${email}: ${err}`);
  }
  const data = await res.json();
  // Supabase localStorage format
  return {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    Math.floor(Date.now() / 1000) + data.expires_in,
    expires_in:    data.expires_in,
    token_type:    'bearer',
    user:          data.user,
  };
}

async function injectSession(page, baseUrl, session) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: session });
}

async function fetchIds(lawyerSession, clientSession) {
  const headers = {
    'apikey': SUPABASE_ANON,
    'Authorization': `Bearer ${lawyerSession.access_token}`,
    'Content-Type': 'application/json',
  };

  // Get a matter the lawyer is assigned to
  const mRes = await fetch(`${SUPABASE_URL}/rest/v1/matters?select=id&limit=1`, { headers });
  const matters = await mRes.json();
  const matterId = matters?.[0]?.id ?? 'unknown';

  // Get a matter the client has (use client token)
  const cHeaders = { ...headers, 'Authorization': `Bearer ${clientSession.access_token}` };
  const cRes = await fetch(`${SUPABASE_URL}/rest/v1/matters?select=id&limit=1`, { headers: cHeaders });
  const cMatters = await cRes.json();
  const caseId = cMatters?.[0]?.id ?? matterId;

  return { matterId, caseId };
}

// ── Web portal: URL-based navigation works fine (Next.js SSR, no redirect loop) ──
async function screenshotWeb(page, baseUrl, pages, outDir, session) {
  await mkdir(outDir, { recursive: true });

  const loginPage = pages.find(p => !p.auth);
  if (loginPage) {
    try {
      await page.goto(`${baseUrl}${loginPage.path}`, { waitUntil: 'networkidle', timeout: 20_000 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: join(outDir, `${loginPage.name}.png`), fullPage: true });
      console.log(`  📸 ${loginPage.name}.png`);
    } catch (err) { console.warn(`  ⚠  ${loginPage.name}: ${err.message}`); }
  }

  await injectSession(page, baseUrl, session);

  for (const pg of pages.filter(p => p.auth)) {
    try {
      await page.goto(`${baseUrl}${pg.path}`, { waitUntil: 'networkidle', timeout: 25_000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: join(outDir, `${pg.name}.png`), fullPage: true });
      console.log(`  📸 ${pg.name}.png`);
    } catch (err) { console.warn(`  ⚠  ${pg.name}: ${err.message}`); }
  }
}

// ── Expo apps: _layout.tsx always redirects to home/dashboard on full reload.
//    Strategy: inject session, load once, then click tab bar links (client-side
//    navigation → no reload → no redirect loop). Matter detail tabs clicked inline.
async function screenshotExpo(page, baseUrl, tabLabels, matterId, outDir, session) {
  await mkdir(outDir, { recursive: true });

  // 1. Login screen (unauthenticated)
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 20_000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(outDir, '01-login.png'), fullPage: true });
    console.log(`  📸 01-login.png`);
  } catch (err) { console.warn(`  ⚠  login: ${err.message}`); }

  // 2. Inject session and do ONE page load — let the app redirect to its default tab
  await injectSession(page, baseUrl, session);
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 25_000 });
  await page.waitForTimeout(4000); // wait for fonts + auth + redirect to settle

  // 3. Click each tab bar link (Expo Router renders these as <a> tags in web mode)
  for (let i = 0; i < tabLabels.length; i++) {
    const label = tabLabels[i];
    const num   = String(i + 2).padStart(2, '0');
    const name  = `${num}-${label.toLowerCase()}`;
    try {
      // Tab bar <a> links have the tab title as their text content
      const link = page.locator(`a`).filter({ hasText: new RegExp(`^${label}$`, 'i') }).last();
      await link.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true });
      console.log(`  📸 ${name}.png`);
    } catch (err) { console.warn(`  ⚠  ${name}: ${err.message}`); }
  }

  if (!matterId || matterId === 'unknown') return;

  // 4. Click into a matter from the list (client-side navigation → no redirect)
  //    We navigate to the matters/cases tab first, then click the first matter card.
  const casesTabLabel = tabLabels.find(t => /case|board|matter/i.test(t)) ?? tabLabels[1];
  try {
    const casesLink = page.locator(`a`).filter({ hasText: new RegExp(`^${casesTabLabel}$`, 'i') }).last();
    await casesLink.click({ timeout: 5000 });
    await page.waitForTimeout(2000);

    // Click the first matter/case card to open detail
    const matterCard = page.locator('[data-testid="matter-card"], [href*="/matter/"]').first()
      .or(page.locator('text=/view|open|details/i').first());
    const cardVisible = await matterCard.isVisible({ timeout: 4000 }).catch(() => false);
    if (cardVisible) {
      await matterCard.click();
      await page.waitForTimeout(3000);
    } else {
      // Fallback: direct client-side push via history API (no full reload)
      await page.evaluate(url => window.history.pushState({}, '', url), `/matter/${matterId}`);
      await page.waitForTimeout(3000);
    }
  } catch (err) {
    // Fallback to history push
    await page.evaluate(url => window.history.pushState({}, '', url), `/matter/${matterId}`).catch(() => {});
    await page.waitForTimeout(3000);
  }

  // 5. Screenshot each matter detail tab by clicking the tab buttons
  for (let i = 0; i < MATTER_TABS.length; i++) {
    const tab = MATTER_TABS[i];
    const num  = String(tabLabels.length + i + 2).padStart(2, '0');
    const name = `${num}-matter-${tab}`;
    try {
      const btn = page.locator(`text=/^${tab}$/i`).last();
      const vis = await btn.isVisible({ timeout: 3000 }).catch(() => false);
      if (vis) { await btn.click(); await page.waitForTimeout(1500); }
      await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true });
      console.log(`  📸 ${name}.png`);
    } catch (err) { console.warn(`  ⚠  ${name}: ${err.message}`); }
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
await loadEnv();

let ownerEmail, ownerPass, lawyerEmail, lawyerPass, clientEmail, clientPass;
try {
  if (doWeb)    { ownerEmail  = env('OWNER_EMAIL');  ownerPass  = env('OWNER_PASS');  }
  if (doLawyer) { lawyerEmail = env('LAWYER_EMAIL'); lawyerPass = env('LAWYER_PASS'); }
  if (doClient) { clientEmail = env('CLIENT_EMAIL'); clientPass = env('CLIENT_PASS'); }
} catch (e) {
  console.error(`\n❌ ${e.message}\n`);
  process.exit(1);
}

// Start servers
const serverPromises = [];
if (doWeb)    serverPromises.push(startServer('Owner Portal', 'npm', ['run', 'dev'], join(ROOT, 'apps', 'web'), 3000));
if (doClient) serverPromises.push(startServer('Client App',  'npx', ['expo', 'start', '--web', '--port', '8081'], join(ROOT, 'apps', 'client-app'), 8081));
if (doLawyer) serverPromises.push(startServer('Lawyer App',  'npx', ['expo', 'start', '--web', '--port', '8082'], join(ROOT, 'apps', 'lawyer-app'), 8082));

process.on('exit', stopServers);
process.on('SIGINT', () => { stopServers(); process.exit(0); });
process.on('SIGTERM', () => { stopServers(); process.exit(0); });

await Promise.all(serverPromises);

// Extra wait for Next.js / Expo to fully compile
if (doWeb)    await waitForPort(3000);
if (doClient) await waitForPort(8081);
if (doLawyer) await waitForPort(8082);

await new Promise(r => setTimeout(r, 3000));

// Fetch Supabase sessions before opening the browser (pure HTTP, no UI)
console.log('\n🔑 Authenticating with Supabase…');
let ownerSession, clientSession, lawyerSession;
if (doWeb)    ownerSession  = await getSupabaseSession(ownerEmail,  ownerPass);
if (doClient) clientSession = await getSupabaseSession(clientEmail, clientPass);
if (doLawyer) lawyerSession = await getSupabaseSession(lawyerEmail, lawyerPass);
console.log('✓  Sessions ready');

// Fetch real matter/case IDs so detail pages can be navigated to
console.log('🔍 Fetching matter IDs…');
const fallbackSession = lawyerSession ?? clientSession ?? ownerSession;
const clientFallback  = clientSession ?? lawyerSession ?? ownerSession;
const { matterId, caseId } = await fetchIds(fallbackSession, clientFallback);
console.log(`✓  matterId=${matterId}  caseId=${caseId}`);

// Launch browser
const browser = await chromium.launch({ headless: true });

try {
  // ── Owner Portal (URL-based navigation) ──────────────────────────────────
  if (doWeb) {
    console.log('\n📱 Owner Portal');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await screenshotWeb(page, 'http://localhost:3000', WEB_PAGES, join(OUT, 'web'), ownerSession);
    await ctx.close();
  }

  // ── Client App (click-based navigation) ──────────────────────────────────
  if (doClient) {
    console.log('\n📱 Client App (Expo Web)');
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await screenshotExpo(page, 'http://localhost:8081', CLIENT_TABS, caseId, join(OUT, 'client'), clientSession);
    await ctx.close();
  }

  // ── Lawyer App (click-based navigation) ──────────────────────────────────
  if (doLawyer) {
    console.log('\n📱 Lawyer App (Expo Web)');
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await screenshotExpo(page, 'http://localhost:8082', LAWYER_TABS, matterId, join(OUT, 'lawyer'), lawyerSession);
    await ctx.close();
  }

} finally {
  await browser.close();
  stopServers();
}

console.log(`\n✅ Done — screenshots saved to ${OUT}`);
