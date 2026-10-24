// The skeleton Page (#28): one complete Page in the CI look showing how Patterns combine. It passes the whole
// verifier at every test width and Embed Size, at 800px and at a smaller Target Height. Network-bound like
// render.test.mjs; needs the ods-widgets checkout (ODS_WIDGETS_DIR).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = import.meta.dirname;
const CLI = path.join(here, '..', 'verify.mjs');
const REFS = path.join(here, '..', '..', 'references');
const SKELETON = path.join(REFS, 'skeleton', 'page');
const read = (...p) => fs.readFileSync(path.join(REFS, ...p), 'utf8');
const html = fs.readFileSync(path.join(SKELETON, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(SKELETON, 'stylesheet.css'), 'utf8');
const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-cache-'));
const SMALL = 750;

// the Page's own line, not the same text in the base stylesheet's header comment
function withHeight(height) {
  const own = '\n.hw-page { --target-height: 800px; }\n';
  const at = css.lastIndexOf(own);
  return css.slice(0, at) + own.replace('800px', `${height}px`) + css.slice(at + own.length);
}

function verify(height, embedSize) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-skeleton-page-'));
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, 'stylesheet.css'), withHeight(height));
  const r = spawnSync('node', [CLI, dir, '--target-height', String(height), '--embed-size', embedSize], {
    encoding: 'utf8', env: { ...process.env, VERIFIER_CACHE_DIR: cacheDir },
  });
  return { ...r, report: JSON.parse(fs.readFileSync(path.join(dir, 'verifier-output', 'report.json'), 'utf8')) };
}

test('skeleton Page stylesheet is the base stylesheet verbatim plus the Target Height and Pattern 9 CSS', () => {
  const base = read('base-stylesheet.css');
  assert.ok(css.startsWith(base));
  assert.match(css.slice(base.length), /^\s*\.hw-page \{ --target-height: 800px; \}\n/);
  assert.equal(css.slice(base.length).match(/--target-height:/g).length, 1);
});

test('skeleton Page has no hard-coded year, no custom JS and the contexts follow the naming convention', () => {
  const markup = html.replace(/<!--[\s\S]*?-->/g, '');
  assert.doesNotMatch(markup, /\b(19|20)\d\d\b/);
  assert.doesNotMatch(markup, /<script|ods-import-script/);
  for (const name of ['yearctx', 'datactx', 'geoctx']) assert.ok(markup.includes(name), name);
  assert.match(markup, /context="datactx, geoctx"/);
});

test('skeleton Page combines the Patterns: latest period, KPI, filter, chart, tabs, choropleth, footer', () => {
  for (const needle of ['ods-facet-results-sort="-num"', 'ods-aggregation=', 'ods-select', 'ods-chart-query', 'ods-simple-tabs',
    'ods-color-gradient=', 'color-by-field="bfs_nummer"', 'class="hw-footer"'])
    assert.ok(html.includes(needle), needle);
  assert.doesNotMatch(html, /join-context|local-key|remote-key/);
});

for (const height of [800, SMALL])
  for (const [embed, widths] of [['gross', [375, 720, 1200]], ['klein', [375, 720]]])
    test(`skeleton Page passes the verifier at ${embed} ${widths.join('/')} with Target Height ${height}px`, () => {
      const r = verify(height, embed);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.deepEqual(r.report.findings.filter(f => f.severity === 'error'), []);
      // the one allowed warning: the latest-period default is computed at runtime (Pattern 3, Pattern 9)
      assert.deepEqual([...new Set(r.report.findings.map(f => f.rule))], ['dry-run-key-coverage-filter-ignored']);
      for (const stage of ['lint', 'dryRun', 'render']) assert.equal(r.report.stages[stage].status, 'pass', stage);
      assert.deepEqual(r.report.stages.render.screenshots.map(s => s.width), widths);
      if (embed === 'gross') assert.ok(r.report.stages.render.states.some(s => s.label === 'tab "Karte"'));
    });
