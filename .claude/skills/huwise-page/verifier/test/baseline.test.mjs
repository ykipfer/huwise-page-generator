// Ticket #35: Baseline and regression detection. Offline: accept, compare, re-run, dataset changed, reset.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { REQUEST_SLUGS, parseRequest, initRun, recordResult, confirmScores } from '../benchmark.mjs';
import { acceptBaseline, compareRun, resetRow, fetchSchemas } from '../baseline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..', '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hw-base-'));
const score = (a, b, c) => ({
  fidelity: { score: a, reason: 'r1' }, ciLayout: { score: b, reason: 'r2' }, sketchFidelity: { score: c, reason: 'r3' },
});

// Current schema of every dataset any request names: one text field and one integer field each.
const datasetIds = slugs => [...new Set(slugs.flatMap(s => parseRequest(path.join(SKILL, 'benchmark', 'requests', `${s}.md`)).datasets))];
const schemasFor = (slugs = REQUEST_SLUGS) => Object.fromEntries(datasetIds(slugs).map(id => [id, [{ name: 'name', type: 'text' }, { name: 'jahr', type: 'int' }]]));

/** Run folder with the given slugs recorded (and confirmed unless said otherwise). `spec[slug]` = { scores, iterations, errors, warnings }. */
function makeRun(spec, { confirm = true, runsDir = tmp(), date = '2026-10-24' } = {}) {
  const slugs = Object.keys(spec);
  const { runDir, pages } = initRun({ slugs, runsDir, date });
  pages.forEach((dir, i) => {
    const { scores = score(2, 2, 2), iterations = 1, errors = 0, warnings = 1 } = spec[slugs[i]];
    fs.mkdirSync(path.join(dir, 'verifier-output'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'sketch'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'sketch', 'index.html'), '<div></div>');
    fs.writeFileSync(path.join(dir, 'verifier-output', 'report.json'), JSON.stringify({
      findings: [...Array(errors).fill({ severity: 'error' }), ...Array(warnings).fill({ severity: 'warning' })],
    }));
    recordResult({ pageDir: dir, iterations, flags: [], scores });
  });
  if (confirm) confirmScores({ runDir, overrides: [] });
  return runDir;
}
const fullSpec = (over = {}) => Object.fromEntries(REQUEST_SLUGS.map(s => [s, over[s] ?? {}]));
const baselineIn = dir => path.join(dir, 'baseline.json');
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));

function acceptedBaseline(over = {}) {
  const dir = tmp();
  acceptBaseline({ runDir: makeRun(fullSpec(over)), schemas: schemasFor(), baselineFile: baselineIn(dir) });
  return baselineIn(dir);
}

test('a confirmed full run becomes the Baseline: one row per request', () => {
  const dir = tmp();
  const runDir = makeRun(fullSpec({ 'zweitwohnungsanteil': { scores: score(2, 1, 1), iterations: 2, warnings: 3 } }));
  acceptBaseline({ runDir, schemas: schemasFor(), baselineFile: baselineIn(dir), date: '2026-10-24' });
  const baseline = readJson(baselineIn(dir));
  assert.deepEqual(Object.keys(baseline.rows).sort(), [...REQUEST_SLUGS].sort());
  assert.equal(baseline.acceptedFrom, path.basename(runDir));
  const row = baseline.rows.zweitwohnungsanteil;
  assert.equal(row.pass, true);
  assert.equal(row.iterations, 2);
  assert.equal(row.warnings, 3);
  assert.deepEqual(row.scores, { fidelity: 2, ciLayout: 1, sketchFidelity: 1 });
  assert.equal(row.total, 4);
  assert.deepEqual(Object.keys(row.datasets).sort(), ['dvs_awt_econ_20250203', 'dvs_awt_soci_20260112']);
});

