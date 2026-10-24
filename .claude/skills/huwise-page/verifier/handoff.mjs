// Handoff file writer for the huwise-page skill (step 7).
// Usage: node handoff.mjs <page-dir> --dataset-title <title> --caption <Legende> [--iterations <n>] [--gap <text>]... [--not-passing]
// Reads <page-dir>/verifier-output/report.json (written by verify.mjs), writes <page-dir>/handoff.md and prints it,
// so the agent can repeat it in chat. Target Height and Embed Size come from the report. The slug is the folder name.
// A handoff is PASSING only when the report passes every stage on the full set of widths for its Embed Size and the
// agent's screenshot review found nothing (no --not-passing). Anything else is written as NOT PASSING with the open errors.
// There is no clipboard helper and nothing is committed.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { WIDTHS } from './render.mjs';

export const CAPTION_MAX = 200;
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const embedUrl = slug => `https://data.gr.ch/pages/${slug}/?headless=true&flg=de-ch`;

const cell = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const where = f => (f.location?.widths ? `render at ${f.location.widths.join('/')}px, state: ${f.location.state}` : `${f.location?.file}:${f.location?.line}:${f.location?.column}`);

/** Why this run cannot be called passing, as a list of short reasons (empty when it can). */
export function notPassingReasons(report, { reviewFailed = false } = {}) {
  const reasons = [];
  const errors = report.findings.filter(f => f.severity === 'error');
  if (errors.length) reasons.push(`${errors.length} verifier error(s) open`);
  for (const [label, key] of [['lint', 'lint'], ['dry-run', 'dryRun'], ['render', 'render']]) {
    const s = report.stages[key]?.status;
    if (s === 'skipped' && !errors.length) reasons.push(`${label} stage skipped (${report.stages[key].reason})`);
  }
  const widths = (report.stages.render?.screenshots ?? []).map(s => s.width);
  const full = WIDTHS[report.embedSize];
  if (!errors.length && report.stages.render?.status === 'pass' && JSON.stringify(widths) !== JSON.stringify(full))
    reasons.push(`the final pass did not render every width (${widths.join('/')}px instead of ${full.join('/')}px)`);
  if (reviewFailed) reasons.push('the screenshot review found problems that are still open');
  return reasons;
}

