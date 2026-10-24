// Benchmark mode helper for the huwise-page skill (ticket #34). Offline: no network, no browser.
// Usage:
//   node benchmark.mjs init [slug...] [--date YYYY-MM-DD]    make the dated run folder, one Page folder per request (prints JSON)
//   node benchmark.mjs sketch <page-dir>                      keep the approved first Page Sketch (once, never overwritten)
//   node benchmark.mjs aid <page-dir>                         list sketch containers/labels missing from the final Page
//   node benchmark.mjs record <page-dir> <scores.json>        write result.json (flags, iterations, 3 scores with reasons, pass)
//   node benchmark.mjs confirm <run-dir> [--override <slug>.<criterion>=<0|1|2>:<reason>]...   owner confirms all, in one pass
//   node benchmark.mjs report <run-dir>                       write and print results.md
// scores.json: { "iterations": n, "flags": [..], "scores": { "fidelity": {"score": 0-2, "reason": ".."}, "ciLayout": {..}, "sketchFidelity": {..} } }
// The run folder is gitignored (benchmark/runs/, or HW_BENCHMARK_RUNS) and never inside the repo's Pages directory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseFragment } from 'parse5';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(SKILL, '..', '..', '..');
const REQUESTS_DIR = path.join(SKILL, 'benchmark', 'requests');
export const DEFAULT_RUNS_DIR = path.join(SKILL, 'benchmark', 'runs');
export const MAX_ITERATIONS = 3;
export const PASS_TOTAL = 4;
export const CRITERIA = [
  { key: 'fidelity', label: 'Request fidelity' },
  { key: 'ciLayout', label: 'CI and layout' },
  { key: 'sketchFidelity', label: 'Sketch fidelity' },
];
export const REQUEST_SLUGS = fs.readdirSync(REQUESTS_DIR).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3)).sort();

