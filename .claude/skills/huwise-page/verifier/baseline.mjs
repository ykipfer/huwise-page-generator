// Baseline and regression detection for Benchmark runs (ticket #35). Offline except `schemas` and the live default of --schemas.
// Usage:
//   node baseline.mjs schemas [slug...]                         print the current field list of every request's datasets (live, Explore API)
//   node baseline.mjs accept <run-dir> [--schemas f]            the owner accepted this confirmed FULL run: write the Baseline file
//   node baseline.mjs compare <run-dir> [--rerun <run-dir>] [--schemas f] [--proposals f]
//                                                               compare a run (full or subset) with the Baseline; never replaces it
//   node baseline.mjs reset <run-dir> <slug> --note "..." [--schemas f]
//                                                               the owner accepted a replacement dataset: reset that one row with a note
// schemas file: { "<dataset id>": [{ "name": "..", "type": ".." }] | null }   (null = dataset removed)
// proposals file: { "<slug>": { "dataset": "<replacement id>", "note": ".." } }
// The Baseline file is tracked (benchmark/baseline.json, or HW_BASELINE_FILE).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REQUEST_SLUGS, CRITERIA, parseRequest } from './benchmark.mjs';
import { API_BASE } from './dryrun.mjs';
import { fetchJsonWithKey } from './apikey.mjs';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_BASELINE_FILE = path.join(SKILL, 'benchmark', 'baseline.json');
const requestFile = slug => path.join(SKILL, 'benchmark', 'requests', `${slug}.md`);
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJson = (f, data) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n'); };
const resultFile = (runDir, slug) => path.join(runDir, slug, 'result.json');
const baselineFileOf = file => file ?? process.env.HW_BASELINE_FILE ?? DEFAULT_BASELINE_FILE;

/** The numbers a Baseline row and a comparison keep of one recorded result. */
const summarize = r => ({
  pass: r.pass, iterations: r.iterations, warnings: r.warnings, total: r.total,
  scores: Object.fromEntries(CRITERIA.map(c => [c.key, r.scores[c.key].score])),
});

function loadResult(runDir, slug, { requireConfirmed = false } = {}) {
  const file = resultFile(runDir, slug);
  if (!fs.existsSync(file)) return null;
  const r = readJson(file);
  if (requireConfirmed && !r.confirmed) throw new Error(`The result for "${slug}" is not confirmed by the owner yet (run benchmark.mjs confirm).`);
  return r;
}

const datasetsOf = slug => parseRequest(requestFile(slug)).datasets;

function snapshot(slug, schemas) {
  return Object.fromEntries(datasetsOf(slug).map(id => {
    if (!schemas?.[id]) throw new Error(`No schema snapshot for dataset ${id} (${slug}); it is removed or was not fetched.`);
    return [id, schemas[id].map(({ name, type }) => ({ name, type }))];
  }));
}

/** The owner has confirmed this full run: it becomes the Baseline. A partial or unconfirmed run never can. */
export function acceptBaseline({ runDir, schemas, baselineFile, date = new Date().toISOString().slice(0, 10) }) {
  const missing = REQUEST_SLUGS.filter(s => !loadResult(runDir, s));
  if (missing.length) throw new Error(`Only a full run can become the Baseline; no result for: ${missing.join(', ')}.`);
  const rows = {};
  for (const slug of REQUEST_SLUGS) {
    const r = loadResult(runDir, slug, { requireConfirmed: true });
    rows[slug] = { ...summarize(r), datasets: snapshot(slug, schemas) };
  }
  const baseline = { acceptedFrom: path.basename(runDir), acceptedOn: date, rows };
  writeJson(baselineFileOf(baselineFile), baseline);
  return baseline;
}

/** Why `cur` is worse than the Baseline row `base` (empty when it is not): judged per criterion, so a gain in one does not offset a drop in another. */
function worseReasons(base, cur) {
  const out = [];
  if (base.pass && !cur.pass) out.push('pass to fail');
  for (const { key, label } of CRITERIA) if (cur.scores[key] < base.scores[key]) out.push(`${label} ${base.scores[key]} to ${cur.scores[key]}`);
  if (cur.iterations > base.iterations) out.push(`iterations ${base.iterations} to ${cur.iterations}`);
  return out;
}

