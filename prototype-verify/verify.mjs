// PROTOTYPE — throwaway. Answers "How does the generator verify a Page?" (issue #9).
// Usage: node verify.mjs <page-dir-with-index.html-and-stylesheet.css> [--sizes 375x600,768x700,1200x800]
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const WIDGETS_SRC = path.join(ROOT, 'ods-widgets/src');
const WIDGETS_DIST = path.join(ROOT, 'ods-widgets/dist');
const PORTAL = 'https://data.gr.ch';
const LIVE_PAGE = `${PORTAL}/pages/mittelverwendung-im-bereich-landeslotterie/?headless=true&flg=de-ch`;

const CLOSED_LIST = ['odsSelect', 'odsResults', 'odsFacetResults', 'odsDatasetContext', 'odsMap', 'odsMapLayer',
  'odsSimpleTabs', 'odsSimpleTab', 'odsAdvAnalysis', 'odsChart', 'odsChartQuery', 'odsChartSerie',
  'odsColorGradient', 'odsLegend', 'odsTable', 'odsAggregation', 'odsGauge', 'odsTextSearch'];

// Real parameters the ngdoc omits; each cites the source line that reads it (belongs in the skill's correctness layer)
const KNOWN_UNDOCUMENTED = { odsChartQuery: ['context'] };   // highcharts.js:2271 attrs.context

const args = process.argv.slice(2);
const pageDir = path.resolve(args[0] ?? 'fixtures/mittelverwendung');
const sizes = (args.includes('--sizes') ? args[args.indexOf('--sizes') + 1] : '375x600,768x700,1200x800')
  .split(',').map(s => s.split('x').map(Number));
const name = path.basename(pageDir);
const outDir = path.join(import.meta.dirname, 'out', name);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const pageHtml = fs.readFileSync(path.join(pageDir, 'index.html'), 'utf8');
const pageCss = fs.readFileSync(path.join(pageDir, 'stylesheet.css'), 'utf8');
const findings = [];   // {cls, severity: 'error'|'warning'|'info', where, msg}
const add = (cls, severity, where, msg) => findings.push({ cls, severity, where, msg });
const kebab = s => s.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
const camel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const lineOf = needle => { const i = pageHtml.indexOf(needle); return i < 0 ? '?' : pageHtml.slice(0, i).split('\n').length; };

// ---------- 1. Scrape the platform config that rots (cached for a day) ----------
async function platformConfig() {
  const cache = path.join(import.meta.dirname, '.cache/platform.html');
  if (!fs.existsSync(cache) || Date.now() - fs.statSync(cache).mtimeMs > 864e5) {
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, await (await fetch(LIVE_PAGE, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text());
  }
  const s = fs.readFileSync(cache, 'utf8');
  const balanced = (from) => {   // string-aware brace matcher starting at s[from] === '{'
    let depth = 0, q = null;
    for (let i = from; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") q = c;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) return s.slice(from, i + 1);
    }
  };
  const abs = t => t;   // portal static paths stay relative: the local server proxies them (fonts lack a CORS header)
  const links = [...s.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map(m => abs(m[0]));
  const fonts = abs(s.match(/<style>(@font-face[\s\S]*?)<\/style>/)[1]);
  const translations = balanced(s.indexOf('{', s.indexOf('var translations =')));
  const widgetsConfig = balanced(s.indexOf('{', s.indexOf('ODSWidgetsConfigProvider.setConfig(')));
  const lazyStart = s.indexOf('{', s.indexOf('ods.config(function (ModuleLazyLoaderProvider)'));
  const lazyBody = abs(balanced(lazyStart));
  const themeRev = (s.match(/front-angular\.css\?(\d+)/) || [])[1];
  return { links, fonts, translations, widgetsConfig, lazyBody, themeRev };
}

function harnessHtml(cfg) {
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
        customAPIHeaders: { 'ODS-API-Analytics-App': 'page-verify-prototype' } });
    })
    .run(function (gettextCatalog) {
      gettextCatalog.setStrings('de', ${cfg.translations});
      gettextCatalog.setCurrentLanguage('de');
      if (window.moment) moment.locale('de-ch');
    })
    .controller('PageController', function ($scope) {
      $scope.pageId = 'verify-prototype';
      $scope.user = { is_authenticated: false };
      $scope.domain = { languages: ['de'], current_language: 'de' };
    });