test('a partial or unconfirmed run can never become the Baseline', () => {
  const dir = tmp();
  const subset = makeRun({ zweitwohnungsanteil: {} });
  assert.throws(() => acceptBaseline({ runDir: subset, schemas: schemasFor(), baselineFile: baselineIn(dir) }), /full run/i);
  const unconfirmed = makeRun(fullSpec(), { confirm: false });
  assert.throws(() => acceptBaseline({ runDir: unconfirmed, schemas: schemasFor(), baselineFile: baselineIn(dir) }), /confirm/i);
  assert.equal(fs.existsSync(baselineIn(dir)), false);
});

test('accepting needs a schema snapshot for every dataset', () => {
  const schemas = schemasFor();
  delete schemas.dvs_awt_econ_20250203;
  assert.throws(() => acceptBaseline({ runDir: makeRun(fullSpec()), schemas, baselineFile: baselineIn(tmp()) }), /dvs_awt_econ_20250203/);
});

test('a subset run is compared with the Baseline but never replaces it', () => {
  const file = acceptedBaseline();
  const before = fs.readFileSync(file, 'utf8');
  const runDir = makeRun({ zweitwohnungsanteil: { scores: score(2, 2, 2) } });
  const c = compareRun({ runDir, baselineFile: file, schemas: schemasFor() });
  assert.deepEqual(c.rows.map(r => r.slug), ['zweitwohnungsanteil']);
  assert.equal(c.rows[0].status, 'ok');
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('worse = pass to fail, a lower rubric total or more iterations; the first worse result asks for exactly one re-run', () => {
  const file = acceptedBaseline();
  const cases = {
    'zweitwohnungsanteil': { scores: score(0, 2, 2) },                  // pass -> fail
    'beherbergung-gemeinden': { scores: score(2, 2, 1) },               // rubric 6 -> 5
    'arbeitsmarkt-seit-1993': { iterations: 2 },                        // 1 -> 2 iterations
    'tourismus-herkunftslaender': {},                                   // unchanged
    'finanzkennzahlen-gemeinden': { scores: score(2, 2, 2), iterations: 1, warnings: 9 }, // warnings only: not worse
  };
  const c = compareRun({ runDir: makeRun(cases), baselineFile: file, schemas: schemasFor() });
  const status = Object.fromEntries(c.rows.map(r => [r.slug, r.status]));
  assert.deepEqual(status, {
    'zweitwohnungsanteil': 'needs-rerun', 'beherbergung-gemeinden': 'needs-rerun', 'arbeitsmarkt-seit-1993': 'needs-rerun',
    'tourismus-herkunftslaender': 'ok', 'finanzkennzahlen-gemeinden': 'ok',
  });
  assert.match(c.rows.find(r => r.slug === 'zweitwohnungsanteil').worse.join(';'), /pass to fail/);
  assert.match(c.rows.find(r => r.slug === 'arbeitsmarkt-seit-1993').worse.join(';'), /iterations/);
});

test('worse again on the re-run is a regression; both runs are recorded', () => {
  const file = acceptedBaseline();
  const first = makeRun({ zweitwohnungsanteil: { scores: score(0, 2, 2) } });
  const rerun = makeRun({ zweitwohnungsanteil: { scores: score(1, 1, 1), iterations: 3 } });
  const c = compareRun({ runDir: first, rerunDir: rerun, baselineFile: file, schemas: schemasFor() });
  const row = c.rows[0];
  assert.equal(row.status, 'regression');
  assert.equal(row.first.pass, false);
  assert.equal(row.rerun.total, 3);
  const saved = readJson(path.join(first, 'comparison.json'));
  assert.equal(saved.rows[0].first.total, 4);
  assert.equal(saved.rows[0].rerun.iterations, 3);
  assert.match(fs.readFileSync(path.join(first, 'comparison.md'), 'utf8'), /regression/i);
});

test('a re-run that is not worse is not a regression', () => {
  const file = acceptedBaseline();
  const first = makeRun({ zweitwohnungsanteil: { scores: score(0, 2, 2) } });
  const rerun = makeRun({ zweitwohnungsanteil: {} });
  const row = compareRun({ runDir: first, rerunDir: rerun, baselineFile: file, schemas: schemasFor() }).rows[0];
  assert.equal(row.status, 'not-reproduced');
  assert.equal(row.rerun.pass, true, 'both runs are still recorded');
});

test('only one re-run per request', () => {
  const file = acceptedBaseline();
  const first = makeRun({ zweitwohnungsanteil: { scores: score(0, 2, 2) } });
  compareRun({ runDir: first, rerunDir: makeRun({ zweitwohnungsanteil: {} }), baselineFile: file, schemas: schemasFor() });
  const second = makeRun({ zweitwohnungsanteil: { scores: score(0, 2, 2) } });
  assert.throws(() => compareRun({ runDir: first, rerunDir: second, baselineFile: file, schemas: schemasFor() }), /already re-run/i);
});

test('a re-run of a request that was not worse is refused', () => {
  const file = acceptedBaseline();
  const first = makeRun({ zweitwohnungsanteil: {} });
  const rerun = makeRun({ zweitwohnungsanteil: {} });
  assert.throws(() => compareRun({ runDir: first, rerunDir: rerun, baselineFile: file, schemas: schemasFor() }), /not worse/i);
});

test('a changed dataset is reported as dataset changed, not as a regression, with a proposed replacement', () => {
  const file = acceptedBaseline();
  const schemas = schemasFor();
  schemas.dvs_awt_soci_20260112 = [{ name: 'name', type: 'text' }, { name: 'jahr', type: 'text' }];   // type change
  schemas.dvs_awt_econ_20250203 = null;                                                            // removed
  const proposals = { zweitwohnungsanteil: { dataset: 'dvs_awt_soci_20270101', note: 'Nachfolger-Datensatz' } };
  const runDir = makeRun({ zweitwohnungsanteil: { scores: score(0, 0, 0) }, 'arbeitsmarkt-seit-1993': {} });
  const c = compareRun({ runDir, baselineFile: file, schemas, proposals });
  const row = c.rows.find(r => r.slug === 'zweitwohnungsanteil');
  assert.equal(row.status, 'dataset-changed');
  assert.match(row.changes.join(';'), /dvs_awt_soci_20260112.*jahr/);
  assert.match(row.changes.join(';'), /dvs_awt_econ_20250203.*removed/);
  assert.deepEqual(row.proposal, proposals.zweitwohnungsanteil);
  assert.equal(c.rows.find(r => r.slug === 'arbeitsmarkt-seit-1993').status, 'ok');
  assert.match(fs.readFileSync(path.join(runDir, 'comparison.md'), 'utf8'), /dataset changed/i);
});

test('an added field is not a dataset change; a request now naming other datasets is', () => {
  const file = acceptedBaseline();
  const schemas = schemasFor();
  schemas.dvs_awt_soci_20260112.push({ name: 'neu', type: 'text' });
  const runDir = makeRun({ zweitwohnungsanteil: {} });
  assert.equal(compareRun({ runDir, baselineFile: file, schemas }).rows[0].status, 'ok');
  const baseline = readJson(file);
  baseline.rows.zweitwohnungsanteil.datasets = { dvs_old_renamed: [{ name: 'name', type: 'text' }] };
  fs.writeFileSync(file, JSON.stringify(baseline));
  const renamed = compareRun({ runDir, baselineFile: file, schemas }).rows[0];
  assert.equal(renamed.status, 'dataset-changed');
  assert.match(renamed.changes.join(';'), /dvs_old_renamed/);
});

test('accepting a replacement resets that row with a note and leaves the others', () => {
  const file = acceptedBaseline();
  const before = readJson(file);
  const schemas = schemasFor();
  schemas.dvs_awt_soci_20260112 = [{ name: 'name', type: 'text' }];
  const runDir = makeRun({ zweitwohnungsanteil: { scores: score(1, 1, 1), iterations: 2 } });
  assert.throws(() => resetRow({ runDir, slug: 'zweitwohnungsanteil', baselineFile: file, schemas, note: '' }), /note/i);
  resetRow({ runDir, slug: 'zweitwohnungsanteil', baselineFile: file, schemas, note: 'Dataset replaced 2026-10-24: Schema geändert' });
  const after = readJson(file);
  const row = after.rows.zweitwohnungsanteil;
  assert.equal(row.note, 'Dataset replaced 2026-10-24: Schema geändert');
  assert.equal(row.iterations, 2);
  assert.equal(row.total, 3);
  assert.deepEqual(row.datasets.dvs_awt_soci_20260112, [{ name: 'name', type: 'text' }]);
  assert.deepEqual(after.rows['beherbergung-gemeinden'], before.rows['beherbergung-gemeinden']);
  assert.equal(compareRun({ runDir, baselineFile: file, schemas }).rows[0].status, 'ok', 'no longer a dataset change');
});

test('resetRow needs a confirmed result for the request', () => {
  const file = acceptedBaseline();
  const runDir = makeRun({ zweitwohnungsanteil: {} }, { confirm: false });
  assert.throws(() => resetRow({ runDir, slug: 'zweitwohnungsanteil', baselineFile: file, schemas: schemasFor(), note: 'x' }), /confirm/i);
});

test('fetchSchemas reads fields from the catalogue; a missing dataset is null', async () => {
  const urls = [];
  const fetchJson = async url => {
    urls.push(url);
    return url.includes('gone')
      ? { status: 404, body: null }
      : { status: 200, body: { fields: [{ name: 'a', type: 'text', label: 'x' }, { name: 'b', type: 'int' }] } };
  };
  const s = await fetchSchemas(['present', 'gone'], { fetchJson });
  assert.deepEqual(s, { present: [{ name: 'a', type: 'text' }, { name: 'b', type: 'int' }], gone: null });
  assert.ok(urls[0].includes('/catalog/datasets/present'));
});

test('CLI: accept, compare with a re-run, and reset run offline', () => {
  const dir = tmp();
  const cli = (...a) => execFileSync('node', [path.join(HERE, '..', 'baseline.mjs'), ...a], { encoding: 'utf8', env: { ...process.env, HW_BASELINE_FILE: baselineIn(dir) }, stdio: ['ignore', 'pipe', 'pipe'] });
  const schemasFile = path.join(dir, 'schemas.json');
  fs.writeFileSync(schemasFile, JSON.stringify(schemasFor()));
  assert.match(cli('accept', makeRun(fullSpec()), '--schemas', schemasFile), /6 request/);
  const first = makeRun({ zweitwohnungsanteil: { scores: score(0, 2, 2) } });
  assert.match(cli('compare', first, '--schemas', schemasFile), /needs-rerun/);
  const rerun = makeRun({ zweitwohnungsanteil: { scores: score(0, 2, 2) } });
  assert.match(cli('compare', first, '--rerun', rerun, '--schemas', schemasFile), /regression/);
  assert.match(cli('reset', first, 'zweitwohnungsanteil', '--note', 'Dataset ersetzt', '--schemas', schemasFile), /zweitwohnungsanteil/);
  assert.equal(readJson(baselineIn(dir)).rows.zweitwohnungsanteil.note, 'Dataset ersetzt');
});

test('documentation: the benchmark reference describes the Baseline workflow and the file is tracked', () => {
  const ref = fs.readFileSync(path.join(SKILL, 'references', 'benchmark-mode.md'), 'utf8').toLowerCase();
  for (const needle of ['baseline.mjs', 'baseline.json', 'regression', 'dataset changed', 're-run', 'owner confirms', 'subset'])
    assert.ok(ref.includes(needle), needle);
});
