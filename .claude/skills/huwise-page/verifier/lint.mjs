// Lint stage: constructs the Huwise editor refuses on save, mirrored exactly. No network.
// The editor's HTML check parses markup (comments are ignored); its CSS check is a plain text search.
import { parseFragment } from 'parse5';

const REFUSED_TAGS = ['style', 'script', 'form', 'object', 'iframe'];

const finding = (rule, file, loc, message) => ({
  rule,
  severity: 'error',
  location: { file, line: loc.startLine, column: loc.startCol },
  message,
});

function* elements(node) {
  for (const child of node.childNodes ?? []) {
    if (child.tagName) yield child;
    yield* elements(child);
    if (child.content) yield* elements(child.content);   // <template>
  }
}

function lintHtml(html) {
  const findings = [];
  const doc = parseFragment(html, { sourceCodeLocationInfo: true });
  for (const el of elements(doc)) {
    const loc = el.sourceCodeLocation;
    if (REFUSED_TAGS.includes(el.tagName))
      findings.push(finding(`refused-${el.tagName}`, 'index.html', loc, `<${el.tagName}> is refused by the Huwise editor on save`));
    for (const { name, value } of el.attrs) {
      const attrLoc = loc.attrs?.[name] ?? loc;
      if (/^on/.test(name) && !el.tagName.startsWith('ods-'))
        findings.push(finding('refused-on-attribute', 'index.html', attrLoc, `"${name}" on <${el.tagName}> is refused by the Huwise editor (only ods-* Widgets may carry on* attributes)`));
      // eslint-disable-next-line no-control-regex
      if (/^javascript:/i.test(value.replace(/[\u0000- ]/g, '')))
        findings.push(finding('refused-javascript-url', 'index.html', attrLoc, `"${name}" on <${el.tagName}> has a javascript: value`));
    }
  }
  return findings;
}

function lintCss(css) {
  const findings = [];
  const lines = css.split('\n');
  lines.forEach((text, i) => {
    for (const m of text.matchAll(/@import/gi))
      findings.push(finding('refused-css-import', 'stylesheet.css', { startLine: i + 1, startCol: m.index + 1 },
        '@import is refused by the Huwise editor (plain text search, comments included)'));
  });
  return findings;
}

export function lint({ html, css }) {
  return [...lintHtml(html), ...lintCss(css)];
}
