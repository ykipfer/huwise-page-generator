import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = import.meta.dirname;
const CLI = path.join(here, '..', 'verify.mjs');

// Copy a fixture into a temp dir so runs never write into the repo.
function run(fixture, extraArgs = ['--target-height', '800', '--embed-size', 'gross']) {
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
