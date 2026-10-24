import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withApiKey } from '../apikey.mjs';

const here = import.meta.dirname;
const CLI = path.join(here, '..', 'verify.mjs');

// Copy a fixture into a temp dir so runs never write into the repo.
// Lint tests stay offline (--no-dry-run, --skip-render; the render stage has its own tests in render.test.mjs); dry-run tests pass DRY_RUN_ARGS and hit live data.gr.ch.
const LINT_ARGS = ['--target-height', '800', '--embed-size', 'gross', '--no-dry-run', '--skip-render'];
const DRY_RUN_ARGS = ['--target-height', '800', '--embed-size', 'gross', '--skip-render'];
function run(fixture, extraArgs = LINT_ARGS) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-'));
  fs.cpSync(path.join(here, 'fixtures', fixture), dir, { recursive: true });
  const r = spawnSync('node', [CLI, dir, ...extraArgs], { encoding: 'utf8' });
  const jsonPath = path.join(dir, 'verifier-output', 'report.json');
  const report = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : null;
  return { ...r, dir, report };
}

const summary = report => report.findings.map(f => [f.rule, f.severity, f.location.file, f.location.line]);

test('clean Page passes with exit 0 and writes JSON and Markdown reports', () => {
  const r = run('clean');
  assert.equal(r.status, 0);
  assert.deepEqual(r.report.findings, []);
  assert.equal(r.report.targetHeight, 800);
  assert.equal(r.report.embedSize, 'Gross');
  assert.ok(fs.existsSync(path.join(r.dir, 'verifier-output', 'report.md')));
});

const refused = [
  ['refused-style', 'refused-style', 'index.html', 2],
  ['refused-script', 'refused-script', 'index.html', 2],
  ['refused-form', 'refused-form', 'index.html', 2],
  ['refused-object', 'refused-object', 'index.html', 2],
  ['refused-iframe', 'refused-iframe', 'index.html', 2],
  ['refused-onclick', 'refused-on-attribute', 'index.html', 2],
  ['refused-javascript-url', 'refused-javascript-url', 'index.html', 2],
  ['refused-css-import', 'refused-css-import', 'stylesheet.css', 2],
  ['refused-css-import-in-comment', 'refused-css-import', 'stylesheet.css', 2],
];
for (const [fixture, rule, file, line] of refused) {
  test(`${fixture}: exactly one ${rule} error at ${file}:${line}, exit 1`, () => {
    const r = run(fixture);
    assert.equal(r.status, 1);
    assert.deepEqual(summary(r.report), [[rule, 'error', file, line]]);
  });
}

test('refused tags only inside an HTML comment pass', () => {
  const r = run('allowed-tags-in-html-comment');
  assert.equal(r.status, 0);
  assert.deepEqual(r.report.findings, []);
});

test('on-change on an ods-* Widget passes', () => {
  const r = run('allowed-on-change-on-widget');
  assert.equal(r.status, 0);
  assert.deepEqual(r.report.findings, []);
});

test('on-change on a plain <div> fails', () => {
  const r = run('refused-on-change-on-div');
  assert.equal(r.status, 1);
  assert.deepEqual(summary(r.report), [['refused-on-attribute', 'error', 'index.html', 2]]);
});

test('bad usage exits 2', () => {
  assert.equal(run('clean', ['--target-height', 'abc', '--embed-size', 'gross']).status, 2);
  assert.equal(run('clean', ['--target-height', '800', '--embed-size', 'huge']).status, 2);
});

test('the verifier-output folder is gitignored', () => {
  const r = spawnSync('git', ['check-ignore', '-q', 'some-page/verifier-output/report.json'], { cwd: here });
  assert.equal(r.status, 0);
});

test('a Page folder without stylesheet.css passes with exit 0', () => {
  const r = run('allowed-no-stylesheet');
  assert.equal(r.status, 0);
  assert.deepEqual(r.report.findings, []);
});

