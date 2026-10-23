// Render stage: a local harness shows the Page in an iframe exactly at the Target Height.
// Reuses the approach of the prototype/page-verification branch (scraped platform config, proxied portal statics).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
import { annotate } from './annotate.mjs';

const PORTAL = 'https://data.gr.ch';
const LIVE_PAGE = `${PORTAL}/pages/mittelverwendung-im-bereich-landeslotterie/?headless=true&flg=de-ch`;
const DAY = 864e5;
const here = import.meta.dirname;
const SETTLE_QUIET_MS = 1500;
const SETTLE_CAP_MS = 30000;
const OPTION_CAP = 12; // ods-select options explored per select
const MAX_STATES = 40; // explored states per width

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
const inspectFrame = ({ allowed, chartIds, mapIds, repeats }) => {
  const label = el => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const W = document.documentElement.clientWidth;
  // Content height: the lowest edge inside the Page plus the portal wrapper's bottom margin. The wrapper's
  // own min-height is a harness artefact (the real iframe body has no fixed height), so scrollHeight is not used.
  const main = document.querySelector('main');
  // An element's bottom counts only where it is visible: content clipped by a scrolling or hidden-overflow
  // ancestor (a table inside hw-table-scroll) adds no height to the Page.
  const visibleBottom = el => {
    let bottom = el.getBoundingClientRect().bottom;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const o = getComputedStyle(a);
      if (o.display !== 'contents' && o.overflowY !== 'visible') bottom = Math.min(bottom, a.getBoundingClientRect().bottom);
    }
    return bottom + window.scrollY;
  };
  // Map tiles and panes extend beyond the map's own box and are clipped by it: only the container counts.
  const bottoms = [...document.querySelectorAll('.page-layout, .page-layout *')].filter(el => !el.parentElement?.closest('.leaflet-container')).map(visibleBottom);
  const out = { text: [], signals: [], present: [], overflow: 0, offenders: [], height: Math.ceil(Math.max(0, ...bottoms) + (main ? parseFloat(getComputedStyle(main).marginBottom) || 0 : 0)) };
  const txt = document.body.innerText;
  if (txt.includes('{{')) out.text.push('{{');
  for (const t of ['NaN', 'undefined']) if (new RegExp(`\\b${t}\\b`).test(txt)) out.text.push(t);
  // Widget signals. The ids were put on the source elements by annotate.mjs.
  const ng = window.angular;
  out.present = [...document.querySelectorAll('[data-verify-id]')].map(el => el.getAttribute('data-verify-id'));
  // a Widget variable that is unset, empty or NaN (attribute Widgets name their variable in the attribute)
  const VARIABLE_WIDGETS = /^(?:data-|x-)?ods-(results|facet-results|aggregation|adv-analysis)$/;
  const DEFAULT_VARIABLE = { results: 'results', 'facet-results': 'results', aggregation: 'aggregation' };
  for (const el of document.querySelectorAll('[data-verify-id]')) {
    const attr = [...el.attributes].find(a => VARIABLE_WIDGETS.test(a.name));
    if (!attr || el.hasAttribute('ng-repeat')) continue;
    const kind = attr.name.match(VARIABLE_WIDGETS)[1];
    const names = (attr.value.trim() || DEFAULT_VARIABLE[kind] || '').split(',').map(s => s.trim()).filter(Boolean);
    const scope = ng.element(el).scope();
    for (const name of names) {
      let v;
      try { v = scope.$eval(name); } catch { v = undefined; }
      const where = `ods-${kind}="${attr.value}"`;
      if (v === undefined || v === null) out.signals.push({ rule: 'widget-variable', message: `Widget variable "${name}" (${where}) is unset` });
      else if (Array.isArray(v) && v.length === 0) out.signals.push({ rule: 'widget-variable', message: `Widget variable "${name}" (${where}) is empty` });
      else if (typeof v === 'number' && Number.isNaN(v)) out.signals.push({ rule: 'widget-variable', message: `Widget variable "${name}" (${where}) is NaN` });
    }
  }
  // a chart without points
  for (const id of chartIds) {
    for (const el of document.querySelectorAll(`[data-verify-id="${id}"]`)) {
      if (!el.querySelector('.highcharts-container')) out.signals.push({ rule: 'chart-no-points', message: 'A chart was not drawn (no Highcharts container)' });
      else if (el.querySelector('.highcharts-no-data') || !el.querySelector('.highcharts-point, .highcharts-graph, .highcharts-series path'))
        out.signals.push({ rule: 'chart-no-points', message: 'A chart is drawn without points' });
    }
  }
  // a map that shows no features, or is under the 280px minimum
  const MAP_MIN = 280;
  const hasFeatures = map => {
    if (map.querySelector('.leaflet-overlay-pane path, .leaflet-marker-pane > *, .leaflet-shadow-pane > *')) return true;
    return [...map.querySelectorAll('.leaflet-overlay-pane canvas, canvas.leaflet-heatmap-layer')].some(c => {
      try { return c.width > 0 && c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0); } catch { return true; }
    });
  };
  for (const id of mapIds) {
    for (const el of document.querySelectorAll(`[data-verify-id="${id}"]`)) {
      const map = el.querySelector('.leaflet-container');
      if (!map) { out.signals.push({ rule: 'map-no-features', message: 'A map was not drawn (no Leaflet container)' }); continue; }
      if (!hasFeatures(map)) out.signals.push({ rule: 'map-no-features', message: 'A map shows no features' });
      const h = Math.round(map.getBoundingClientRect().height);
      if (h < MAP_MIN) out.signals.push({ rule: 'map-too-small', message: `A map is ${h}px high; the minimum is ${MAP_MIN}px` });
    }
  }
  // ng-repeat over a variable that is undefined where the repeat sits (typically a Widget's variable used
  // outside the element that owns it): it renders nothing, silently.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  for (let c = walker.nextNode(); c; c = walker.nextNode()) {
    const m = c.nodeValue.match(/^\s*ngRepeat:\s*(.+?)\s*$/);
    if (!m || !repeats.includes(m[1])) continue;
    const parts = m[1].match(/^(?:\([^)]*\)|[\w$]+(?:\s*,\s*[\w$]+)?)\s+in\s+(.+?)(?:\s+track by\s.+)?$/);
    if (!parts) continue;
    const collection = parts[1].split(/(?<!\|)\|(?!\|)/)[0].trim();
    let v;
    try { v = ng.element(c).scope().$eval(collection); } catch { continue; }
    if (v === undefined) out.signals.push({ rule: 'ng-repeat-out-of-scope', message: `ng-repeat="${m[1]}": "${collection}" is undefined where the repeat sits, so it renders nothing. A Widget's variable is visible only inside the element that owns it` });
  }
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

