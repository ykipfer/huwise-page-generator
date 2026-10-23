// Owner decisions on the #24/#25 findings (spec #16). Offline: static checks of the shared CSS, the Pattern
// texts and the render stage's guarded-variable signal. The render behaviour itself is tested in render.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REFERENCES = path.join(import.meta.dirname, '..', '..', 'references');
const read = (...p) => fs.readFileSync(path.join(REFERENCES, ...p), 'utf8');
const BASE_CSS = read('base-stylesheet.css');
const INSTANCES = fs.readdirSync(path.join(REFERENCES, 'patterns', 'instances'));
const rulePattern = /\.hw-page \.chart-timezone-caption \{ display: none; \}|\.hw-page \.ods-simple-tabs-nav|\.hw-page \.hw-empty/;

test('the base stylesheet carries the timezone-caption rule, the ods-simple-tabs bar and .hw-empty', () => {
  assert.match(BASE_CSS, /\.hw-page \.chart-timezone-caption \{ display: none; \}/);
  assert.match(BASE_CSS, /\.hw-page \.ods-simple-tabs-nav \{[^}]*overflow-x: auto;[^}]*overflow-y: hidden;/);
  assert.match(BASE_CSS, /\.hw-page \.ods-simple-tabs-nav-link\.ods-simple-tabs-nav-link-active/);
  assert.match(BASE_CSS, /\.hw-page \.hw-empty \{[^}]*border: 1px dashed var\(--hw-rule\)/);
});

test('.ods-simple-tabs-nav is an allowed scroll container', () => {
  assert.ok(JSON.parse(read('scroll-containers.json')).selectors.includes('.ods-simple-tabs-nav'));
});

test('no Pattern file and no instance repeats the CSS that moved into the base stylesheet', () => {
  for (const f of ['06-chart.md', '08-tabs.md', '14-empty-state.md'])
    assert.ok(!rulePattern.test(read('patterns', f)), `${f} still carries the moved CSS`);
  for (const name of INSTANCES) {
    const dir = path.join(REFERENCES, 'patterns', 'instances', name);
    const css = read('patterns', 'instances', name, 'stylesheet.css');
    assert.ok(!rulePattern.test(css.slice(BASE_CSS.length)), `${name}/stylesheet.css repeats the moved CSS after the base`);
    if (fs.existsSync(path.join(dir, 'extra.css')))
      assert.ok(!rulePattern.test(read('patterns', 'instances', name, 'extra.css')), `${name}/extra.css repeats the moved CSS`);
  }
});

test('an instance stylesheet is base + target height + its extra.css, when it has one', () => {
  for (const name of INSTANCES) {
    const css = read('patterns', 'instances', name, 'stylesheet.css');
    assert.ok(css.startsWith(BASE_CSS), `${name} does not start with the current base stylesheet`);
    if (!fs.existsSync(path.join(REFERENCES, 'patterns', 'instances', name, 'extra.css'))) continue;   // inline extras are not separately kept
    const rest = css.slice(BASE_CSS.length).replace('.hw-page { --target-height: 800px; }\n', '');
    assert.equal(rest.trim(), read('patterns', 'instances', name, 'extra.css').trim(), `${name}: stylesheet.css is not base + target height + extra.css`);
  }
});

test('stacked charts: the top 7 and a KPI for the rest, with no claim of an "Übrige" series', () => {
  const chart = read('patterns', '06-chart.md');
  assert.match(chart, /shows the 7 largest categories, and the rest goes into a KPI/);
  assert.match(chart, /There is no "Übrige" series in a stacked chart/);
  assert.match(read('rulebook.md'), /stacked chart[^\n]*7 largest[^\n]*KPI[^\n]*no "Übrige" series/);
  assert.match(read('core.md'), /stacked chart\*\* with more than 7 categories[^\n]*KPI[^\n]*no "Übrige" series/);
  for (const f of ['core.md', 'rulebook.md', 'page-sketch.md'])
    assert.ok(!/group[^\n]*into "Übrige"/.test(read(f)), `${f} still says to group into "Übrige"`);
});

test('the guarded-variable warning is documented and implemented', () => {
  for (const f of [['core.md'], ['patterns', '14-empty-state.md']])
    assert.ok(read(...f).includes('widget-variable-guarded'), `${f.join('/')} does not document widget-variable-guarded`);
  const render = fs.readFileSync(path.join(import.meta.dirname, '..', 'render.mjs'), 'utf8');
  assert.match(render, /rule: 'widget-variable-guarded', warning: true/);
  // NaN stays an error: the guarded branch only excuses unset, null and empty arrays
  assert.match(render, /guarded\.includes\(name\) && \(v === undefined \|\| v === null \|\| \(Array\.isArray\(v\) && v\.length === 0\)\)/);
});
