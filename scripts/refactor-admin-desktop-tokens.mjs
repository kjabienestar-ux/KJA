// Conservative migration: only declarations with an explicit desktop media guard
// AND a positive selector anchored in the generated token scope. Dry run by default.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import { JSDOM } from 'jsdom';
import { scanPortal } from './check-admin-colors.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const tokens = JSON.parse(fs.readFileSync(path.join(root, 'assets/admin-tokens.json'), 'utf8')).values;
const scopeCss = fs.readFileSync(path.join(root, 'assets/css/paginas/kja-admin-tokens.css'), 'utf8');
const tokenScope = postcss.parse(scopeCss).nodes.find(n => n.type === 'atrule').nodes.find(n => n.type === 'rule').selector;
const scope = new Set(postcss.list.comma(tokenScope));
const doc = new JSDOM(fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8')).window.document;
for (const el of doc.querySelectorAll('#view-gestion [id],#view-admin-cuentas [id]')) {
  // Section roots are static. Do not assume the lifetime/parent of dynamic controls.
  if (/^admin-[\w-]+-section$/.test(el.id)) scope.add('#' + el.id);
}
// Access uses this class on its static admin-access-section workbench.
scope.add('.aw-workbench');
scope.add('.pw-workbench');
// These unique classes are on the token-scoped dialog roots in dashboard.html.
for(const id of ['admin-role-dialog','admin-role-confirm-modal']){
  const el=doc.getElementById(id);
  if(el?.classList.contains(id)&&doc.querySelectorAll('.'+id).length===1)scope.add('.'+id);
}

export function explicitDesktop(media) {
  return postcss.list.comma(media).every(query => !/\b(?:not|or)\b/i.test(query) &&
    [...query.matchAll(/\(\s*min-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)/gi)].some(m => Number(m[1]) >= 901));
}

function firstChoice(selector) {
  if (!/^:(?:is|where)\(/.test(selector)) return null;
  const begin = selector.indexOf('('); let depth = 0;
  for (let i = begin; i < selector.length; i++) {
    if (selector[i] === '(') depth++;
    if (selector[i] === ')' && --depth === 0) return selector.slice(begin + 1, i);
  }
  return null;
}

export function anchored(selector) {
  // A sibling combinator can escape the token root. Be conservative with any +/~.
  if (/[+~]/.test(selector)) return false;
  // Split only outside CSS functions/attribute selectors, so a compound such
  // as #portal.admin-wide:is([data-admin-section=...],...) is also recognised.
  const parts=postcss.list.space(selector.trim());
  let stripped=selector.trim();
  if(parts.length>1&&/^#portal(?=[.#:\[]|$)/.test(parts[0]))stripped=parts.slice(1).join(' ').replace(/^>\s*/, '');
  const choice = firstChoice(stripped);
  if (choice !== null) return postcss.list.comma(choice).every(anchored);
  const start = /^(#[\w-]+|\.[\w-]+)/.exec(stripped)?.[1];
  return scope.has(start);
}

const normalizedHex = value => {
  if (!/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) return null;
  const lower = value.toLowerCase();
  return lower.length === 4 ? '#' + [...lower.slice(1)].map(c => c + c).join('') : lower;
};
function tokenHex(name,seen=new Set()){
  if(seen.has(name))return null;seen.add(name);
  const value=tokens[name],alias=/^var\(--kja-([\w-]+)\)$/.exec(value??'');
  return alias?tokenHex(alias[1],seen):normalizedHex(value??'');
}
const secondaryInk = new Set(['#69635d', '#6c6a64', '#625e56', '#5c564f']);
const primaryInk = new Set(['#282622','#24241f','#252523']);
const legacyAccent = new Set(['#a9583e','#98492e']);
const exact = new Map();
for (const name of Object.keys(tokens)) {
  const hex = tokenHex(name);
  if (hex) (exact.get(hex) ?? exact.set(hex, []).get(hex)).push(name);
}
// Explicitly reviewed legacy families. These rules are in addition to the two
// scope guards in refactorCss; never apply them to arbitrary shared sheets.
const reconciledFamilies = /(?:^|[\\/])dashboard-(?:access-workbench|admin-organization|people-workbench|month-tramos)\.css$/;
function familyColorToken(hex, prop, selector, file) {
  if (!reconciledFamilies.test(file)) return null;
  const ink = prop === 'color', fill = prop === 'background' || prop === 'background-color';
  const edge = /^border(?:-[\w-]+)?$/.test(prop);
  const control = /(?:\b(?:button|input|select|textarea)\b|(?:-search|-manage|-picker|-trigger|-retry|-save|-link|-step-number|-policy-number|-route-step\.disabled|-office-detect))/.test(selector);
  const persistent = /aria-(?:pressed|checked|selected|current)|\.is-(?:selected|active|edited)|:has\(input:checked\)/.test(selector);
  if (/^outline(?:-color)?$/.test(prop) && /:focus(?:-visible|-within)?\b/.test(selector) && ['#93472f','#98492e'].includes(hex)) return 'focus';
  if (edge && /:focus-within/.test(selector) && hex === '#93472f') return 'field-border';
  if (edge && control && !persistent && ['#998b7f','#9a8c7b','#b5a797','#aa9786'].includes(hex)) return 'field-border';
  if (edge && !control && ['#e6dfd8','#e6ded4','#e8ded2','#e5dbce','#eee7de','#cfc2b5'].includes(hex)) return 'divider-subtle';
  if (/^border-(?:top|bottom|right|left)$/.test(prop) && ['#e6dfd8','#e6ded4','#e8ded2','#e5dbce','#eee7de'].includes(hex)) return 'divider-subtle';
  if (ink && /::placeholder/.test(selector) && ['#6a665f','#9a928a'].includes(hex)) return 'text-secondary';
  if (ink && ['#51483f','#3d3a36'].includes(hex)) return 'text-primary';
  if (fill && ['#fcfaf7','#fffefa','#faf9f5'].includes(hex) && !/map-shell|map-state|qr-|confetti/.test(selector)) return 'surface-opaque';
  // White is deliberate for QR/map imagery; only replace white in UI controls,
  // form surfaces and editor chrome, not arbitrary artwork or canvases.
  if (fill && hex === '#ffffff' && !/qr-|map-|:disabled/.test(selector) && (control || /admin-editor-(?:block|head|foot|nav|sheet)|pw-editor-profile|pw-segmented/.test(selector))) return 'surface-opaque';
  if (fill && hex === '#f0eae3' && /:disabled/.test(selector)) return 'action-disabled-bg';
  if ((fill || edge) && ['#a9583e','#98492e'].includes(hex) && /(?:#admin-(?:access|days-off)-save|\.admin-role-manage\.is-primary)/.test(selector)) return 'action-primary';
  if (prop === '--people-primary' && hex === '#a9583e') return 'action-primary';
  if (prop === '--people-primary-hover' && hex === '#8e432b') return 'action-primary-hover';
  if (prop === '--people-card-bg' && hex === '#ffffff') return 'surface-opaque';
  if (prop === 'accent-color' && ['#a9583e','#98492e'].includes(hex)) return 'action-primary';
  if (ink && hex === '#ffffff' && /#admin-(?:access|days-off)-save|#admin-refresh/.test(selector)) return 'on-action';
  if (fill && hex === '#f0e2d5' && /::selection|\.lp-(?:day\.is-selected|people-list|selected-dates|views)/.test(selector)) return 'surface-accent-tint';
  return null;
}
export function colorToken(hex, prop, selector, file) {
  const reconciled=familyColorToken(hex,prop,selector,file);
  if(reconciled)return reconciled;
  const status=/\b(?:status|badge|tag|pill)\b/i.test(selector);
  const control=/\b(?:input|select|textarea|button|trigger|picker)\b/i.test(selector);
  const ink = prop === 'color' || /^(--[\w-]*-(?:muted|ink|text|foreground))$/.test(prop) || (prop==='--navy'&&selector.includes('.aw-workbench'));
  const fill = /^(?:background(?:-color)?|fill|--[\w-]*-(?:bg|surface|background|hover|soft|tint|focus))$/.test(prop);
  const edge = /^(?:border(?:-[\w-]+)?|outline(?:-color)?|stroke|--[\w-]*-(?:border|line|edge|line-hover))$/.test(prop);
  const accent=/^--[\w-]*-accent(?:-hover)?$/.test(prop)||(prop==='--blue'&&selector.includes('.aw-workbench'));
  if(ink&&primaryInk.has(hex)&&!status)return 'text-primary';
  if(accent&&legacyAccent.has(hex))return 'action-primary';
  if(accent&&hex==='#8e432b')return 'action-primary-hover';
  if (!(ink || fill || edge)) return null;
  if (ink && secondaryInk.has(hex) && !status) return 'text-secondary';
  if(legacyAccent.has(hex)&&!status&&!/:focus/.test(selector)){
    if(edge&&/tab/.test(selector))return 'tab-indicator-color';
    if(ink||/action|button|refresh|heading-icon|tab|filter|accent/i.test(selector))return 'action-primary';
  }
  if(hex==='#ded6cb'&&edge&&!control)return 'divider-subtle';
  if(hex==='#aa9786'&&/^--[\w-]*-line-hover$/.test(prop))return 'field-border';
  if((hex==='#fcfaf7'||hex==='#faf9f5')&&fill&&(/-(?:field-bg|surface|card-bg)$/.test(prop)||/\b(?:input|select|textarea|card)\b/.test(selector)))return 'surface-opaque';
  if(hex==='#f5ece1'&&fill&&/-tint$/.test(prop))return 'surface-hover';
  if (hex === '#ffffff') return ink && /(?:button|primary|danger|action)[\w-]*/i.test(selector) ? 'on-action' : null;
  if (hex === '#527966') return /:focus/.test(selector) ? 'focus' : /aria-(?:selected|pressed)|is-selected|is-active/.test(selector) ? 'selection-border' : null;
  if (hex === '#93472f') return /:focus/.test(selector) ? null : /tab/.test(selector) && edge ? 'tab-indicator-color' : 'action-primary';
  if (hex === '#365e4a') return /status|badge|tag|pill/.test(selector) ? 'status-text' : ink || edge || fill ? 'action-secondary' : null;
  if (hex === '#f1ede6') return /disabled/.test(selector) ? 'action-disabled-bg' : /:active/.test(selector) ? 'action-neutral-pressed' : 'status-neutral-bg';
  if (hex === '#5c564f') return /disabled/.test(selector) ? 'action-disabled-text' : 'status-neutral-text';
  if (hex === '#e9dfd1') return /avatar/.test(selector) ? 'person-avatar-bg' : /filter|segment/.test(selector) ? 'filter-pressed-bg' : null;
  const matching = exact.get(hex) ?? [];
  if (matching.length !== 1) return null;
  const name = matching[0];
  if (name.startsWith('chart-') || name === 'loading-neutral' && !/sk-|skeleton|load/i.test(selector)) return null;
  if (name === 'surface-opaque' || name === 'surface-hover' || name === 'surface-canvas' || name === 'surface-accent-tint' || name.endsWith('-bg') || name === 'loading-neutral') return fill ? name : null;
  if (name === 'surface-border' || name === 'field-border') return edge ? name : null;
  if (name === 'text-primary' || name.endsWith('-text')) return ink ? name : null;
  if (name.startsWith('action-')) return name;
  return null;
}
const spacing = new Set(['4','8','12','16','20','24','32']);
const spacingProp = /^(?:gap|row-gap|column-gap|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?)$/;

export function refactorCss(css, file='input.css') {
  const tree = postcss.parse(css, {from:file});
  const report = {color:0,spacing:0,duplicates:0,nonExactInk:0,nonExactColor:0};
  tree.walkRules(rule => {
    if (!postcss.list.comma(rule.selector).every(anchored)) return;
    let desktop = false;
    for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) {
      if (p.type === 'atrule' && p.name === 'media' && explicitDesktop(p.params)) desktop = true;
    }
    if (!desktop) return;
    const seen = new Map();
    for (const decl of [...rule.nodes]) {
      if (decl.type !== 'decl') continue;
      const original = decl.value;
      // Do not modify functions/fallbacks or arbitrary dimension expressions.
      const parsed = valueParser(original);
      parsed.walk(node => {
        if (node.type === 'function') return false;
        if (node.type !== 'word') return;
        const hex = normalizedHex(node.value);
        if (hex) {
          const name = colorToken(hex,decl.prop,rule.selector,file);
          if (name) {
            if(hex!==tokenHex(name)){
              if(name==='text-secondary'||name==='text-primary')report.nonExactInk++;
              else report.nonExactColor++;
            }
            node.value = 'var(--kja-' + name + ')'; report.color++;
          }
        } else if (spacingProp.test(decl.prop) && /^\d+px$/.test(node.value) && spacing.has(node.value.slice(0,-2))) {
          node.value = 'var(--kja-space-' + node.value.slice(0,-2) + ')'; report.spacing++;
        }
      });
      decl.value = parsed.toString();
      const key = JSON.stringify([decl.prop,decl.value,Boolean(decl.important)]);
      // Remove only a previous identical declaration in the very same rule.
      if (seen.has(key)) {seen.get(key).remove(); report.duplicates++;}
      seen.set(key,decl);
    }
  });
  return {css:tree.toString(),report};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const totals = {color:0,spacing:0,duplicates:0,nonExactInk:0,nonExactColor:0};
  const changed = [];
  for (const file of scanPortal().keys()) {
    const absolute = path.join(root,file);
    const original = fs.readFileSync(absolute,'utf8');
    const {css,report} = refactorCss(original,file);
    if (!Object.values(report).some(Boolean)) continue;
    changed.push({file,...report});
    for (const key of Object.keys(totals)) totals[key] += report[key];
    if (process.argv.includes('--write')) fs.writeFileSync(absolute,css);
  }
  console.log(JSON.stringify({mode:process.argv.includes('--write')?'write':'dry-run',totals,changed},null,2));
}
