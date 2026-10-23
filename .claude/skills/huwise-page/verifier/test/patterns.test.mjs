// Filter Patterns 1, 2, 3 (both variants), 4 and 14 (#24). "No Pattern without a proven instance": every Pattern
// has an instance Page on a real data.gr.ch dataset, and the verifier passes it clean at every width. The
// verifier runs are network-bound like render.test.mjs (real browser, portal config, gitignored ods-widgets checkout).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = import.meta.dirname;
const CLI = path.join(here, '..', 'verify.mjs');
const REFERENCES = path.join(here, '..', '..', 'references');
const PATTERNS = path.join(REFERENCES, 'patterns');
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const BASE_CSS = read(REFERENCES, 'base-stylesheet.css');
const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-cache-'));

const PATTERN_FILES = {
  1: '01-dropdown-from-facet.md',
  2: '02-dropdown-from-group-by.md',
  3: '03-latest-period.md',
  4: '04-copy-filter.md',
  14: '14-empty-state.md',
};
// Which Pattern each instance proves, and what must be in its markup.
const INSTANCES = {
  'p01-dropdown-from-facet': { pattern: 1, has: ["'disjunctive.anlagetyp': true", 'ods-facet-results-facet-name="anlagetyp"', "datactx.parameters['refine.anlagetyp']", 'value-modifier="name"'] },
  'p02-dropdown-from-group-by': { pattern: 2, has: ['ods-adv-analysis-group-by="region"', 'ods-adv-analysis-limit="20"', 'ods-adv-analysis-context="optctx"'] },
  'p03a-latest-period-facet': { pattern: 3, has: ['ods-facet-results-sort="-num"', 'ng-if="jahre.length"', "'refine.jahr': ''+jahre[0].name"] },
  'p03b-latest-period-max': { pattern: 3, has: ['max(datum) as datum', "datactx.parameters['refine.jahr'].length ?", "moment:'YYYY'", 'ng-if="latest.length"'] },
  'p04-copy-filter': { pattern: 4, has: ["geoctx.parameters['refine.name'] = datactx.parameters['refine.region']"] },
  'p14-empty-state': { pattern: 14, has: ['!treffer || treffer.length === 0', 'Keine Daten für diese Auswahl', 'hw-empty'] },
};

// ---------- the Pattern files ----------
for (const [n, file] of Object.entries(PATTERN_FILES)) {
  test(`Pattern ${n} file has the five Pattern sections, placeholders and a proven instance`, () => {
    const text = read(PATTERNS, file);
    assert.ok(text.startsWith(`# Pattern ${n}:`), 'title');
    let at = -1;
    for (const heading of ['## Job', '## Widgets', '## Snippet', '## Pitfalls', '## Source Example Page']) {
      const i = text.indexOf(heading, at + 1);
      assert.ok(i > at, `${file}: ${heading} missing or out of order`);
      at = i;
    }
    assert.ok(/\{[a-z_]+\}/.test(text), 'snippet has {snake_case} placeholders');
    assert.ok(text.includes('```html'), 'snippet is HTML');
    const proven = Object.entries(INSTANCES).filter(([, i]) => i.pattern === Number(n)).map(([name]) => name);
    assert.ok(proven.length, `no instance proves Pattern ${n}`);
    for (const name of proven) assert.ok(text.includes(`patterns/instances/${name}/`), `${file} does not name ${name}`);
  });
}

test('Pattern 3 has both variants, and every Pattern names its Example Page', () => {
  const three = read(PATTERNS, PATTERN_FILES[3]);
  assert.ok(/## Snippet: Variant A/.test(three) && /## Snippet: Variant B/.test(three));
  for (const file of Object.values(PATTERN_FILES)) assert.ok(/page_examples\//.test(read(PATTERNS, file)), `${file} names no Example Page`);
});

test('the Patterns record the pitfalls the instances taught', () => {
  const all = Object.fromEntries(Object.entries(PATTERN_FILES).map(([n, f]) => [n, read(PATTERNS, f)]));
  assert.ok(/disjunctive/.test(all[1]) && /without/i.test(all[1]));
  assert.ok(/ods-adv-analysis-limit/.test(all[2]) && /separate context/i.test(all[2]) && /optctx/.test(all[2]));
  assert.ok(/parameters-from-context/.test(all[4]) && /whole parameter object/.test(all[4]));
  assert.ok(/\.length/.test(all[3]) && /\[\]/.test(all[3]) && /array/i.test(all[3]));
  assert.ok(/!x \|\| x\.length === 0/.test(all[14]));
});

test('core.md lists the filter Patterns', () => {
  const core = read(REFERENCES, 'core.md');
  for (const file of Object.values(PATTERN_FILES)) assert.ok(core.includes(file), `core.md does not mention ${file}`);
});

// ---------- the instances ----------
for (const [name, { has }] of Object.entries(INSTANCES)) {
  const dir = path.join(PATTERNS, 'instances', name);

  test(`${name}: base stylesheet verbatim, markup as the Pattern shows, no year literal`, () => {
    const css = read(dir, 'stylesheet.css');
    assert.ok(css.startsWith(BASE_CSS), 'does not start with the base stylesheet');
    assert.ok(/\.hw-page \{ --target-height: 800px; \}/.test(css));
    const html = read(dir, 'index.html');
    for (const token of has) assert.ok(html.includes(token), `${name} lacks ${token}`);
    assert.ok(!/\b(19|20)\d{2}\b/.test(html.replace(/dvs_[a-z_]+\d+/g, '')), 'a year literal');
    assert.ok(html.includes('class="hw-footer"'));
  });

  test(`${name}: the verifier passes it with no findings at 375, 720 and 1200px`, () => {
    const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-pattern-'));
    for (const f of ['index.html', 'stylesheet.css']) fs.copyFileSync(path.join(dir, f), path.join(copy, f));
    const r = spawnSync('node', [CLI, copy, '--target-height', '800', '--embed-size', 'gross'],
      { encoding: 'utf8', env: { ...process.env, VERIFIER_CACHE_DIR: cacheDir } });
    const report = JSON.parse(fs.readFileSync(path.join(copy, 'verifier-output', 'report.json'), 'utf8'));
    assert.equal(r.status, 0, r.stdout + r.stderr + JSON.stringify(report.findings));
    assert.deepEqual(report.findings, []);
    assert.deepEqual(report.stages.render.screenshots.map(s => s.width), [375, 720, 1200]);
    assert.equal(report.stages.dryRun.status, 'pass');
  });
}

test('the Pattern 14 instance reaches its empty-state message in a state the verifier explores', () => {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-pattern-'));
  const dir = path.join(PATTERNS, 'instances', 'p14-empty-state');
  for (const f of ['index.html', 'stylesheet.css']) fs.copyFileSync(path.join(dir, f), path.join(copy, f));
  const r = spawnSync('node', [CLI, copy, '--target-height', '800', '--embed-size', 'gross', '--iterate'],
    { encoding: 'utf8', env: { ...process.env, VERIFIER_CACHE_DIR: cacheDir } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const report = JSON.parse(fs.readFileSync(path.join(copy, 'verifier-output', 'report.json'), 'utf8'));
  const labels = report.stages.render.states.map(s => s.label);
  // The year options come first, so the last year (2026) is selected when the month options run:
  // December 2026 has no data yet.
  assert.ok(labels.includes('ods-select option "2026"') && labels.includes('ods-select option "Dezember"'), labels.join(', '));
  assert.ok(labels.indexOf('ods-select option "2026"') < labels.indexOf('ods-select option "Dezember"'));
});
