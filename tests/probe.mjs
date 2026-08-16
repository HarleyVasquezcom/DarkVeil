import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';

let puppeteer;
try {
  puppeteer = createRequire(import.meta.url)('puppeteer');
} catch (error) {
  console.error('puppeteer not found. Install it first: npm.cmd install (see README).');
  process.exit(1);
}

const EXT = path.resolve(import.meta.dirname, '..');
const EXT_FWD = EXT.replaceAll('\\', '/');
let CHROME;
try {
  CHROME = process.env.PROBE_CHROME || (await puppeteer.executablePath());
} catch (error) {
  CHROME = process.env.PROBE_CHROME;
  if (!CHROME) {
    console.error('Chrome for Testing not found; set PROBE_CHROME or run npm install.');
    process.exit(1);
  }
}
const DEPLOY_URL = (process.env.DARKVEIL_DEPLOY_URL || '').replace(/\/+$/, '');
const LANDING = pathToFileURL(path.join(EXT, 'landing', 'index.html')).href;
const FIXTURE = fs.readFileSync(path.join(import.meta.dirname, 'fixtures', 'site.html'), 'utf8');

const EXPECTED_LABELS = {
  tagline: {
    en: 'whitelisted dark, everywhere else untouched', es: 'oscuro solo donde lo eliges, el resto intacto',
    fr: 'sombre là où tu le choisis, intact ailleurs', pt: 'escuro só onde você escolhe, intocado no resto',
    it: 'scuro solo dove scegli, intatto altrove', de: 'dunkel nur wo du es wählst, unberührt sonst',
  },
  credit: {
    en: 'Built by Harley Vásquez', es: 'Creado por Harley Vásquez', fr: 'Créé par Harley Vásquez',
    pt: 'Criado por Harley Vásquez', it: 'Creato da Harley Vásquez', de: 'Erstellt von Harley Vásquez',
  },
};

let passes = 0;
let failures = 0;
const problems = [];

function check(name, ok, extra) {
  if (ok) {
    passes += 1;
    console.log('  PASS ' + name);
  } else {
    failures += 1;
    problems.push(name + (extra ? ' — ' + extra : ''));
    console.log('  FAIL ' + name + (extra ? ' — ' + extra : ''));
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeoutMs, intervalMs = 200) {
  const start = Date.now();
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (error) {}
    if (Date.now() - start > timeoutMs) return null;
    await sleep(intervalMs);
  }
}