// Lint rules from the skill references (closed Widget list, banned habits, side effects): one seeded fault each.
const lintErrors = [
  ['unlisted-widget-element', 'unlisted-widget', 'index.html', 2],
  ['unlisted-widget-attribute', 'unlisted-widget', 'index.html', 2],
  ['unlisted-widget-data-prefix', 'unlisted-widget', 'index.html', 2],
  ['map-without-scroll-wheel-zoom', 'required-widget-attribute', 'index.html', 2],
  ['map-scroll-wheel-zoom-true', 'required-widget-attribute', 'index.html', 2],
  ['banned-ods-tabs', 'banned-ods-tabs', 'index.html', 2],
  ['banned-native-join', 'banned-native-join', 'index.html', 2],
  ['banned-domain-attribute', 'banned-domain-attribute', 'index.html', 2],
  ['banned-auto-resize', 'banned-auto-resize', 'index.html', 2],
  ['banned-ods-auto-resize', 'banned-auto-resize', 'index.html', 2],
  ['banned-range-custom', 'banned-range-custom', 'index.html', 2],
  ['banned-ods-box', 'banned-ods-box', 'index.html', 2],
  ['banned-svelte-class', 'banned-svelte-class', 'index.html', 2],
  ['banned-bootstrap-grid', 'banned-bootstrap-grid', 'index.html', 2],
  ['banned-root-shared', 'banned-root-shared', 'index.html', 2],
  ['banned-current-language', 'banned-current-language', 'index.html', 2],
  ['banned-ods-box-css', 'banned-ods-box', 'stylesheet.css', 2],
  ['banned-svelte-class-css', 'banned-svelte-class', 'stylesheet.css', 2],
  ['banned-viewport-height', 'banned-viewport-height', 'stylesheet.css', 2],
  ['banned-viewport-height-inline', 'banned-viewport-height', 'index.html', 2],
  ['banned-q-filter', 'banned-q-filter', 'index.html', 2],
  ['banned-hard-coded-year', 'banned-hard-coded-year', 'index.html', 2],
  ['banned-hard-coded-year-where', 'banned-hard-coded-year', 'index.html', 2],
  ['banned-hard-coded-year-expression', 'banned-hard-coded-year', 'index.html', 2],
  ['banned-hard-coded-year-unquoted-ng-if', 'banned-hard-coded-year', 'index.html', 2],
  ['banned-hard-coded-year-array', 'banned-hard-coded-year', 'index.html', 2],
  ['banned-hard-coded-year-interpolation', 'banned-hard-coded-year', 'index.html', 2],
  ['banned-kpi-tiles-over-four', 'kpi-tile-cap', 'index.html', 2],
  ['banned-results-repeat-without-max', 'banned-results-repeat-without-max', 'index.html', 2],
  ['banned-results-repeat-without-max-same-element', 'banned-results-repeat-without-max', 'index.html', 2],
  ['banned-results-repeat-without-max-default-variable', 'banned-results-repeat-without-max', 'index.html', 2],
  ['banned-bootstrap-grid-css', 'banned-bootstrap-grid', 'stylesheet.css', 2],
  ['banned-hand-built-tabs', 'banned-hand-built-tabs', 'index.html', 2],
  ['side-effect-scope-variable', 'side-effect', 'index.html', 2],
  ['side-effect-not-hidden', 'side-effect', 'index.html', 2],
  ['side-effect-conditional', 'side-effect', 'index.html', 2],
  ['side-effect-in-attribute', 'side-effect', 'index.html', 2],
  ['side-effect-two-way-copy', 'side-effect', 'index.html', 3],
  ['side-effect-two-sources', 'side-effect', 'index.html', 3],
  ['side-effect-length-guard-other-parameter', 'side-effect', 'index.html', 2],
];
for (const [fixture, rule, file, line] of lintErrors) {
  test(`${fixture}: exactly one ${rule} error at ${file}:${line}, exit 1`, () => {
    const r = run(fixture);
    assert.equal(r.status, 1);
    assert.deepEqual(summary(r.report), [[rule, 'error', file, line]]);
  });
}

// Allowed constructs that the lint rules above must not report.
const allowed = [
  ['allowed-listed-widgets', 'every Widget on the closed list, in element and attribute form, passes'],
  ['allowed-class-lookalikes', 'classes that only contain a banned class name pass'],
  ['allowed-banned-names-in-css-comment', 'banned names inside a CSS comment pass'],
  ['allowed-year-like-numbers', 'year-like numbers in prose, limits and dataset IDs pass'],
  ['allowed-year-in-display-text', 'years in display text (dates, prose comparisons, quoted years, title attributes) pass'],
  ['allowed-kpi-tiles-four', 'four KPI tiles pass'],
  ['allowed-on-change-on-attribute-widget', 'on-change on an attribute-form Widget (a <div> carrying ods-results) passes'],
  ['allowed-ng-click-toggle', 'a single ng-click toggle is not a hand-built tab bar and passes'],
  ['allowed-side-effect-guarded-default', 'the guarded default side-effect form passes'],
  ['allowed-side-effect-guarded-default-length', 'the guarded default with a .length emptiness test passes'],
  ['allowed-side-effect-one-way-copy', 'the one-way copy side-effect form passes'],
];
for (const [fixture, description] of allowed) {
  test(`${fixture}: ${description}`, () => {
    const r = run(fixture);
    assert.equal(r.status, 0);
    assert.deepEqual(r.report.findings, []);
  });
}

