// Intake helpers for /huwise-page step 1. The data.gr.ch MCP has no German field labels, no
// timeserie_precision and no geo/timeserie features, so one raw v1 call fills the gaps.
// Usage: node intake.mjs v1 <dataset-id>       one raw v1 call, German labels
//        node intake.mjs explore <dataset-id>  fallback when the MCP is unavailable: public Explore API v2.1
//        node intake.mjs facets <dataset-id> <field> [limit]   distinct values of a field (Explore API, fallback)
//        node intake.mjs shared <main-id> <companion-id> [mainField=companionField ...]
//                                              Companion Dataset: which dimension do the two datasets share?
import { pathToFileURL } from 'node:url';
import { fetchJsonWithKey } from './apikey.mjs';
const HOST = process.env.HUWISE_HOST ?? 'https://data.gr.ch';

export const v1Url = id => `${HOST}/api/datasets/1.0/${encodeURIComponent(id)}/?lang=de`;

async function getJson(url) {
  const { status, statusText, body } = await fetchJsonWithKey(url);
  if (status < 200 || status > 299 || body === null) throw new Error(`${status} ${statusText}: ${url}`);
  return body;
}

export function summariseV1(d) {
  return {
    source: 'v1 API',
    datasetId: d.datasetid,
    title: d.metas?.title ?? null,
    dataProcessed: d.metas?.data_processed ?? null,
    features: d.features ?? [],
    fields: (d.fields ?? []).map(f => ({
      name: f.name, label: f.label, type: f.type,
      timeseriePrecision: (f.annotations ?? []).find(a => a.name === 'timeserie_precision')?.args?.[0] ?? null,
    })),
  };
}
export const fetchV1 = async id => summariseV1(await getJson(v1Url(id)));

// Explore API v2.1 labels are in the dataset's first metadata language (Romansh on data.gr.ch): use label_de.
export async function exploreSummary(id) {
  const d = await getJson(`${HOST}/api/explore/v2.1/catalog/datasets/${encodeURIComponent(id)}`);
  return {
    source: 'Explore API v2.1',
    datasetId: d.dataset_id,
    title: d.metas?.default?.title ?? null,
    dataProcessed: d.metas?.default?.data_processed ?? null,
    features: d.features ?? [],
    fields: (d.fields ?? []).map(f => ({ name: f.name, label: f.label_de ?? f.label, type: f.type, timeseriePrecision: null })),
  };
}

export async function exploreFacets(id, field, limit = 100) {
  const q = new URLSearchParams({ select: `${field}, count(*) as n`, group_by: field, order_by: field, limit: String(limit) });
  const d = await getJson(`${HOST}/api/explore/v2.1/catalog/datasets/${encodeURIComponent(id)}/records?${q}`);
  return d.results.map(r => ({ value: r[field], count: r.n }));
}

// Companion Dataset: the two datasets share a dimension when a field of one holds values that also occur in a
// field of the other, compared as strings (a text key and an integer key match). Candidate pairs are fields with
// the same name or the same German label, plus any pairs the caller names (renamed keys such as
// name=gemeinde_name). Date fields are left to named pairs: their values differ in format. Only a shared
// dimension allows a shared filter (Pattern 4); with none, no shared filter is proposed.
const VALUE_CAP = 1000;
export async function sharedDimensions(mainId, compId, pairs = [], { summary = exploreSummary, facets = exploreFacets } = {}) {
  const [main, comp] = await Promise.all([summary(mainId), summary(compId)]);
  const byName = (d, n) => d.fields.find(f => f.name === n);
  const candidates = new Map();
  const add = (a, b) => { if (byName(main, a) && byName(comp, b)) candidates.set(`${a}=${b}`, { main: a, companion: b }); };
  for (const a of main.fields) for (const b of comp.fields) {
    if (a.type === 'date' || b.type === 'date') continue;
    if (a.name === b.name || (a.label && a.label === b.label)) add(a.name, b.name);
  }
  for (const [a, b] of pairs) {
    if (!byName(main, a) || !byName(comp, b)) throw new Error(`Unknown field in pair ${a}=${b}`);
    add(a, b);
  }
  const results = [];
  for (const { main: a, companion: b } of candidates.values()) {
    const [va, vb] = await Promise.all([facets(mainId, a, VALUE_CAP), facets(compId, b, VALUE_CAP)]);
    const setA = new Set(va.map(v => String(v.value))), setB = new Set(vb.map(v => String(v.value)));
    const both = [...setA].filter(v => setB.has(v));
    results.push({
      main: a, companion: b,
      mainType: byName(main, a).type, companionType: byName(comp, b).type,
      mainValues: setA.size, companionValues: setB.size, shared: both.length,
      onlyInMain: setA.size - both.length, onlyInCompanion: setB.size - both.length,
      truncated: va.length >= VALUE_CAP || vb.length >= VALUE_CAP,
    });
  }
  const dimensions = results.filter(r => r.shared > 0);
  return {
    mainDataset: mainId, companionDataset: compId, checked: results, dimensions,
    verdict: dimensions.length
      ? `Shared dimension: ${dimensions.map(d => `${d.main} = ${d.companion} (${d.shared} common values)`).join('; ')}`
      : 'No shared dimension: propose no shared filter; show the datasets side by side',
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, id, field, limit] = process.argv.slice(2);
  if (cmd === 'shared') {
    if (!id || !field) { console.error('Usage: node intake.mjs shared <main-id> <companion-id> [mainField=companionField ...]'); process.exit(2); }
    const pairs = process.argv.slice(5).map(p => p.split('='));
    console.log(JSON.stringify(await sharedDimensions(id, field, pairs), null, 2));
    process.exit(0);
  }
  const run = { v1: () => fetchV1(id), explore: () => exploreSummary(id), facets: () => exploreFacets(id, field, limit && Number(limit)) }[cmd];
  if (!run || !id || (cmd === 'facets' && !field)) {
    console.error('Usage: node intake.mjs v1|explore <dataset-id>  |  node intake.mjs facets <dataset-id> <field> [limit]');
    process.exit(2);
  }
  console.log(JSON.stringify(await run(), null, 2));
}
