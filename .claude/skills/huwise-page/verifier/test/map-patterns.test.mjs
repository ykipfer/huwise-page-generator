// Map Patterns 9-13 (#27): each Pattern file has the Pattern file format, and each has an instance Page on a
// real data.gr.ch dataset that passes the whole verifier (lint, dry-run with key coverage, render at every
// width and in every explored state). Network-bound like render.test.mjs; needs the ods-widgets checkout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = import.meta.dirname;
const CLI = path.join(here, '..', 'verify.mjs');
const PATTERNS = path.join(here, '..', '..', 'references', 'patterns');
const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-cache-'));

const PATTERN_FILES = {
  '09-choropleth': { warnings: ['dry-run-key-coverage-filter-ignored'] },
  '10-tooltip-tipctx': { warnings: ['dry-run-key-coverage-filter-ignored'] },
  '11-tooltip-record': { warnings: [] },
  '12-point-categories': { warnings: ['select-options-capped'] },
  '13-boundary-outlines': { warnings: [] },
};

function verifyInstance(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-instance-'));
  fs.cpSync(path.join(PATTERNS, 'instances', name), dir, { recursive: true });
  const r = spawnSync('node', [CLI, dir, '--target-height', '800', '--embed-size', 'gross'], {
    encoding: 'utf8', env: { ...process.env, VERIFIER_CACHE_DIR: cacheDir },
  });
  return { ...r, report: JSON.parse(fs.readFileSync(path.join(dir, 'verifier-output', 'report.json'), 'utf8')) };
}

for (const [name, { warnings }] of Object.entries(PATTERN_FILES)) {
  test(`Pattern file ${name} has the Pattern file sections, in order`, () => {
    const text = fs.readFileSync(path.join(PATTERNS, `${name}.md`), 'utf8');
    const headings = [...text.matchAll(/^## (.+)$/gm)].map(m => m[1]);
    assert.deepEqual(headings, ['Job', 'Widgets', 'Snippet', 'Pitfalls', 'Source Example Page']);
    assert.match(text, /^# Pattern \d+: /m);
  });

  test(`instance Page ${name} passes the verifier with no error at every width`, () => {
    const r = verifyInstance(name);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(r.report.findings.filter(f => f.severity === 'error'), []);
    assert.deepEqual([...new Set(r.report.findings.map(f => f.rule))].sort(), warnings);
    for (const stage of ['lint', 'dryRun', 'render']) assert.equal(r.report.stages[stage].status, 'pass', stage);
    assert.deepEqual(r.report.stages.render.screenshots.map(s => s.width), [375, 720, 1200]);
  });
}

test('Pattern 9 instance ran the key-coverage check against the Boundary Dataset', () => {
  const r = verifyInstance('09-choropleth');
  assert.ok(r.report.apiRequests >= 2, `${r.report.apiRequests} API requests`);
  assert.ok(!r.report.findings.some(f => f.rule === 'dry-run-key-coverage' || f.rule === 'dry-run-boundary-key-mismatch'));
});

test('Patterns 10 and 11 instances were explored by clicking a map shape', () => {
  for (const name of ['10-tooltip-tipctx', '11-tooltip-record'])
    assert.ok(verifyInstance(name).report.stages.render.states.some(s => s.label === 'map shape click'), name);
});

test('no instance Page uses the banned native join', () => {
  for (const name of Object.keys(PATTERN_FILES))
    assert.doesNotMatch(fs.readFileSync(path.join(PATTERNS, 'instances', name, 'index.html'), 'utf8'), /join-context|local-key|remote-key/);
});