export function handoffMarkdown({ report, slug, datasetTitle, caption, iterations = null, gaps = [], reviewFailed = false }) {
  if (!SLUG_PATTERN.test(slug)) throw new Error(`Slug must be kebab-case, got "${slug}".`);
  if (caption.length > CAPTION_MAX) throw new Error(`The Legende has ${caption.length} characters, the limit is ${CAPTION_MAX}.`);
  if (!caption.includes(datasetTitle)) throw new Error('The Legende must name the dataset as source (its title does not appear).');
  const reasons = notPassingReasons(report, { reviewFailed });
  const passing = reasons.length === 0;
  const errors = report.findings.filter(f => f.severity === 'error');
  const warnings = report.findings.filter(f => f.severity !== 'error');
  const L = [];
  L.push(`# Handoff: ${slug}`, '', `Status: **${passing ? 'PASSING' : 'NOT PASSING'}**`);
  if (!passing) L.push('', ...reasons.map(r => `- ${r}`), '', 'Do not paste this Page before the open errors in section 4 are resolved.');
  L.push('',
    '## 1. Editor steps', '',
    `1. In the Huwise editor of data.gr.ch create a Page with the slug \`${slug}\`.`,
    `2. Paste \`pages/${slug}/index.html\` into the **DE** HTML field.`,
    `3. Paste \`pages/${slug}/stylesheet.css\` into the **DE** CSS field.`,
    '4. Leave the EN and IT fields empty.',
    '',
    '## 2. Embed URL', '',
    `\`${embedUrl(slug)}\``, '',
    'Warning: do not use the snippet of the Page\'s Sharing tab. It omits `flg=de-ch`, and a reader whose portal language is not German would see an empty Page.',
    '',
    '## 3. gr.ch component values', '',
    `- Höhe (px): **${report.targetHeight}**`,
    `- Embed Size: **${report.embedSize}**`,
    `- Legende (Embed Caption, ${caption.length} of ${CAPTION_MAX} characters): ${caption}`,
    '',
    '## 4. Verification summary', '',
    `- Result: **${report.status.toUpperCase()}**${iterations ? `, after ${iterations} iteration${iterations === 1 ? '' : 's'}` : ''}`,
    ...[['Lint', 'lint'], ['Dry-run', 'dryRun'], ['Render', 'render']].map(([label, key]) => {
      const s = report.stages[key];
      return `- ${label}: ${s.status}${s.reason ? ` (${s.reason})` : ''}`;
    }),
    `- Target Height ${report.targetHeight}px, Embed Size ${report.embedSize}, widths rendered: ${(report.stages.render?.screenshots ?? []).map(s => s.width).join(', ') || 'none'}px`,
    `- API requests (dry-run): ${report.apiRequests}`,
    `- Warnings: ${warnings.length}`,
    `- Reference gaps found: ${gaps.length ? '' : 'none'}`,
    ...gaps.map(g => `  - ${g}`));
  if (errors.length) {
    L.push('', '### Open errors', '', '| Rule | Location | Message |', '|---|---|---|', ...errors.map(f => `| ${f.rule} | ${cell(where(f))} | ${cell(f.message)} |`));
  }
  if (warnings.length) {
    L.push('', '### Warnings', '', '| Rule | Location | Message |', '|---|---|---|', ...warnings.map(f => `| ${f.rule} | ${cell(where(f))} | ${cell(f.message)} |`));
  }
  L.push('', '## 5. Screenshots', '');
  const shots = report.stages.render?.screenshots ?? [];
  if (!shots.length) L.push('No screenshots (the render stage did not run).');
  for (const s of shots) L.push(`- ${s.width}px: \`pages/${slug}/verifier-output/${s.file}\``);
  for (const s of report.stages.render?.states ?? []) L.push(`- State ${s.label} (${s.width}px): \`pages/${slug}/verifier-output/${s.screenshot}\``);
  L.push('', 'Screenshots are ignored by git; the 375px and 1200px shots are shown in chat.');
  return L.join('\n') + '\n';
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const usage = msg => {
    console.error(`${msg}\nUsage: node handoff.mjs <page-dir> --dataset-title <title> --caption <Legende> [--iterations <n>] [--gap <text>]... [--not-passing]`);
    process.exit(2);
  };
  const opts = { dir: null, datasetTitle: null, caption: null, iterations: null, gaps: [], reviewFailed: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dataset-title') opts.datasetTitle = args[++i];
    else if (args[i] === '--caption') opts.caption = args[++i];
    else if (args[i] === '--iterations') opts.iterations = Number(args[++i]);
    else if (args[i] === '--gap') opts.gaps.push(args[++i]);
    else if (args[i] === '--not-passing') opts.reviewFailed = true;
    else if (!opts.dir) opts.dir = args[i];
    else usage(`Unexpected argument: ${args[i]}`);
  }
  if (!opts.dir || !opts.datasetTitle || !opts.caption) usage('Missing Page folder, --dataset-title or --caption.');
  const dir = path.resolve(opts.dir);
  const reportPath = path.join(dir, 'verifier-output', 'report.json');
  if (!fs.existsSync(reportPath)) usage(`No verifier report at ${reportPath}; run verify.mjs first.`);
  let md;
  try {
    md = handoffMarkdown({ report: JSON.parse(fs.readFileSync(reportPath, 'utf8')), slug: path.basename(dir), ...opts });
  } catch (e) { usage(e.message); }
  fs.writeFileSync(path.join(dir, 'handoff.md'), md);
  process.stdout.write(md);
}