// runs inside the iframe: every interaction that can change the Page's state, in document order.
// Author-written ng-click only (Widget templates carry their own), ods-simple-tabs tabs, and the
// options of every ods-select. Selecting an option clicks its list item; the dropdown need not be open.
const listActions = ({ clickIds, optionCap, tooltip }) => {
  const found = [];
  const capped = [];
  const text = el => el.innerText.trim().replace(/\s+/g, ' ');
  document.querySelectorAll('.ods-simple-tabs-container').forEach((tabs, t) =>
    tabs.querySelectorAll('.ods-simple-tabs-nav-link').forEach(a =>
      found.push({ el: a, key: `tab:${t}:${a.id}`, label: `tab "${text(a)}"`, active: a.classList.contains('ods-simple-tabs-nav-link-active') })));
  const clickCount = {};
  document.querySelectorAll('[data-verify-id]').forEach(el => {
    const id = el.getAttribute('data-verify-id');
    const expr = clickIds[id];
    if (expr === undefined) return;
    clickCount[id] = (clickCount[id] ?? -1) + 1;
    found.push({ el, key: `click:${id}:${clickCount[id]}`, label: `ng-click "${expr}"` });
  });
  document.querySelectorAll('.odswidget-select').forEach((select, s) => {
    const items = [...select.querySelectorAll('li.odswidget-select-dropdown-menu-item[role="option"]')]
      .filter(li => !li.classList.contains('odswidget-select-dropdown-actions-select-all') && !li.classList.contains('odswidget-select-dropdown-no-options'))
      .filter(li => !li.classList.contains('odswidget-select-dropdown-menu-selected'));
    if (items.length > optionCap) capped.push({ select: s, total: items.length });
    items.slice(0, optionCap).forEach(li => {
      const label = text(li);
      found.push({ el: li, key: `select:${s}:${label}`, label: `ods-select option "${label}"` });
    });
  });
  // A map layer with a tooltip template: click the first shape or marker of each map to render the tooltip.
  if (tooltip) document.querySelectorAll('.leaflet-container').forEach((map, m) => {
    const el = map.querySelector('.leaflet-overlay-pane path.leaflet-clickable, .leaflet-marker-pane .leaflet-marker-icon');
    if (el) found.push({ el, key: `map:${m}`, label: m === 0 ? 'map shape click' : `map shape click (map ${m + 1})` });
  });
  found.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  window.__verifyActions = Object.fromEntries(found.map(f => [f.key, f.el]));
  return { actions: found.map(({ key, label, active }) => ({ key, label, active: !!active })), capped };
};
const performAction = key => {
  const el = window.__verifyActions[key];
  if (!el) return;
  if (key.startsWith('map:')) { // Leaflet reads the pointer position from the event
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  } else el.click();
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


const INITIAL = 'initial';

/** Renders the Page and explores its states; returns { findings, screenshots, states, platformConfig }.
 *  States are explored at every width: first the initial state, then each tab, author-written ng-click and
 *  ods-select option in document order, including the ones a state makes reachable. A state is cumulative
 *  (an earlier click stays in effect). Every signal is re-checked in every state. */
export async function render({ html, css, targetHeight, widths, outDir, scrollSelectors }) {
  const cfg = await platformConfig();
  const marked = annotate(html);
  const entries = Object.entries(marked.elements);
  const clickIds = Object.fromEntries(entries.filter(([, e]) => e.click !== null).map(([id, e]) => [id, e.click]));
  const chartIds = entries.filter(([, e]) => e.kind === 'ods-chart').map(([id]) => id);
  const mapIds = entries.filter(([, e]) => e.kind === 'ods-map').map(([id]) => id);
  const server = await serve(harnessHtml(cfg, marked.html, css), findWidgetsDist());
  const browser = await chromium.launch();
  const perWidth = [];
  const screenshots = [];
  const seen = new Set();
  const states = new Map();
  fs.mkdirSync(outDir, { recursive: true });
  try {
    for (const w of widths) {
      const page = await browser.newPage({ viewport: { width: w, height: targetHeight } });
      const net = { inflight: 0, last: Date.now() };
      let issues = [];
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

      // settles, re-checks every signal, screenshots; returns nothing, records into perWidth and states
      const check = async label => {
        const settled = await settle(page, net, frame);
        const r = await frame.evaluate(inspectFrame, { allowed: scrollSelectors, chartIds, mapIds, repeats: marked.repeats });
        for (const id of r.present) seen.add(id);
        const state = states.get(label) ?? states.set(label, { label, index: states.size, rules: [] }).get(label);
        const shot = label === INITIAL ? `screenshot-${w}.png` : `state-${state.index}-${w}.png`;
        await page.locator('#f').screenshot({ path: path.join(outDir, shot) });
        if (label === INITIAL) screenshots.push({ width: w, file: shot });
        Object.assign(state, { width: w, screenshot: shot });
        const found = issues.filter(i => !(i.rule === 'console-error' && apiFailed.has(i.url)));
        issues = [];
        // a failed API request also logs a console error: report the cause once
        if (!settled) found.push({ rule: 'not-settled', message: `Page did not settle within ${SETTLE_CAP_MS / 1000}s` });
        found.push(...r.signals);
        for (const t of r.text) found.push({ rule: 'unresolved-text', message: `Visible text contains "${t}"` });
        if (r.overflow > 0) found.push({ rule: 'overflow', message: `Horizontal overflow; offending elements: ${r.offenders.join(', ') || 'none identified'}` });
        if (r.height > targetHeight) found.push({ rule: 'content-too-tall', message: `Content is taller than the Target Height (${targetHeight}px)`, detail: `${r.height}px` });
        for (const i of found) {
          perWidth.push({ w, state: label, issue: i });
          if (!state.rules.includes(i.rule)) state.rules.push(i.rule);
        }
      };

      await check(INITIAL);
      const visited = new Set();
      for (;;) {
        const { actions, capped } = await frame.evaluate(listActions, { clickIds, optionCap: OPTION_CAP, tooltip: entries.some(([, e]) => e.tooltip) });
        for (const a of actions) if (a.active) visited.add(a.key); // the initial state already shows the active tab
        for (const c of capped)
          perWidth.push({ w, state: INITIAL, issue: { rule: 'select-options-capped', warning: true, message: `ods-select number ${c.select + 1} has ${c.total} options; only the first ${OPTION_CAP} are explored as states` } });
        const next = actions.find(a => !visited.has(a.key));
        if (!next || visited.size >= MAX_STATES) break;
        visited.add(next.key);
        await frame.evaluate(performAction, next.key);
        await check(next.label);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  // a Widget in the source that no explored state ever rendered
  for (const [id, e] of entries)
    if (e.kind !== 'ng-click' && !seen.has(id))
      perWidth.push({ w: widths, state: null, issue: { rule: 'widget-never-rendered', message: `${e.label} (line ${e.line}) is never rendered in any explored state (behind an ng-if, or in a tab, click or option state that was not reached?)` } });
  // one finding per distinct problem and state, listing the widths where it occurs
  const byKey = new Map();
  for (const { w, state, issue: i } of perWidth) {
    const k = `${i.rule}\0${i.message}\0${state}`;
    if (!byKey.has(k)) byKey.set(k, { rule: i.rule, severity: i.rule === 'not-settled' || i.warning ? 'warning' : 'error', message: i.message, location: { widths: [], state: state ?? 'all states' }, details: [] });
    const f = byKey.get(k);
    for (const x of [].concat(w)) if (!f.location.widths.includes(x)) f.location.widths.push(x);
    if (i.detail) f.details.push(`${w}px: ${i.detail}`);
  }
  const findings = [...byKey.values()].map(({ details, ...f }) => (details.length ? { ...f, message: `${f.message} (${details.join(', ')})` } : f));
  return {
    findings,
    screenshots,
    states: [...states.values()].map(({ label, width, screenshot, rules }) => ({ label, width, screenshot, findings: rules })),
    platformConfig: { source: cfg.source, fetchedAt: new Date(cfg.fetchedAt).toISOString(), themeRev: cfg.themeRev },
  };
}
