// Build, verify loop and handoff (#30). Seams: the handoff writer (handoff.mjs), the Git ignore rules for a Page folder,
// and the skill's documentation of steps 5 to 7 (SKILL.md, references/build-verify-handoff.md). All offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { handoffMarkdown, notPassingReasons, embedUrl } from '../handoff.mjs';

const here = import.meta.dirname;
const SKILL = path.join(here, '..', '..');
const REPO = path.join(SKILL, '..', '..', '..');
const HANDOFF = path.join(here, '..', 'handoff.mjs');

const stage = status => ({ status });
const shots = widths => widths.map(width => ({ width, file: `screenshot-${width}.png` }));
const passingReport = (embedSize = 'Gross') => ({
  page: 'beispiel-seite', status: 'pass', targetHeight: 800, embedSize,
  stages: { lint: stage('pass'), dryRun: { status: 'pass', apiRequests: 12 }, render: { status: 'pass', screenshots: shots(embedSize === 'Gross' ? [375, 720, 1200] : [375, 720]), states: [{ label: 'tab "Karte"', width: 1200, screenshot: 'state-1-1200.png', findings: [] }] } },
  apiRequests: 12, findings: [{ severity: 'warning', rule: 'widget-variable-guarded', location: { widths: [1200], state: 'initial' }, message: 'x is empty' }],
});
const failingReport = () => ({
  ...passingReport(), status: 'fail',
  stages: { lint: stage('fail'), dryRun: { status: 'skipped', reason: 'lint has errors' }, render: { status: 'skipped', reason: 'lint has errors', screenshots: [] } },
  apiRequests: 0,
  findings: [{ severity: 'error', rule: 'banned-hard-coded-year', location: { file: 'index.html', line: 4, column: 9 }, message: 'a literal year | here' }],
});
const input = (over = {}) => ({ report: passingReport(), slug: 'beispiel-seite', datasetTitle: 'Beispiel Datensatz', caption: 'Quelle: Beispiel Datensatz, data.gr.ch', ...over });

const order = (md, headings) => headings.map(h => md.indexOf(h));

test('a passing handoff holds the five sections in the ticket order', () => {
  const md = handoffMarkdown(input({ iterations: 2 }));
  assert.match(md, /Status: \*\*PASSING\*\*/);
  const at = order(md, ['## 1. Editor steps', '## 2. Embed URL', '## 3. gr.ch component values', '## 4. Verification summary', '## 5. Screenshots']);
  assert.ok(at.every(i => i >= 0), md);
  assert.deepEqual([...at].sort((a, b) => a - b), at);
  assert.match(md, /after 2 iterations/);
});

test('editor steps name the slug, the DE HTML and CSS fields and the empty EN and IT fields', () => {
  const md = handoffMarkdown(input());
  assert.match(md, /create a Page with the slug `beispiel-seite`/);
  assert.match(md, /index\.html` into the \*\*DE\*\* HTML field/);
  assert.match(md, /stylesheet\.css` into the \*\*DE\*\* CSS field/);
  assert.match(md, /Leave the EN and IT fields empty/);
});

