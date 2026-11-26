import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import namedColors from 'color-name';

const root = fileURLToPath(new URL('../', import.meta.url));
const registry = 'docs/auditorias/KJA-051/excepciones-colores.json';
const generatedTokens = 'assets/css/paginas/kja-admin-tokens.css';
const colorFunction = /^(?:rgba?|hsla?|hwb|(?:ok)?l(?:ab|ch)|color|device-cmyk)$/i;
const colorProperty = /(?:^--|color|background|shadow|border|outline|fill|stroke|decoration|caret|accent|column-rule|scrollbar|mask|filter|gradient)/i;

// Dedicated admin sheets include rules for popups attached directly to body.
const dedicated = /^(?:kja-|assignment-|dashboard-(?:admin-|assignments|contracts|people-|person-editor|close-workspace|control-refined|roles|pasar-lista|ranking|facebook-report|access-workbench|areas\.|overview-modal|month-|attendance-preview))/i;
const adminSelector = /(?:[#.]admin[-\w]*|#view-gestion\b|[#.]assignment[-\w]*|[#.](?:seg|apl|pw|rh|asg|aw|fbr|kja)-[\w-]+|\[data-(?:admin|assignment|lateral-section)\b)/i;

export function desktopPossible(media) {
  return postcss.list.comma(media || 'all').some(query => {
    if (/^\s*not\b/i.test(query)) return true;
    return ![...query.matchAll(/\(\s*(?:max-width\s*:\s*|width\s*<=\s*)([\d.]+)px\s*\)/gi)].some(m => Number(m[1]) < 901)
      && ![...query.matchAll(/\(\s*width\s*<\s*([\d.]+)px\s*\)/gi)].some(m => Number(m[1]) <= 901);
  });
}

export function literalColors(property, value) {
  const colors = [];
  valueParser(value).walk(node => {
    if (node.type === 'function') {
      const name = node.value.toLowerCase();
      if (name === 'url') return false;
      if (colorFunction.test(name) && !/\b(?:var|env)\(/i.test(valueParser.stringify(node.nodes))) {
        colors.push(valueParser.stringify(node).toLowerCase().replace(/\s*([,/])\s*/g, '$1').replace(/\s+/g, ' '));
        return false;
      }
    }
    if (node.type !== 'word') return;
    const word = node.value.toLowerCase();
    if (/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/.test(word)
      || (colorProperty.test(property) && Object.hasOwn(namedColors, word))) colors.push(word);
  });
  return colors;
}

export function inspectCss(css, file, wholeSheet = false) {
  const tree = postcss.parse(css, { from: file });
  const entries = new Map();
  tree.walkDecls(decl => {
    const context = [];
    let inAdmin = wholeSheet;
    for (let parent = decl.parent; parent && parent.type !== 'root'; parent = parent.parent) {
      if (parent.type === 'atrule') {
        if (parent.name.toLowerCase() === 'media' && !desktopPossible(parent.params)) return;
        context.unshift('@' + parent.name + ' ' + parent.params.trim());
      } else if (parent.type === 'rule') {
        if (adminSelector.test(parent.selector)) inAdmin = true;
        context.unshift(parent.selector.trim());
      }
    }
    if (!inAdmin) return;
    const key = context.join(' / ') + ' | ' + decl.prop;
    for (const color of literalColors(decl.prop, decl.value)) {
      if (!entries.has(key)) entries.set(key, new Map());
      const colors = entries.get(key);
      if (!colors.has(color)) colors.set(color, []);
      colors.get(color).push(decl.source.start.line);
    }
  });
  return entries;
}

export function scanPortal() {
  const doc = new JSDOM(fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8')).window.document;
  const scanned = new Map();
  const pending = [];
  function enqueue(href, base, whole = false) {
    const url = new URL(href, new URL(base, 'https://kja.local/'));
    if (url.origin !== 'https://kja.local') return;
    const file = decodeURIComponent(url.pathname.slice(1));
    if (file === generatedTokens) return;
    const full = whole || dedicated.test(path.posix.basename(file));
    if (scanned.has(file) && (scanned.get(file).full || !full)) return;
    scanned.set(file, { full });
    pending.push(file);
  }
  for (const link of doc.querySelectorAll('link[href]')) {
    if ((link.relList.contains('stylesheet') || link.getAttribute('as') === 'style') && desktopPossible(link.media)) {
      enqueue(link.getAttribute('href'), 'dashboard.html');
    }
  }
  while (pending.length) {
    const file = pending.pop();
    const sheet = scanned.get(file);
    const css = fs.readFileSync(path.join(root, file), 'utf8');
    sheet.entries = inspectCss(css, file, sheet.full);
    postcss.parse(css, {from: file}).walkAtRules('import', rule => {
      const first = valueParser(rule.params).nodes[0];
      const href = first.type === 'function' && first.value === 'url' ? first.nodes[0]?.value : first.value;
      if (href) enqueue(href, file, sheet.full);
    });
  }
  return new Map([...scanned].map(([file, sheet]) => [file, sheet.entries]));
}

export function snapshot(scanned) {
  const files = {};
  for (const file of [...scanned.keys()].sort()) {
    const entries = scanned.get(file);
    if (!entries.size) continue;
    files[file] = [...entries.keys()].sort().map(key => [
      key, Object.fromEntries([...entries.get(key)].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([color, lines]) => [color, lines.length]))
    ]);
  }
  return files;
}

export function compare(scanned, allowed) {
  const additions = [];
  for (const [file, entries] of scanned) {
    const old = new Map(allowed[file] || []);
    for (const [key, colors] of entries) {
      for (const [color, lines] of colors) {
        const limit = old.get(key)?.[color] ?? 0;
        for (const line of lines.slice(limit)) additions.push(file + ':' + line + ' · ' + key + ' · ' + color);
      }
    }
  }
  return additions;
}

// One readable entry per selector/property. Pruning can only shrink the registry.
export function formatRegistry(files) {
  return '{\n' + Object.entries(files).map(([file, entries]) =>
    '  ' + JSON.stringify(file) + ': [\n' + entries.map(entry => '    ' + JSON.stringify(entry)).join(',\n') + '\n  ]'
  ).join(',\n') + '\n}\n';
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const scanned = scanPortal();
  const baseline = fs.readFileSync(path.join(root, registry), 'utf8').replace(/\r\n/g, '\n');
  const allowed = JSON.parse(baseline);
  const added = compare(scanned, allowed);
  const current = formatRegistry(snapshot(scanned));
  if (added.length) {
    console.error(added.join('\n'));
    process.exitCode = 1;
  } else if (current !== baseline && process.argv.includes('--prune')) {
    fs.writeFileSync(path.join(root, registry), current);
    console.log('Se retiraron las excepciones que ya no se utilizan.');
  } else if (current !== baseline) {
    console.error('Retira las excepciones en desuso con npm run test:colores -- --prune.');
    process.exitCode = 1;
  } else {
    console.log(scanned.size + ' hojas revisadas; cero colores literales nuevos.');
  }
}
