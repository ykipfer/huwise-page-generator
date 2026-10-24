// Base stylesheet, rulebook, Pattern 15 and the static skeletons (#21). The render tests are network-bound
// like render.test.mjs: a real browser, the portal's platform config and the gitignored ods-widgets checkout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = import.meta.dirname;
const CLI = path.join(here, '..', 'verify.mjs');
const REFERENCES = path.join(here, '..', '..', 'references');
const read = (...p) => fs.readFileSync(path.join(REFERENCES, ...p), 'utf8');
const BASE_CSS = read('base-stylesheet.css');
const BASE = JSON.parse(read('base-stylesheet.json'));
const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-cache-'));

// ---------- the base stylesheet ----------
test('base stylesheet carries every colour, font, card and size value of the CI Rules', () => {
  const css = BASE_CSS.toLowerCase();
  for (const value of ['#2d2d8a', '#e7e7f2', '#111111', '#2a2a2a', '#6b6b6b', '#d9d9d6', '#fbfaf7', '#ffffff',
    '#2f7d4f', '#ddeedf', '#b47a12', '#f4ead6', '#c8102e', '#f7e1e4', '#4f8e94', '#e2f0f1',
    "'eudoxus sans', \"helvetica neue\", helvetica, arial, sans-serif",
    'border-radius: 12px', 'box-shadow: 0 3px 14px rgba(26, 26, 26, 0.08)', 'border-top: 4px solid',
    'border-radius: 4px', 'font-size: 26px', 'letter-spacing: 0.18em', 'max-width: 1200px',
    'max(280px,', 'max(240px,', 'max(200px,'])
    assert.ok(css.includes(value), `missing ${value}`);
  assert.ok(/@font-face/.test(css));
});

test('base stylesheet has no @import, no gradient and no viewport units', () => {
  assert.ok(!/@import/i.test(BASE_CSS));
  assert.ok(!/gradient\s*\(/i.test(BASE_CSS));
  assert.ok(!/\dvh\b/i.test(BASE_CSS));
});

test('base stylesheet uses only the breakpoints 720px and 480px', () => {
  const widths = [...BASE_CSS.matchAll(/@media[^{]*\(max-width:\s*(\d+)px\)/g)].map(m => Number(m[1]) + 1);
  assert.deepEqual([...new Set(widths)].sort(), [480, 720]);
});

test('every style rule is scoped under the root class', () => {
  const code = BASE_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...code.matchAll(/([^{}]+)\{[^{}]*\}/g)].map(m => m[1].trim()).filter(s => !s.startsWith('@'));
  assert.ok(selectors.length > 40);
  for (const selector of selectors.flatMap(s => s.split(',').map(x => x.trim())))
    assert.ok(selector.startsWith(`.${BASE.rootClass}`), `unscoped selector: ${selector}`);
});

test('base stylesheet defines the footer marker, the height-bearing areas and the scroll containers', () => {
  const scroll = JSON.parse(read('scroll-containers.json')).selectors;
  for (const cls of [BASE.footerClass, ...BASE.fixedHeightClasses, ...scroll.map(s => s.slice(1))])
    assert.ok(new RegExp(`\\.${cls}(?![\\w-])`).test(BASE_CSS), `.${cls} is not defined`);
  for (const cls of BASE.fixedHeightClasses)
    assert.match(BASE_CSS, new RegExp(`\\.${cls}\\s*\\{[^}]*height:\\s*(max|calc|min)\\(`));
  assert.ok(!scroll.includes('.table-scroll') && !scroll.includes('.tabs-scroll'), 'stand-in selectors are gone');
});

test('the rulebook covers chart colours, status colours and content rules', () => {
  const rulebook = read('rulebook.md');
  for (const text of ['#2D2D8A, #E69F00, #009E73, #56B4E9, #CC79A7, #0072B2, #D55E00', '#6B6B6B', 'Übrige', 'Red is never a category colour',
    '#E7E7F2', '#2F7D4F', 'real rating', 'de-ch', 'Dez 2026', 'exclamation marks', 'emoji', 'German only'])
    assert.ok(rulebook.includes(text), `rulebook lacks ${text}`);
});

test('the Pattern 15 file has the five Pattern sections and the footer snippet', () => {
  const pattern = read('patterns', '15-footer.md');
  for (const heading of ['## Job', '## Widgets', '## Snippet', '## Pitfalls', '## Source Example Page'])
    assert.ok(pattern.includes(heading), `Pattern 15 lacks ${heading}`);
  assert.ok(pattern.includes(`class="${BASE.footerClass}"`));
  assert.ok(pattern.includes('Letzte Aktualisierung'));
  assert.ok(/\{[a-z_]+\}/.test(pattern), 'snippet has {snake_case} placeholders');
});

// ---------- the static skeletons ----------
const SHAPES = ['sidebar-main', 'card-grid', 'single'];
const TARGET = /\.hw-page \{ --target-height: 800px; \}\n$/;   // the Page's own line, at the end

test('each skeleton stylesheet is the base stylesheet verbatim plus the Target Height', () => {
  for (const shape of SHAPES) {
    const css = read('skeleton', shape, 'stylesheet.css');
    assert.ok(css.startsWith(BASE_CSS), `${shape} does not start with the base stylesheet`);
    assert.equal(css.slice(BASE_CSS.length).trim(), '.hw-page { --target-height: 800px; }');
  }
});

test('each skeleton is Widget-free and carries the footer', () => {
  for (const shape of SHAPES) {
    const html = read('skeleton', shape, 'index.html');
    assert.ok(!/<ods-|ods-[a-z-]+=/.test(html.replace(/<!--[\s\S]*?-->/g, '')), `${shape} has Widgets`);
    assert.ok(html.includes(`class="${BASE.footerClass}"`));
  }
});

function verify(dir, targetHeight, embedSize) {
  const r = spawnSync('node', [CLI, dir, '--target-height', String(targetHeight), '--embed-size', embedSize, '--no-dry-run'],
    { encoding: 'utf8', env: { ...process.env, VERIFIER_CACHE_DIR: cacheDir } });
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'verifier-output', 'report.json'), 'utf8'));
  return { ...r, report };
}
function pageDir({ html, css }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-skeleton-'));
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, 'stylesheet.css'), css);
  return dir;
}
const skeleton = (shape, height = 800) => ({
  html: read('skeleton', shape, 'index.html'),
  css: read('skeleton', shape, 'stylesheet.css').replace(TARGET, `.hw-page { --target-height: ${height}px; }\n`),
});
const widthsOf = r => r.report.stages.render.screenshots.map(s => s.width);

