// Companion Dataset end to end (#32): the shared-dimension check at intake, the lint rules (footer names both
// datasets, no values combined), the dry-run covering both datasets, and one passing Page with `compctx`.
// Lint and fake-API tests are offline; the dry-run, shared-dimension and instance tests hit live data.gr.ch
// (set HUWISE_APIKEY for a higher limit) and the instance test renders in a real browser like patterns.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sharedDimensions } from '../intake.mjs';

const here = import.meta.dirname;
const CLI = path.join(here, '..', 'verify.mjs');
const INTAKE = path.join(here, '..', 'intake.mjs');
const REFERENCES = path.join(here, '..', '..', 'references');
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const INSTANCE = path.join(REFERENCES, 'patterns', 'instances', 'companion-dataset');

const LINT_ARGS = ['--target-height', '800', '--embed-size', 'gross', '--no-dry-run', '--skip-render'];
const DRY_RUN_ARGS = ['--target-height', '800', '--embed-size', 'gross', '--skip-render'];
function run(source, extraArgs = LINT_ARGS, env = process.env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-companion-'));
  fs.cpSync(path.isAbsolute(source) ? source : path.join(here, 'fixtures', source), dir, { recursive: true });
  const r = spawnSync('node', [CLI, dir, ...extraArgs], { encoding: 'utf8', env });
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'verifier-output', 'report.json'), 'utf8'));
  return { ...r, dir, report };
}
const summary = report => report.findings.map(f => [f.rule, f.severity, f.location.file, f.location.line]);

// ---------- intake: the shared dimension ----------
const fakeSummary = datasets => async id => ({ fields: datasets[id] });
const fakeFacets = values => async (id, field) => values[`${id}:${field}`].map(value => ({ value, count: 1 }));

test('a shared Gemeinde key is found by name, with a text key matching an integer key as strings', async () => {
  const r = await sharedDimensions('main', 'comp', [], {
    summary: fakeSummary({
      main: [{ name: 'bfs_nummer', label: 'Gemeindenummer', type: 'text' }, { name: 'jahr', label: 'Jahr', type: 'date' }],
      comp: [{ name: 'gemeindenummer', label: 'Gemeindenummer', type: 'int' }, { name: 'jahr', label: 'Jahr', type: 'text' }],
    }),
    facets: fakeFacets({ 'main:bfs_nummer': ['3851', '3901', '3945'], 'comp:gemeindenummer': [3851, 3901] }),
  });
  assert.deepEqual(r.dimensions.map(d => [d.main, d.companion, d.shared]), [['bfs_nummer', 'gemeindenummer', 2]]);
  assert.match(r.verdict, /^Shared dimension: bfs_nummer = gemeindenummer \(2 common values\)/);
});

test('date fields are not matched automatically, a named pair is checked', async () => {
  const deps = {
    summary: fakeSummary({
      main: [{ name: 'name', label: 'Gemeindename', type: 'text' }],
      comp: [{ name: 'gemeinde_name', label: 'Gemeinde Name', type: 'text' }],
    }),
    facets: fakeFacets({ 'main:name': ['Chur', 'Davos'], 'comp:gemeinde_name': ['Davos', 'Arosa'] }),
  };
  assert.equal((await sharedDimensions('main', 'comp', [], deps)).dimensions.length, 0);
  const named = await sharedDimensions('main', 'comp', [['name', 'gemeinde_name']], deps);
  assert.deepEqual(named.dimensions.map(d => [d.shared, d.onlyInMain, d.onlyInCompanion]), [[1, 1, 1]]);
});

test('no shared dimension: the verdict says to propose no shared filter', async () => {
  const r = await sharedDimensions('main', 'comp', [['region', 'gemeinde']], {
    summary: fakeSummary({ main: [{ name: 'region', label: 'Region', type: 'text' }], comp: [{ name: 'gemeinde', label: 'Gemeinde', type: 'text' }] }),
    facets: fakeFacets({ 'main:region': ['Albula'], 'comp:gemeinde': ['Chur'] }),
  });
  assert.deepEqual(r.dimensions, []);
  assert.equal(r.checked.length, 1);
  assert.match(r.verdict, /No shared dimension: propose no shared filter/);
});

