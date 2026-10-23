// Render stage: a local harness shows the Page in an iframe exactly at the Target Height.
// Reuses the approach of the prototype/page-verification branch (scraped platform config, proxied portal statics).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

const PORTAL = 'https://data.gr.ch';
const LIVE_PAGE = `${PORTAL}/pages/mittelverwendung-im-bereich-landeslotterie/?headless=true&flg=de-ch`;
const DAY = 864e5;
const here = import.meta.dirname;
const SETTLE_QUIET_MS = 1500;
const SETTLE_CAP_MS = 30000;

export const WIDTHS = { Gross: [375, 720, 1200], Klein: [375, 720] };
export const ITERATE_WIDTHS = [1200];

export function findWidgetsDist() {
  if (process.env.ODS_WIDGETS_DIR) return path.join(process.env.ODS_WIDGETS_DIR, 'dist');
  for (let d = here; d !== path.dirname(d); d = path.dirname(d)) {
    const c = path.join(d, 'ods-widgets', 'dist');
    if (fs.existsSync(c)) return c;
  }
  throw new Error('ods-widgets checkout not found (set ODS_WIDGETS_DIR)');
}

// ---------- platform config: scraped from one live Page, cached for a day ----------
function parsePlatform(s) {
  const balanced = from => {
    let depth = 0, q = null;
    for (let i = from; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") q = c;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) return s.slice(from, i + 1);
    }
    throw new Error('platform scrape: unbalanced braces');
  };
  const objectAfter = marker => {
    const at = s.indexOf(marker);
    if (at < 0) throw new Error(`platform scrape: "${marker}" not found`);
    return balanced(s.indexOf('{', at));
  };
  const fonts = s.match(/<style>(@font-face[\s\S]*?)<\/style>/);
  if (!fonts) throw new Error('platform scrape: @font-face block not found');
  return {
    links: [...s.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map(m => m[0]),
    fonts: fonts[1],
    translations: objectAfter('var translations ='),
    widgetsConfig: objectAfter('ODSWidgetsConfigProvider.setConfig('),
    lazyBody: objectAfter('ods.config(function (ModuleLazyLoaderProvider)'),
    themeRev: (s.match(/front-angular\.css\?(\d+)/) || [])[1] ?? null,
  };
}

export async function platformConfig() {
  const dir = process.env.VERIFIER_CACHE_DIR || path.join(here, '.cache');
  const file = path.join(dir, 'platform.json');
  try {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Date.now() - c.fetchedAt < DAY) return { ...c, source: 'cache' };
  } catch {}
  const res = await fetch(LIVE_PAGE, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`platform scrape: ${LIVE_PAGE} answered ${res.status}`);
  const c = { fetchedAt: Date.now(), ...parsePlatform(await res.text()) };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(c));
  return { ...c, source: 'live' };
}

export function harnessHtml(cfg, html, css) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${cfg.links.join('\n')}
<style>${cfg.fonts}</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.0/jquery.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/angular.js/1.8.3/angular.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/angular-sanitize/1.8.3/angular-sanitize.min.js"></script>
<script src="/static/vendor/angular-1.8.3/i18n/angular-locale_de-ch.js"></script>
<script src="/ods-widgets/dist/ods-widgets.js"></script>
<script>
  angular.module('ods-widgets').config(function (ModuleLazyLoaderProvider) ${cfg.lazyBody});
  angular.module('harness', ['ods-widgets', 'ngSanitize'])
    .config(function (ODSWidgetsConfigProvider) {
      ODSWidgetsConfigProvider.setConfig(${cfg.widgetsConfig});
      ODSWidgetsConfigProvider.setConfig({ defaultDomain: '${PORTAL}', secureContextDomain: false, basePath: '/ods-widgets/dist/',
        customAPIHeaders: { 'ODS-API-Analytics-App': 'page-verifier' } });
    })
    .run(function (gettextCatalog) {
      gettextCatalog.setStrings('de', ${cfg.translations});
      gettextCatalog.setCurrentLanguage('de');
      if (window.moment) moment.locale('de-ch');
    })
    .controller('PageController', function ($scope) {
      $scope.pageId = 'page-verifier';
      $scope.user = { is_authenticated: false };
      $scope.domain = { languages: ['de'], current_language: 'de' };
    });