/** Dataset changes since the Baseline row: removed or renamed datasets, removed fields, changed types. Added fields are not changes. */
function datasetChanges(slug, row, schemas) {
  const current = datasetsOf(slug), changes = [];
  for (const id of Object.keys(row.datasets)) if (!current.includes(id)) changes.push(`${id} is no longer the request's dataset (renamed or replaced)`);
  for (const id of current) if (!(id in row.datasets)) changes.push(`${id} is new in the request`);
  for (const [id, fields] of Object.entries(row.datasets)) {
    if (!current.includes(id)) continue;
    const now = schemas?.[id];
    if (now === undefined) throw new Error(`No schema snapshot for dataset ${id}; fetch it with \`node baseline.mjs schemas\`.`);
    if (now === null) { changes.push(`${id} removed`); continue; }
    const types = new Map(now.map(f => [f.name, f.type]));
    for (const f of fields) {
      if (!types.has(f.name)) changes.push(`${id}: field ${f.name} removed`);
      else if (types.get(f.name) !== f.type) changes.push(`${id}: field ${f.name} type ${f.type} to ${types.get(f.name)}`);
    }
  }
  return changes;
}

/**
 * Compare the recorded requests of a run with the Baseline. Rows whose scores (or re-run scores) the owner has not confirmed are flagged `unconfirmed`. Statuses: ok, needs-rerun (worse once: re-run it exactly once),
 * regression (worse again on the re-run), not-reproduced (worse once, fine on the re-run), dataset-changed (never a regression), new.
 * Writes comparison.json and comparison.md into the run folder. The Baseline file is only read.
 */
export function compareRun({ runDir, rerunDir, baselineFile, schemas, proposals = {} }) {
  const baseline = readJson(baselineFileOf(baselineFile));
  const savedFile = path.join(runDir, 'comparison.json');
  const saved = fs.existsSync(savedFile) ? Object.fromEntries(readJson(savedFile).rows.map(r => [r.slug, r])) : {};
  const rows = [];
  for (const slug of REQUEST_SLUGS) {
    const result = loadResult(runDir, slug);
    if (!result) continue;
    const first = summarize(result), base = baseline.rows[slug];
    if (!base) { rows.push({ slug, status: 'new', first }); continue; }
    const changes = datasetChanges(slug, base, schemas);
    if (changes.length) { rows.push({ slug, status: 'dataset-changed', changes, proposal: proposals[slug] ?? saved[slug]?.proposal ?? null, baseline: summarize(base), first, note: base.note }); continue; }
    const worse = worseReasons(base, first);
    const row = { slug, status: 'ok', baseline: { ...summarize(base), note: base.note }, first, worse };
    const rerunResult = rerunDir ? loadResult(rerunDir, slug) : null;
    if (rerunResult && !worse.length) throw new Error(`"${slug}" was not worse than the Baseline, so it is not re-run.`);
    if (rerunResult) {
      const stored = saved[slug]?.rerunDir;
      if (stored && path.resolve(stored) !== path.resolve(rerunDir)) throw new Error(`"${slug}" was already re-run once (${stored}); a request is re-run exactly once.`);
      row.rerunDir = path.resolve(rerunDir);
    } else if (saved[slug]?.rerunDir && worse.length) {
      row.rerunDir = saved[slug].rerunDir;
    }
    if (worse.length) {
      const again = row.rerunDir ? loadResult(row.rerunDir, slug) : null;
      if (!again) row.status = 'needs-rerun';
      else {
        row.rerun = summarize(again);
        row.rerunWorse = worseReasons(base, row.rerun);
        row.status = row.rerunWorse.length ? 'regression' : 'not-reproduced';
      }
    }
    rows.push(row);
  }
  for (const row of rows) row.unconfirmed = !loadResult(runDir, row.slug).confirmed || (!!row.rerunDir && !loadResult(row.rerunDir, row.slug).confirmed);
  const comparison = { run: path.basename(runDir), baselineFrom: baseline.acceptedFrom, rows };
  writeJson(savedFile, comparison);
  fs.writeFileSync(path.join(runDir, 'comparison.md'), comparisonMarkdown(comparison));
  return comparison;
}

const flag = r => (r.unconfirmed ? ' [scores not confirmed by the owner]' : '');
const line = s => `${s.pass ? 'pass' : 'fail'}, ${s.iterations} iteration(s), rubric ${s.total}/6, ${s.warnings} warning(s)`;

