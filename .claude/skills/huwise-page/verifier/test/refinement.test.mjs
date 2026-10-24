// Ticket #31: refinement in the same session. Static documentation checks, all offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => fs.readFileSync(path.join(SKILL, ...p), 'utf8');
const refinement = () => read('references', 'build-verify-handoff.md').split(/^## Refinement$/m)[1] ?? '';

test('there is exactly one Refinement section and it is the last of the reference', () => {
  const ref = read('references', 'build-verify-handoff.md');
  assert.equal(ref.match(/^## Refinement$/gm)?.length, 1);
  assert.ok(!/^## /m.test(refinement()), 'no section after Refinement');
});

test('a CSS-only refinement edits in place, re-runs every stage and rewrites the handoff', () => {
  const r = refinement();
  for (const needle of ['in place', 'CSS-only', 'every stage', 'handoff.mjs', 'handoff.md']) assert.ok(r.includes(needle), needle);
});

test('the 3-iteration cap resets for each refinement', () => {
  const r = refinement();
  assert.match(r, /fresh 3-iteration cap/);
  assert.match(r, /iteration 1/i);
});

test('a plan-changing refinement regenerates sketch and preview and waits for approval before building', () => {
  const r = refinement();
  for (const needle of ['Page Sketch', 'preview.mjs', 'plan list', 'ok', 'new Visualization']) assert.ok(r.includes(needle), needle);
  assert.match(r, /Nothing is built before the owner approves/);
});

test('SKILL.md points to the refinement workflow', () => {
  const skill = read('SKILL.md');
  assert.match(skill, /\*\*Refinement\*\*/);
  assert.ok(skill.includes('references/build-verify-handoff.md'));
});