// Attributes missing from the Widget family files are warnings: they never fail a Page.
const warnings = [
  ['warning-undocumented-element-attribute', 'unit on ods-gauge', 2],
  ['warning-undocumented-attribute-widget-parameter', 'ods-results-offset next to ods-results', 3],
];
for (const [fixture, what, line] of warnings) {
  test(`${fixture}: ${what} is one warning at index.html:${line}, exit 0`, () => {
    const r = run(fixture);
    assert.equal(r.status, 0);
    assert.deepEqual(summary(r.report), [['undocumented-widget-attribute', 'warning', 'index.html', line]]);
  });
}

test('allowed-documented-and-global-attributes: documented, global and AngularJS attributes produce no warning', () => {
  const r = run('allowed-documented-and-global-attributes');
  assert.equal(r.status, 0);
  assert.deepEqual(r.report.findings, []);
});

// Dry-run stage: runs against live data.gr.ch (anonymous budget 5000/day, about 1 request per dataset,
// literal query or colour map) on a stable dataset, with no hard-coded years.
const dryRunErrors = [
  ['dryrun-missing-field', 'dry-run-missing-field', 2, 'gibt_es_nicht'],
  ['dryrun-record-fields-missing', 'dry-run-missing-field', 2, 'gemeinde_nam'],
  ['dryrun-empty-query', 'dry-run-empty-query', 2, 'betriebe < 0'],
  ['dryrun-colour-map-extra-key', 'dry-run-colour-map-mismatch', 2, 'X'],
];
for (const [fixture, rule, line, mention] of dryRunErrors) {
  test(`${fixture}: exactly one ${rule} error at index.html:${line} naming "${mention}", exit 1`, () => {
    const r = run(fixture, DRY_RUN_ARGS);
    assert.equal(r.status, 1);
    assert.deepEqual(summary(r.report), [[rule, 'error', 'index.html', line]]);
    assert.ok(r.report.findings[0].message.includes(mention), r.report.findings[0].message);
  });
}

test('a colour map missing a real facet value lists the missing key', () => {
  const r = run('dryrun-colour-map-extra-key', DRY_RUN_ARGS);
  assert.match(r.report.findings[0].message, /missing[^.]*\bP\b/i);
});

test('a colour map that exactly matches the facet values passes and the report counts 2 API requests', () => {
  const r = run('dryrun-colour-map-matches', DRY_RUN_ARGS);
  assert.equal(r.status, 0);
  assert.deepEqual(r.report.findings, []);
  assert.equal(r.report.stages.dryRun.status, 'pass');
  assert.equal(r.report.apiRequests, 2);
  assert.match(fs.readFileSync(path.join(r.dir, 'verifier-output', 'report.md'), 'utf8'), /API requests: 2/);
});

test('a colour map is checked against the values left by the context\'s literal default filters', () => {
  const r = run('dryrun-colour-map-filtered', DRY_RUN_ARGS);
  assert.deepEqual(r.report.findings, []);
  assert.equal(r.status, 0);
});

test('a colour map key that the context\'s literal filter excludes is reported as not in the data', () => {
  const r = run('dryrun-colour-map-filtered-extra-key', DRY_RUN_ARGS);
  assert.equal(r.status, 1);
  assert.deepEqual(summary(r.report).map(f => f[0]), ['dry-run-colour-map-mismatch']);
  assert.match(r.report.findings[0].message, /Not in the data: Italien/);
});

test('existing fields in parameters, filters and row expressions pass; one literal query costs one request', () => {
  const r = run('dryrun-valid-fields-and-query', DRY_RUN_ARGS);
  assert.deepEqual(r.report.findings, []);
  assert.equal(r.status, 0);
  assert.equal(r.report.apiRequests, 2);
});

