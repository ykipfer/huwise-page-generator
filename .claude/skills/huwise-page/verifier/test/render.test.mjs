// Render stage tests. They are network-bound: they render in a real browser against live data.gr.ch
// (platform config scrape, portal statics, one dataset) and need the gitignored ods-widgets/ checkout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = import.meta.dirname;
const CLI = path.join(here, '..', 'verify.mjs');
// One cache dir for the whole file, so the platform scrape happens once.
const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-cache-'));

const BASE_CSS = path.join(here, '..', '..', 'references', 'base-stylesheet.css');
function run(fixture, extraArgs = [], { cache = cacheDir, withBase = fixture.startsWith('render-map') } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-render-'));
  fs.cpSync(path.join(here, 'fixtures', fixture), dir, { recursive: true });
  if (withBase) {
    // Fixtures that need the CI areas (map, chart) keep only their Target Height; the base stylesheet comes first.
    const css = path.join(dir, 'stylesheet.css');
    fs.writeFileSync(css, fs.readFileSync(BASE_CSS, 'utf8') + '\n' + fs.readFileSync(css, 'utf8'));
  }
  const args = ['--target-height', '800', '--embed-size', 'gross', '--no-dry-run', ...extraArgs];
  const r = spawnSync('node', [CLI, dir, ...args], { encoding: 'utf8', env: { ...process.env, VERIFIER_CACHE_DIR: cache } });
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'verifier-output', 'report.json'), 'utf8'));
  return { ...r, dir, report };
}
const summary = report => report.findings.map(f => [f.rule, f.severity]);
const shots = r => r.report.stages.render.screenshots.map(s => s.width);

test('clean Page passes at 375, 720 and 1200 with one screenshot per width (Gross)', () => {
  const r = run('render-clean');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.report.findings, []);
  assert.equal(r.report.stages.render.status, 'pass');
  assert.deepEqual(shots(r), [375, 720, 1200]);
  for (const s of r.report.stages.render.screenshots)
    assert.ok(fs.statSync(path.join(r.dir, 'verifier-output', s.file)).size > 0);
});

test('Klein renders at 375 and 720 only', () => {
  const r = run('render-clean', ['--embed-size', 'klein']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(shots(r), [375, 720]);
});

test('--iterate renders at 1200 only', () => {
  const r = run('render-clean', ['--iterate']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(shots(r), [1200]);
});

test('platform config is cached for a day and refreshed after that', () => {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-cache-'));
  const source = () => run('render-clean', ['--iterate'], { cache }).report.stages.render.platformConfig.source;
  assert.equal(source(), 'live');
  assert.equal(source(), 'cache');
  const file = path.join(cache, 'platform.json');
  const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...stored, fetchedAt: Date.now() - 2 * 864e5 }));
  assert.equal(source(), 'live');
});

test('render is skipped, and reported as skipped, when lint has errors', () => {
  const r = run('banned-ods-tabs');
  assert.equal(r.status, 1);
  assert.equal(r.report.stages.render.status, 'skipped');
  assert.deepEqual(r.report.stages.render.screenshots, []);
  assert.deepEqual(summary(r.report), [['banned-ods-tabs', 'error']]);
});

const mustFail = [
  ['render-console-error', 'console-error', [375, 720, 1200]],
  ['render-unresolved-text', 'unresolved-text', [375, 720, 1200]],
  ['render-overflow-375', 'overflow', [375]],
  ['render-too-tall', 'content-too-tall', [375, 720, 1200]],
];
for (const [fixture, rule, widths] of mustFail) {
  test(`${fixture}: exactly one ${rule} error at ${widths.join('/')}px, exit 1`, () => {
    const r = run(fixture);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.deepEqual(summary(r.report), [[rule, 'error']]);
    assert.deepEqual(r.report.findings[0].location.widths, widths);
    assert.equal(r.report.stages.render.status, 'fail');
    assert.deepEqual(shots(r), [375, 720, 1200]);
  });
}

test('overflow only inside an allowed scroll container passes', () => {
  const r = run('render-overflow-in-scroll-container');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.report.findings, []);
});

test('content taller than the Target Height but clipped by a scroll container passes', () => {
  const r = run('render-tall-clipped-in-scroll');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.report.findings, []);
});

// ---------- Widget signals and state exploration (#23) ----------
const stateLabels = r => r.report.stages.render.states.map(s => s.label);
const stateOf = (r, label) => r.report.stages.render.states.find(s => s.label === label);

test('an empty Widget variable fails with exactly that finding', () => {
  const r = run('render-empty-variable', ['--iterate']);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(summary(r.report), [['widget-variable', 'error']]);
  assert.match(r.report.findings[0].message, /rows/);
  assert.match(r.report.findings[0].message, /empty/);
});

