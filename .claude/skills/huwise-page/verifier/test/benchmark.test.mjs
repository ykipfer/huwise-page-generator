// Ticket #34: Benchmark mode and rubric scoring. Offline: run folder, pass rule, results, sketch aid, documentation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { REQUEST_SLUGS, parseRequest, initRun, passes, recordResult, confirmScores, resultsMarkdown, sketchAid } from '../benchmark.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..', '..');
const REPO = path.resolve(SKILL, '..', '..', '..');
const read = (...p) => fs.readFileSync(path.join(SKILL, ...p), 'utf8');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hw-bench-'));
const score = (a, b, c) => ({
  fidelity: { score: a, reason: 'r1' }, ciLayout: { score: b, reason: 'r2' }, sketchFidelity: { score: c, reason: 'r3' },
});
const report = (errors = 0, warnings = 0) => ({
  findings: [...Array(errors).fill({ severity: 'error' }), ...Array(warnings).fill({ severity: 'warning' })],
});

test('the six request files are known and parse into prompt, datasets and checklist', () => {
  assert.equal(REQUEST_SLUGS.length, 6);
  for (const slug of REQUEST_SLUGS) {
    const r = parseRequest(path.join(SKILL, 'benchmark', 'requests', `${slug}.md`));
    assert.equal(r.slug, slug);
    assert.ok(r.prompt.length > 20, slug);
    assert.ok(r.datasets.length >= 1, slug);
    assert.ok(r.checklist.length >= 3, slug);
  }
  assert.equal(parseRequest(path.join(SKILL, 'benchmark', 'requests', 'zweitwohnungsanteil.md')).datasets.length, 2);
});

test('pass rule: no errors, at most 3 iterations, at least 4/6 and no 0', () => {
  assert.equal(passes({ report: report(), iterations: 1, scores: score(2, 1, 1) }).pass, true);
  assert.equal(passes({ report: report(0, 5), iterations: 3, scores: score(2, 2, 0) }).pass, false, 'a 0 fails');
  assert.equal(passes({ report: report(), iterations: 1, scores: score(1, 1, 1) }).pass, false, '3/6 fails');
  assert.equal(passes({ report: report(), iterations: 1, scores: score(2, 1, 1) }).total, 4);
  assert.equal(passes({ report: report(1), iterations: 1, scores: score(2, 2, 2) }).pass, false, 'an error fails');
  assert.equal(passes({ report: report(), iterations: 4, scores: score(2, 2, 2) }).pass, false, 'iteration 4 fails');
  const warn = passes({ report: report(0, 7), iterations: 2, scores: score(2, 2, 2) });
  assert.equal(warn.pass, true);
  assert.equal(warn.warnings, 7, 'warnings are counted, not failed');
});

test('initRun makes a dated run folder, one folder per slug, and refuses the Pages directory', () => {
  const runs = tmp();
  const a = initRun({ slugs: ['zweitwohnungsanteil'], runsDir: runs, date: '2026-10-24' });
  assert.equal(path.basename(a.runDir), '2026-10-24');
  assert.deepEqual(a.pages.map(p => path.basename(p)), ['zweitwohnungsanteil']);
  assert.ok(fs.existsSync(a.pages[0]));
  const b = initRun({ slugs: [], runsDir: runs, date: '2026-10-24' });
  assert.equal(path.basename(b.runDir), '2026-10-24-2', 'a second run on the same day gets a suffix');
  assert.equal(b.pages.length, 6, 'no slug means all six');
  assert.throws(() => initRun({ slugs: ['nope'], runsDir: runs, date: '2026-10-24' }), /Unknown benchmark request/);
  assert.throws(() => initRun({ slugs: [], runsDir: path.join(REPO, 'pages'), date: '2026-10-24' }), /Pages directory/);
  assert.throws(() => initRun({ slugs: [], runsDir: path.join(REPO, 'pages', 'x'), date: '2026-10-24' }), /Pages directory/);
});

test('the default run folder is gitignored and not in pages/', () => {
  const ignored = spawnSync('git', ['check-ignore', '-q', path.join(SKILL, 'benchmark', 'runs', '2026-10-24', 'x', 'index.html')], { cwd: REPO });
  assert.equal(ignored.status, 0);
});