test('the dry-run is skipped, and reported as skipped, when lint has errors', () => {
  const r = run('dryrun-lint-error-skips', DRY_RUN_ARGS);
  assert.equal(r.status, 1);
  assert.deepEqual(summary(r.report), [['refused-script', 'error', 'index.html', 1]]);
  assert.equal(r.report.stages.lint.status, 'fail');
  assert.equal(r.report.stages.dryRun.status, 'skipped');
  assert.equal(r.report.apiRequests, 0);
  assert.match(fs.readFileSync(path.join(r.dir, 'verifier-output', 'report.md'), 'utf8'), /Dry-run: skipped/);
});

test('render is skipped when the dry-run has errors', () => {
  const r = run('dryrun-missing-field', DRY_RUN_ARGS);
  assert.equal(r.report.stages.dryRun.status, 'fail');
  assert.equal(r.report.stages.render.status, 'skipped');
});

test('a Page without datasets passes the dry-run with 0 API requests', () => {
  const r = run('clean', DRY_RUN_ARGS);
  assert.equal(r.report.stages.dryRun.status, 'pass');
  assert.equal(r.report.apiRequests, 0);
});

// Boundary Dataset catalogue: one entry per spatial level, every column filled, confirmed live.
const catalogue = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'references', 'boundary-catalogue.json'), 'utf8')).levels;
const LEVELS = ['Gemeinde', 'Region', 'Tourismusdestination', 'Raumbeobachtung 1', 'Raumbeobachtung 2'];

test('the catalogue has the five levels with every column filled', () => {
  assert.deepEqual(catalogue.map(e => e.level), LEVELS);
  for (const e of catalogue)
    for (const col of ['dataset', 'keyField', 'keyType', 'nameField', 'snapshot', 'records'])
      assert.ok(e[col] !== undefined && e[col] !== '', `${e.level} lacks ${col}`);
  assert.equal(new Set(catalogue.map(e => e.dataset)).size, 5);
});

test('boundary-catalogue.md lists every entry with its dataset, key field and name field', () => {
  const md = fs.readFileSync(path.join(here, '..', '..', 'references', 'boundary-catalogue.md'), 'utf8');
  for (const e of catalogue)
    for (const v of [e.level, e.dataset, e.keyField, e.nameField])
      assert.ok(md.includes(`${v}`), `boundary-catalogue.md lacks ${v}`);
});

test('every catalogue entry matches data.gr.ch: record count, key field and type, name field', async () => {
  for (const e of catalogue) {
    const url = `https://data.gr.ch/api/explore/v2.1/catalog/datasets/${e.dataset}`;
    const res = await fetch(url, { headers: withApiKey(url) });
    assert.equal(res.status, 200, `${e.dataset} not readable`);
    const meta = await res.json();
    const field = n => meta.fields.find(f => f.name === n);
    assert.equal(meta.metas.default.records_count, e.records, `${e.level}: record count`);
    assert.equal(field(e.keyField)?.type, e.keyType, `${e.level}: key field ${e.keyField}`);
    assert.ok(field(e.nameField), `${e.level}: name field ${e.nameField}`);
    assert.ok(meta.features.includes('geo'), `${e.level}: not a geo dataset`);
  }
});

// Key-coverage check of the dry-run (live data.gr.ch, stable datasets, no hard-coded years).
test('a data key absent from the Boundary Dataset is an error that lists the key', () => {
  const r = run('dryrun-keys-unmatched', DRY_RUN_ARGS);
  assert.equal(r.status, 1);
  assert.deepEqual(summary(r.report), [['dry-run-key-coverage', 'error', 'index.html', 3]]);
  assert.match(r.report.findings[0].message, /\b3932\b/);
  assert.match(r.report.findings[0].message, /dvs_awt_regi_202502110/);
});

test('only keys within the default filters are checked', () => {
  const r = run('dryrun-keys-filtered', DRY_RUN_ARGS);
  assert.deepEqual(r.report.findings, []);
  assert.equal(r.status, 0);
});

test('data covering only some boundary shapes passes, int data key against text boundary key', () => {
  const r = run('dryrun-keys-partial-int-to-text', DRY_RUN_ARGS);
  assert.deepEqual(r.report.findings, []);
  assert.equal(r.status, 0);
  assert.equal(r.report.stages.dryRun.status, 'pass');
  assert.equal(r.report.apiRequests, 4);   // 2 dataset metadata + data keys + boundary keys
});

