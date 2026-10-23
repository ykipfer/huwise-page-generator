// Verifier CLI for the huwise-page skill.
// Usage: node verify.mjs <page-dir> --target-height <px> --embed-size <klein|gross> [--no-dry-run]
// (--no-dry-run skips the network-bound dry-run stage; the lint tests use it to stay offline)
// Reads <page-dir>/index.html and stylesheet.css, writes verifier-output/report.{json,md}
// into the Page folder, exits 1 on any error finding (2 on bad usage).
import fs from 'node:fs';
import path from 'node:path';
import { lint } from './lint.mjs';
import { dryRun } from './dryrun.mjs';

const EMBED_SIZES = { klein: 'Klein', gross: 'Gross' };

function usage(msg) {
  console.error(`${msg}\nUsage: node verify.mjs <page-dir> --target-height <px> --embed-size <klein|gross>`);
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { dir: null, targetHeight: null, embedSize: null, noDryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--no-dry-run') opts.noDryRun = true;
    else if (argv[i] === '--target-height') opts.targetHeight = Number(argv[++i]);
    else if (argv[i] === '--embed-size') opts.embedSize = EMBED_SIZES[String(argv[++i]).toLowerCase()];
    else if (!opts.dir) opts.dir = argv[i];
    else usage(`Unexpected argument: ${argv[i]}`);
  }
  if (!opts.dir) usage('Missing Page folder.');
  if (!Number.isInteger(opts.targetHeight) || opts.targetHeight <= 0) usage('--target-height must be a positive integer (px).');
  if (!opts.embedSize) usage('--embed-size must be Klein or Gross.');
  return opts;
}

function markdown(report) {
  const errors = report.findings.filter(f => f.severity === 'error').length;
  const lines = [
    `# Verifier report: ${report.page}`,
    '',
    `Status: **${report.status.toUpperCase()}** (${errors} error${errors === 1 ? '' : 's'}, ${report.findings.length - errors} other)`,
    `Target Height: ${report.targetHeight}px, Embed Size: ${report.embedSize}`,
    '',
    ...[['Lint', 'lint'], ['Dry-run', 'dryRun'], ['Render', 'render']].map(([label, key]) => {
      const s = report.stages[key];
      return `- ${label}: ${s.status}${s.reason ? ` (${s.reason})` : ''}`;
    }),
    `- API requests: ${report.apiRequests}`,
    '',
  ];
  if (!report.findings.length) lines.push('No findings.');
  else {
    lines.push('| Severity | Rule | Location | Message |', '|---|---|---|---|');
    for (const f of report.findings)
      lines.push(`| ${f.severity} | ${f.rule} | ${f.location.file}:${f.location.line}:${f.location.column} | ${f.message} |`);
  }
  return lines.join('\n') + '\n';
}

const opts = parseArgs(process.argv.slice(2));
const pageDir = path.resolve(opts.dir);
const htmlPath = path.join(pageDir, 'index.html');
if (!fs.existsSync(htmlPath)) usage(`Page folder is missing index.html: ${pageDir}`);
const html = fs.readFileSync(htmlPath, 'utf8');
// A Page without a stylesheet is valid: its CSS part is empty.
const cssPath = path.join(pageDir, 'stylesheet.css');
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

const hasErrors = list => list.some(f => f.severity === 'error');
const stageStatus = list => (hasErrors(list) ? 'fail' : 'pass');

// Stages gate each other so one root cause doesn't bury every other finding:
// the dry-run runs only when lint is clean, render only when lint and dry-run are clean.
const findings = lint({ html, css });
const stages = { lint: { status: stageStatus(findings) } };
let apiRequests = 0;
if (hasErrors(findings)) {
  stages.dryRun = { status: 'skipped', reason: 'lint has errors' };
} else if (opts.noDryRun) {
  stages.dryRun = { status: 'skipped', reason: 'disabled by --no-dry-run' };
} else {
  const dry = await dryRun({ html });
  findings.push(...dry.findings);
  apiRequests = dry.apiRequests;
  stages.dryRun = { status: stageStatus(dry.findings), apiRequests };
}
stages.render = stages.dryRun.status === 'pass'
  ? { status: 'skipped', reason: 'render stage not built yet' }
  : { status: 'skipped', reason: stages.lint.status === 'fail' ? 'lint has errors' : 'dry-run has errors' };

const errors = findings.filter(f => f.severity === 'error');
const report = {
  page: path.basename(pageDir),
  status: errors.length ? 'fail' : 'pass',
  targetHeight: opts.targetHeight,
  embedSize: opts.embedSize,
  stages,
  apiRequests,
  findings,
};

const outDir = path.join(pageDir, 'verifier-output');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'report.md'), markdown(report));
console.log(`${report.status.toUpperCase()}: ${errors.length} error(s), ${findings.length - errors.length} other. Report: ${path.join(outDir, 'report.md')}`);
process.exit(errors.length ? 1 : 0);