test('recordResult writes result.json with flags, scores, iterations and warnings, and computes pass', () => {
  const { pages } = initRun({ slugs: ['zweitwohnungsanteil'], runsDir: tmp(), date: '2026-10-24' });
  const dir = pages[0];
  fs.mkdirSync(path.join(dir, 'verifier-output'));
  fs.writeFileSync(path.join(dir, 'verifier-output', 'report.json'), JSON.stringify(report(0, 2)));
  assert.throws(() => recordResult({ pageDir: dir, iterations: 1, flags: [], scores: score(2, 2, 2) }), /Page Sketch/, 'kept sketch is required');
  fs.mkdirSync(path.join(dir, 'sketch'));
  fs.writeFileSync(path.join(dir, 'sketch', 'index.html'), '<div></div>');
  assert.throws(() => recordResult({ pageDir: dir, iterations: 1, flags: [], scores: { ...score(2, 2, 2), ciLayout: { score: 3, reason: 'x' } } }), /0, 1 or 2/);
  assert.throws(() => recordResult({ pageDir: dir, iterations: 1, flags: [], scores: { ...score(2, 2, 2), fidelity: { score: 2, reason: '' } } }), /reason/);
  const r = recordResult({ pageDir: dir, iterations: 2, flags: ['Companion Dataset needed: Beherbergungsstatistik'], scores: score(2, 1, 2) });
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8'));
  assert.equal(saved.pass, true);
  assert.equal(saved.warnings, 2);
  assert.equal(saved.iterations, 2);
  assert.deepEqual(saved.flags, ['Companion Dataset needed: Beherbergungsstatistik']);
  assert.equal(saved.scores.ciLayout.score, 1);
  assert.equal(saved.confirmed, false);
  assert.equal(r.pass, true);
});

test('recordResult fails a run with no verifier report', () => {
  const { pages } = initRun({ slugs: ['zweitwohnungsanteil'], runsDir: tmp(), date: '2026-10-24' });
  fs.mkdirSync(path.join(pages[0], 'sketch'));
  fs.writeFileSync(path.join(pages[0], 'sketch', 'index.html'), '<div></div>');
  assert.throws(() => recordResult({ pageDir: pages[0], iterations: 1, flags: [], scores: score(2, 2, 2) }), /verifier report/);
});

function recorded(slug, scores, { errors = 0, iterations = 1, runDir } = {}) {
  const dir = path.join(runDir, slug);
  fs.mkdirSync(path.join(dir, 'verifier-output'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'sketch'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'sketch', 'index.html'), '<div></div>');
  fs.writeFileSync(path.join(dir, 'verifier-output', 'report.json'), JSON.stringify(report(errors, 1)));
  return recordResult({ pageDir: dir, iterations, flags: slug === 'arbeitsmarkt-seit-1993' ? ['content dropped to fit the Target Height: Tab 2'] : [], scores });
}

test('confirmScores confirms all in one pass and applies overrides, recomputing pass', () => {
  const { runDir } = initRun({ slugs: ['arbeitsmarkt-seit-1993', 'zweitwohnungsanteil'], runsDir: tmp(), date: '2026-10-24' });
  recorded('arbeitsmarkt-seit-1993', score(2, 2, 1), { runDir });
  recorded('zweitwohnungsanteil', score(2, 1, 1), { runDir });
  const out = confirmScores({ runDir, overrides: [{ slug: 'zweitwohnungsanteil', criterion: 'ciLayout', score: 0, reason: 'Karte leer bei 375px' }] });
  const get = s => JSON.parse(fs.readFileSync(path.join(runDir, s, 'result.json'), 'utf8'));
  assert.equal(get('arbeitsmarkt-seit-1993').confirmed, true);
  assert.equal(get('zweitwohnungsanteil').confirmed, true);
  assert.equal(get('zweitwohnungsanteil').pass, false, 'override of a score to 0 fails the request');
  assert.equal(get('zweitwohnungsanteil').scores.ciLayout.overridden, true);
  assert.equal(get('zweitwohnungsanteil').scores.ciLayout.agentScore, 1);
  assert.equal(get('arbeitsmarkt-seit-1993').scores.ciLayout.overridden, undefined);
  assert.equal(out.length, 2);
  assert.throws(() => confirmScores({ runDir, overrides: [{ slug: 'zweitwohnungsanteil', criterion: 'bogus', score: 1, reason: 'x' }] }), /criterion/);
});

test('resultsMarkdown lists per request pass/fail, iterations, warnings, scores and flags; unconfirmed is marked', () => {
  const { runDir } = initRun({ slugs: ['arbeitsmarkt-seit-1993', 'zweitwohnungsanteil'], runsDir: tmp(), date: '2026-10-24' });
  recorded('arbeitsmarkt-seit-1993', score(2, 2, 1), { runDir });
  recorded('zweitwohnungsanteil', score(1, 1, 1), { runDir, iterations: 3 });
  const md = resultsMarkdown(runDir);
  assert.match(md, /\| arbeitsmarkt-seit-1993 \| PASS \| 1 \| 1 \| 2 \| 2 \| 1 \| 5\/6 \|/);
  assert.match(md, /\| zweitwohnungsanteil \| FAIL \| 3 \| 1 \| 1 \| 1 \| 1 \| 3\/6 \|/);
  assert.match(md, /content dropped to fit the Target Height/);
  assert.match(md, /r1/, 'one-line reasons are listed');
  assert.match(md, /awaiting the owner/i);
  assert.match(md, /1 of 2 passed/);
  confirmScores({ runDir, overrides: [] });
  assert.doesNotMatch(resultsMarkdown(runDir), /awaiting the owner/i);
});

