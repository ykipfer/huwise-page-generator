// Dry-run stage: data errors caught before rendering, about 1 API request per dataset, literal query or
// colour map. Runs only when lint is clean (verify.mjs gates it).
//
// Checks (errors):
// - every referenced field exists in its context's dataset: field-x, expression-y, series-breakdown,
//   facet names, refine./exclude./disjunctive./sort in parameters and filter bindings, .fields.* reads;
// - every literal ods-adv-analysis ODSQL query runs and returns rows;
// - every literal value-to-colour map (category-colors, color-categories) uses exactly the real facet
//   values of its field, within the context's literal default refine/exclude filters. Missing or extra keys silently fall back to the default palette.
//
// It talks to the public Explore API v2.1. Inside Claude Code the same facts are available through the
// data.gr.ch MCP (the skill uses it while planning); a Node script cannot call MCP tools, so the CLI
// always uses the API.
//
// Key coverage (errors): for each map layer fed by an ods-color-gradient (the hand join), every data key
// within the data context's literal default filters must have a shape in the Boundary Dataset, compared
// as strings. The Boundary Dataset must be in the closed catalogue (references/boundary-catalogue.json)
// and be joined on the catalogue's key field. Shapes without data are not an error. Filters computed at
// runtime can't be evaluated: they are ignored, with a warning.
import fs from 'node:fs';
import path from 'node:path';
import { parseFragment } from 'parse5';
import { elements, textNodes } from './lint.mjs';

const CATALOGUE = JSON.parse(fs.readFileSync(
  path.join(import.meta.dirname, '..', 'references', 'boundary-catalogue.json'), 'utf8')).levels;

export const API_BASE = process.env.HUWISE_API_BASE ?? 'https://data.gr.ch/api/explore/v2.1';
const FACET_CAP = 100;   // group_by returns at most 100 values per request
const MAX_KEYS = 10000;  // the API refuses offset + limit above this
const LIST_CAP = 20;     // keys named in one message
// Fields every record carries besides the dataset's own.
const SYSTEM_FIELDS = new Set(['recordid', 'record_timestamp', 'datasetid', '_id', '_full_count', '_geom', '_bbox']);
const IDENT = /^[A-Za-z_]\w*$/;

const finding = (rule, loc, message, severity = 'error') => ({
  rule, severity, location: { file: 'index.html', line: loc.startLine, column: loc.startCol }, message,
});

async function defaultFetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  return { status: res.status, body };
}

// Attribute lookup that also accepts AngularJS's data-/x- prefixed spelling.
function attrOf(el, name) {
  for (const prefix of ['', 'data-', 'x-']) {
    const found = el.attrs?.find(a => a.name === prefix + name);
    if (found) return { value: found.value, loc: el.sourceCodeLocation.attrs?.[found.name] ?? el.sourceCodeLocation };
  }
  return null;
}
const hasAttr = (el, name) => attrOf(el, name) !== null;
const literal = v => v !== undefined && !v.includes('{{');
const simpleName = v => v?.match(/^\s*\[?\s*([A-Za-z_]\w*)\s*\]?\s*$/)?.[1];

