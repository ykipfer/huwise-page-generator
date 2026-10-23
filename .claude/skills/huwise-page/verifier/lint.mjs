// Lint stage, no network:
// - constructs the Huwise editor refuses on save, mirrored exactly. The editor's HTML check parses
//   markup (comments are ignored); its CSS check is a plain text search.
// - the closed Widget list and the banned habits, read from ../references/ so that knowledge and lint
//   never drift apart.
// - the layout rules (layout-lint.mjs): footer, fixed-height parents, fixed widths.
// - warnings (never fail a Page): attributes on a listed Widget that its family file does not document.
import fs from 'node:fs';
import path from 'node:path';
import { parseFragment } from 'parse5';
import { lintLayout } from './layout-lint.mjs';

const REFERENCES = path.join(import.meta.dirname, '..', 'references');
const reference = file => JSON.parse(fs.readFileSync(path.join(REFERENCES, file), 'utf8'));
const WIDGETS = reference('widgets.json').widgets;
const HABITS = reference('banned-habits.json').habits;
const matchers = kind => HABITS.flatMap(h => h.match.filter(m => kind in m).map(m => [h, m]));
const WIDGET_TAGS = new Set(WIDGETS.filter(w => w.form !== 'attribute').map(w => w.markup));
const REQUIRED_ATTRS = WIDGETS.filter(w => w.requiredAttributes).map(w => [w.markup, w.requiredAttributes]);
const WIDGET_ATTRS = new Set(WIDGETS.filter(w => w.form !== 'element').map(w => w.markup));

// ods-* attributes that are neither a listed attribute Widget nor a parameter of one on the same
// element (ods-results-max next to ods-results). An unlisted Widget's own parameters
// (ods-analysis-x next to ods-analysis) are folded into its finding. AngularJS also accepts the
// data-/x- prefixed forms, so names are compared without them; findings keep the written name.
function unlistedWidgetAttrs(el) {
  const names = el.attrs.map(a => ({ raw: a.name, name: a.name.replace(/^(data|x)-/, '') }))
    .filter(n => n.name.startsWith('ods-'));
  const present = names.filter(n => WIDGET_ATTRS.has(n.name)).map(n => n.name);
  const unknown = names.filter(n => !WIDGET_ATTRS.has(n.name) && !present.some(w => n.name.startsWith(`${w}-`)));
  return unknown.filter(n => !unknown.some(u => n.name.startsWith(`${u.name}-`))).map(n => n.raw);
}

