// Intake helpers for /huwise-page step 1. The data.gr.ch MCP has no German field labels, no
// timeserie_precision and no geo/timeserie features, so one raw v1 call fills the gaps.
// Usage: node intake.mjs v1 <dataset-id>       one raw v1 call, German labels
//        node intake.mjs explore <dataset-id>  fallback when the MCP is unavailable: public Explore API v2.1
//        node intake.mjs facets <dataset-id> <field> [limit]   distinct values of a field (Explore API, fallback)
import { pathToFileURL } from 'node:url';
const HOST = process.env.HUWISE_HOST ?? 'https://data.gr.ch';

export const v1Url = id => `${HOST}/api/datasets/1.0/${encodeURIComponent(id)}/?lang=de`;

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json();
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, id, field, limit] = process.argv.slice(2);
  const run = { v1: () => fetchV1(id), explore: () => exploreSummary(id), facets: () => exploreFacets(id, field, limit && Number(limit)) }[cmd];
  if (!run || !id || (cmd === 'facets' && !field)) {
    console.error('Usage: node intake.mjs v1|explore <dataset-id>  |  node intake.mjs facets <dataset-id> <field> [limit]');
    process.exit(2);
  }
  console.log(JSON.stringify(await run(), null, 2));
}
