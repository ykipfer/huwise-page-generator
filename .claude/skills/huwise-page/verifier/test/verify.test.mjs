import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = import.meta.dirname;
const CLI = path.join(here, '..', 'verify.mjs');

// Copy a fixture into a temp dir so runs never write into the repo.
function run(fixture, extraArgs = ['--target-height', '800', '--embed-size', 'gross']) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-'));
  fs.cpSync(path.join(here, 'fixtures', fixture), dir, { recursive: true });
  const r = spawnSync('node', [CLI, dir, ...extraArgs], { encoding: 'utf8' });
  const jsonPath = path.join(dir, 'verifier-output', 'report.json');
  const report = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : null;
  return { ...r, dir, report };
}

const summary = report => report.findings.map(f => [f.rule, f.severity, f.location.file, f.location.line]);

test('clean Page passes with exit 0 and writes JSON and Markdown reports', () => {
  const r = run('clean');
  assert.equal(r.status, 0);
  assert.deepEqual(r.report.findings, []);
  assert.equal(r.report.targetHeight, 800);
  assert.equal(r.report.embedSize, 'Gross');
  assert.ok(fs.existsSync(path.join(r.dir, 'verifier-output', 'report.md')));
});

const refused = [
  ['refused-style', 'refused-style', 'index.html', 2],
  ['refused-script', 'refused-script', 'index.html', 2],
  ['refused-form', 'refused-form', 'index.html', 2],
  ['refused-object', 'refused-object', 'index.html', 2],
  ['refused-iframe', 'refused-iframe', 'index.html', 2],
  ['refused-onclick', 'refused-on-attribute', 'index.html', 2],
  ['refused-javascript-url', 'refused-javascript-url', 'index.html', 2],
  ['refused-css-import', 'refused-css-import', 'stylesheet.css', 2],
  ['refused-css-import-in-comment', 'refused-css-import', 'stylesheet.css', 2],
];
for (const [fixture, rule, file, line] of refused) {
  test(`${fixture}: exactly one ${rule} error at ${file}:${line}, exit 1`, () => {
    const r = run(fixture);
    assert.equal(r.status, 1);
    assert.deepEqual(summary(r.report), [[rule, 'error', file, line]]);
  });
}

test('refused tags only inside an HTML comment pass', () => {
  const r = run('allowed-tags-in-html-comment');
  assert.equal(r.status, 0);
  assert.deepEqual(r.report.findings, []);
});

test('on-change on an ods-* Widget passes (clean fixture carries ods-select on-change)', () => {
  assert.equal(run('clean').status, 0);
});

test('bad usage exits 2', () => {
  assert.equal(run('clean', ['--target-height', 'abc', '--embed-size', 'gross']).status, 2);
  assert.equal(run('clean', ['--target-height', '800', '--embed-size', 'huge']).status, 2);
});

test('the verifier-output folder is gitignored', () => {
  const r = spawnSync('git', ['check-ignore', '-q', 'some-page/verifier-output/report.json'], { cwd: here });
  assert.equal(r.status, 0);
});