test('a map joined to a dataset outside the catalogue is an error', () => {
  const r = run('dryrun-boundary-not-in-catalogue', DRY_RUN_ARGS);
  assert.equal(r.status, 1);
  assert.deepEqual(summary(r.report), [['dry-run-boundary-not-in-catalogue', 'error', 'index.html', 3]]);
});

test('a map joined on another field than the catalogue key is an error', () => {
  const r = run('dryrun-boundary-wrong-key-field', DRY_RUN_ARGS);
  assert.equal(r.status, 1);
  assert.deepEqual(summary(r.report), [['dry-run-boundary-key-mismatch', 'error', 'index.html', 3]]);
  assert.match(r.report.findings[0].message, /bfs_nummer/);
});

// Offline: the same check against a fake API, for paging and filters that live data can't pin down.
function fakeApi({ dataKeys, boundaryKeys }) {
  const requests = [];
  const fetchJson = async url => {
    requests.push(decodeURIComponent(url.replace(/\+/g, ' ')));
    const u = new URL(url);
    const id = u.pathname.split('/')[6];
    if (!u.pathname.endsWith('/records')) {
      const fields = id === 'dvs_awt_regi_202502110'
        ? [{ name: 'bfs_nummer', type: 'text' }, { name: 'name', type: 'text' }]
        : [{ name: 'key', type: 'int' }, { name: 'wert', type: 'int' }, { name: 'jahr', type: 'text' }];
      return { status: 200, body: { fields } };
    }
    const all = id === 'dvs_awt_regi_202502110' ? boundaryKeys : dataKeys;
    const field = u.searchParams.get('select');
    const offset = Number(u.searchParams.get('offset') ?? 0), limit = Number(u.searchParams.get('limit'));
    return { status: 200, body: { total_count: all.length, results: all.slice(offset, offset + limit).map(k => ({ [field]: k })) } };
  };
  return { fetchJson, requests };
}
const page = (params = '') => `<ods-dataset-context context="datactx,geoctx" datactx-dataset="data_set" ${params} geoctx-dataset="dvs_awt_regi_202502110">
<div ods-color-gradient="colors" ods-color-gradient-context="datactx" ods-color-gradient-x="key" ods-color-gradient-serie="SUM(wert)">
<ods-map scroll-wheel-zoom="false"><ods-map-layer context="geoctx" display="categories" color-by-field="bfs_nummer" color-categories="colors['colors']"></ods-map-layer></ods-map></div></ods-dataset-context>`;

test('keys beyond the first API page are all compared', async () => {
  const { dryRun } = await import('../dryrun.mjs');
  const boundaryKeys = Array.from({ length: 250 }, (_, i) => String(1000 + i));
  const dataKeys = Array.from({ length: 250 }, (_, i) => 1000 + i);
  const { fetchJson, requests } = fakeApi({ dataKeys, boundaryKeys });
  const { findings, apiRequests } = await dryRun({ html: page(), fetchJson });
  assert.deepEqual(findings, []);
  assert.equal(apiRequests, 2 + 3 + 3);
  assert.equal(requests.filter(r => r.includes('/records')).length, 6);
  const withLast = await dryRun({ html: page(), fetchJson: fakeApi({ dataKeys: [...dataKeys, 9999], boundaryKeys }).fetchJson });
  assert.deepEqual(withLast.findings.map(f => f.rule), ['dry-run-key-coverage']);
  assert.match(withLast.findings[0].message, /9999/);
});

test('literal refine and exclude filters become the where clause of the key query', async () => {
  const { dryRun } = await import('../dryrun.mjs');
  const { fetchJson, requests } = fakeApi({ dataKeys: [1000], boundaryKeys: ['1000'] });
  const html = page(`datactx-parameters="{'refine.jahr': ['2020', '2021'], 'exclude.jahr': '2022'}"`);
  const { findings } = await dryRun({ html, fetchJson });
  assert.deepEqual(findings, []);
  const keyQuery = requests.find(r => r.includes('data_set/records'));
  assert.ok(keyQuery.includes('jahr in ("2020","2021")'), keyQuery);
  assert.ok(keyQuery.includes('not jahr in ("2022")'), keyQuery);
});