</script></head><body>
<main id="main" role="main" class="main--page"><div ng-app="harness" ng-controller="PageController">
<div class="page-layout ng-cloak"><style type="text/css">${pageCss}</style><div>${pageHtml}</div></div></div></main>
</body></html>`;
}

// ---------- 2. Lint against the closed Widget list and the banned habits ----------
function widgetParams() {   // ngdoc @param names per directive, from ods-widgets/src (not docs/)
  const params = {};
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    if (!p.endsWith('.js')) return;
    for (const block of fs.readFileSync(p, 'utf8').split('@ngdoc').slice(1)) {
      const n = block.match(/@name ods-widgets\.directive:(\w+)/);
      if (!n) continue;
      params[n[1]] = [...block.matchAll(/@param\s+\{[^}]*\}\s+\[?([\w.]+)/g)].map(m => kebab(m[1])).concat(KNOWN_UNDOCUMENTED[n[1]] || []);
    }
  });
  walk(WIDGETS_SRC);
  return params;
}

async function lint(browser) {
  const params = widgetParams();
  const p = await browser.newPage();
  const els = await p.evaluate(html => [...new DOMParser().parseFromString(html, 'text/html').body.querySelectorAll('*')]
    .map(e => ({ tag: e.tagName.toLowerCase(), attrs: [...e.attributes].map(a => [a.name, a.value]) })), pageHtml);
  await p.close();

  const contexts = new Set();
  els.filter(e => e.tag === 'ods-dataset-context').forEach(e =>
    (e.attrs.find(a => a[0] === 'context')?.[1] || '').split(',').forEach(c => contexts.add(c.trim())));

  for (const e of els) {
    const where = `line ${lineOf('<' + e.tag)} <${e.tag}>`;
    if (e.tag.startsWith('ods-')) {
      const w = camel(e.tag);
      if (!CLOSED_LIST.includes(w)) add('lint', 'error', where, `Widget <${e.tag}> is not on the closed list`);
      else for (const [a] of e.attrs) {
        if (a.startsWith('ods-') || a.startsWith('ng-') || ['class', 'style', 'id'].includes(a)) continue;
        if (w === 'odsDatasetContext' && [...contexts].some(c => a.startsWith(c + '-'))) continue;
        if (!(params[w] || []).includes(a)) add('lint', 'warning', `line ${lineOf(a + '=')} <${e.tag}>`, `attribute "${a}" is not a documented parameter of ${w}`);
      }
    }
    for (const [a] of e.attrs.filter(([a]) => a.startsWith('ods-'))) {
      const base = Object.keys(params).filter(k => a === kebab(k) || a.startsWith(kebab(k) + '-')).sort((x, y) => y.length - x.length)[0];
      if (!base) { add('lint', 'error', `line ${lineOf(a + '=')}`, `attribute "${a}" matches no Widget`); continue; }
      if (!CLOSED_LIST.includes(base)) add('lint', 'error', `line ${lineOf(a + '=')}`, `attribute Widget ${base} is not on the closed list`);
      else if (a !== kebab(base) && !params[base].includes(a)) add('lint', 'warning', `line ${lineOf(a + '=')}`, `"${a}" is not a documented parameter of ${base}`);
    }
    const attr = Object.fromEntries(e.attrs);
    if (attr['ng-repeat'] && attr['ods-results'] && !attr['ods-results-max'])
      add('lint', 'error', `line ${lineOf('ods-results="' + attr['ods-results'])}`, 'ods-results + ng-repeat without ods-results-max');
    if (attr['ng-init'] && /[^=!<>]=[^=]/.test(attr['ng-init']))
      add('lint', 'error', `line ${lineOf('ng-init=')}`, `ng-init assignment "${attr['ng-init']}" is a side effect outside the two allowed forms`);
    if (attr['ng-click'] && /[^=!<>]=[^=]/.test(attr['ng-click']))
      add('lint', 'error', `line ${lineOf('ng-click=')}`, `ng-click assignment "${attr['ng-click']}": tabs built by hand, use ods-simple-tabs`);
    for (const [a, v] of e.attrs.filter(([a]) => a.endsWith('-parameters'))) {
      if (/['"]q['"]\s*:/.test(v)) add('lint', 'error', `line ${lineOf(a)}`, `"q:" full-text search used as a filter in ${a}`);
      if (/refine\.[\w]+['"]\s*:\s*['"](19|20)\d\d['"]/.test(v)) add('lint', 'error', `line ${lineOf(a)}`, `hard-coded year in ${a}`);
    }
  }

  const banned = [
    [/<script\b/i, 'contains <script>'], [/<iframe\b/i, 'contains <iframe>'], [/\son[a-z]+\s*=/i, 'contains an on* handler'],
    [/\$root\.shared/, '$root.shared'], [/range-custom/, 'color="range-custom"'],
    [/\|\s*currentLanguage/, 'platform-only filter currentLanguage'], [/svelte-[\w]+/, 'copied svelte-* class']];
  for (const [re, msg] of banned) if (re.test(pageHtml)) add('lint', 'error', `line ${lineOf(pageHtml.match(re)[0])}`, `banned: ${msg}`);
  if (/\.ods-box\b|class="[^"]*\bods-box\b/.test(pageHtml + pageCss)) add('lint', 'error', 'html/css', 'banned: platform-only CSS class .ods-box');

  // side-effect assignments in {{ }}: only guarded default or one-way copy
  for (const m of pageHtml.matchAll(/\{\{([^}]*?[^=!<>]=[^=][^}]*?)\}\}/g)) {
    const x = m[1].trim();
    const guarded = /^(\w+)\.parameters\[('[^']+'|"[^"]+")\]\s*=\s*\1\.parameters\[\2\]\s*\|\|\s*[^;]+;\s*''$/.test(x);
    const copy = /^(\w+)\.parameters\[[^\]]+\]\s*=\s*(\w+)\.parameters\[[^\]]+\]\s*;\s*''$/.exec(x);
    if (!guarded && !(copy && copy[1] !== copy[2])) add('lint', 'error', `line ${lineOf(m[0])}`, `side-effect assignment outside the two allowed forms: {{ ${x} }}`);
  }
  return els;
}

// ---------- 3. Dataset dry-run: referenced fields exist, literal ODSQL runs ----------
let apiRequests = 0;
async function api(url) { apiRequests++; const r = await fetch(url); return { ok: r.ok, body: await r.json().catch(() => ({})) }; }

async function dryRun(els) {
  const ctxDataset = {};
  for (const e of els.filter(e => e.tag === 'ods-dataset-context'))
    for (const [a, v] of e.attrs) if (a.endsWith('-dataset')) ctxDataset[a.slice(0, -8)] = v;
  const fieldsOf = {};
  for (const id of new Set(Object.values(ctxDataset))) {
    const r = await api(`${PORTAL}/api/explore/v2.1/catalog/datasets/${id}?lang=de`);
    if (!r.ok) { add('dataset', 'error', id, `dataset not reachable: ${r.body.message || 'error'}`); continue; }
    fieldsOf[id] = new Set(r.body.fields.map(f => f.name));
  }
  // which context an element reads from (nearest attribute that names one)
  const refs = [];
  for (const e of els) {
    const a = Object.fromEntries(e.attrs);
    const ctx = a.context || a['ods-facet-results-context'] || a['ods-aggregation-context'] || a['ods-results-context'] || a['ods-adv-analysis-context'];
    const ds = ctxDataset[ctx?.split(',')[0]?.trim()];
    const push = (attr, f) => f && /^[a-z_][a-z0-9_]*$/.test(f) && refs.push({ ds, attr, f });
    push('ods-facet-results-facet-name', a['ods-facet-results-facet-name']);
    push('ods-aggregation-expression', a['ods-aggregation-expression']);
    push('field-x', a['field-x']); push('series-breakdown', a['series-breakdown']); push('field', a.field);
    push('expression-y', a['expression-y']);
    if (a['ods-adv-analysis'] && ds && !Object.values(a).join(' ').includes('{{')) {
      const q = new URLSearchParams({ limit: a['ods-adv-analysis-limit'] || '1' });
      for (const k of ['select', 'where', 'group-by', 'order-by']) if (a['ods-adv-analysis-' + k]) q.set(k.replace('-', '_'), a['ods-adv-analysis-' + k]);
      const r = await api(`${PORTAL}/api/explore/v2.1/catalog/datasets/${ds}/records?${q}`);
      if (!r.ok) add('odsql', 'error', `line ${lineOf('ods-adv-analysis="' + a['ods-adv-analysis'])}`, `ODSQL fails on ${ds}: ${r.body.message}`);
      else if (!r.body.results?.length) add('odsql', 'warning', `ods-adv-analysis="${a['ods-adv-analysis']}"`, 'ODSQL runs but returns no rows');
    }
  }
  for (const e of els.filter(e => e.tag === 'ods-chart-query')) {
    const a = Object.fromEntries(e.attrs), ds = ctxDataset[a.context];
    if (!a['category-colors'] || !a['series-breakdown'] || !ds) continue;
    let colors; try { colors = JSON.parse(a['category-colors']); } catch { add('lint', 'error', `line ${lineOf('category-colors')}`, 'category-colors is not valid JSON'); continue; }
    const r = await api(`${PORTAL}/api/explore/v2.1/catalog/datasets/${ds}/facets?facet=${a['series-breakdown']}&lang=de`);
    const values = (r.body.facets?.[0]?.facets || []).map(f => f.value);
    const unused = Object.keys(colors).filter(k => !values.includes(k));
    const uncoloured = values.filter(v => !(v in colors));
    if (unused.length) add('dataset', 'error', `line ${lineOf('category-colors')}`, `category-colors keys match no value of ${a['series-breakdown']}: ${unused.join(', ')}`);
    if (uncoloured.length) add('dataset', 'error', `line ${lineOf('category-colors')}`, `values of ${a['series-breakdown']} without a CI colour (fall back to the default palette): ${uncoloured.join(', ')}`);
  }
  for (const m of pageHtml.matchAll(/refine\.(\w+)/g)) refs.push({ ds: null, attr: 'refine.', f: m[1] });
  for (const m of pageHtml.matchAll(/\.fields\.(\w+)/g)) refs.push({ ds: null, attr: '.fields.', f: m[1] });
  const all = new Set(Object.values(fieldsOf).flatMap(s => [...s]));
  for (const { ds, attr, f } of refs) {
    const known = ds && fieldsOf[ds] ? fieldsOf[ds].has(f) : all.has(f);
    if (!known) add('dataset', 'error', `line ${lineOf(f)}`, `${attr} "${f}" is not a field of ${ds || 'any context dataset'}`);
  }
}

// ---------- 4. Render inside an iframe at each size, explore interactive states ----------
const proxyCache = new Map();
async function proxy(u, res) {
  const key = u.pathname + u.search;
  if (!proxyCache.has(key)) {
    const r = await fetch(PORTAL + key, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    proxyCache.set(key, { status: r.status, type: r.headers.get('content-type'), body: Buffer.from(await r.arrayBuffer()) });
  }
  const c = proxyCache.get(key);
  res.statusCode = c.status; if (c.type) res.setHeader('content-type', c.type); res.end(c.body);
}

function serve(harness) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/harness.html') { res.setHeader('content-type', 'text/html'); return res.end(harness); }
    if (u.pathname === '/host.html') {
      res.setHeader('content-type', 'text/html');
      return res.end(`<!doctype html><body style="margin:0;background:#888"><iframe id="f" src="/harness.html"
        style="border:0;width:${u.searchParams.get('w')}px;height:${u.searchParams.get('h')}px;background:#fff"></iframe></body>`);
    }
    if (u.pathname.startsWith('/ods-widgets/dist/')) {
      const f = path.join(WIDGETS_DIST, decodeURIComponent(u.pathname.slice('/ods-widgets/dist/'.length)));
      if (fs.existsSync(f)) { if (f.endsWith('.js')) res.setHeader('content-type', 'text/javascript'); if (f.endsWith('.css')) res.setHeader('content-type', 'text/css'); return res.end(fs.readFileSync(f)); }
    }
    if (/^\/(static|css|assets)\//.test(u.pathname)) return proxy(u, res);
    res.statusCode = 404; res.end();
  });
  return new Promise(r => server.listen(0, () => r(server)));
}

const inspectFrame = () => {   // runs inside the iframe
  const out = { empty: [], text: [], overflow: null, offenders: [], height: document.documentElement.scrollHeight, maps: [], present: [] };
  const label = el => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  document.querySelectorAll('[class*="odswidget-"]').forEach(el => el.classList.forEach(c => { const m = c.match(/^odswidget-([a-z-]+?)$/); if (m) out.present.push('ods-' + ({ charts: 'chart' }[m[1]] || m[1])); }));
  document.querySelectorAll('*').forEach(el => { if (el.tagName.startsWith('ODS-') || [...el.attributes].some(a => /^ods-[a-z-]+$/.test(a.name) && !/-(context|max|sort|facet-name|function|expression|select|where|group-by|order-by|limit)$/.test(a.name))) out.present.push(el.tagName.startsWith('ODS-') ? el.tagName.toLowerCase() : [...el.attributes].find(a => a.name.startsWith('ods-')).name + '="' + el.getAttribute([...el.attributes].find(a => a.name.startsWith('ods-')).name) + '"'); });
  document.querySelectorAll('ods-chart, .odswidget-charts').forEach(el => {
    const pts = el.querySelectorAll('.highcharts-point, .highcharts-graph').length;
    if (!el.querySelector('.highcharts-container')) out.empty.push('ods-chart: no Highcharts container rendered');
    else if (el.querySelector('.highcharts-no-data') || pts === 0) out.empty.push('ods-chart: chart drawn but has no data points');
  });
  document.querySelectorAll('ods-map').forEach(el => {
    const n = el.querySelectorAll('.leaflet-overlay-pane path, .leaflet-marker-pane > *').length;
    if (n === 0) out.empty.push('ods-map: no features drawn');
    out.maps.push(el.getBoundingClientRect().height);
  });
  document.querySelectorAll('ods-table').forEach(el => { if (!el.querySelector('tbody tr')) out.empty.push('ods-table: no rows'); });
  for (const [attr, label2] of [['ods-results', 'ods-results'], ['ods-facet-results', 'ods-facet-results'], ['ods-aggregation', 'ods-aggregation'], ['ods-adv-analysis', 'ods-adv-analysis']]) {
    document.querySelectorAll(`[${attr}]:not([ng-repeat])`).forEach(el => {
      const v = angular.element(el).scope()?.[el.getAttribute(attr)];
      if (v === undefined || v === null) out.empty.push(`${label2}="${el.getAttribute(attr)}": variable never set`);
      else if (Array.isArray(v) && v.length === 0) out.empty.push(`${label2}="${el.getAttribute(attr)}": empty result`);
      else if (typeof v === 'number' && !isFinite(v)) out.empty.push(`${label2}="${el.getAttribute(attr)}": ${v}`);
    });
  }
  document.querySelectorAll('ods-select').forEach(el => {
    const v = angular.element(el).scope()?.$eval(el.getAttribute('options'));
    if (!v || !v.length) out.empty.push(`ods-select options="${el.getAttribute('options')}": no options`);
  });
  const txt = document.body.innerText;
  for (const t of ['{{', 'NaN', 'undefined', 'Infinity', '[object Object]']) if (txt.includes(t)) out.text.push(`visible text contains "${t}": …${txt.slice(Math.max(0, txt.indexOf(t) - 40), txt.indexOf(t) + 40).replace(/\s+/g, ' ')}…`);
  const W = document.documentElement.clientWidth;
  out.overflow = document.documentElement.scrollWidth - W;
  if (out.overflow > 0) {
    const off = [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > W + 1 && ![...el.children].some(c => c.getBoundingClientRect().right > W + 1));
    out.offenders = off.slice(0, 5).map(el => `${label(el)} (right edge ${Math.round(el.getBoundingClientRect().right)}px)`);
  }
  return out;
};

async function settle(page, net, frame) {
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    await page.waitForTimeout(300);
    const quiet = net.inflight === 0 && Date.now() - net.last > 1500;
    const busy = await frame.evaluate(() => !![...document.querySelectorAll('.ng-cloak, .odswidget-spinner, .odswidget-spinner--large')].some(e => e.checkVisibility())).catch(() => true);
    if (quiet && !busy) return Date.now() - t0;
  }
  if (process.env.DEBUG) console.error('UNSETTLED', net.inflight, Date.now() - net.last, await frame.evaluate(() => [...document.querySelectorAll('.ng-cloak, .odswidget-spinner, .odswidget-spinner--large')].filter(e => e.offsetParent !== null).map(e => e.outerHTML.slice(0, 150)).concat([...document.querySelectorAll('[class*=chart]')].slice(0,6).map(e => e.tagName + ' ' + e.className))), [...net.open]);
  return -1;
}

async function render(browser, harness) {
  const server = await serve(harness);
  const port = server.address().port;
  const stateResults = [];
  let renderRequests = 0;
  for (const [w, h] of sizes) {
    const page = await browser.newPage({ viewport: { width: w + 40, height: h + 40 } });
    const net = { inflight: 0, last: Date.now(), open: new Set() };
    const consoleMsgs = [];
    page.on('request', r => { net.open.add(r.url()); net.inflight++; net.last = Date.now(); if (r.url().startsWith(PORTAL + '/api/')) renderRequests++; });
    const done = r => { net.open.delete(r.url()); net.inflight = Math.max(0, net.inflight - 1); net.last = Date.now(); };
    page.on('requestfinished', done);
    page.on('requestfailed', r => { done(r); if (r.failure()?.errorText !== 'net::ERR_ABORTED') consoleMsgs.push(`request failed: ${r.url().slice(0, 120)} (${r.failure()?.errorText})`); });
    page.on('response', async r => { if (r.status() === 404 && !r.url().startsWith(PORTAL + '/api/')) consoleMsgs.push(`404: ${r.url().slice(0, 160)}`);
      if (r.status() >= 400 && r.url().startsWith(PORTAL + '/api/')) consoleMsgs.push(`API ${r.status()}: ${r.url().slice(0, 160)} → ${(await r.text().catch(() => '')).slice(0, 160)}`); });
    page.on('console', m => { if (m.type() === 'error') consoleMsgs.push(`console.error: ${m.text().slice(0, 300)}`); });
    page.on('pageerror', e => consoleMsgs.push(`uncaught: ${String(e).slice(0, 300)}`));
    await page.goto(`http://localhost:${port}/host.html?w=${w}&h=${h}`);
    const frame = page.frames().find(f => f.url().endsWith('/harness.html'));
    const states = [{ id: 'default', click: null }];
    let ms = await settle(page, net, frame);
    // only author-written ng-click (Widget templates carry their own) plus ods-simple-tabs headers
    const clickables = await frame.evaluate(src => [...document.querySelectorAll('[ng-click], .odswidget-simple-tabs__tab')]
      .filter(el => !el.hasAttribute('ng-click') || src.includes(el.getAttribute('ng-click')))
      .map((el, i) => { el.setAttribute('data-verify-click', i); return { i, text: el.innerText.trim().slice(0, 30) }; }),
      [...pageHtml.matchAll(/ng-click="([^"]+)"/g)].map(m => m[1]));
    for (let s = 0; s <= clickables.length; s++) {
      if (s > 0) {
        const c = clickables[s - 1];
        await frame.click(`[data-verify-click="${c.i}"]`).catch(() => {});
        states.push({ id: `click-${c.i}`, click: c.text });
        ms = await settle(page, net, frame);
      }
      const st = states[s];
      const r = await frame.evaluate(inspectFrame);
      const shot = `${w}x${h}-${st.id}.png`;
      await page.locator('#f').screenshot({ path: path.join(outDir, shot) });
      stateResults.push({ size: `${w}x${h}`, state: st.click ? `after clicking "${st.click}"` : 'initial', settleMs: ms, shot, console: consoleMsgs.splice(0), ...r });
    }
    // one full-height capture of the initial layout, by growing the iframe to its content
    await page.setViewportSize({ width: w + 40, height: Math.min(stateResults.at(-1).height + 40, 8000) });
    await page.evaluate(([hh]) => { document.getElementById('f').style.height = hh + 'px'; }, [Math.min(stateResults.at(-1).height, 8000)]);
    await page.waitForTimeout(800);
    await page.locator('#f').screenshot({ path: path.join(outDir, `${w}x${h}-full.png`) });
    await page.close();
  }
  server.close();
  return { stateResults, renderRequests };
}

