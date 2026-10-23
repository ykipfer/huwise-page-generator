import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = import.meta.dirname;
const CLI = path.join(here, '..', 'verify.mjs');

// Copy a fixture into a temp dir so runs never write into the repo.
// Lint tests stay offline (--no-dry-run); dry-run tests pass DRY_RUN_ARGS and hit live data.gr.ch.
const LINT_ARGS = ['--target-height', '800', '--embed-size', 'gross', '--no-dry-run'];
const DRY_RUN_ARGS = ['--target-height', '800', '--embed-size', 'gross'];
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
  ['allowed-ng-click-toggle', 'a single ng-click toggle is not a hand-built tab bar and passes'],
  ['allowed-side-effect-guarded-default', 'the guarded default side-effect form passes'],
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
