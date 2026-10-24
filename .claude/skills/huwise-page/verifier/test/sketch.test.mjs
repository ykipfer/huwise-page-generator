// Page Sketch intake and preview (#29). Seams: the preview CLI (preview.mjs), the intake helpers (intake.mjs)
// and the skill's documentation (SKILL.md). The browser tests need Playwright's chromium; the live tests hit data.gr.ch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { v1Url, summariseV1, fetchV1, exploreSummary } from '../intake.mjs';

const here = import.meta.dirname;
const SKILL = path.join(here, '..', '..');
const REPO = path.join(SKILL, '..', '..', '..');
const PREVIEW = path.join(here, '..', 'preview.mjs');
const VERIFY = path.join(here, '..', 'verify.mjs');
const SKELETON = path.join(SKILL, 'references', 'skeleton', 'sidebar-main');

function pageFolder() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sketch-'));
  fs.cpSync(SKELETON, dir, { recursive: true });
  return dir;
}
const preview = (dir, size, height) =>
  spawnSync('node', [PREVIEW, dir, '--target-height', String(height), '--embed-size', size, '--no-open'], { encoding: 'utf8' });
const frameSizes = page => page.$$eval('iframe', fs => fs.map(f => { const b = f.getBoundingClientRect(); return [b.width, b.height]; }));

// ---------- preview ----------
test('preview of a Gross sketch holds three iframes at 375, 720 and 1200 wide, each exactly at the Target Height', async () => {
  const dir = pageFolder();
  const r = preview(dir, 'gross', 640);
  assert.equal(r.status, 0, r.stderr);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto('file://' + path.join(dir, 'preview.html'));
    assert.deepEqual(await frameSizes(page), [[375, 640], [720, 640], [1200, 640]]);
    for (const handle of await page.$$('iframe')) {
      const frame = await handle.contentFrame();
      const m = await frame.evaluate(() => ({
        scroll: document.documentElement.scrollHeight,
        footer: !!document.querySelector('.hw-footer'),
      }));
      assert.equal(m.footer, true);
      assert.ok(m.scroll <= 640, `sketch scrolls: ${m.scroll}`);
    }
  } finally { await browser.close(); }
});

test('preview of a Klein sketch holds two iframes at 375 and 720 wide', async () => {
  const dir = pageFolder();
  assert.equal(preview(dir, 'klein', 800).status, 0);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto('file://' + path.join(dir, 'preview.html'));
    assert.deepEqual(await frameSizes(page), [[375, 800], [720, 800]]);
  } finally { await browser.close(); }
});

test('the preview applies the requested Target Height to the sketch, not the default', () => {
  const dir = pageFolder();
  assert.equal(preview(dir, 'gross', 600).status, 0);
  assert.match(fs.readFileSync(path.join(dir, 'preview.html'), 'utf8'), /--target-height:\s*600px/);
});

test('preview.html is gitignored in a Page folder, the sketch files are not', () => {
  const ignored = f => spawnSync('git', ['check-ignore', '-q', f], { cwd: REPO }).status === 0;
  assert.equal(ignored('pages/beherbergung-gemeinden/preview.html'), true);
  assert.equal(ignored('pages/beherbergung-gemeinden/index.html'), false);
  assert.equal(ignored('pages/beherbergung-gemeinden/stylesheet.css'), false);
});