// Documented attributes per Widget, read from the first column of the parameter tables in the family
// files (references/widgets/*.md): every table row under a "## `ods-…`" heading. `<name>` in a row
// stands for any name (<context>-dataset, ods-aggregation-<variablename>-context).
function documentedAttributes() {
  const dir = path.join(REFERENCES, 'widgets');
  const byWidget = new Map(WIDGETS.map(w => [w.markup, []]));
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
    let markup = null;
    for (const line of fs.readFileSync(path.join(dir, file), 'utf8').split('\n')) {
      const heading = line.match(/^## `([^`]+)`/);
      if (heading) markup = heading[1];
      else if (line.startsWith('## ')) markup = null;
      const row = markup && line.match(/^\| `([^`]+)` \|/);
      if (row && byWidget.has(markup))
        byWidget.get(markup).push(new RegExp(`^${row[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/<[^>]+>/g, '[a-z0-9-]+')}$`));
    }
  }
  return byWidget;
}
const DOCUMENTED = documentedAttributes();
// Attributes that belong to the HTML element or to AngularJS, not to a Widget.
const NOT_WIDGET_ATTR = /^(class|style|id|hidden|title|lang|role|tabindex|translate|aria-.+|ng-.+|on-.+)$/;

// Attributes on a listed Widget that no table of its family file documents. A Widget used as a tag owns
// the element's unprefixed attributes; an attribute-only Widget owns the attributes prefixed with its
// name (ods-results-max). Names are compared without the data-/x- prefix; findings keep the written name.
function undocumentedWidgetAttrs(el, ignored) {
  const names = el.attrs.map(a => ({ raw: a.name, name: a.name.replace(/^(data|x)-/, '') }));
  const has = w => names.some(n => n.name === w.markup);
  const owners = WIDGETS.filter(w => w.form === 'attribute' && has(w));
  const hosts = WIDGETS.filter(w => w.form !== 'attribute' && (w.markup === el.tagName || (w.form === 'both' && has(w))));
  const documented = (w, name) => name === w.markup || DOCUMENTED.get(w.markup).some(re => re.test(name));
  return names.filter(n => !ignored.has(n.raw) && !NOT_WIDGET_ATTR.test(n.name)).filter(n => {
    const owner = owners.filter(w => n.name.startsWith(`${w.markup}-`)).sort((a, b) => b.markup.length - a.markup.length)[0];
    if (owner) return !documented(owner, n.name);
    return hosts.length > 0 && !n.name.startsWith('ods-') && !hosts.some(w => documented(w, n.name));
  }).map(n => n.raw);
}

const REFUSED_TAGS = ['style', 'script', 'form', 'object', 'iframe'];

const finding = (rule, file, loc, message, severity = 'error') => ({
  rule,
  severity,
  location: { file, line: loc.startLine, column: loc.startCol },
  message,
});
const habitFinding = (habit, file, loc) =>
  finding(`banned-${habit.id}`, file, loc, `${habit.habit}. Use instead: ${habit.replacement}`);

// Banned habits on one element. Returns the tag/attribute names it reported, so that the
// closed-list check does not report the same construct twice.
function bannedOnElement(el, findings) {
  const loc = el.sourceCodeLocation;
  const claimed = new Set();
  for (const [habit, m] of matchers('element'))
    if (el.tagName === m.element) {
      findings.push(habitFinding(habit, 'index.html', loc));
      claimed.add(el.tagName);
    }
  for (const { name } of el.attrs)
    for (const [habit, m] of matchers('attribute'))
      if (new RegExp(m.attribute).test(name)) {
        findings.push(habitFinding(habit, 'index.html', loc.attrs?.[name] ?? loc));
        claimed.add(name);
      }
  for (const { name, value } of el.attrs)
    for (const [habit, m] of matchers('attributeValue'))
      if ((!m.attributes || new RegExp(m.attributes).test(name)) && new RegExp(m.attributeValue).test(value))
        findings.push(habitFinding(habit, 'index.html', loc.attrs?.[name] ?? loc));
  // Keys of context parameter objects: <ctx>-parameters="{'refine.x': 'v', 'q': '…'}".
  for (const { name, value } of el.attrs.filter(a => a.name.endsWith('-parameters')))
    for (const [, , key] of value.matchAll(/(?:^|[{,])\s*(['"]?)([\w.-]+)\1\s*:/g))
      for (const [habit, m] of matchers('parameterKey'))
        if (new RegExp(m.parameterKey).test(key))
          findings.push(habitFinding(habit, 'index.html', loc.attrs[name]));
  // Whole class tokens, one finding per habit and element.
  const classes = (el.attrs.find(a => a.name === 'class')?.value ?? '').split(/\s+/).filter(Boolean);
  for (const [habit, m] of matchers('class'))
    if (classes.some(c => new RegExp(m.class).test(c)))
      findings.push(habitFinding(habit, 'index.html', loc.attrs.class));
  return claimed;
}

export function* elements(node) {
  for (const child of node.childNodes ?? []) {
    if (child.tagName) yield child;
    yield* elements(child);
    if (child.content) yield* elements(child.content);   // <template>
  }
}

export function* textNodes(node) {
  for (const child of node.childNodes ?? []) {
    if (child.nodeName === '#text') yield child;
    yield* textNodes(child);
    if (child.content) yield* textNodes(child.content);
  }
}

// Location of a match at `index` inside raw source text that starts at `loc`.
function locate(loc, text, index) {
  const before = text.slice(0, index).split('\n');
  return before.length === 1
    ? { startLine: loc.startLine, startCol: loc.startCol + index }
    : { startLine: loc.startLine + before.length - 1, startCol: before.at(-1).length + 1 };
}

// `html` habits: matched in text and attribute values (comments are not text, so they are ignored).
function bannedInText(html, doc, findings) {
  for (const node of textNodes(doc)) {
    const loc = node.sourceCodeLocation;
    const raw = html.slice(loc.startOffset, loc.endOffset);
    for (const [habit, m] of matchers('html'))
      for (const match of raw.matchAll(new RegExp(m.html, 'g')))
        findings.push(habitFinding(habit, 'index.html', locate(loc, raw, match.index)));
  }
  for (const el of elements(doc))
    for (const { name, value } of el.attrs)
      for (const [habit, m] of matchers('html'))
        if (new RegExp(m.html).test(value))
          findings.push(habitFinding(habit, 'index.html', el.sourceCodeLocation.attrs?.[name] ?? el.sourceCodeLocation));
}

const attr = (el, name) => el.attrs?.find(a => a.name === name)?.value;

// `repeatWithoutMax` habits: ng-repeat="row in rows" under (or on) the element that defines rows.
function bannedRepeats(doc, findings) {
  for (const el of elements(doc)) {
    const variable = attr(el, 'ng-repeat')?.match(/\bin\s+([\w$]+)/)?.[1];
    if (!variable) continue;
    for (const [habit, m] of matchers('repeatWithoutMax'))
      for (let node = el; node?.attrs; node = node.parentNode) {
        const defined = attr(node, m.repeatWithoutMax);   // '' when written without a value
        if (defined !== undefined && (defined || m.defaultVariable) === variable) {
          if (attr(node, m.max) === undefined)
            findings.push(habitFinding(habit, 'index.html', node.sourceCodeLocation.attrs[m.repeatWithoutMax]));
          break;
        }
      }
  }
}

// `handBuiltTabs` habits: ng-click="tab = 'a'" and ng-click="tab = 'b'" on two elements.
// A toggle (x = !x) sets no literal and passes.
function bannedTabs(doc, findings) {
  for (const [habit, m] of matchers('handBuiltTabs')) {
    const byVariable = new Map();
    for (const el of elements(doc)) {
      const set = attr(el, m.handBuiltTabs)?.match(/^\s*([\w$.]+)\s*=\s*('[^']*'|"[^"]*"|\d+)\s*;?\s*$/);
      if (!set) continue;
      const [, variable, literal] = set;
      if (!byVariable.has(variable)) byVariable.set(variable, { el, literals: new Set() });
      byVariable.get(variable).literals.add(literal);
    }
    for (const { el, literals } of byVariable.values())
      if (literals.size > 1)
        findings.push(habitFinding(habit, 'index.html', el.sourceCodeLocation.attrs[m.handBuiltTabs]));
  }
}

// Side-effect assignments {{ … ; '' }} are allowed in exactly two forms (core.md), both writing one
// context parameter from inside a hidden element:
//   guarded default  {{ a.parameters['p'] = a.parameters['p'] || <expr>; '' }}
//   one-way copy     {{ b.parameters['q'] = a.parameters['p']; '' }}
const GUARDED_DEFAULT = /^(\w+)\.parameters\[(['"])([^'"]+)\2\]\s*=\s*\1\.parameters\[(['"])\3\4\]\s*\|\|\s*([^;]+?)\s*;\s*(''|"")$/;
const ONE_WAY_COPY = /^(\w+)\.parameters\[(['"])([^'"]+)\2\]\s*=\s*(\w+)\.parameters\[(['"])([^'"]+)\5\]\s*;\s*(''|"")$/;
const withoutStrings = expr => expr.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, '""');
const assigns = expr => /(^|[^=!<>])=(?![=>])/.test(withoutStrings(expr));
const hidden = el => {
  for (let node = el; node?.attrs; node = node.parentNode)
    if (attr(node, 'hidden') !== undefined || /display\s*:\s*none/.test(attr(node, 'style') ?? '')) return true;
  return false;
};

function sideEffects(html, doc, findings) {
  const report = (loc, message) => findings.push(finding('side-effect', 'index.html', loc, message));
  const copies = [];   // { target, source, loc }
  const check = (expr, loc, inHiddenText) => {
    if (!assigns(expr)) return;
    const guarded = expr.match(GUARDED_DEFAULT);
    const copy = expr.match(ONE_WAY_COPY);
    if (!(guarded && !assigns(guarded[5])) && !(copy && copy[1] !== copy[4]))
      return report(loc, `Side effect outside the two allowed forms (guarded default, one-way copy): {{ ${expr} }}`);
    if (!inHiddenText)
      return report(loc, `Side effect must sit in the text of a hidden element (hidden or style="display: none"): {{ ${expr} }}`);
    if (copy) copies.push({ target: copy[1], param: copy[3], source: copy[4], loc });
  };
  for (const node of textNodes(doc)) {
    const loc = node.sourceCodeLocation;
    const raw = html.slice(loc.startOffset, loc.endOffset);
    for (const m of raw.matchAll(/\{\{([\s\S]*?)\}\}/g))
      check(m[1].replace(/\s+/g, ' ').trim(), locate(loc, raw, m.index), hidden(node.parentNode));
  }
  for (const el of elements(doc))
    for (const { name, value } of el.attrs)
      for (const m of value.matchAll(/\{\{([\s\S]*?)\}\}/g))
        check(m[1].replace(/\s+/g, ' ').trim(), el.sourceCodeLocation.attrs[name], false);
  // Copies go one way, each target parameter from a single source context.
  copies.forEach((c, i) => {
    const earlier = copies.slice(0, i);
    if (earlier.some(e => e.target === c.source && e.source === c.target))
      report(c.loc, `Two-way copy between ${c.source} and ${c.target}: copies go one way only`);
    else if (earlier.some(e => e.target === c.target && e.param === c.param && e.source !== c.source))
      report(c.loc, `${c.target}.parameters['${c.param}'] is copied from more than one context: copy from a single source`);
  });
}

function lintHtml(html, doc) {
  const findings = [];
  bannedInText(html, doc, findings);
  bannedRepeats(doc, findings);
  bannedTabs(doc, findings);
  sideEffects(html, doc, findings);
  for (const el of elements(doc)) {
    const loc = el.sourceCodeLocation;
    const claimed = bannedOnElement(el, findings);
    if (REFUSED_TAGS.includes(el.tagName))
      findings.push(finding(`refused-${el.tagName}`, 'index.html', loc, `<${el.tagName}> is refused by the Huwise editor on save`));
    if (el.tagName.startsWith('ods-') && !WIDGET_TAGS.has(el.tagName) && !claimed.has(el.tagName))
      findings.push(finding('unlisted-widget', 'index.html', loc, `<${el.tagName}> is not on the closed Widget list (references/widgets.json)`));
    for (const [markup, required] of REQUIRED_ATTRS) {
      if (el.tagName !== markup && !el.attrs.some(a => a.name === markup)) continue;
      for (const [name, value] of Object.entries(required))
        if (!el.attrs.some(a => a.name === name && a.value === value))
          findings.push(finding('required-widget-attribute', 'index.html', loc, `${markup} needs ${name}="${value}" (references/widgets.json)`));
    }
    const unlisted = unlistedWidgetAttrs(el);
    for (const name of unlisted.filter(n => !claimed.has(n)))
      findings.push(finding('unlisted-widget', 'index.html', loc.attrs?.[name] ?? loc, `"${name}" is not on the closed Widget list (references/widgets.json)`));
    for (const name of undocumentedWidgetAttrs(el, new Set([...claimed, ...unlisted])))
      findings.push(finding('undocumented-widget-attribute', 'index.html', loc.attrs?.[name] ?? loc,
        `"${name}" is not documented in the Widget family file (references/widgets/). It may still work; check the ods-widgets source before relying on it`, 'warning'));
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
  // Banned habits ignore comments: blank them out, keeping line breaks so locations hold.
  const code = css.replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ' ')).split('\n');
  code.forEach((text, i) => {
    for (const [habit, m] of matchers('css'))
      for (const match of text.matchAll(new RegExp(m.css, 'g')))
        findings.push(habitFinding(habit, 'stylesheet.css', { startLine: i + 1, startCol: match.index + 1 }));
  });
  return findings;
}

// One finding per rule and location, even when several matchers of a habit hit the same spot.
const unique = findings => [...new Map(findings.map(f =>
  [`${f.rule}@${f.location.file}:${f.location.line}:${f.location.column}`, f])).values()];

export function lint({ html, css }) {
  const doc = parseFragment(html, { sourceCodeLocationInfo: true });
  return unique([...lintHtml(html, doc), ...lintCss(css), ...lintLayout({ doc, css })]);
}
