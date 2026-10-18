// Verifier CLI for the huwise-page skill.
// Usage: node verify.mjs <page-dir> --target-height <px> --embed-size <klein|gross>
// Reads <page-dir>/index.html and stylesheet.css, writes verifier-output/report.{json,md}
// into the Page folder, exits 1 on any error finding (2 on bad usage).
import fs from 'node:fs';
import path from 'node:path';
import { lint } from './lint.mjs';

const EMBED_SIZES = { klein: 'Klein', gross: 'Gross' };

function usage(msg) {
  console.error(`${msg}\nUsage: node verify.mjs <page-dir> --target-height <px> --embed-size <klein|gross>`);
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { dir: null, targetHeight: null, embedSize: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--target-height') opts.targetHeight = Number(argv[++i]);
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
const read = name => {
  const p = path.join(pageDir, name);
  if (!fs.existsSync(p)) usage(`Page folder is missing ${name}: ${pageDir}`);
  return fs.readFileSync(p, 'utf8');
};
const html = read('index.html');
const css = read('stylesheet.css');

const findings = lint({ html, css });
const errors = findings.filter(f => f.severity === 'error');
const report = {
  page: path.basename(pageDir),
  status: errors.length ? 'fail' : 'pass',
  targetHeight: opts.targetHeight,
  embedSize: opts.embedSize,
  findings,
};

const outDir = path.join(pageDir, 'verifier-output');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'report.md'), markdown(report));
console.log(`${report.status.toUpperCase()}: ${errors.length} error(s), ${findings.length - errors.length} other. Report: ${path.join(outDir, 'report.md')}`);
process.exit(errors.length ? 1 : 0);