export function parseRequest(file) {
  const text = fs.readFileSync(file, 'utf8');
  const section = name => text.split(new RegExp(`^## ${name}\\s*$`, 'm'))[1]?.split(/^## /m)[0] ?? '';
  const ids = label => [...(text.match(new RegExp(`^- ${label}: (.*)$`, 'm'))?.[1] ?? '').matchAll(/`([a-z0-9_]+)`/g)].slice(0, 1).map(m => m[1]);
  return {
    slug: path.basename(file, '.md'),
    title: text.match(/^# (.*)$/m)?.[1] ?? '',
    prompt: section('Prompt').split('\n').filter(l => l.startsWith('>')).map(l => l.replace(/^>\s?/, '')).join(' ').trim(),
    datasets: [...ids('Main dataset'), ...ids('Companion Dataset')],
    checklist: section('Must-have checklist').split('\n').filter(l => /^- \[ \]/.test(l)).map(l => l.replace(/^- \[ \]\s*/, '')),
  };
}

const inside = (child, parent) => { const r = path.relative(parent, child); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };

/** Make `<runsDir>/<date>[-n]/<slug>/` for each request (all six when `slugs` is empty). Never inside the Pages directory. */
export function initRun({ slugs = [], runsDir = process.env.HW_BENCHMARK_RUNS || DEFAULT_RUNS_DIR, date = new Date().toISOString().slice(0, 10) } = {}) {
  const resolved = path.resolve(runsDir);
  if (inside(resolved, path.join(REPO, 'pages'))) throw new Error(`The run folder must not be inside the Pages directory (${path.join(REPO, 'pages')}).`);
  const chosen = slugs.length ? slugs : REQUEST_SLUGS;
  for (const s of chosen) if (!REQUEST_SLUGS.includes(s)) throw new Error(`Unknown benchmark request "${s}". Known: ${REQUEST_SLUGS.join(', ')}.`);
  let runDir = path.join(resolved, date);
  for (let n = 2; fs.existsSync(runDir); n++) runDir = path.join(resolved, `${date}-${n}`);
  const pages = chosen.map(s => path.join(runDir, s));
  for (const p of pages) fs.mkdirSync(p, { recursive: true });
  return { runDir, pages, requests: chosen.map(s => parseRequest(path.join(REQUESTS_DIR, `${s}.md`))) };
}

/** Pass: verifier reports no errors, within 3 fix iterations, rubric total >= 4/6 and no 0. Warnings are counted, not failed. */
export function passes({ report, iterations, scores }) {
  const errors = report.findings.filter(f => f.severity === 'error').length;
  const warnings = report.findings.length - errors;
  const values = CRITERIA.map(c => scores[c.key].score);
  const total = values.reduce((a, b) => a + b, 0);
  const reasons = [];
  if (errors) reasons.push(`${errors} verifier error(s)`);
  if (iterations > MAX_ITERATIONS) reasons.push(`${iterations} iterations (limit ${MAX_ITERATIONS})`);
  if (total < PASS_TOTAL) reasons.push(`rubric ${total}/6 (need ${PASS_TOTAL}/6)`);
  if (values.includes(0)) reasons.push('a rubric criterion scored 0');
  return { pass: reasons.length === 0, total, errors, warnings, reasons };
}

function checkScores(scores) {
  for (const { key, label } of CRITERIA) {
    const s = scores?.[key];
    if (!s || ![0, 1, 2].includes(s.score)) throw new Error(`${label}: the score must be 0, 1 or 2.`);
    if (typeof s.reason !== 'string' || !s.reason.trim()) throw new Error(`${label}: a one-line reason is required.`);
    if (s.reason.includes('\n')) throw new Error(`${label}: the reason must be one line.`);
  }
}

const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const resultFile = pageDir => path.join(pageDir, 'result.json');

export function snapshotSketch(pageDir) {
  const dest = path.join(pageDir, 'sketch');
  if (fs.existsSync(path.join(dest, 'index.html'))) throw new Error('The first Page Sketch is already kept; it is never overwritten.');
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ['index.html', 'stylesheet.css']) if (fs.existsSync(path.join(pageDir, f))) fs.copyFileSync(path.join(pageDir, f), path.join(dest, f));
  if (!fs.existsSync(path.join(dest, 'index.html'))) throw new Error(`No index.html in ${pageDir} to keep as the Page Sketch.`);
}

export function recordResult({ pageDir, iterations, flags = [], scores }) {
  if (!fs.existsSync(path.join(pageDir, 'sketch', 'index.html'))) throw new Error('The kept first Page Sketch is missing (run `benchmark.mjs sketch` when the sketch is auto-approved).');
  const reportFile = path.join(pageDir, 'verifier-output', 'report.json');
  if (!fs.existsSync(reportFile)) throw new Error(`No verifier report at ${reportFile}.`);
  if (!Number.isInteger(iterations) || iterations < 1) throw new Error('iterations must be a positive integer.');
  checkScores(scores);
  const report = readJson(reportFile);
  const verdict = passes({ report, iterations, scores });
  const result = {
    slug: path.basename(pageDir), iterations, flags, warnings: verdict.warnings, errors: verdict.errors, total: verdict.total,
    pass: verdict.pass, failReasons: verdict.reasons, verifierStatus: report.status ?? null,
    scores: Object.fromEntries(CRITERIA.map(c => [c.key, { score: scores[c.key].score, reason: scores[c.key].reason.trim() }])),
    confirmed: false,
  };
  fs.writeFileSync(resultFile(pageDir), JSON.stringify(result, null, 2) + '\n');
  return result;
}

const runSlugs = runDir => fs.readdirSync(runDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();

/** The owner confirms every recorded request in one pass; each override replaces one score and re-derives pass/fail. */
export function confirmScores({ runDir, overrides = [] }) {
  for (const o of overrides) {
    if (!CRITERIA.some(c => c.key === o.criterion)) throw new Error(`Unknown criterion "${o.criterion}". Known: ${CRITERIA.map(c => c.key).join(', ')}.`);
    if (![0, 1, 2].includes(o.score)) throw new Error('An override score must be 0, 1 or 2.');
    if (!o.reason?.trim()) throw new Error('An override needs a one-line reason.');
    if (!fs.existsSync(resultFile(path.join(runDir, o.slug)))) throw new Error(`No recorded result for "${o.slug}".`);
  }
  const done = [];
  for (const slug of runSlugs(runDir)) {
    const pageDir = path.join(runDir, slug);
    if (!fs.existsSync(resultFile(pageDir))) continue;
    const result = readJson(resultFile(pageDir));
    for (const o of overrides.filter(x => x.slug === slug)) {
      const cur = result.scores[o.criterion];
      result.scores[o.criterion] = { score: o.score, reason: o.reason.trim(), overridden: true, agentScore: cur.agentScore ?? cur.score, agentReason: cur.agentReason ?? cur.reason };
    }
    const verdict = passes({ report: readJson(path.join(pageDir, 'verifier-output', 'report.json')), iterations: result.iterations, scores: result.scores });
    Object.assign(result, { total: verdict.total, pass: verdict.pass, failReasons: verdict.reasons, confirmed: true });
    fs.writeFileSync(resultFile(pageDir), JSON.stringify(result, null, 2) + '\n');
    done.push(result);
  }
  return done;
}

export function resultsMarkdown(runDir) {
  const rows = [], notes = [];
  let passed = 0, recorded = 0, unconfirmed = 0;
  for (const slug of runSlugs(runDir)) {
    const file = resultFile(path.join(runDir, slug));
    if (!fs.existsSync(file)) { rows.push(`| ${slug} | NOT RUN | | | | | | |`); continue; }
    const r = readJson(file);
    recorded++; if (r.pass) passed++; if (!r.confirmed) unconfirmed++;
    rows.push(`| ${slug} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.iterations} | ${r.warnings} | ${CRITERIA.map(c => r.scores[c.key].score).join(' | ')} | ${r.total}/6 |`);
    notes.push(`### ${slug}`, '');
    if (!r.pass) notes.push(`Failed: ${r.failReasons.join('; ')}`, '');
    for (const c of CRITERIA) {
      const s = r.scores[c.key];
      notes.push(`- ${c.label}: ${s.score}. ${s.reason}${s.overridden ? ` (owner override; agent scored ${s.agentScore}: ${s.agentReason})` : ''}`);
    }
    notes.push('', r.flags.length ? 'Plan-list flags (recorded, not acted on):' : 'Plan-list flags: none', ...r.flags.map(f => `- ${f}`), '');
  }
  return [
    `# Benchmark results: ${path.basename(runDir)}`, '',
    `${passed} of ${rows.length} passed.${unconfirmed ? ` Scores are awaiting the owner's confirmation (${unconfirmed} request${unconfirmed === 1 ? '' : 's'}).` : ''}`, '',
    'Pass rule: verifier reports no errors within 3 iterations, rubric at least 4/6 with no 0. Warnings are counted, not failed.', '',
    `| Request | Result | Iterations | Warnings | ${CRITERIA.map(c => c.label).join(' | ')} | Total |`,
    `|---|---|---|---|${CRITERIA.map(() => '---').join('|')}|---|`,
    ...rows, '', ...notes,
  ].join('\n') + '\n';
}

// Widget-free stand-ins of the Page Sketch that the built Page replaces with the Widget's own markup (Pattern 8, Pattern 1).
const STAND_INS = new Set(['hw-tabs', 'hw-tab', 'hw-filter-control', 'is-active']);

const hwClasses = html => {
  const out = [];
  const walk = n => {
    const cls = n.attrs?.find(a => a.name === 'class')?.value ?? '';
    for (const c of cls.split(/\s+/)) if (c.startsWith('hw-') && c !== 'hw-placeholder' && !STAND_INS.has(c)) out.push(c);
    for (const c of n.childNodes ?? []) walk(c);
    if (n.content) walk(n.content);
  };
  walk(parseFragment(html));
  return out;
};

const placeholderLabels = html => {
  const out = [];
  const text = n => (n.nodeName === '#text' ? n.value : (n.childNodes ?? []).map(text).join(''));
  const walk = n => {
    if ((n.attrs?.find(a => a.name === 'class')?.value ?? '').split(/\s+/).includes('hw-placeholder')) out.push(text(n).trim());
    for (const c of n.childNodes ?? []) walk(c);
  };
  walk(parseFragment(html));
  return out;
};

/** Objective aid for the sketch-fidelity score: hw- containers of the sketch that the final Page lost, in order, and placeholder labels that no longer appear. */
export function sketchAid(sketchHtml, finalHtml) {
  const finalClasses = hwClasses(finalHtml);
  let from = 0;
  const missingClasses = [];
  for (const c of hwClasses(sketchHtml)) {
    const i = finalClasses.indexOf(c, from);
    if (i === -1) missingClasses.push(c); else from = i + 1;
  }
  const lower = finalHtml.toLowerCase();
  return { missingClasses, missingLabels: placeholderLabels(sketchHtml).filter(l => l && !lower.includes(l.toLowerCase())) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, ...rest] = process.argv.slice(2);
  const fail = msg => { console.error(`${msg}\nSee the usage at the top of benchmark.mjs.`); process.exit(2); };
  try {
    if (cmd === 'init') {
      const slugs = [], opts = {};
      for (let i = 0; i < rest.length; i++) rest[i] === '--date' ? (opts.date = rest[++i]) : slugs.push(rest[i]);
      const r = initRun({ slugs, ...opts });
      console.log(JSON.stringify({ runDir: r.runDir, pages: r.pages, requests: r.requests }, null, 2));
    } else if (cmd === 'sketch') {
      snapshotSketch(path.resolve(rest[0] ?? fail('Missing Page folder.')));
    } else if (cmd === 'aid') {
      const d = path.resolve(rest[0] ?? fail('Missing Page folder.'));
      console.log(JSON.stringify(sketchAid(fs.readFileSync(path.join(d, 'sketch', 'index.html'), 'utf8'), fs.readFileSync(path.join(d, 'index.html'), 'utf8')), null, 2));
    } else if (cmd === 'record') {
      const d = path.resolve(rest[0] ?? fail('Missing Page folder.'));
      const input = readJson(path.resolve(rest[1] ?? fail('Missing scores.json.')));
      const r = recordResult({ pageDir: d, ...input });
      console.log(`${r.slug}: ${r.pass ? 'PASS' : 'FAIL'} (${r.total}/6, ${r.iterations} iteration(s), ${r.warnings} warning(s))${r.pass ? '' : ` ${r.failReasons.join('; ')}`}`);
    } else if (cmd === 'confirm') {
      const runDir = path.resolve(rest[0] ?? fail('Missing run folder.'));
      const overrides = [];
      for (let i = 1; i < rest.length; i++) {
        if (rest[i] !== '--override') fail(`Unexpected argument: ${rest[i]}`);
        const m = (rest[++i] ?? '').match(/^([a-z0-9-]+)\.([A-Za-z]+)=([012]):(.+)$/);
        if (!m) fail('--override needs <slug>.<criterion>=<0|1|2>:<reason>');
        overrides.push({ slug: m[1], criterion: m[2], score: Number(m[3]), reason: m[4] });
      }
      console.log(`Confirmed ${confirmScores({ runDir, overrides }).length} request(s), ${overrides.length} override(s).`);
    } else if (cmd === 'report') {
      const runDir = path.resolve(rest[0] ?? fail('Missing run folder.'));
      const md = resultsMarkdown(runDir);
      fs.writeFileSync(path.join(runDir, 'results.md'), md);
      process.stdout.write(md);
    } else fail(`Unknown command "${cmd ?? ''}".`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
