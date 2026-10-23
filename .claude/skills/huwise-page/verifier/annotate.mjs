// Render stage helper: marks every element the render stage needs to find again in the compiled DOM
// (listed Widgets, author-written ng-click) with data-verify-id="N". Angular keeps attributes when it
// clones an element (ng-if, ng-repeat) or replaces a Widget's tag, so an id seen in the DOM means that
// source element rendered. The markup is edited at the start tag only; nothing else is touched.
import fs from 'node:fs';
import path from 'node:path';
import { parseFragment } from 'parse5';

const WIDGETS = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'references', 'widgets.json'), 'utf8')).widgets;
const TAGS = new Map(WIDGETS.filter(w => w.form !== 'attribute').map(w => [w.markup, w]));
const ATTRS = new Map(WIDGETS.filter(w => w.form !== 'element').map(w => [w.markup, w]));
const unprefixed = name => name.replace(/^(data|x)-/, '');

/** Returns { html, elements: { [id]: { kind, label, line } }, repeats: [expression] }.
 *  kind is a Widget's markup name ('ods-chart') or 'ng-click'; click holds the ng-click expression, if any. */
export function annotate(html) {
  const elements = {};
  const repeats = [];
  const inserts = [];
  const visit = node => {
    if (node.attrs && node.sourceCodeLocation?.startTag) {
      const attr = name => node.attrs.find(a => unprefixed(a.name) === name)?.value;
      const widget = TAGS.get(node.nodeName) ?? [...ATTRS.values()].find(w => attr(w.markup) !== undefined);
      const click = attr('ng-click');
      const repeat = attr('ng-repeat');
      if (repeat) repeats.push(repeat.trim());
      const kind = widget ? widget.markup : click !== undefined ? 'ng-click' : null;
      if (kind) {
        const id = String(Object.keys(elements).length);
        const loc = node.sourceCodeLocation.startTag;
        elements[id] = {
          kind,
          label: widget ? (TAGS.has(node.nodeName) ? `<${node.nodeName}>` : `${widget.markup}="${attr(widget.markup)}"`) : `ng-click="${click}"`,
          line: loc.startLine,
          click: click ?? null,
        };
        inserts.push([loc.startOffset + 1 + node.nodeName.length, ` data-verify-id="${id}"`]);
      }
    }
    for (const child of node.childNodes ?? []) visit(child);
    if (node.content) visit(node.content);
  };
  visit(parseFragment(html, { sourceCodeLocationInfo: true }));
  let out = html;
  for (const [at, text] of inserts.sort((a, b) => b[0] - a[0])) out = out.slice(0, at) + text + out.slice(at);
  return { html: out, elements, repeats };
}
