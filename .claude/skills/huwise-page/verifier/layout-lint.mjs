// Layout lint, no network (ADR 0002). Three rules, driven by ../references/base-stylesheet.json and
// scroll-containers.json:
// - missing-footer: no element carries the footer marker class (Pattern 15 is mandatory).
// - no-fixed-height: an ods-chart / ods-map whose parent has no explicit fixed height. Fixed means the
//   parent carries a base-stylesheet area class, an inline `height` in px / calc() / max() / min() /
//   clamp() / var(), or a Page CSS rule that declares such a height and whose selector matches it.
//   The cascade is not resolved: a matching declaration is enough.
// - fixed-width-too-wide: `width` or `min-width` above 375px in px on a content element, in inline
//   styles or in CSS rules (max-width is always fine). Elements inside a scroll container (the table
//   wrapper, the tab bar) are exempt, so a wide table can scroll there.
import fs from 'node:fs';
import path from 'node:path';

const REFERENCES = path.join(import.meta.dirname, '..', 'references');
const reference = file => JSON.parse(fs.readFileSync(path.join(REFERENCES, file), 'utf8'));
const BASE = reference('base-stylesheet.json');
const SCROLL = reference('scroll-containers.json').selectors;

function* elements(node) {
  for (const child of node.childNodes ?? []) {
    if (child.tagName) yield child;
    yield* elements(child);
    if (child.content) yield* elements(child.content);
  }
}
const attr = (el, name) => el.attrs?.find(a => a.name === name)?.value;
const classesOf = el => (attr(el, 'class') ?? '').split(/\s+/).filter(Boolean);

// ---------- a small selector matcher: tag, .class, #id, [attr], descendant and child combinators ----------
// Pseudo-classes and pseudo-elements are ignored (`.a:hover` matches like `.a`). Selectors with sibling
// combinators or :root match nothing: a lint must not guess.
function parseSelector(selector) {
  if (/[+~]|:root/.test(selector)) return null;
  const parts = [];   // compound selectors, left to right, each with the combinator that precedes it
  let combinator = ' ';
  for (const token of selector.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/)) {
    if (token === '>') { combinator = '>'; continue; }
    const compound = { combinator, tag: null, classes: [], id: null, attrs: [] };
    const bare = token.replace(/::?[\w-]+(\([^)]*\))?/g, '');
    for (const m of bare.matchAll(/^([\w-]+|\*)|\.([\w-]+)|#([\w-]+)|\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/g)) {
      if (m[1] && m[1] !== '*') compound.tag = m[1].toLowerCase();
      else if (m[2]) compound.classes.push(m[2]);
      else if (m[3]) compound.id = m[3];
      else if (m[4]) compound.attrs.push([m[4], m[5]]);
    }
    parts.push(compound);
    combinator = ' ';
  }
  return parts;
}
const matchesCompound = (el, c) =>
  (!c.tag || el.tagName === c.tag)
  && c.classes.every(k => classesOf(el).includes(k))
  && (!c.id || attr(el, 'id') === c.id)
  && c.attrs.every(([n, v]) => attr(el, n) !== undefined && (v === undefined || attr(el, n) === v));
function matches(el, parts) {
  const at = (node, i) => {
    if (!node?.tagName || !matchesCompound(node, parts[i])) return false;
    if (i === 0) return true;
    if (parts[i].combinator === '>') return at(node.parentNode, i - 1);
    for (let p = node.parentNode; p?.tagName; p = p.parentNode) if (at(p, i - 1)) return true;
    return false;
  };
  return at(el, parts.length - 1);
}
const scrollParts = SCROLL.map(parseSelector).filter(Boolean);
const inScrollContainer = el => {
  for (let node = el; node?.tagName; node = node.parentNode)
    if (scrollParts.some(p => matches(node, p))) return true;
  return false;
};