for (const shape of SHAPES)
  for (const height of [800, 700])
    for (const [embed, widths] of [['gross', [375, 720, 1200]], ['klein', [375, 720]]])
      test(`skeleton ${shape} passes clean at ${embed} ${widths.join('/')} with Target Height ${height}px`, () => {
        const r = verify(pageDir(skeleton(shape, height)), height, embed);
        assert.equal(r.status, 0, r.stdout + JSON.stringify(r.report.findings));
        assert.deepEqual(r.report.findings, []);
        assert.deepEqual(widthsOf(r), widths);
      });

test('changing only --target-height re-lays out the whole skeleton', () => {
  for (const shape of SHAPES) {
    // the CSS says 800px but the Page is shown in 700px: too tall, so the layout follows the CSS value
    const tall = verify(pageDir(skeleton(shape, 800)), 700, 'gross');
    assert.deepEqual(tall.report.findings.map(f => f.rule), ['content-too-tall'], shape);
    // the same files with only the custom property changed fit
    const fit = verify(pageDir(skeleton(shape, 700)), 700, 'gross');
    assert.deepEqual(fit.report.findings, [], shape);
  }
});

test('a table wider than 375px inside the table-scroll wrapper passes at 375px', () => {
  const fixture = path.join(here, 'fixtures', 'render-wide-table-in-scroll');
  const dir = pageDir({
    html: fs.readFileSync(path.join(fixture, 'index.html'), 'utf8'),
    css: `${BASE_CSS}\n${fs.readFileSync(path.join(fixture, 'stylesheet.css'), 'utf8')}`,
  });
  const r = verify(dir, 800, 'gross');
  assert.equal(r.status, 0, r.stdout + JSON.stringify(r.report.findings));
  assert.deepEqual(r.report.findings, []);
  assert.deepEqual(widthsOf(r), [375, 720, 1200]);
});