</script></head><body>
<main id="main" role="main" class="main--page"><div ng-app="harness" ng-controller="PageController">
<div class="page-layout ng-cloak"><style type="text/css">${css}</style><div>${html}</div></div></div></main>
</body></html>`;
}

// ---------- local server: harness, host page, ods-widgets dist, same-origin proxy of portal statics ----------
export function serve(harness, dist) {
  const cache = new Map();
  const proxy = async (u, res) => {
    const key = u.pathname + u.search;
    if (!cache.has(key)) {
      const r = await fetch(PORTAL + key, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      cache.set(key, { status: r.status, type: r.headers.get('content-type'), body: Buffer.from(await r.arrayBuffer()) });
    }
    const c = cache.get(key);
    res.statusCode = c.status;
    if (c.type) res.setHeader('content-type', c.type);
    res.end(c.body);
  };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/harness.html') { res.setHeader('content-type', 'text/html'); return res.end(harness); }
    if (u.pathname === '/host.html') {
      res.setHeader('content-type', 'text/html');
      return res.end(`<!doctype html><body style="margin:0"><iframe id="f" src="/harness.html"
        style="display:block;border:0;width:${Number(u.searchParams.get('w'))}px;height:${Number(u.searchParams.get('h'))}px"></iframe></body>`);
    }
    if (u.pathname.startsWith('/ods-widgets/dist/')) {
      const f = path.join(dist, decodeURIComponent(u.pathname.slice('/ods-widgets/dist/'.length)));
      if (f.startsWith(dist) && fs.existsSync(f) && fs.statSync(f).isFile()) {
        if (f.endsWith('.js')) res.setHeader('content-type', 'text/javascript');
        if (f.endsWith('.css')) res.setHeader('content-type', 'text/css');
        return res.end(fs.readFileSync(f));
      }
    }
    if (/^\/(static|css|assets)\//.test(u.pathname)) return proxy(u, res).catch(() => { res.statusCode = 502; res.end(); });
    res.statusCode = 404;
    res.end();
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

// runs inside the iframe
const inspectFrame = allowed => {
  const label = el => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const W = document.documentElement.clientWidth;
  // Content height: the lowest edge inside the Page plus the portal wrapper's bottom margin. The wrapper's
  // own min-height is a harness artefact (the real iframe body has no fixed height), so scrollHeight is not used.
  const main = document.querySelector('main');
  const bottoms = [...document.querySelectorAll('.page-layout, .page-layout *')].map(el => el.getBoundingClientRect().bottom + window.scrollY);
  const out = { text: [], overflow: 0, offenders: [], height: Math.ceil(Math.max(0, ...bottoms) + (main ? parseFloat(getComputedStyle(main).marginBottom) || 0 : 0)) };
  const txt = document.body.innerText;
  if (txt.includes('{{')) out.text.push('{{');
  for (const t of ['NaN', 'undefined']) if (new RegExp(`\\b${t}\\b`).test(txt)) out.text.push(t);
  out.overflow = document.documentElement.scrollWidth - W;
  if (out.overflow > 0) {
    const inAllowed = el => allowed.some(s => el.closest(s));
    const beyond = el => el.getBoundingClientRect().right > W + 1 && !inAllowed(el);
    out.offenders = [...document.querySelectorAll('body *')]
      .filter(el => beyond(el) && ![...el.children].some(beyond))
      .slice(0, 5).map(label);
  }
  return out;
};

async function settle(page, net, frame) {
  const t0 = Date.now();
  while (Date.now() - t0 < SETTLE_CAP_MS) {
    await page.waitForTimeout(300);
    const quiet = net.inflight === 0 && Date.now() - net.last > SETTLE_QUIET_MS;
    const busy = await frame.evaluate(() => [...document.querySelectorAll('.ng-cloak, .odswidget-spinner, .odswidget-spinner--large')].some(e => e.checkVisibility())).catch(() => true);
    if (quiet && !busy) return true;
  }
  return false;
}

/** Renders the Page; returns { findings, screenshots, platformConfig }. */
export async function render({ html, css, targetHeight, widths, outDir, scrollSelectors }) {
  const cfg = await platformConfig();
  const server = await serve(harnessHtml(cfg, html, css), findWidgetsDist());
  const browser = await chromium.launch();
  const perWidth = [];
  const screenshots = [];
  try {
    for (const w of widths) {
      const page = await browser.newPage({ viewport: { width: w, height: targetHeight } });
      const net = { inflight: 0, last: Date.now() };
      const issues = [];
      const apiFailed = new Set();
      page.on('request', () => { net.inflight++; net.last = Date.now(); });
      const done = () => { net.inflight = Math.max(0, net.inflight - 1); net.last = Date.now(); };
      page.on('requestfinished', done);
      page.on('requestfailed', done);
      page.on('response', async r => {
        if (r.status() < 400 || !r.url().startsWith(PORTAL + '/api/')) return;
        apiFailed.add(r.url());
        let msg = (await r.text().catch(() => '')).slice(0, 200);
        try { msg = JSON.parse(msg).message ?? msg; } catch {}
        issues.push({ rule: 'api-error', message: `API ${r.status()} from ${new URL(r.url()).pathname}: ${msg}` });
      });
      page.on('console', m => {
        if (m.type() === 'error') issues.push({ rule: 'console-error', message: m.text().slice(0, 300), url: m.location().url });
      });
      page.on('pageerror', e => issues.push({ rule: 'uncaught-exception', message: String(e).slice(0, 300) }));
      await page.goto(`http://127.0.0.1:${server.address().port}/host.html?w=${w}&h=${targetHeight}`);
      const frame = page.frames().find(f => f.url().endsWith('/harness.html'));
      const settled = await settle(page, net, frame);
      const r = await frame.evaluate(inspectFrame, scrollSelectors);
      fs.mkdirSync(outDir, { recursive: true });
      const shot = `screenshot-${w}.png`;
      await page.locator('#f').screenshot({ path: path.join(outDir, shot) });
      screenshots.push({ width: w, file: shot });
      if (!settled) issues.push({ rule: 'not-settled', message: `Page did not settle within ${SETTLE_CAP_MS / 1000}s` });
      for (const t of r.text) issues.push({ rule: 'unresolved-text', message: `Visible text contains "${t}"` });
      if (r.overflow > 0) issues.push({ rule: 'overflow', message: `Horizontal overflow; offending elements: ${r.offenders.join(', ') || 'none identified'}` });
      if (r.height > targetHeight) issues.push({ rule: 'content-too-tall', message: `Content is taller than the Target Height (${targetHeight}px)`, detail: `${r.height}px` });
      // a failed API request also logs a console error: report the cause once
      perWidth.push({ w, issues: issues.filter(i => !(i.rule === 'console-error' && apiFailed.has(i.url))) });
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  // one finding per distinct problem, listing the widths where it occurs
  const byKey = new Map();
  for (const { w, issues } of perWidth)
    for (const i of issues) {
      const k = `${i.rule}\0${i.message}`;
      if (!byKey.has(k)) byKey.set(k, { rule: i.rule, severity: i.rule === 'not-settled' ? 'warning' : 'error', message: i.message, location: { widths: [] }, details: [] });
      const f = byKey.get(k);
      f.location.widths.push(w);
      if (i.detail) f.details.push(`${w}px: ${i.detail}`);
    }
  const findings = [...byKey.values()].map(({ details, ...f }) => (details.length ? { ...f, message: `${f.message} (${details.join(', ')})` } : f));
  return {
    findings,
    screenshots,
    platformConfig: { source: cfg.source, fetchedAt: new Date(cfg.fetchedAt).toISOString(), themeRev: cfg.themeRev },
  };
}