test('a pair naming an unknown field is refused', async () => {
  await assert.rejects(sharedDimensions('main', 'comp', [['x', 'y']], {
    summary: fakeSummary({ main: [{ name: 'a', label: 'A', type: 'text' }], comp: [{ name: 'b', label: 'B', type: 'text' }] }),
    facets: fakeFacets({}),
  }), /Unknown field in pair x=y/);
});

function intakeShared(...args) {
  const r = spawnSync('node', [INTAKE, 'shared', ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('live: Zweitwohnungsanteil and Beherbergung share the BFS number and the Gemeinde name', () => {
  const r = intakeShared('dvs_awt_soci_20260112', 'dvs_awt_econ_20250203', 'name=gemeinde_name');
  const dims = Object.fromEntries(r.dimensions.map(d => [`${d.main}=${d.companion}`, d]));
  assert.equal(dims['bfs_nummer=gemeindenummer'].shared, 40);
  assert.equal(dims['bfs_nummer=gemeindenummer'].onlyInCompanion, 0);
  assert.equal(dims['name=gemeinde_name'].shared, 40);
});

test('live: Bauzonen (Regionen) and Beherbergung (Gemeinden) share no dimension', () => {
  const r = intakeShared('dvs_are_soci_20250224', 'dvs_awt_econ_20250203', 'region=gemeinde_name');
  assert.deepEqual(r.dimensions, []);
  assert.equal(r.checked.length, 1);
  assert.match(r.verdict, /No shared dimension/);
});

// ---------- lint ----------
test('the footer must name the Companion Dataset as well as the main dataset', () => {
  const r = run('companion-footer-one-link');
  assert.equal(r.status, 1);
  assert.deepEqual(summary(r.report), [['companion-footer', 'error', 'index.html', 2]]);
  assert.match(r.report.findings[0].message, /Companion Dataset "dvs_awt_econ_20250203" \(compctx\)/);
});

test('a ratio of values from the two datasets is an error, side by side is not', () => {
  const r = run('companion-mixed-values');
  assert.equal(r.status, 1);
  assert.deepEqual(summary(r.report), [['companion-mixed-values', 'error', 'index.html', 4]]);
  assert.match(r.report.findings[0].message, /datactx and compctx|compctx and datactx/);
});

test('a Page without compctx is not subject to the Companion rules', () => {
  const r = run('allowed-footer-only');
  assert.equal(r.status, 0);
  assert.deepEqual(r.report.findings, []);
});

test('the Companion instance passes lint: one-way copies, both footer links, no mixed value', () => {
  const r = run(INSTANCE);
  assert.equal(r.report.stages.lint.status, 'pass', JSON.stringify(r.report.findings));
});

// ---------- dry-run: both datasets ----------
test('the dry-run checks fields and colour maps in both datasets and reports both', () => {
  const r = run('companion-dryrun-clean', DRY_RUN_ARGS);
  assert.deepEqual(r.report.findings, []);
  assert.equal(r.status, 0);
  assert.deepEqual(r.report.stages.dryRun.datasets,
    [{ context: 'datactx', dataset: 'dvs_awt_soci_20260112' }, { context: 'compctx', dataset: 'dvs_awt_econ_20250203' }]);
  assert.equal(r.report.apiRequests, 4);   // 2 dataset fields + 2 colour maps
  assert.match(read(r.dir, 'verifier-output', 'report.md'), /Dry-run datasets: datactx dvs_awt_soci_20260112, compctx dvs_awt_econ_20250203/);
});

test('a field of the main dataset used on compctx is a missing field of the Companion Dataset', () => {
  const r = run('companion-dryrun-missing-field', DRY_RUN_ARGS);
  assert.equal(r.status, 1);
  assert.deepEqual(summary(r.report), [['dry-run-missing-field', 'error', 'index.html', 3]]);
  assert.match(r.report.findings[0].message, /"name".*dvs_awt_econ_20250203.*compctx/);
});

test('a colour map on compctx is checked against the Companion Dataset\'s own values', () => {
  const r = run('companion-dryrun-colour-map-missing-key', DRY_RUN_ARGS);
  assert.equal(r.status, 1);
  assert.deepEqual(summary(r.report), [['dry-run-colour-map-mismatch', 'error', 'index.html', 3]]);
  assert.match(r.report.findings[0].message, /Missing from the map: 12\./);
});

// ---------- the end-to-end Page ----------
test('the Companion instance has compctx, its own Visualizations, one copy per shared filter and a footer naming both datasets', () => {
  const html = read(INSTANCE, 'index.html');
  assert.match(html, /compctx-dataset="dvs_awt_econ_20250203"/);
  assert.match(html, /datactx-dataset="dvs_awt_soci_20260112"/);
  assert.ok(html.includes('<ods-chart-query context="compctx"'), 'a chart of its own on compctx');
  assert.ok(html.includes(`compctx.parameters['refine.gemeinde_name'] = datactx.parameters['refine.name']`), 'one-way copy to compctx, renamed');
  assert.ok(!/datactx\.parameters\[[^\]]*\]\s*=\s*compctx/.test(html), 'no copy back');
  const footer = html.slice(html.indexOf('class="hw-footer"'));
  assert.ok(footer.includes('dvs_awt_soci_20260112') && footer.includes('dvs_awt_econ_20250203'));
  assert.ok(!/\b(19|20)\d{2}\b/.test(html.replace(/dvs_[a-z_]+\d+/g, '')), 'a year literal');
  assert.ok(read(INSTANCE, 'stylesheet.css').startsWith(read(REFERENCES, 'base-stylesheet.css')));
});

test('end to end: the Companion instance passes the verifier at 375, 720 and 1200px and reaches the empty state', () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-cache-'));
  const r = run(INSTANCE, ['--target-height', '800', '--embed-size', 'gross'], { ...process.env, VERIFIER_CACHE_DIR: cacheDir });
  assert.equal(r.status, 0, r.stdout + r.stderr + JSON.stringify(r.report.findings));
  assert.ok(r.report.findings.every(f => f.severity === 'warning'));
  assert.deepEqual(r.report.stages.render.screenshots.map(s => s.width), [375, 720, 1200]);
  assert.equal(r.report.stages.dryRun.status, 'pass');
  assert.ok(r.report.stages.dryRun.datasets.some(d => d.context === 'compctx' && d.dataset === 'dvs_awt_econ_20250203'));
  // a Gemeinde without Beherbergung data shows "Keine Daten", not an empty chart (reported as the guarded variable)
  assert.ok(r.report.findings.some(f => f.rule === 'widget-variable-guarded' && /treffer/.test(f.message)));
});

// ---------- the references ----------
test('companion-dataset.md covers intake, sketch and plan list, build, footer and verify', () => {
  const doc = read(REFERENCES, 'companion-dataset.md');
  for (const needle of ['shared dimension', 'intake.mjs shared', 'No shared filter', 'compctx', 'Pattern 4', 'side by side', 'combined across datasets',
    'both datasets', 'dry-run', 'first tab', 'patterns/instances/companion-dataset'])
    assert.ok(doc.toLowerCase().includes(needle.toLowerCase()), `companion-dataset.md lacks: ${needle}`);
});

test('SKILL.md, intake.md, page-sketch.md and build-verify-handoff.md point to the Companion procedure', () => {
  for (const file of ['SKILL.md', 'references/intake.md', 'references/page-sketch.md', 'references/build-verify-handoff.md'])
    assert.ok(read(here, '..', '..', file).includes('companion-dataset.md'), `${file} does not mention companion-dataset.md`);
});
