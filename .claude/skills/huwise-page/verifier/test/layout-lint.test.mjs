// Layout lint (#21): the footer is mandatory, charts and maps need a fixed-height parent, and content
// elements never carry a fixed width above 375px. Offline: lint only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = import.meta.dirname;
const CLI = path.join(here, '..', 'verify.mjs');
const ARGS = ['--target-height', '800', '--embed-size', 'gross', '--no-dry-run', '--skip-render'];

function run(fixture) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-layout-'));
  fs.cpSync(path.join(here, 'fixtures', fixture), dir, { recursive: true });
  const r = spawnSync('node', [CLI, dir, ...ARGS], { encoding: 'utf8' });
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'verifier-output', 'report.json'), 'utf8'));
  return { ...r, report };
}
const summary = report => report.findings.map(f => [f.rule, f.severity, f.location.file, f.location.line]);

const mustFail = [
  ['missing-footer', 'missing-footer', 'index.html', 1],
  ['chart-without-fixed-height', 'no-fixed-height', 'index.html', 3],
  ['fixed-width-600', 'fixed-width-too-wide', 'stylesheet.css', 2],
];
for (const [fixture, rule, file, line] of mustFail) {
  test(`${fixture}: exactly one ${rule} error at ${file}:${line}, exit 1`, () => {
    const r = run(fixture);
    assert.equal(r.status, 1);
    assert.deepEqual(summary(r.report), [[rule, 'error', file, line]]);
  });
}

for (const fixture of ['allowed-chart-fixed-parents', 'allowed-footer-only', 'allowed-wide-table-in-scroll']) {
  test(`${fixture} passes lint`, () => {
    const r = run(fixture);
    assert.equal(r.status, 0, r.stdout);
    assert.deepEqual(r.report.findings, []);
  });
}
