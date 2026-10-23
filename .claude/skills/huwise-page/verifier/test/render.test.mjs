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

function run(fixture, extraArgs = [], { cache = cacheDir } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-render-'));
  fs.cpSync(path.join(here, 'fixtures', fixture), dir, { recursive: true });
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
  assert.deepEqual(r.report.findings, []);
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
