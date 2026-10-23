// Patterns 5 to 8 (#25): KPI tile, chart, table, tabs. Each Pattern file has the Pattern file format, and each has an
// instance Page on a real data.gr.ch dataset that the verifier passes clean. Network-bound like render.test.mjs:
// live data.gr.ch, a real browser and the gitignored ods-widgets/ checkout (ODS_WIDGETS_DIR).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = import.meta.dirname;
const CLI = path.join(here, '..', 'verify.mjs');
const REFERENCES = path.join(here, '..', '..', 'references');
const read = (...p) => fs.readFileSync(path.join(REFERENCES, ...p), 'utf8');
const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-cache-'));

const PATTERNS = [
  { file: '05-kpi.md', title: 'Pattern 5', instance: '05-kpi', widgets: ['ods-aggregation'] },
  { file: '06-chart.md', title: 'Pattern 6', instance: '06-chart', widgets: ['ods-chart', 'series-breakdown', 'stacked', 'category-colors'] },
  { file: '07-table.md', title: 'Pattern 7', instance: '07-table', widgets: ['ods-table', 'displayed-fields', 'hw-table-scroll'] },
  { file: '08-tabs.md', title: 'Pattern 8', instance: '08-tabs', widgets: ['ods-simple-tabs', 'ods-simple-tab'] },
];

// ---------- the Pattern files ----------
for (const p of PATTERNS) {
  test(`${p.file} has the Pattern file format: Job, Widgets, Snippet, Pitfalls, Source Example Page`, () => {
    const md = read('patterns', p.file);
    assert.ok(md.startsWith(`# ${p.title}:`), 'title');
    const headings = [...md.matchAll(/^## (.+)$/gm)].map(m => m[1]);
    assert.deepEqual(headings.filter(h => ['Job', 'Widgets', 'Snippet', 'Pitfalls', 'Source Example Page'].includes(h)),
      ['Job', 'Widgets', 'Snippet', 'Pitfalls', 'Source Example Page']);
  });

  test(`${p.file} has an HTML snippet with {snake_case} placeholders and names its Widgets`, () => {
    const md = read('patterns', p.file);
    const snippet = md.match(/```html\n([\s\S]*?)```/)?.[1] ?? '';
    assert.match(snippet, /\{[a-z][a-z_]*\}/, 'placeholder');
    for (const w of p.widgets) assert.ok(md.includes(w), `${w} is not mentioned`);
  });

  test(`${p.file} points at its verified instance Page`, () => {
    assert.ok(read('patterns', p.file).includes(`patterns/instances/${p.instance}/`));
  });
}

test('Pattern 8 bans hand-built tabs and Pattern 6 fixes the CI colour order and Übrige', () => {
  assert.match(read('patterns', '08-tabs.md'), /banned-hand-built-tabs/);
  assert.match(read('patterns', '08-tabs.md'), /filters sit above the tabs/);
  const chart = read('patterns', '06-chart.md');
  for (const t of ['#2D2D8A, #E69F00, #009E73, #56B4E9, #CC79A7, #0072B2, #D55E00', '#6B6B6B', 'Übrige', 'Highcharts', '6.1.4'])
    assert.ok(chart.includes(t), `missing ${t}`);
});

// ---------- the instance Pages ----------
function verify(instance, extraArgs = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-pattern-'));
  fs.cpSync(path.join(REFERENCES, 'patterns', 'instances', instance), dir, { recursive: true });
  const r = spawnSync('node', [CLI, dir, '--target-height', '800', '--embed-size', 'gross', ...extraArgs],
    { encoding: 'utf8', env: { ...process.env, VERIFIER_CACHE_DIR: cacheDir } });
  return { ...r, dir, report: JSON.parse(fs.readFileSync(path.join(dir, 'verifier-output', 'report.json'), 'utf8')) };
}

for (const p of PATTERNS) {
  test(`${p.instance}: the instance Page passes lint, dry-run and render with no finding at 375, 720 and 1200px`, () => {
    const r = verify(p.instance);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(r.report.findings, []);
    assert.deepEqual(['lint', 'dryRun', 'render'].map(s => r.report.stages[s].status), ['pass', 'pass', 'pass']);
    assert.deepEqual(r.report.stages.render.screenshots.map(s => s.width), [375, 720, 1200]);
  });

  test(`${p.instance}: the instance stylesheet is the base stylesheet verbatim, then the Target Height, then its own rules`, () => {
    const css = read('patterns', 'instances', p.instance, 'stylesheet.css');
    const base = read('base-stylesheet.css');
    assert.ok(css.startsWith(base), 'base stylesheet changed');
    assert.ok(css.slice(base.length).trimStart().startsWith('.hw-page { --target-height: 800px; }'));
  });
}

test('06-chart: the colour map covers exactly the values the context filter leaves, and uses the CI order', () => {
  const html = read('patterns', 'instances', '06-chart', 'index.html');
  const map = html.match(/category-colors="\{([^}]*)\}"/)[1];
  assert.deepEqual([...map.matchAll(/#[0-9A-F]{6}/g)].map(m => m[0]), ['#2D2D8A', '#E69F00']);
  assert.match(html, /series-breakdown="metrik"/);
  assert.match(html, /stacked="normal"/);
});

test('08-tabs: every tab is explored as its own state and holds exactly one Visualization', () => {
  const r = verify('08-tabs');
  assert.deepEqual(r.report.stages.render.states.map(s => s.label), ['initial', 'tab "Ankünfte"', 'tab "Tabelle"']);
  for (const s of r.report.stages.render.states) assert.deepEqual(s.findings, []);
  const html = read('patterns', 'instances', '08-tabs', 'index.html');
  const tabs = html.split('<ods-simple-tab ').slice(1);
  assert.equal(tabs.length, 3);
  for (const t of tabs) assert.equal((t.match(/<ods-chart[ >]|<ods-table[ >]/g) ?? []).length, 1);
  assert.ok(html.indexOf('hw-filters') < html.indexOf('<ods-simple-tabs>'), 'filters sit above the tabs');
});

test('07-table: the wide table passes at 375px with its ten columns, wider than the Page, inside the table-scroll wrapper', () => {
  const html = read('patterns', 'instances', '07-table', 'index.html');
  const fields = html.match(/displayed-fields="([^"]+)"/)[1].split(',');
  assert.ok(fields.length >= 8, 'wide table');
  assert.match(html, /<div class="hw-table-scroll">\s*<div class="hw-table-wide">\s*<ods-table/);
  assert.match(read('patterns', 'instances', '07-table', 'stylesheet.css'), /\.hw-table-wide \{ min-width: (7\d\d|[89]\d\d|\d{4})px/);
  const r = verify('07-table', ['--no-dry-run']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.report.stages.render.screenshots.some(s => s.width === 375));
  assert.ok(!r.report.findings.some(f => f.rule === 'overflow'));
});
