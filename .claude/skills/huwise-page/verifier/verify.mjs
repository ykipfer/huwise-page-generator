// Verifier CLI for the huwise-page skill.
// Usage: node verify.mjs <page-dir> --target-height <px> --embed-size <klein|gross> [--iterate] [--skip-render]
// Stages: lint, then render (only when lint is clean). --iterate renders at 1200px only; --skip-render runs lint only.
// Reads <page-dir>/index.html and stylesheet.css, writes verifier-output/report.{json,md}
// into the Page folder, exits 1 on any error finding (2 on bad usage).
import fs from 'node:fs';
import path from 'node:path';
import { lint } from './lint.mjs';
import { render, WIDTHS, ITERATE_WIDTHS } from './render.mjs';

const EMBED_SIZES = { klein: 'Klein', gross: 'Gross' };

function usage(msg) {
  console.error(`${msg}\nUsage: node verify.mjs <page-dir> --target-height <px> --embed-size <klein|gross> [--iterate] [--skip-render]`);
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { dir: null, targetHeight: null, embedSize: null, iterate: false, skipRender: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--target-height') opts.targetHeight = Number(argv[++i]);
    else if (argv[i] === '--embed-size') opts.embedSize = EMBED_SIZES[String(argv[++i]).toLowerCase()];
    else if (argv[i] === '--iterate') opts.iterate = true;
    else if (argv[i] === '--skip-render') opts.skipRender = true;
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
  ];
  if (!report.findings.length) lines.push('No findings.');
  else {
    lines.push('| Severity | Rule | Location | Message |', '|---|---|---|---|');
    for (const f of report.findings) {
      const where = f.location.widths ? `render at ${f.location.widths.join('/')}px` : `${f.location.file}:${f.location.line}:${f.location.column}`;
      lines.push(`| ${f.severity} | ${f.rule} | ${where} | ${f.message.replace(/\|/g, '\\|')} |`);
    }
  }
  lines.push('', `Render: ${report.render.status}${report.render.reason ? ` (${report.render.reason})` : ''}`);
  for (const s of report.render.screenshots ?? []) lines.push(`- ${s.width}px: ${s.file}`);
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

const findings = lint({ html, css });
const outDir = path.join(pageDir, 'verifier-output');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// Gate: render runs only when every earlier stage present is clean (lint for now).
const renderInfo = { status: 'skipped', reason: opts.skipRender ? 'skipped by --skip-render' : 'lint has errors', screenshots: [] };
if (!findings.some(f => f.severity === 'error') && !opts.skipRender) {
  const scrollSelectors = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'references', 'scroll-containers.json'), 'utf8')).selectors;
  const widths = opts.iterate ? ITERATE_WIDTHS : WIDTHS[opts.embedSize];
  const r = await render({ html, css, targetHeight: opts.targetHeight, widths, outDir, scrollSelectors });
  findings.push(...r.findings);
  Object.assign(renderInfo, { status: r.findings.some(f => f.severity === 'error') ? 'fail' : 'pass', reason: undefined, screenshots: r.screenshots, platformConfig: r.platformConfig });
}

const errors = findings.filter(f => f.severity === 'error');
const report = {
  page: path.basename(pageDir),
  status: errors.length ? 'fail' : 'pass',
  targetHeight: opts.targetHeight,
  embedSize: opts.embedSize,
  render: renderInfo,
  findings,
};

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'report.md'), markdown(report));
console.log(`${report.status.toUpperCase()}: ${errors.length} error(s), ${findings.length - errors.length} other. Render: ${renderInfo.status}. Report: ${path.join(outDir, 'report.md')}`);
process.exit(errors.length ? 1 : 0);