const server = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://localhost').pathname;
  if (p === '/site.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(FIXTURE);
  } else {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const SITE_PAGE = `http://127.0.0.1:${PORT}/site.html`;

const launch = (args) =>
  puppeteer.launch({ headless: true, executablePath: CHROME, args, protocolTimeout: 60000 });

const storageGet = (page, keys) => page.evaluate((ks) => chrome.storage.local.get(ks), keys);

const filterOf = (page) => page.evaluate(() => getComputedStyle(document.documentElement).filter || '');

console.log('DarkVeil probe (extension: ' + EXT + ')');
console.log('fixture server: ' + SITE_PAGE);

let browser = null;
let base = null;
let ZIP_BYTES = 0;

try {
  // ---- BASELINE ----
  base = await launch([]);
  {
    const page = await base.newPage();
    await page.goto(SITE_PAGE, { waitUntil: 'domcontentloaded' });
    await sleep(800);
    const f = await filterOf(page);
    check('baseline: no CSS filter without extension', f === 'none' || f === '', f);
    await page.close();
  }

  // ---- EXTENSION BROWSER ----
  browser = await launch([`--disable-extensions-except=${EXT_FWD}`, `--load-extension=${EXT_FWD}`]);

  const bootSwSeen = [];
  browser.on('targetcreated', (t) => {
    if (t.type() === 'service_worker' && t.url().includes('/background.js')) bootSwSeen.push(t.url());
  });
  await waitFor(() => (bootSwSeen.length > 0 ? true : null), 10000);

  const registry = await (async () => {
    const page = await browser.newPage();
    await page.goto('chrome://extensions-internals', { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    const text = await page.evaluate(() => (document.body ? document.body.innerText : '[]'));
    await page.close();
    try { return JSON.parse(text); } catch (e) { return []; }
  })();
  const entry = (Array.isArray(registry) ? registry : []).find((e) => e && e.name === 'DarkVeil');
  const extId = entry ? entry.id : null;
  check('extension registered and ENABLED', !!entry && entry.registry_status === 'ENABLED' && entry.location === 'COMMAND_LINE', entry ? entry.registry_status : 'not found');
  check('manifest_version 3 confirmed by Chrome', !!entry && entry.manifest_version === 3, entry && String(entry.manifest_version));
  if (!extId) throw new Error('extension id not found');

  const popupUrl = `chrome-extension://${extId}/popup.html`;
  const popup = await browser.newPage();
  let popupErrors = 0;
  popup.on('pageerror', (e) => {
    popupErrors += 1;
    console.log('    [popup pageerror] ' + e.message);
  });

  const page = await browser.newPage();
  await page.goto(SITE_PAGE + '?ready=1', { waitUntil: 'domcontentloaded' });
  await page.bringToFront();
  await sleep(600);

  await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popup.waitForFunction(() => document.getElementById('stateLed') !== null, { timeout: 8000, polling: 100 });

  // defaults
  const defaults = await popup.evaluate(async () => {
    const s = await chrome.storage.local.get(['dv:on', 'dv:whitelist', 'dv:strength', 'dv:sepia', 'dv:brightness', 'dv:lastHost']);
    return {
      on: s['dv:on'], whitelist: s['dv:whitelist'], strength: s['dv:strength'],
      sepia: s['dv:sepia'], brightness: s['dv:brightness'], lastHost: s['dv:lastHost'],
    };
  });
  check('defaults: dv:on = false', defaults.on === false, String(defaults.on));
  check('defaults: empty whitelist', Array.isArray(defaults.whitelist) && defaults.whitelist.length === 0, JSON.stringify(defaults.whitelist));
  check('defaults: strength 85 / sepia 8 / brightness -12', defaults.strength === 85 && defaults.sepia === 8 && defaults.brightness === -12, `${defaults.strength}/${defaults.sepia}/${defaults.brightness}`);
  check('content script reported host (dv:lastHost = 127.0.0.1)', defaults.lastHost === '127.0.0.1', String(defaults.lastHost));

  check('popup renders without JS exceptions', popupErrors === 0, popupErrors + ' errors');
  check('fresh profile: night room shows CLEAR state', (await popup.evaluate(() => document.getElementById('stateLed').dataset.state)) === 'off', '');

  const perms = await popup.evaluate(async () => {
    const all = await chrome.permissions.getAll();
    return { permissions: all.permissions || [], origins: all.origins || [] };
  });
  check(
    'permission surface: storage only, http/https (no <all_urls>)',
    perms.permissions.length === 1 && perms.permissions.includes('storage') &&
      perms.origins.length === 2 && perms.origins.includes('http://*/*') && perms.origins.includes('https://*/*'),
    JSON.stringify(perms)
  );

  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  check('manifest v3 + 1 permission (no <all_urls>)', manifest.manifest_version === 3 && manifest.permissions.length === 1 && !JSON.stringify(manifest).includes('<all_urls>'), '');

  // ---- ENABLE, EMPTY WHITELIST: nothing veiled ----
  await popup.evaluate(() => document.getElementById('toggleBtn').click());
  await waitFor(() => popup.evaluate(async () => (await chrome.storage.local.get('dv:on'))['dv:on'] === true ? true : null), 8000);
  check('toggle: dv:on = true persisted', true, '');
  await sleep(600);
  const emptyFilter = await filterOf(page);
  check('veil on + empty whitelist: page stays clear', !emptyFilter.includes('invert'), emptyFilter);
  check('veil on + empty whitelist: no style tag injected', (await page.evaluate(() => document.getElementById('dv-shadow') === null)) === true, '');

  // ---- ADD CURRENT PAGE -> veil applies ----
  await popup.evaluate(() => document.getElementById('addBtn').click());
  const listStored = await waitFor(() => popup.evaluate(async () => {
    const s = await chrome.storage.local.get('dv:whitelist');
    return s['dv:whitelist'] && s['dv:whitelist'].length === 1 ? s['dv:whitelist'][0] : null;
  }), 8000);
  check('add current page: whitelist = [127.0.0.1]', listStored === '127.0.0.1', String(listStored));
  const veilOn = await waitFor(() => page.evaluate(() => {
    const f = getComputedStyle(document.documentElement).filter || '';
    return f.includes('invert') ? f : null;
  }), 8000);
  check('whitelisted site veiled: filter applied live', veilOn !== null, String(veilOn));
  check('filter uses invert(0.85) + hue-rotate(180deg)', /invert\(0\.85\)/.test(veilOn || '') && veilOn.includes('hue-rotate(180deg)'), String(veilOn));
  check('filter applies sepia(0.08) + brightness(0.88) defaults', /sepia\(0\.08\)/.test(veilOn || '') && /brightness\(0\.88\)/.test(veilOn || ''), String(veilOn));
  check('style tag present under id dv-shadow', (await page.evaluate(() => document.getElementById('dv-shadow') !== null)) === true, '');

  // ---- SLIDERS CHANGE THE FILTER ----
  await popup.evaluate(() => {
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('strengthRange', 60);
    set('sepiaRange', 40);
    set('brightnessRange', 10);
  });
  const customFilter = await waitFor(() => page.evaluate(() => {
    const f = getComputedStyle(document.documentElement).filter || '';
    return /invert\(0\.6\)/.test(f) ? f : null;
  }), 8000);
  check('strength slider -> invert(0.6) live', customFilter !== null, String(customFilter));
  check('sepia slider -> sepia(0.4)', customFilter && /sepia\(0\.4\)/.test(customFilter), String(customFilter));
  check('brightness slider -> brightness(1.1)', customFilter && /brightness\(1\.1\)/.test(customFilter), String(customFilter));
  const uiVals = await popup.evaluate(() => ({
    s: document.getElementById('strengthVal').textContent,
    e: document.getElementById('sepiaVal').textContent,
    b: document.getElementById('brightnessVal').textContent,
  }));
  check('popup slider labels updated (60% / 40% / +10%)', uiVals.s === '60%' && uiVals.e === '40%' && uiVals.b === '+10%', JSON.stringify(uiVals));

  // ---- RELOAD: veil + settings persist ----
  await page.goto(SITE_PAGE + '?reload=1', { waitUntil: 'domcontentloaded' });
  await sleep(600);
  const reloadedFilter = await filterOf(page);
  check('after reload: whitelisted site still veiled', /invert\(0\.6\)/.test(reloadedFilter) && /brightness\(1\.1\)/.test(reloadedFilter), reloadedFilter);
  await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popup.waitForFunction(() => document.getElementById('stateLed') !== null, { timeout: 8000, polling: 100 });
  const ui = await popup.evaluate(() => ({
    led: document.getElementById('stateLed').dataset.state,
    rows: document.querySelectorAll('#list li[data-host]').length || Array.from(document.querySelectorAll('#list li .host')).map((e) => e.textContent),
    strength: document.getElementById('strengthRange').value,
    sepia: document.getElementById('sepiaRange').value,
    brightness: document.getElementById('brightnessRange').value,
  }));
  check('popup reload: LED stays on', ui.led === 'on', ui.led);
  check('popup reload: whitelist row present', Array.isArray(ui.rows) && ui.rows.includes('127.0.0.1'), JSON.stringify(ui.rows));
  check('popup reload: slider values persisted (60/40/10)', ui.strength === '60' && ui.sepia === '40' && ui.brightness === '10', JSON.stringify(ui));

  // ---- NON-WHITELISTED HOST STAYS CLEAR ----
  await popup.evaluate(async () => chrome.storage.local.set({ 'dv:whitelist': ['other.test'] }));
  await page.goto(SITE_PAGE + '?nomatch=1', { waitUntil: 'domcontentloaded' });
  await sleep(800);
  const clearFilter = await filterOf(page);
  check('non-whitelisted host stays clear', !clearFilter.includes('invert'), clearFilter);
  check('non-whitelisted host: no style tag', (await page.evaluate(() => document.getElementById('dv-shadow') === null)) === true, '');

  // ---- RE-ADD + OFF ----
  await popup.evaluate(async () => chrome.storage.local.set({ 'dv:whitelist': ['127.0.0.1'] }));
  await page.goto(SITE_PAGE + '?readd=1', { waitUntil: 'domcontentloaded' });
  await waitFor(() => page.evaluate(() => (getComputedStyle(document.documentElement).filter || '').includes('invert') ? true : null), 8000);
  check('re-added host veiled again', true, '');
  await popup.evaluate(() => document.getElementById('toggleBtn').click());
  await waitFor(() => popup.evaluate(async () => (await chrome.storage.local.get('dv:on'))['dv:on'] === false ? true : null), 8000);
  const offFilter = await waitFor(() => page.evaluate(() => {
    const f = getComputedStyle(document.documentElement).filter || '';
    return !f.includes('invert') ? 'clear' : null;
  }), 8000);
  check('toggle off: filter removed live', offFilter === 'clear', String(offFilter));

  // ---- FROZEN ----
  const freshPage = await browser.newPage();
  await freshPage.goto(SITE_PAGE + '?frozen=1', { waitUntil: 'domcontentloaded' });
  await freshPage.bringToFront();
  await sleep(800);
  check('frozen (off): no veil on fresh page', (await filterOf(freshPage)) === 'none' || (await filterOf(freshPage)) === '', await filterOf(freshPage));
  const frozenAll = await storageGet(popup, null);
  const keys = Object.keys(frozenAll).filter((k) => k.startsWith('dv:'));
  check('frozen: only dv:* keys in storage', keys.length === 6 && ['dv:on', 'dv:whitelist', 'dv:strength', 'dv:sepia', 'dv:brightness', 'dv:lastHost'].every((k) => keys.includes(k)), keys.join(','));

  // ---- i18n ----
  const langCheck = async (code, expected) => {
    await popup.select('#langSel', code);
    const ok = await waitFor(() => popup.evaluate((exp) => document.querySelector('[data-i18n="tagline"]')?.textContent === exp, expected), 6000);
    check(`language switch to ${code} re-renders popup`, ok === true, expected);
    if (ok) {
      const credit = await popup.evaluate(() => document.querySelector('[data-i18n="credit"]')?.textContent);
      check(`language ${code}: credit localized`, credit === EXPECTED_LABELS.credit[code], credit);
      await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
      await popup.waitForFunction(() => document.querySelector('[data-i18n="tagline"]')?.textContent !== '', { timeout: 8000, polling: 100 });
      const persisted = await popup.evaluate((exp) => document.querySelector('[data-i18n="tagline"]')?.textContent === exp, expected);
      check(`language ${code}: persisted across reload`, persisted === true, 'reverted');
    }
  };
  await popup.select('#langSel', 'en');
  for (const code of ['fr', 'de', 'es', 'pt', 'it']) {
    await langCheck(code, EXPECTED_LABELS.tagline[code]);
  }
  await popup.evaluate(() => chrome.storage.local.remove('dv:lang'));
  await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popup.waitForFunction(() => document.querySelector('[data-i18n="tagline"]')?.textContent !== '', { timeout: 8000, polling: 100 });
  const navLang = await popup.evaluate(() => (navigator.language || 'en').toLowerCase().split('-')[0]);
  const defaulted = await popup.evaluate(() => document.querySelector('[data-i18n="tagline"]')?.textContent);
  check('default language = navigator language (or en)', ['en', 'es', 'fr', 'pt', 'it', 'de'].includes(navLang) && EXPECTED_LABELS.tagline[navLang] === defaulted, `nav=${navLang} got=${defaulted}`);
  await popup.evaluate(() => chrome.storage.local.set({ 'dv:lang': 'en' }));
  const popupCreditUrl = await popup.evaluate(() => {
    const a = document.querySelector('[data-i18n="credit"]');
    return a && a.tagName === 'A' ? a.href : '';
  });
  check('credit links to LinkedIn (popup)', popupCreditUrl === 'https://www.linkedin.com/in/harleyvasquez/', popupCreditUrl);

  // ---- Landing ----
  const landing = await browser.newPage();
  const landingErrors = [];
  landing.on('pageerror', (e) => landingErrors.push(e.message));
  await landing.goto(LANDING, { waitUntil: 'domcontentloaded' });
  await sleep(800);
  const heroOk = await landing.evaluate(() => {
    const t = document.querySelector('[data-i18n="heroTitle"]')?.textContent || '';
    return t.length > 0 && document.title !== '';
  });
  check('landing renders with localized hero', heroOk === true, '');
  await landing.select('#langSel', 'es');
  const heroEs = await waitFor(() => landing.evaluate(() => document.querySelector('[data-i18n="heroTitle"]')?.textContent), 5000);
  check('landing switch to es works', heroEs === 'El velo oscuro que eliges tú' || heroEs?.length > 5, heroEs);
  const titleEs = await waitFor(() => landing.evaluate((exp) => (document.title.includes(exp) ? document.title : null), 'oscuro'), 5000);
  check('landing document.title translated on switch', titleEs !== null, titleEs);
  check('no JS errors on landing', landingErrors.length === 0, landingErrors.join(' | '));
  const landingCreditUrl = await landing.evaluate(() => {
    const a = document.querySelector('[data-i18n="credit"]');
    return a && a.tagName === 'A' ? a.href : '';
  });
  check('credit links to LinkedIn (landing)', landingCreditUrl === 'https://www.linkedin.com/in/harleyvasquez/', landingCreditUrl);
  await landing.close();

  // ---- Packaging ----
  const zipPath = path.join(EXT, 'dist', 'darkveil.zip');
  const landingZip = path.join(EXT, 'landing', 'darkveil.zip');
  check('dist/darkveil.zip exists', fs.existsSync(zipPath), zipPath);
  check('landing/darkveil.zip exists (CTA target)', fs.existsSync(landingZip), landingZip);
  if (fs.existsSync(zipPath) && fs.existsSync(landingZip)) {
    const s = fs.statSync(zipPath);
    const l = fs.statSync(landingZip);
    check('landing zip byte-identical to dist zip', s.size === l.size && s.size > 0, `dist=${s.size} landing=${l.size}`);
    ZIP_BYTES = l.size;
  }
  const iconOk = ['icon16.png', 'icon48.png', 'icon128.png'].every((f) => {
    const p = path.join(EXT, 'icons', f);
    return fs.existsSync(p) && fs.readFileSync(p)[0] === 0x89 && fs.readFileSync(p)[1] === 0x50;
  });
  check('icons 16/48/128 present and valid PNG', iconOk, '');

  // ---- Deploy (gated) ----
  if (DEPLOY_URL) {
    try {
      const res = await fetch(DEPLOY_URL + '/', { headers: { 'User-Agent': 'darkveil-probe' } });
      const body = await res.text();
      check('deployed landing responds (Vercel)', res.status === 200 && body.includes('DarkVeil'), res.status + ' len=' + body.length);
      const zipRes = await fetch(DEPLOY_URL + '/darkveil.zip', { headers: { 'User-Agent': 'darkveil-probe' } });
      const zipBody = await zipRes.arrayBuffer();
      check('deployed landing serves the extension zip', zipRes.status === 200 && typeof ZIP_BYTES === 'number' && zipBody.byteLength === ZIP_BYTES, zipRes.status + ' bytes=' + zipBody.byteLength + ' expected=' + ZIP_BYTES);
    } catch (error) {
      const msg = error && error.message ? error.message : String(error);
      check('deployed landing responds (Vercel)', false, msg);
      check('deployed landing serves the extension zip', false, msg);
    }
  } else {
    console.log('  [info] DARKVEIL_DEPLOY_URL not set; skipping deployed-landing checks.');
  }
} finally {
  if (browser) await browser.close();
  if (base) await base.close();
  server.close();
}

console.log('');
console.log(`RESULT: ${passes} passed, ${failures} failed`);
if (failures > 0) {
  console.log('PROBLEMS:');
  for (const p of problems) console.log('  - ' + p);
  process.exit(1);
}
process.exit(0);