// ---------- 5. Report ----------
const browser = await chromium.launch();
const cfg = await platformConfig();
const els = await lint(browser);
await dryRun(els);
const { stateResults, renderRequests } = await render(browser, harnessHtml(cfg));
await browser.close();

const sourceWidgets = new Set(els.filter(e => e.tag.startsWith('ods-')).map(e => e.tag));
const seen = new Set(stateResults.flatMap(r => r.present));
for (const t of sourceWidgets) if (![...seen].includes(t)) add('render', 'error', `<${t}>`, 'never rendered in any explored state (hidden behind ng-if / tab not reached?)');
for (const r of stateResults) {
  const where = `${r.size}, ${r.state}`;
  if (r.settleMs < 0) add('render', 'warning', where, 'did not settle within 30 s');
  for (const m of new Set(r.console)) add('console', 'error', where, m);
  for (const m of r.empty) add('empty', 'error', where, m);
  for (const m of r.text) add('empty', 'error', where, m);
  if (r.overflow > 0) add('overflow', 'error', where, `horizontal overflow ${r.overflow}px; offenders: ${r.offenders.join('; ')}`);
  for (const mh of r.maps) if (mh < 400) add('overflow', 'warning', where, `map is ${Math.round(mh)}px high (< 400px floor)`);
  if (r.state === 'initial') add('layout', 'info', where, `content height ${r.height}px in a ${r.size.split('x')[1]}px iframe${r.height > +r.size.split('x')[1] ? ' → iframe scrolls' : ''}`);
}
// collapse identical messages across sizes/states so the agent reads each problem once
const grouped = new Map();
for (const f of findings) { const k = f.cls + f.severity + f.msg; if (!grouped.has(k)) grouped.set(k, { ...f, where: [] }); grouped.get(k).where.push(f.where); }
const list = [...grouped.values()];
const errors = list.filter(f => f.severity === 'error');
const total = apiRequests + renderRequests;
const order = ['lint', 'dataset', 'odsql', 'console', 'empty', 'render', 'overflow', 'layout'];
let md = `# Verification: ${name}\n\n**Verdict: ${errors.length ? `FAIL — ${errors.length} distinct errors` : 'PASS'}**  ·  ` +
  `${list.filter(f => f.severity === 'warning').length} warnings  ·  platform theme rev ${cfg.themeRev}\n\n` +
  `Requests to data.gr.ch API this run: **${total}** (dry-run ${apiRequests}, render ${renderRequests}) of the anonymous 5000/day budget.\n\n`;
for (const cls of order) {
  const fs_ = list.filter(f => f.cls === cls).sort((a, b) => a.severity.localeCompare(b.severity));
  if (!fs_.length) continue;
  md += `## ${cls}\n\n` + fs_.map(f => `- **${f.severity}** ${f.msg}  \n  _${[...new Set(f.where)].join(' · ')}_`).join('\n') + '\n\n';
}
md += `## Screenshots\n\n| size | state | settle | file |\n|---|---|---|---|\n` +
  stateResults.map(r => `| ${r.size} | ${r.state} | ${r.settleMs}ms | ${r.shot} |`).join('\n') +
  '\n' + sizes.map(([w, h]) => `| ${w}x${h} | full height | | ${w}x${h}-full.png |`).join('\n') + '\n';
fs.writeFileSync(path.join(outDir, 'report.md'), md);
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ verdict: errors.length ? 'fail' : 'pass', requests: total, findings: list, states: stateResults }, null, 2));
console.log(md);
process.exit(errors.length ? 1 : 0);