test('a request that was never recorded shows as not run', () => {
  const { runDir } = initRun({ slugs: ['zweitwohnungsanteil'], runsDir: tmp(), date: '2026-10-24' });
  assert.match(resultsMarkdown(runDir), /\| zweitwohnungsanteil \| NOT RUN/);
});

test('sketchAid reports sketch containers and labels missing from the final Page', () => {
  const sketch = '<div class="hw-page hw-shape-sidebar"><div class="hw-kpi">K</div><div class="hw-chart-area"><div class="hw-placeholder">Säulendiagramm: Ausgaben</div></div><div class="hw-footer">F</div></div>';
  const same = '<div class="hw-page hw-shape-sidebar"><div class="hw-kpi">K</div><div class="hw-chart-area"><ods-chart label-y="Säulendiagramm: Ausgaben"></ods-chart></div><div class="hw-footer">F</div></div>';
  assert.deepEqual(sketchAid(sketch, same), { missingClasses: [], missingLabels: [] });
  const changed = '<div class="hw-page hw-shape-single"><div class="hw-footer">F</div><div class="hw-kpi">K</div><div class="hw-map-area">Karte</div></div>';
  const aid = sketchAid(sketch, changed);
  assert.ok(aid.missingClasses.includes('hw-shape-sidebar'));
  assert.ok(aid.missingClasses.includes('hw-chart-area'));
  assert.deepEqual(aid.missingLabels, ['Säulendiagramm: Ausgaben']);
});

test('sketchAid ignores the sketch-only stand-ins for tabs and filter controls', () => {
  const sketch = '<div class="hw-page"><div class="hw-filter"><div class="hw-filter-control">Alle</div></div><div class="hw-tabs"><span class="hw-tab is-active">A</span></div></div>';
  const built = '<div class="hw-page"><div class="hw-filter"><ods-select></ods-select></div><ods-simple-tabs></ods-simple-tabs></div>';
  assert.deepEqual(sketchAid(sketch, built).missingClasses, []);
});

test('CLI: init, sketch snapshot, record, confirm and report run end to end offline', () => {
  const runs = tmp();
  const cli = (...a) => execFileSync('node', [path.join(HERE, '..', 'benchmark.mjs'), ...a], { encoding: 'utf8', env: { ...process.env, HW_BENCHMARK_RUNS: runs }, stdio: ['ignore', 'pipe', 'pipe'] });
  const out = JSON.parse(cli('init', 'zweitwohnungsanteil', '--date', '2026-10-24'));
  const dir = out.pages[0];
  fs.writeFileSync(path.join(dir, 'index.html'), '<div class="hw-page"></div>');
  fs.writeFileSync(path.join(dir, 'stylesheet.css'), '.a{}');
  cli('sketch', dir);
  assert.ok(fs.existsSync(path.join(dir, 'sketch', 'index.html')));
  fs.mkdirSync(path.join(dir, 'verifier-output'));
  fs.writeFileSync(path.join(dir, 'verifier-output', 'report.json'), JSON.stringify(report(0, 1)));
  const input = path.join(runs, 'in.json');
  fs.writeFileSync(input, JSON.stringify({ iterations: 1, flags: [], scores: score(2, 2, 2) }));
  assert.match(cli('record', dir, input), /PASS/);
  cli('confirm', out.runDir, '--override', 'zweitwohnungsanteil.ciLayout=1:Karte klein');
  assert.match(cli('report', out.runDir), /1 of 1 passed/);
  assert.ok(fs.existsSync(path.join(out.runDir, 'results.md')));
  assert.throws(() => cli('sketch', dir), /already/, 'the first sketch is kept, never overwritten');
});

test('documentation: SKILL.md and the benchmark reference describe benchmark mode', () => {
  const skill = read('SKILL.md');
  assert.match(skill, /\/huwise-page benchmark/);
  assert.ok(skill.includes('references/benchmark-mode.md'));
  const ref = read('references', 'benchmark-mode.md');
  for (const needle of ['180', 'auto-approve', 'no questions', 'plan-list flags', 'run folder', 'gitignored', '4/6', 'Pages directory',
    'benchmark.mjs', 'request fidelity', 'CI and layout', 'sketch fidelity', 'confirm', 'not a pixel target'])
    assert.ok(ref.toLowerCase().includes(needle.toLowerCase()), needle);
  assert.match(ref, /subset/i);
  assert.match(ref, /3 iterations/);
  assert.match(ref, /Warnings are counted, not failed/);
});