test('an empty variable that the Page guards with an empty-state message passes', () => {
  const r = run('render-empty-variable-guarded', ['--iterate']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  // excused, but not silently: one warning that names the variable
  assert.deepEqual(summary(r.report), [['widget-variable-guarded', 'warning']]);
  assert.match(r.report.findings[0].message, /"rows"/);
});

test('every guarded empty variable gets its own warning, naming it, and none is an error', () => {
  const r = run('render-empty-variables-guarded-two', ['--iterate']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(summary(r.report), [['widget-variable-guarded', 'warning'], ['widget-variable-guarded', 'warning']]);
  const names = r.report.findings.map(f => f.message.match(/"(\w+)"/)[1]).sort();
  assert.deepEqual(names, ['more', 'rows']);
});

test('a guard that only handles the non-empty case does not excuse an empty variable', () => {
  const r = run('render-empty-variable-positive-guard-only', ['--iterate']);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(summary(r.report), [['widget-variable', 'error']]);
});

test('a chart without points fails with exactly that finding', () => {
  const r = run('render-chart-no-points', ['--iterate']);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(summary(r.report), [['chart-no-points', 'error']]);
});

test('a Widget never rendered in any explored state (behind a tab) fails with exactly that finding', () => {
  const r = run('render-widget-never-rendered-in-tab', ['--iterate']);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(summary(r.report), [['widget-never-rendered', 'error']]);
  assert.match(r.report.findings[0].message, /ods-table/);
  assert.deepEqual(stateLabels(r), ['initial', 'tab "Zweite"']);
});

test('a broken Visualization reachable only via ng-click fails, in that state only', () => {
  const r = run('render-broken-state-via-ng-click', ['--iterate']);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(summary(r.report), [['widget-variable', 'error']]);
  assert.equal(r.report.findings[0].location.state, 'ng-click "showRows = !showRows"');
  assert.deepEqual(stateOf(r, 'initial').findings, []);
});

test('a broken state reachable only via an ods-select option fails, in that state only', () => {
  const r = run('render-broken-state-via-ods-select', ['--iterate']);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(summary(r.report), [['widget-variable', 'error']]);
  assert.equal(r.report.findings[0].location.state, 'ods-select option "schlecht"');
  assert.deepEqual(stateOf(r, 'ods-select option "gut"').findings, []);
});

test('ng-repeat over an out-of-scope variable is reported', () => {
  const r = run('render-repeat-out-of-scope', ['--iterate']);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(summary(r.report), [['ng-repeat-out-of-scope', 'error']]);
  assert.match(r.report.findings[0].message, /rows/);
});

test('the clean Page with tabs, an ng-click and an ods-select passes in every state, with a 1200px screenshot per state', () => {
  const r = run('render-tabs-clean');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.report.findings, []);
  assert.deepEqual(stateLabels(r), ['initial', 'ng-click "more = !more"', 'ods-select option "a"', 'ods-select option "b"', 'tab "Diagramm"']);
  for (const s of r.report.stages.render.states) {
    assert.deepEqual(s.findings, []);
    assert.equal(s.width, 1200);
    assert.ok(fs.statSync(path.join(r.dir, 'verifier-output', s.screenshot)).size > 0);
  }
  assert.match(fs.readFileSync(path.join(r.dir, 'verifier-output', 'report.md'), 'utf8'), /tab "Diagramm"/);
});

// ---------- map signals (#27) ----------
test('a map with a layer that loads shapes passes, with no console error', () => {
  const r = run('render-map-clean', ['--iterate']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.report.findings, []);
});

test('a map that loads no features fails with exactly that finding', () => {
  const r = run('render-map-no-features', ['--iterate']);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(summary(r.report), [['map-no-features', 'error']]);
});

test('a map under 280px fails with exactly that finding', () => {
  const r = run('render-map-too-small', ['--iterate']);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(summary(r.report), [['map-too-small', 'error']]);
  assert.match(r.report.findings[0].message, /200px/);
});

test('a chart under 240px fails with exactly that finding', () => {
  const r = run('render-chart-too-small', ['--iterate'], { withBase: true });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(summary(r.report), [['chart-too-small', 'error']]);
  assert.match(r.report.findings[0].message, /minimum is 240px/);
});

test('a table area under 200px fails with exactly that finding', () => {
  const r = run('render-table-area-too-small', ['--iterate']);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(summary(r.report), [['table-area-too-small', 'error']]);
  assert.match(r.report.findings[0].message, /120px/);
});

test('boundary shapes without data render in the "other" grey without an error', () => {
  const r = run('render-map-shapes-without-data', ['--iterate']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.report.findings, []);
});

test('a map inside a tab passes once the tab is explored', () => {
  const r = run('render-map-in-tab-clean', ['--iterate']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.report.findings, []);
  assert.deepEqual(stateLabels(r), ['initial', 'tab "Karte"']);
});

test('a map tooltip is explored by clicking a shape, and passes when its nested context loads', () => {
  const r = run('render-map-tooltip-clean', ['--iterate']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.report.findings, []);
  assert.deepEqual(stateLabels(r), ['initial', 'map shape click']);
});

test('a map tooltip whose nested context finds no record fails in the click state only', () => {
  const r = run('render-map-tooltip-broken', ['--iterate']);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(summary(r.report), [['widget-variable', 'error']]);
  assert.equal(r.report.findings[0].location.state, 'map shape click');
  assert.deepEqual(stateOf(r, 'initial').findings, []);
});