export function comparisonMarkdown({ run, baselineFrom, rows }) {
  const section = (title, items) => items.length ? [`## ${title}`, '', ...items.flat(), ''] : [];
  const by = (...s) => rows.filter(r => s.includes(r.status));
  return [
    `# Comparison with the Baseline: ${run}`, '', `Baseline from run ${baselineFrom}. Regression = worse than the Baseline on a re-run too (pass to fail, a lower score on any rubric criterion, more iterations).`, '',
    ...section('Regressions', by('regression').map(r => [`- **${r.slug}**: first run ${line(r.first)}; re-run ${line(r.rerun)}; Baseline ${line(r.baseline)}. Worse: ${r.rerunWorse.join(', ')}.${flag(r)}`])),
    ...section('Re-run needed (worse once; re-run exactly once)', by('needs-rerun').map(r => [`- **${r.slug}**: ${line(r.first)} against Baseline ${line(r.baseline)}. Worse: ${r.worse.join(', ')}.${flag(r)}`])),
    ...section('Not reproduced on the re-run (not a regression)', by('not-reproduced').map(r => [`- **${r.slug}**: first run worse (${r.worse.join(', ')}); re-run ${line(r.rerun)}.${flag(r)}`])),
    ...section('Dataset changed (not a regression)', by('dataset-changed').map(r => [
      `- **${r.slug}**: ${r.changes.join('; ')}.${flag(r)}`,
      r.proposal ? `  - Proposed replacement: ${r.proposal.dataset}${r.proposal.note ? ` (${r.proposal.note})` : ''}. When the owner accepts it: update the request file, re-run it, then \`baseline.mjs reset\`.` : '  - No replacement proposed yet.',
    ])),
    ...section('Unchanged or better', by('ok').map(r => [`- ${r.slug}: ${line(r.first)}${r.baseline.note ? ` (Baseline note: ${r.baseline.note})` : ''}${flag(r)}`])),
    ...section('Not in the Baseline', by('new').map(r => [`- ${r.slug}${flag(r)}`])),
  ].join('\n') + '\n';
}

/** The owner accepted a replacement dataset: that request's Baseline row is replaced by this run's confirmed result, with a note. */
export function resetRow({ runDir, slug, baselineFile, schemas, note }) {
  if (!note?.trim()) throw new Error('A reset needs a note saying why the row changed.');
  const file = baselineFileOf(baselineFile);
  const baseline = readJson(file);
  if (!REQUEST_SLUGS.includes(slug)) throw new Error(`Unknown benchmark request "${slug}".`);
  const result = loadResult(runDir, slug, { requireConfirmed: true });
  if (!result) throw new Error(`No recorded result for "${slug}" in ${runDir}.`);
  baseline.rows[slug] = { ...summarize(result), datasets: snapshot(slug, schemas), note: note.trim() };
  writeJson(file, baseline);
  return baseline.rows[slug];
}

/** Current fields of the datasets (null when the catalogue has no such dataset). */
export async function fetchSchemas(ids, { fetchJson = fetchJsonWithKey } = {}) {
  const out = {};
  for (const id of ids) {
    const { status, body } = await fetchJson(`${API_BASE}/catalog/datasets/${encodeURIComponent(id)}`);
    out[id] = status === 200 && Array.isArray(body?.fields) ? body.fields.map(({ name, type }) => ({ name, type })) : null;
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, ...rest] = process.argv.slice(2);
  const fail = msg => { console.error(`${msg}\nSee the usage at the top of baseline.mjs.`); process.exit(2); };
  const positional = [], opts = {};
  for (let i = 0; i < rest.length; i++) rest[i].startsWith('--') ? (opts[rest[i].slice(2)] = rest[++i]) : positional.push(rest[i]);
  const schemasFor = async slugs => opts.schemas ? readJson(path.resolve(opts.schemas)) : fetchSchemas([...new Set(slugs.flatMap(datasetsOf))]);
  try {
    if (cmd === 'schemas') {
      const slugs = positional.length ? positional : REQUEST_SLUGS;
      console.log(JSON.stringify(await schemasFor(slugs), null, 2));
    } else if (cmd === 'accept') {
      const runDir = path.resolve(positional[0] ?? fail('Missing run folder.'));
      const b = acceptBaseline({ runDir, schemas: await schemasFor(REQUEST_SLUGS) });
      console.log(`Baseline set from ${b.acceptedFrom}: ${Object.keys(b.rows).length} request rows.`);
    } else if (cmd === 'compare') {
      const runDir = path.resolve(positional[0] ?? fail('Missing run folder.'));
      const slugs = REQUEST_SLUGS.filter(s => fs.existsSync(resultFile(runDir, s)));
      const c = compareRun({
        runDir, rerunDir: opts.rerun && path.resolve(opts.rerun), schemas: await schemasFor(slugs),
        proposals: opts.proposals ? readJson(path.resolve(opts.proposals)) : {},
      });
      process.stdout.write(fs.readFileSync(path.join(runDir, 'comparison.md'), 'utf8'));
      console.log(c.rows.map(r => `${r.slug}: ${r.status}`).join('\n'));
    } else if (cmd === 'reset') {
      const [runArg, slug] = positional;
      if (!runArg || !slug) fail('Missing run folder or slug.');
      resetRow({ runDir: path.resolve(runArg), slug, schemas: await schemasFor([slug]), note: opts.note });
      console.log(`Baseline row reset: ${slug}.`);
    } else fail(`Unknown command "${cmd ?? ''}".`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