test('a filter computed at runtime is ignored with a warning, never an error', async () => {
  const { dryRun } = await import('../dryrun.mjs');
  const { fetchJson } = fakeApi({ dataKeys: [1000], boundaryKeys: ['1000'] });
  const computed = await dryRun({ html: page(`datactx-parameters="{'refine.jahr': ''+latest[0].jahr}"`), fetchJson });
  assert.deepEqual(computed.findings.map(f => [f.rule, f.severity]), [['dry-run-key-coverage-filter-ignored', 'warning']]);
  const guarded = page() + `<span hidden>{{ datactx.parameters['refine.jahr'] = datactx.parameters['refine.jahr'] || latest[0].jahr; '' }}</span>`;
  const again = await dryRun({ html: guarded, fetchJson });
  assert.deepEqual(again.findings.map(f => [f.rule, f.severity]), [['dry-run-key-coverage-filter-ignored', 'warning']]);
});

// The core reference explains what the lint enforces: every listed Widget and banned habit appears in it.
test('core.md covers every listed Widget and every banned habit', () => {
  const refs = path.join(here, '..', '..', 'references');
  const core = fs.readFileSync(path.join(refs, 'core.md'), 'utf8');
  const { widgets, count } = JSON.parse(fs.readFileSync(path.join(refs, 'widgets.json'), 'utf8'));
  const { habits } = JSON.parse(fs.readFileSync(path.join(refs, 'banned-habits.json'), 'utf8'));
  assert.equal(widgets.length, count);
  for (const w of widgets) assert.ok(core.includes(`\`${w.markup}\``), `core.md lacks ${w.markup}`);
  for (const h of habits) assert.ok(core.includes(`\`${h.id}\``), `core.md lacks banned habit ${h.id}`);
});

// The Widget family files: one per family, every listed Widget documented, every claim cited.
const refsDir = path.join(here, '..', '..', 'references');
const familyFile = family => path.join(refsDir, 'widgets', `${family}.md`);
const listedWidgets = JSON.parse(fs.readFileSync(path.join(refsDir, 'widgets.json'), 'utf8')).widgets;

test('family files cover every listed Widget with a parameter table and a Correct usage section', () => {
  for (const family of new Set(listedWidgets.map(w => w.family))) {
    const md = fs.readFileSync(familyFile(family), 'utf8');
    assert.ok(md.includes('\n## Correct usage\n'), `${family}.md lacks a Correct usage section`);
    for (const w of listedWidgets.filter(x => x.family === family)) {
      const section = md.split(/^## /m).find(part => part.startsWith(`\`${w.markup}\``));
      assert.ok(section, `${family}.md lacks a section for ${w.markup}`);
      assert.match(section, /^\| `[^`]+` \|/m, `${w.markup} has no parameter table row`);
    }
  }
});

test('every Correct usage claim carries a source:line citation', () => {
  for (const family of new Set(listedWidgets.map(w => w.family))) {
    const usage = fs.readFileSync(familyFile(family), 'utf8').split('\n## Correct usage\n')[1];
    for (const bullet of usage.split('\n').filter(l => /^\s*- /.test(l) && !l.trimEnd().endsWith(':')))
      assert.match(bullet, /\.(js|less):\d+/, `${family}.md: uncited claim: ${bullet.slice(0, 90)}`);
  }
});

// The citations point into the owner's gitignored ods-widgets checkout; without it there is nothing to check.
const checkout = path.join(here, '..', '..', '..', '..', '..', 'ods-widgets', 'src');
test('family files cite real source lines', { skip: !fs.existsSync(checkout) && 'ods-widgets checkout missing' }, () => {
  for (const family of new Set(listedWidgets.map(w => w.family))) {
    const md = fs.readFileSync(familyFile(family), 'utf8');
    for (const [, file, lines] of md.matchAll(/`(?:ods-widgets\/src\/directives\/)?((?:less\/components\/)?[\w-]+\.(?:js|less)):([\d,-]+)`/g)) {
      const source = path.join(checkout, file.startsWith('less/') ? file : `directives/${file}`);
      assert.ok(fs.existsSync(source), `${family}.md cites missing file ${file}`);
      const count = fs.readFileSync(source, 'utf8').split('\n').length;
      for (const n of lines.split(/[,-]/).map(Number))
        assert.ok(n >= 1 && n <= count, `${family}.md cites ${file}:${n}, but the file has ${count} lines`);
    }
  }
});
