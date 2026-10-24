// Companion Dataset lint, no network. Both rules apply only to a Page that declares a context named
// `compctx` (the naming convention, references/core.md), so every other Page is untouched.
// - companion-footer: the footer (Pattern 15) must link both datasets, the main one (`datactx`) and the
//   Companion Dataset (`compctx`): an href naming each dataset ID.
// - companion-mixed-values: a value is never combined across the two datasets. An interpolation or an
//   Angular expression that reads Widget variables (or `.nhits`) of two different dataset contexts, with
//   `compctx` among them, is an error. The values are shown side by side instead. Reading a context's
//   `.parameters[...]` is not a value and stays allowed (the one-way copy, a guarded default).
import fs from 'node:fs';
import path from 'node:path';

const BASE = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'references', 'base-stylesheet.json'), 'utf8'));

function* elements(node) {
  for (const child of node.childNodes ?? []) {
    if (child.tagName) yield child;
    yield* elements(child);
    if (child.content) yield* elements(child.content);
  }
}
function* textNodes(node) {
  for (const child of node.childNodes ?? []) {
    if (child.nodeName === '#text') yield child;
    yield* textNodes(child);
    if (child.content) yield* textNodes(child.content);
  }
}
// AngularJS also accepts the data-/x- prefixed spelling.
function attrOf(el, name) {
  for (const prefix of ['', 'data-', 'x-']) {
    const found = el.attrs?.find(a => a.name === prefix + name);
    if (found) return found;
  }
  return null;
}
const simpleName = v => v?.match(/^\s*\[?\s*([A-Za-z_]\w*)\s*\]?\s*$/)?.[1];
const finding = (rule, loc, message) =>
  ({ rule, severity: 'error', location: { file: 'index.html', line: loc.startLine, column: loc.startCol }, message });

// Widgets that define a variable, and the attribute naming the context they read.
const DEFINERS = [
  ['ods-aggregation', 'ods-aggregation-context'],
  ['ods-adv-analysis', 'ods-adv-analysis-context'],
  ['ods-facet-results', 'ods-facet-results-context'],
  ['ods-results', 'ods-results-context'],
];

// Variable name -> context, looked up from the element outwards (the nearest definition wins).
function contextOfVariable(node, variable) {
  for (; node?.attrs; node = node.parentNode) {
    for (const [widget, ctxAttr] of DEFINERS) {
      const defined = attrOf(node, widget);
      if (!defined) continue;
      const names = defined.value.split(',').map(s => s.trim()).filter(Boolean);
      if (!names.length && widget === 'ods-results') names.push('results');
      const ctx = simpleName(attrOf(node, ctxAttr)?.value) ?? simpleName(attrOf(node, 'context')?.value);
      if (names.includes(variable) && ctx) return ctx;
    }
  }
  return null;
}

export function lintCompanion({ doc }) {
  const els = [...elements(doc)];
  const contexts = new Map();   // context name -> dataset id
  for (const el of els) {
    if (el.tagName !== 'ods-dataset-context' && !attrOf(el, 'ods-dataset-context')) continue;
    for (const ctx of (attrOf(el, 'context')?.value ?? '').split(/[\s,\[\]]+/).filter(Boolean)) {
      const d = attrOf(el, `${ctx}-dataset`);
      if (d) contexts.set(ctx, d.value.trim());
    }
  }
  if (!contexts.has('compctx')) return [];
  const findings = [];

  // companion-footer
  const footers = els.filter(el => (attrOf(el, 'class')?.value ?? '').split(/\s+/).includes(BASE.footerClass));
  if (footers.length) {
    const hrefs = footers.flatMap(f => [...elements({ childNodes: [f] })].filter(e => e.tagName === 'a'))
      .map(a => attrOf(a, 'href')?.value ?? '');
    for (const [ctx, label] of [['datactx', 'main dataset'], ['compctx', 'Companion Dataset']]) {
      const id = contexts.get(ctx);
      if (id && !hrefs.some(h => h.includes(id)))
        findings.push(finding('companion-footer', footers[0].sourceCodeLocation,
          `The footer must name both datasets: no link to the ${label} "${id}" (${ctx}). Add its "Quelle:" link (Pattern 15)`));
    }
  }

  // companion-mixed-values
  const check = (expr, loc, node) => {
    const code = expr.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, '""').replace(/\b\w+\.parameters\b/g, '');
    const used = new Set();
    for (const m of code.matchAll(/(?<![\w$.])([A-Za-z_]\w*)(\.nhits)?/g)) {
      if (m[2] && contexts.has(m[1])) used.add(m[1]);
      else { const c = contextOfVariable(node, m[1]); if (c && contexts.has(c)) used.add(c); }
    }
    if (used.size > 1 && used.has('compctx'))
      findings.push(finding('companion-mixed-values', loc,
        `Values of two datasets are combined (${[...used].join(' and ')}): {{ ${expr.trim()} }}. Never mix the Companion Dataset's values with the main dataset's; show them side by side`));
  };
  for (const node of textNodes(doc)) {
    const loc = node.sourceCodeLocation;
    for (const m of node.value.matchAll(/\{\{([\s\S]*?)\}\}/g)) check(m[1], loc, node.parentNode);
  }
  for (const el of els)
    for (const { name, value } of el.attrs) {
      const loc = el.sourceCodeLocation.attrs?.[name] ?? el.sourceCodeLocation;
      for (const m of value.matchAll(/\{\{([\s\S]*?)\}\}/g)) check(m[1], loc, el);
      if (/^(?:data-|x-)?ng-(?:if|show|hide|class|style|bind)$/.test(name)) check(value, loc, el);
    }
  return findings;
}