// ---------- CSS rules: [{ selectors, declarations: [{ name, value, line, column }] }] ----------
function cssRules(css) {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ' '));
  const rules = [];
  const lineCol = index => {
    const before = code.slice(0, index).split('\n');
    return { line: before.length, column: before.at(-1).length + 1 };
  };
  for (const m of code.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (selector.startsWith('@')) continue;   // @font-face; @media bodies are matched as plain rules
    const bodyStart = m.index + m[0].indexOf('{') + 1;
    const declarations = [];
    let offset = 0;
    for (const text of m[2].split(';')) {
      const d = text.match(/^(\s*)([\w-]+)\s*:\s*([\s\S]*?)\s*$/);
      if (d) declarations.push({ name: d[2].toLowerCase(), value: d[3], ...lineCol(bodyStart + offset + d[1].length) });
      offset += text.length + 1;
    }
    rules.push({ selectors: selector.split(',').map(parseSelector).filter(Boolean), declarations });
  }
  return rules;
}

const FIXED_HEIGHT = /^(\d+(\.\d+)?px|(calc|max|min|clamp)\([^%]*\)|var\(--[\w-]+\))$/i;
const isFixedHeight = value => FIXED_HEIGHT.test(value.replace(/\s*!important$/i, '')) && !/vh|auto/i.test(value);
const styleDeclarations = el => (attr(el, 'style') ?? '').split(';')
  .map(t => t.match(/^\s*([\w-]+)\s*:\s*([\s\S]*?)\s*$/)).filter(Boolean).map(m => ({ name: m[1].toLowerCase(), value: m[2] }));

const finding = (rule, file, line, column, message) =>
  ({ rule, severity: 'error', location: { file, line, column }, message });

export function lintLayout({ doc, css }) {
  const findings = [];
  const els = [...elements(doc)];
  const rules = cssRules(css);
  const ruleMatches = (el, rule) => rule.selectors.some(p => matches(el, p));

  // missing-footer
  if (!els.some(el => classesOf(el).includes(BASE.footerClass)))
    findings.push(finding('missing-footer', 'index.html', 1, 1,
      `The Page has no footer: no element carries the class "${BASE.footerClass}" (Pattern 15, mandatory on every Page)`));

  // no-fixed-height
  const hasFixedHeight = el =>
    classesOf(el).some(c => BASE.fixedHeightClasses.includes(c))
    || styleDeclarations(el).some(d => d.name === 'height' && isFixedHeight(d.value))
    || rules.some(r => ruleMatches(el, r) && r.declarations.some(d => d.name === 'height' && isFixedHeight(d.value)));
  for (const el of els.filter(e => e.tagName === 'ods-chart' || e.tagName === 'ods-map')) {
    const parent = el.parentNode?.tagName ? el.parentNode : null;
    if (!parent || !hasFixedHeight(parent)) {
      const loc = el.sourceCodeLocation;
      findings.push(finding('no-fixed-height', 'index.html', loc.startLine, loc.startCol,
        `<${el.tagName}> needs a parent with an explicit fixed height (${BASE.fixedHeightClasses.map(c => `.${c}`).join(', ')}, or px/calc() derived from --target-height)`));
    }
  }

  // fixed-width-too-wide
  const tooWide = value => {
    const px = value.match(/^(\d+(?:\.\d+)?)px$/i);
    return px && Number(px[1]) > BASE.maxFixedWidth;
  };
  const isWidth = name => name === 'width' || name === 'min-width';
  for (const el of els) {
    if (inScrollContainer(el)) continue;
    const loc = el.sourceCodeLocation;
    for (const d of styleDeclarations(el))
      if (isWidth(d.name) && tooWide(d.value))
        findings.push(finding('fixed-width-too-wide', 'index.html', loc.attrs?.style?.startLine ?? loc.startLine, loc.attrs?.style?.startCol ?? loc.startCol,
          `<${el.tagName}> has a fixed ${d.name} of ${d.value}, above ${BASE.maxFixedWidth}px`));
  }
  for (const rule of rules)
    for (const d of rule.declarations)
      if (isWidth(d.name) && tooWide(d.value.replace(/\s*!important$/i, '')) &&
          els.some(el => ruleMatches(el, rule) && !inScrollContainer(el)))
        findings.push(finding('fixed-width-too-wide', 'stylesheet.css', d.line, d.column,
          `A fixed ${d.name} of ${d.value} on a content element, above ${BASE.maxFixedWidth}px (allowed only inside ${SCROLL.join(' or ')})`));
  return findings;
}