// Keys of a literal object attribute value: {'A': '#fff', "B": 'red', C: 1}.
function objectKeys(value) {
  if (!literal(value) || !/^\s*\{/.test(value)) return null;
  const keys = [];
  for (const m of value.matchAll(/[{,]\s*(?:(['"])((?:(?!\1)[^\\])*)\1|([\w.-]+))\s*:/g)) keys.push(m[2] ?? m[3]);
  return keys;
}

// Entries of a literal object attribute value, values kept as raw source: [{ key, raw }]. Null when not an object.
function objectEntries(value) {
  const s = (value ?? '').trim();
  if (!s.startsWith('{') || !s.endsWith('}')) return null;
  const body = s.slice(1, -1), entries = [];
  for (let i = 0; i < body.length;) {
    const k = /^\s*(?:(['"])((?:(?!\1)[^\\])*)\1|([\w.-]+))\s*:\s*/.exec(body.slice(i));
    if (!k) break;
    i += k[0].length;
    let depth = 0, quote = null, j = i;
    for (; j < body.length; j++) {
      const c = body[j];
      if (quote) { if (c === '\\') j++; else if (c === quote) quote = null; }
      else if (c === "'" || c === '"') quote = c;
      else if ('[({'.includes(c)) depth++;
      else if ('])}'.includes(c)) depth--;
      else if (c === ',' && depth === 0) break;
    }
    entries.push({ key: k[2] ?? k[3], raw: body.slice(i, j).trim() });
    i = j + 1;
  }
  return entries;
}

// A raw value that is a plain literal (string, number, or an array of them) as a list of strings; else null.
function literalValues(raw) {
  const item = /\s*(?:(['"])((?:(?!\1)[^\\])*)\1|(-?\d+(?:\.\d+)?))\s*/y;
  const one = new RegExp(`^${item.source}$`).exec(raw);
  if (one) return [one[2] ?? one[3]];
  const arr = /^\[(.*)\]$/s.exec(raw);
  if (!arr) return null;
  const values = [];
  const parts = arr[1].trim() ? arr[1].split(',') : null;
  if (!parts) return null;
  for (const part of parts) {
    const m = new RegExp(`^${item.source}$`).exec(part);
    if (!m) return null;
    values.push(m[2] ?? m[3]);
  }
  return values;
}

// Default filters of a context: literal refine/exclude entries, and the fields whose default is computed.
function defaultFilters(paramsValue, ctx, html) {
  const filters = [], dynamic = new Set();
  for (const { key, raw } of objectEntries(paramsValue) ?? []) {
    const m = key.match(/^(refine|exclude)\.(.+)$/);
    if (!m) continue;
    const values = literalValues(raw);
    if (values) filters.push({ kind: m[1], field: m[2], values });
    else dynamic.add(m[2]);
  }
  // Guarded defaults and other writes into the context's parameters happen at runtime.
  const write = new RegExp(`\\b${ctx}\\.parameters\\[\\s*(['"])(?:refine|exclude)\\.(\\w+)\\1\\s*\\]\\s*=(?!=)`, 'g');
  for (const [, , field] of html.matchAll(write)) if (!filters.some(f => f.field === field)) dynamic.add(field);
  return { filters, dynamic };
}

// ODSQL where clause for literal filters. A filter that can't be expressed joins `ignored`.
function whereClause(filters, types, ignored) {
  const parts = [];
  for (const { kind, field, values } of filters) {
    const type = types.get(field);
    let list = null;
    if (!IDENT.test(field)) list = null;
    else if (type === 'text') list = values.map(v => `"${v.replace(/["\\]/g, '\\$&')}"`);
    else if ((type === 'int' || type === 'double') && values.every(v => Number.isFinite(Number(v)))) list = values.map(Number);
    if (!list) { ignored.add(field); continue; }
    parts.push(`${kind === 'exclude' ? 'not ' : ''}${field} in (${list.join(',')})`);
  }
  return parts.join(' and ');
}

function collect(html) {
  const doc = parseFragment(html, { sourceCodeLocationInfo: true });
  const datasets = new Map();   // context name -> { id, loc }
  const refs = [];              // { ctx, field, loc, what }
  const maps = [];              // { ctx, field, keys, loc, attr }
  const queries = [];           // { ctx, params, loc }
  const gradients = new Map();  // gradient variable -> { dataCtx, field }
  const layers = [];            // map layers fed by a gradient: { variable, geoCtx, keyField, loc }
  const els = [...elements(doc)];

  const ref = (ctx, field, loc, what) => { if (ctx && field) refs.push({ ctx, field, loc, what }); };
  const fieldRef = (ctx, value, loc, what) => { if (IDENT.test(value ?? '')) ref(ctx, value, loc, what); };

  for (const el of els) {
    if (el.tagName !== 'ods-dataset-context' && !hasAttr(el, 'ods-dataset-context')) continue;
    for (const ctx of (attrOf(el, 'context')?.value ?? '').split(/[\s,\[\]]+/).filter(Boolean)) {
      const d = attrOf(el, `${ctx}-dataset`);
      if (d && /^[\w-]+$/.test(d.value.trim())) {
        const params = attrOf(el, `${ctx}-parameters`)?.value;
        datasets.set(ctx, { id: d.value.trim(), loc: d.loc, ...defaultFilters(params, ctx, html) });
      }
    }
  }
  const ctxOf = (el, ...names) => {
    for (const n of names) { const c = simpleName(attrOf(el, n)?.value); if (c) return c; }
    return null;
  };
  // Row variable -> context: ods-results rows and map-layer tooltip records.
  const rowContext = (node, variable) => {
    for (; node?.attrs; node = node.parentNode) {
      // ng-repeat="row in rows": the loop variable reads the rows of the Widget that defines `rows`.
      const repeat = attrOf(node, 'ng-repeat')?.value.match(/^\s*(\w+)\s+in\s+(\w+)/);
      if (repeat?.[1] === variable) return rowContext(node, repeat[2]);
      const r = attrOf(node, 'ods-results');
      if (r && (r.value.trim() || 'results') === variable) return ctxOf(node, 'ods-results-context', 'context');
      if (variable === 'record' && (node.tagName === 'ods-map-layer' || hasAttr(node, 'ods-map-layer'))) return ctxOf(node, 'context');
    }
    return null;
  };
  const scanExpression = (text, loc, node) => {
    for (const m of text.matchAll(/\b(\w+)\.parameters\[\s*(['"])(?:refine|exclude|disjunctive)\.([\w]+)\2\s*\]/g))
      if (datasets.has(m[1])) ref(m[1], m[3], loc, 'filter parameter');
    for (const m of text.matchAll(/\b(\w+)\.fields\.(\w+)/g))
      ref(rowContext(node, m[1]), m[2], loc, 'record field');
  };

  for (const el of els) {
    const loc = el.sourceCodeLocation;
    if (el.tagName === 'ods-chart-query') {
      const ctx = ctxOf(el, 'context');
      const x = attrOf(el, 'field-x'), breakdown = attrOf(el, 'series-breakdown');
      if (x) fieldRef(ctx, x.value.trim(), x.loc, 'field-x');
      if (breakdown) fieldRef(ctx, breakdown.value.trim(), breakdown.loc, 'series-breakdown');
      const colours = attrOf(el, 'category-colors');
      const keys = colours && objectKeys(colours.value);
      const field = (breakdown ?? x)?.value.trim();
      if (keys && ctx && IDENT.test(field ?? '')) maps.push({ ctx, field, keys, loc: colours.loc, attr: 'category-colors' });
    }
    if (el.tagName === 'ods-chart-serie') {
      let q = el.parentNode;
      while (q?.attrs && q.tagName !== 'ods-chart-query') q = q.parentNode;
      const y = attrOf(el, 'expression-y');
      if (q?.attrs && y && attrOf(el, 'function-y')?.value.trim().toUpperCase() !== 'COUNT')
        fieldRef(ctxOf(q, 'context'), y.value.trim(), y.loc, 'expression-y');
    }
    if (hasAttr(el, 'ods-facet-results')) {
      const name = attrOf(el, 'ods-facet-results-name');
      if (name) fieldRef(ctxOf(el, 'ods-facet-results-context', 'context'), name.value.trim(), name.loc, 'facet name');
    }
    const agg = attrOf(el, 'ods-aggregation');
    if (agg) for (const v of agg.value.split(',').map(s => s.trim()).filter(Boolean)) {
      const expr = attrOf(el, `ods-aggregation-${v}-expression`) ?? attrOf(el, 'ods-aggregation-expression');
      const ctx = ctxOf(el, `ods-aggregation-${v}-context`, 'ods-aggregation-context');
      if (expr) fieldRef(ctx, expr.value.trim(), expr.loc, 'aggregation expression');
    }
    if (hasAttr(el, 'ods-color-gradient')) {
      const ctx = ctxOf(el, 'ods-color-gradient-context');
      const x = attrOf(el, 'ods-color-gradient-x'), serie = attrOf(el, 'ods-color-gradient-serie');
      if (x) fieldRef(ctx, x.value.trim(), x.loc, 'color-gradient x');
      const inner = serie?.value.match(/^\s*\w+\(\s*(\w+)\s*\)\s*$/)?.[1];
      if (inner) fieldRef(ctx, inner, serie.loc, 'color-gradient serie');
      const variable = attrOf(el, 'ods-color-gradient').value.trim();
      if (ctx && x && IDENT.test(x.value.trim()) && /^\w+$/.test(variable) && !gradients.has(variable))
        gradients.set(variable, { dataCtx: ctx, field: x.value.trim() });
    }
    if (el.tagName === 'ods-map-layer' || hasAttr(el, 'ods-map-layer')) {
      const ctx = ctxOf(el, 'context');
      const by = attrOf(el, 'color-by-field'), geo = attrOf(el, 'geo-field');
      if (by) fieldRef(ctx, by.value.trim(), by.loc, 'color-by-field');
      if (geo) fieldRef(ctx, geo.value.trim(), geo.loc, 'geo-field');
      const cats = attrOf(el, 'color-categories');
      const keys = cats && objectKeys(cats.value);
      if (keys && ctx && by && IDENT.test(by.value.trim())) maps.push({ ctx, field: by.value.trim(), keys, loc: cats.loc, attr: 'color-categories' });
      // The hand join: color-categories fed by an ods-color-gradient variable ("colors['colors']").
      const fed = cats?.value.match(/^\s*(\w+)\s*(?:\[\s*(['"])colors\2\s*\]|\.colors)\s*$/)?.[1];
      if (fed && ctx && by && IDENT.test(by.value.trim())) layers.push({ variable: fed, geoCtx: ctx, keyField: by.value.trim(), loc: cats.loc });
    }
    if (hasAttr(el, 'ods-adv-analysis')) {
      const get = n => attrOf(el, `ods-adv-analysis-${n}`);
      const params = { select: get('select'), where: get('where'), group_by: get('group-by'), order_by: get('order-by') };
      const given = Object.entries(params).filter(([, a]) => a);
      if (given.length && given.every(([, a]) => literal(a.value)))
        queries.push({ ctx: ctxOf(el, 'ods-adv-analysis-context'), params: Object.fromEntries(given.map(([k, a]) => [k, a.value.trim()])), loc });
    }
    for (const { name, value } of el.attrs) {
      const attrLoc = loc.attrs?.[name] ?? loc;
      const prefix = name.match(/^(?:data-|x-)?(\w+)-parameters$/)?.[1];
      if (prefix && datasets.has(prefix)) {
        for (const [, , key] of value.matchAll(/(?:^|[{,])\s*(['"]?)([\w.-]+)\1\s*:/g)) {
          const f = key.match(/^(?:refine|exclude|disjunctive)\.(.+)$/)?.[1];
          if (f) ref(prefix, f, attrLoc, 'parameter');
        }
        const sort = value.match(/(?:^|[{,])\s*['"]?sort['"]?\s*:\s*(['"])([^'"]*)\1/)?.[2];
        if (sort !== undefined) for (const s of sort.split(',').map(x => x.trim().replace(/^-/, '')).filter(Boolean)) fieldRef(prefix, s, attrLoc, 'sort');
      }
      scanExpression(value, attrLoc, el);
    }
  }
  for (const node of textNodes(doc)) scanExpression(node.value, node.sourceCodeLocation, node.parentNode);
  const joins = layers.filter(l => gradients.has(l.variable)).map(l => ({ ...gradients.get(l.variable), ...l }));
  return { datasets, refs, maps, queries, joins };
}

// All distinct values of a field, one API request per 100, ordered so the pages don't overlap.
async function distinctValues(get, datasetId, field, where) {
  const values = [];
  for (let offset = 0; ; offset += FACET_CAP) {
    const qs = new URLSearchParams({ select: field, group_by: field, order_by: field, limit: String(FACET_CAP), offset: String(offset) });
    if (where) qs.set('where', where);
    const { status, body } = await get(`/catalog/datasets/${encodeURIComponent(datasetId)}/records?${qs}`);
    if (status !== 200) return { error: `HTTP ${status}. ${body?.message ?? ''}`.trim() };
    values.push(...body.results.map(r => r[field]).filter(v => v !== null && v !== undefined).map(String));
    const total = body.total_count ?? values.length;
    if (offset + FACET_CAP >= total) return { values };
    if (offset + 2 * FACET_CAP > MAX_KEYS) return { values, truncated: true };
  }
}

const listKeys = keys => keys.slice(0, LIST_CAP).join(', ') + (keys.length > LIST_CAP ? ` and ${keys.length - LIST_CAP} more` : '');

export async function dryRun({ html, fetchJson = defaultFetchJson }) {
  const findings = [];
  let apiRequests = 0;
  const get = async path => { apiRequests++; return fetchJson(`${API_BASE}${path}`); };
  const collected = collect(html);
  const { datasets, maps, queries, joins } = collected;
  // One reference per context, field and place, however many attributes name it.
  const refs = [...new Map(collected.refs.map(r =>
    [`${r.ctx}:${r.field}@${r.loc.startLine}:${r.loc.startCol}`, r])).values()];

  try {
    // One metadata request per dataset: its field list.
    const fields = new Map();   // dataset id -> Set of names | null when unavailable
    for (const [, { id, loc }] of datasets) {
      if (fields.has(id)) continue;
      const { status, body } = await get(`/catalog/datasets/${encodeURIComponent(id)}`);
      if (status === 200 && Array.isArray(body?.fields)) fields.set(id, new Map(body.fields.map(f => [f.name, f.type])));
      else {
        fields.set(id, null);
        findings.push(finding('dry-run-dataset-unavailable', loc, `Dataset "${id}" could not be read (HTTP ${status}). Check the ID on data.gr.ch`));
      }
    }
    const known = ctx => {
      const d = datasets.get(ctx), types = d && fields.get(d.id);
      return types ? { id: d.id, types, names: types, filters: d.filters, dynamic: d.dynamic } : null;
    };

    const missing = new Set();   // "ctx:field" already reported as missing
    for (const r of refs) {
      const d = known(r.ctx);
      if (!d || d.names.has(r.field) || SYSTEM_FIELDS.has(r.field)) continue;
      missing.add(`${r.ctx}:${r.field}`);
      findings.push(finding('dry-run-missing-field', r.loc, `Field "${r.field}" (${r.what}) does not exist in dataset "${d.id}" (context ${r.ctx})`));
    }

    for (const q of queries) {
      const d = known(q.ctx);
      if (!d) continue;
      const text = Object.entries(q.params).map(([k, v]) => `${k.replace('_', ' ')} ${v}`).join(' ');
      const qs = new URLSearchParams({ ...q.params, limit: '1' });
      const { status, body } = await get(`/catalog/datasets/${encodeURIComponent(d.id)}/records?${qs}`);
      if (status !== 200)
        findings.push(finding('dry-run-query-failed', q.loc, `Literal ODSQL query failed (HTTP ${status}): ${text}. ${body?.message ?? ''}`.trim()));
      else if (!body.results?.length)
        findings.push(finding('dry-run-empty-query', q.loc, `Literal ODSQL query returned no rows: ${text}`));
    }

    for (const m of maps) {
      const d = known(m.ctx);
      if (!d || missing.has(`${m.ctx}:${m.field}`) || !d.names.has(m.field)) continue;
      const qs = new URLSearchParams({ select: m.field, group_by: m.field, limit: String(FACET_CAP) });
      // Values the reader can see: the context's literal default filters narrow the field (a "top 7" chart).
      const where = whereClause(d.filters, d.types, new Set());
      if (where) qs.set('where', where);
      const { status, body } = await get(`/catalog/datasets/${encodeURIComponent(d.id)}/records?${qs}`);
      if (status !== 200) {
        findings.push(finding('dry-run-query-failed', m.loc, `Facet values of "${m.field}" could not be read (HTTP ${status}). ${body?.message ?? ''}`.trim()));
        continue;
      }
      if ((body.total_count ?? body.results.length) > FACET_CAP) {
        findings.push(finding('dry-run-colour-map-truncated', m.loc,
          `"${m.field}" has more than ${FACET_CAP} values: ${m.attr} could not be checked completely`, 'warning'));
        continue;
      }
      const real = new Set(body.results.map(r => r[m.field]).filter(v => v !== null && v !== undefined).map(String));
      const keys = new Set(m.keys);
      const absent = [...real].filter(v => !keys.has(v));
      const extra = [...keys].filter(k => !real.has(k));
      if (absent.length || extra.length)
        findings.push(finding('dry-run-colour-map-mismatch', m.loc,
          `${m.attr} does not match the values of "${m.field}", so these fall back to the default palette.` +
          (absent.length ? ` Missing from the map: ${absent.join(', ')}.` : '') +
          (extra.length ? ` Not in the data: ${extra.join(', ')}.` : '')));
    }

    // Key coverage: every data key (within the default filters) has a shape in the Boundary Dataset.
    const boundaryKeys = new Map();   // "dataset:field" -> result of distinctValues
    for (const j of joins) {
      const data = known(j.dataCtx), geo = known(j.geoCtx);
      if (!data || !geo) continue;
      const entry = CATALOGUE.find(e => e.dataset === geo.id);
      if (!entry) {
        findings.push(finding('dry-run-boundary-not-in-catalogue', j.loc,
          `Dataset "${geo.id}" (context ${j.geoCtx}) is not in the Boundary Dataset catalogue. Boundary Datasets come only from the closed catalogue (references/boundary-catalogue.md): ${CATALOGUE.map(e => `${e.level} ${e.dataset}`).join(', ')}`));
        continue;
      }
      if (j.keyField !== entry.keyField) {
        findings.push(finding('dry-run-boundary-key-mismatch', j.loc,
          `The ${entry.level} Boundary Dataset "${entry.dataset}" is joined on "${j.keyField}". Its key field is "${entry.keyField}" (${entry.keyType}): set color-by-field to it`));
        continue;
      }
      if (missing.has(`${j.dataCtx}:${j.field}`) || !data.names.has(j.field) || !geo.names.has(entry.keyField)) continue;

      const ignored = new Set(data.dynamic);
      const where = whereClause(data.filters, data.types, ignored);
      if (ignored.size)
        findings.push(finding('dry-run-key-coverage-filter-ignored', j.loc,
          `Key coverage of "${j.field}" was checked without the default filter on ${[...ignored].join(', ')}: it is computed at runtime or not a literal. Keys of every period are compared. Put a literal filter in the context's parameters to check what the reader sees first`, 'warning'));

      const dataKeys = await distinctValues(get, data.id, j.field, where);
      const cacheKey = `${entry.dataset}:${entry.keyField}`;
      if (!boundaryKeys.has(cacheKey)) boundaryKeys.set(cacheKey, await distinctValues(get, entry.dataset, entry.keyField, ''));
      const shapes = boundaryKeys.get(cacheKey);
      const failed = dataKeys.error ?? shapes.error;
      if (failed) {
        findings.push(finding('dry-run-query-failed', j.loc, `Keys for the coverage check could not be read: ${failed}`));
        continue;
      }
      if (dataKeys.truncated || shapes.truncated) {
        findings.push(finding('dry-run-key-coverage-truncated', j.loc, `More than ${MAX_KEYS} keys: key coverage could not be checked completely`, 'warning'));
        continue;
      }
      const have = new Set(shapes.values);
      const unmatched = [...new Set(dataKeys.values)].filter(k => !have.has(k));
      if (unmatched.length)
        findings.push(finding('dry-run-key-coverage', j.loc,
          `${unmatched.length} key${unmatched.length === 1 ? '' : 's'} of "${j.field}" (dataset "${data.id}") ${unmatched.length === 1 ? 'has' : 'have'} no shape in the ${entry.level} Boundary Dataset "${entry.dataset}" (${entry.keyField}, snapshot ${entry.snapshot}): ${listKeys(unmatched)}. These areas would not be drawn. Filter the period or check the snapshot`));
    }
  } catch (err) {
    findings.push(finding('dry-run-unreachable', { startLine: 1, startCol: 1 }, `data.gr.ch could not be reached: ${err.message}`));
  }
  return { findings, apiRequests };
}