test('the embed URL is always headless with flg=de-ch and carries the Sharing tab warning', () => {
  assert.equal(embedUrl('x-y'), 'https://data.gr.ch/pages/x-y/?headless=true&flg=de-ch');
  const md = handoffMarkdown(input());
  assert.ok(md.includes('`https://data.gr.ch/pages/beispiel-seite/?headless=true&flg=de-ch`'));
  assert.match(md, /do not use the snippet of the Page's Sharing tab/);
});

test('component values: Höhe (px) is the Target Height, plus the Embed Size and the Legende with its length', () => {
  const md = handoffMarkdown(input({ report: passingReport('Klein') }));
  assert.match(md, /Höhe \(px\): \*\*800\*\*/);
  assert.match(md, /Embed Size: \*\*Klein\*\*/);
  assert.match(md, /Legende \(Embed Caption, 38 of 200 characters\): Quelle: Beispiel Datensatz, data.gr.ch/);
});

test('the Legende must name the dataset and stay within 200 characters', () => {
  assert.throws(() => handoffMarkdown(input({ caption: 'Quelle: data.gr.ch' })), /name the dataset/);
  assert.throws(() => handoffMarkdown(input({ caption: 'Beispiel Datensatz ' + 'x'.repeat(190) })), /limit is 200/);
  assert.doesNotThrow(() => handoffMarkdown(input({ caption: 'Beispiel Datensatz ' + 'x'.repeat(181) })));
});

test('the verification summary lists stages, warnings and reference gaps', () => {
  const md = handoffMarkdown(input({ gaps: ['ods-select: Attribut x fehlt in widgets/filter.md (select.js:12)'] }));
  assert.match(md, /Lint: pass/);
  assert.match(md, /Dry-run: pass/);
  assert.match(md, /Render: pass/);
  assert.match(md, /API requests \(dry-run\): 12/);
  assert.match(md, /Warnings: 1/);
  assert.match(md, /widget-variable-guarded/);
  assert.match(md, /Reference gaps found:\s+- ods-select/);
  assert.match(handoffMarkdown(input()), /Reference gaps found: none/);
});

test('screenshots are listed per width and per explored state, with paths inside the Page folder', () => {
  const md = handoffMarkdown(input());
  for (const w of [375, 720, 1200]) assert.ok(md.includes(`pages/beispiel-seite/verifier-output/screenshot-${w}.png`), String(w));
  assert.ok(md.includes('pages/beispiel-seite/verifier-output/state-1-1200.png'));
});

test('a failing report is written as NOT PASSING with the open errors', () => {
  const md = handoffMarkdown(input({ report: failingReport(), iterations: 3 }));
  assert.match(md, /Status: \*\*NOT PASSING\*\*/);
  assert.match(md, /Open errors/);
  assert.match(md, /banned-hard-coded-year \| index\.html:4:9 \| a literal year \\\| here/);
  assert.match(md, /after 3 iterations/);
  assert.match(md, /## 1\. Editor steps/);
});

test('a clean report is still NOT PASSING when the final pass skipped widths, skipped a stage or the review failed', () => {
  const iterating = passingReport();
  iterating.stages.render.screenshots = shots([1200]);
  assert.match(notPassingReasons(iterating).join(), /did not render every width/);
  const skipped = passingReport();
  skipped.stages.dryRun = { status: 'skipped', reason: 'disabled by --no-dry-run' };
  assert.match(notPassingReasons(skipped).join(), /dry-run stage skipped/);
  assert.deepEqual(notPassingReasons(passingReport()), []);
  assert.match(handoffMarkdown(input({ reviewFailed: true })), /Status: \*\*NOT PASSING\*\*[\s\S]*screenshot review found problems/);
});

test('the CLI reads the report, writes handoff.md next to the Page and prints it', () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-')), 'beispiel-seite');
  fs.mkdirSync(path.join(dir, 'verifier-output'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'verifier-output', 'report.json'), JSON.stringify(passingReport()));
  const run = (...extra) => spawnSync('node', [HANDOFF, dir, '--dataset-title', 'Beispiel Datensatz', '--caption', 'Quelle: Beispiel Datensatz', ...extra], { encoding: 'utf8' });
  const r = run('--iterations', '1', '--gap', 'eine Lücke');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(path.join(dir, 'handoff.md'), 'utf8'), r.stdout);
  assert.match(r.stdout, /Status: \*\*PASSING\*\*/);
  assert.match(r.stdout, /eine Lücke/);
  assert.match(run('--not-passing').stdout, /NOT PASSING/);
  assert.equal(spawnSync('node', [HANDOFF, dir], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync('node', [HANDOFF, path.join(dir, 'nope'), '--dataset-title', 'a', '--caption', 'a'], { encoding: 'utf8' }).status, 2);
});

test('git tracks a Page folder\'s HTML, CSS and handoff and ignores the sketch preview and the verifier output', () => {
  const ignored = p => spawnSync('git', ['check-ignore', '-q', p], { cwd: REPO }).status === 0;
  for (const f of ['preview.html', 'verifier-output/report.json', 'verifier-output/screenshot-375.png']) assert.ok(ignored(`pages/beispiel-seite/${f}`), f);
  for (const f of ['index.html', 'stylesheet.css', 'handoff.md']) assert.ok(!ignored(`pages/beispiel-seite/${f}`), f);
});

test('SKILL.md documents steps 5 to 7 and points to the reference; the reference covers the ticket', () => {
  const skill = fs.readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8');
  assert.doesNotMatch(skill, /described when those steps land/);
  for (const needle of ['5. **Build**', '6. **Verify**', '7. **Handoff**', 'references/build-verify-handoff.md', 'handoff.mjs']) assert.ok(skill.includes(needle), needle);
  const ref = fs.readFileSync(path.join(SKILL, 'references', 'build-verify-handoff.md'), 'utf8');
  for (const needle of ['skeleton/page', 'ods-import-script', '--iterate', '3 iterations', '375', '1200', 'CI Rules', 'not passing', 'never commit', 'Embed Caption', 'Sharing tab', 'about 30'])
    assert.ok(ref.toLowerCase().includes(needle.toLowerCase()), needle);
});