test('a sketch built from the skeleton passes lint (editor-safe, footer present)', () => {
  const r = spawnSync('node', [VERIFY, pageFolder(), '--target-height', '800', '--embed-size', 'gross', '--no-dry-run', '--skip-render'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout);
});

// ---------- intake ----------
test('the raw v1 call asks for German labels', () => {
  const u = new URL(v1Url('dvs_awt_econ_20250203'));
  assert.equal(u.pathname, '/api/datasets/1.0/dvs_awt_econ_20250203/');
  assert.equal(u.searchParams.get('lang'), 'de');
});

test('v1 summary keeps labels, timeserie precision and the geo/timeserie features', () => {
  const s = summariseV1({
    datasetid: 'x', metas: { title: 'T', data_processed: '2026-10-05T07:23:49+00:00' }, features: ['timeserie', 'geo'],
    fields: [{ name: 'datum', label: 'Datum', type: 'date', annotations: [{ name: 'timeserie_precision', args: ['month'] }] },
      { name: 'jahr', label: 'Jahr', type: 'text' }],
  });
  assert.deepEqual(s.features, ['timeserie', 'geo']);
  assert.deepEqual(s.fields, [
    { name: 'datum', label: 'Datum', type: 'date', timeseriePrecision: 'month' },
    { name: 'jahr', label: 'Jahr', type: 'text', timeseriePrecision: null }]);
  assert.equal(s.title, 'T');
});

test('live v1 call returns German labels and the month precision for the Beherbergung dataset', async () => {
  const s = await fetchV1('dvs_awt_econ_20250203');
  assert.equal(s.fields.find(f => f.name === 'gemeinde_name').label, 'Gemeinde Name');
  assert.equal(s.fields.find(f => f.name === 'datum').timeseriePrecision, 'month');
  assert.ok(s.features.includes('timeserie'));
});

test('the Explore API fallback returns fields and says where the facts came from', async () => {
  const s = await exploreSummary('dvs_awt_econ_20250203');
  assert.equal(s.source, 'Explore API v2.1');
  assert.ok(s.fields.some(f => f.name === 'gemeinde_name'));
  assert.ok(s.title);
});

// ---------- SKILL.md and the step references ----------
const read = (...p) => fs.readFileSync(path.join(SKILL, ...p), 'utf8');
const WIDGETS = JSON.parse(read('references', 'widgets.json')).widgets;

test('SKILL.md is the entry point: name, a Widget index with one line per listed Widget, and nothing in the project memory file', () => {
  const skill = read('SKILL.md');
  assert.match(skill, /^---\nname: huwise-page\n/);
  for (const w of WIDGETS) {
    const line = skill.split('\n').find(l => l.includes('`' + w.markup + '`') && l.includes(`widgets/${w.family}.md`));
    assert.ok(line, `Widget index line for ${w.markup} missing`);
  }
  assert.ok(!/huwise-page|Page Sketch/.test(fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8')));
});

test('SKILL.md documents intake order, MCP fallback, source fallback, add step and the sketch gate', () => {
  const skill = read('SKILL.md');
  const idx = s => skill.indexOf(s);
  assert.ok(idx('ogd-graubuenden') > -1 && idx('ogd-graubuenden') < idx('MCP'), 'ogd-graubuenden before the first MCP mention');
  for (const needle of ['Explore API', 'Source fallback', 'Deliberate add step', 'Widget, the Patterns or the Boundary Dataset catalogue',
    'Target Height', 'Embed Size', 'preview.mjs', 'intake.mjs', 'ok', 'never edit the reference', 'pages/'])
    assert.ok(skill.toLowerCase().includes(needle.toLowerCase()), `SKILL.md lacks: ${needle}`);
});

test('the step references name every plan-list flag and the sketch rules', () => {
  const sketch = read('references', 'page-sketch.md');
  for (const needle of ['missing Widget or Pattern', 'Companion Dataset needed', 'Boundary Dataset needed', 'content dropped', 'historical-state map', 'combined across datasets',
    'Gemeinde', 'ODSQL', 'no API calls', 'no mock charts', 'hw-footer', 'hw-placeholder', 'German kebab-case', '720px', 'tabs'])
    assert.ok(sketch.toLowerCase().includes(needle.toLowerCase()), `page-sketch.md lacks: ${needle}`);
  const intake = read('references', 'intake.md');
  for (const needle of ['lang=de', 'timeserie_precision', 'Explore API', 'boundary-catalogue', 'facet', 'Companion Dataset'])
    assert.ok(intake.includes(needle), `intake.md lacks: ${needle}`);
});
