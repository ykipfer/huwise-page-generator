// Preview wrapper for the Page Sketch (step 3 of /huwise-page).
// Usage: node preview.mjs <page-dir> --target-height <px> --embed-size <klein|gross> [--no-open]
// Reads <page-dir>/index.html and stylesheet.css, writes <page-dir>/preview.html (ignored by version control) with
// the sketch in iframes side by side at the verifier widths, each exactly at the Target Height, and opens it in the browser.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { WIDTHS } from './render.mjs';

const escAttr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export function previewHtml({ html, css, targetHeight, embedSize }) {
  const frameDoc = `<!doctype html><html lang="de-ch"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#fff}${css}\n.hw-page { --target-height: ${targetHeight}px; }</style></head><body>${html}</body></html>`;
  const frames = WIDTHS[embedSize].map(w => `<figure><figcaption>${w}px</figcaption><iframe title="Page Sketch ${w}px" width="${w}" height="${targetHeight}" style="width:${w}px;height:${targetHeight}px" srcdoc="${escAttr(frameDoc)}"></iframe></figure>`).join('\n');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Page Sketch (${embedSize}, ${targetHeight}px)</title>
<style>body{margin:16px;font:13px/1.4 sans-serif;background:#eee}.row{display:flex;gap:16px;align-items:flex-start}figure{margin:0;flex:none}figcaption{margin-bottom:4px;color:#555}iframe{border:0;outline:1px solid #bbb;background:#fff;display:block}</style></head>
<body><p>Page Sketch, Embed Size ${embedSize}, Target Height ${targetHeight}px</p><div class="row">
${frames}
</div></body></html>
`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opts = { dir: null, targetHeight: null, embedSize: null, open: true };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--no-open') opts.open = false;
    else if (args[i] === '--target-height') opts.targetHeight = Number(args[++i]);
    else if (args[i] === '--embed-size') opts.embedSize = { klein: 'Klein', gross: 'Gross' }[String(args[++i]).toLowerCase()];
    else opts.dir = args[i];
  }
  if (!opts.dir || !Number.isInteger(opts.targetHeight) || opts.targetHeight <= 0 || !opts.embedSize || !fs.existsSync(path.join(opts.dir, 'index.html'))) {
    console.error('Usage: node preview.mjs <page-dir with index.html> --target-height <px> --embed-size <klein|gross> [--no-open]');
    process.exit(2);
  }
  const dir = path.resolve(opts.dir);
  const cssPath = path.join(dir, 'stylesheet.css');
  const out = path.join(dir, 'preview.html');
  fs.writeFileSync(out, previewHtml({
    html: fs.readFileSync(path.join(dir, 'index.html'), 'utf8'),
    css: fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '',
    targetHeight: opts.targetHeight, embedSize: opts.embedSize,
  }));
  console.log(`Preview: ${out}`);
  if (opts.open) spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [out], { detached: true, stdio: 'ignore' }).unref();
}
