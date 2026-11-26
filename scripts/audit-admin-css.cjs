// Inventory of dedicated admin stylesheets referenced by the portal.
// Usage from the checkout root: node scripts/audit-admin-css.cjs
const fs = require('node:fs');
const path = require('node:path');
const {parse} = require('rrweb-cssom');
const html = fs.readFileSync('dashboard.html', 'utf8');
const files = [...html.matchAll(/href="(assets\/css\/paginas\/dashboard-(?:admin-[\w-]+|contracts|people-[\w-]+|pasar-lista|assignments[\w-]*|ranking|facebook-report|access-workbench|control-refined|close-workspace|roles|date-picker|loading-motion)\.css)(?:\?[^"]*)?"/g)].map(match => match[1]);
const values = Object.fromEntries(['colors','radii','shadows','fontSizes','variables'].map(key => [key,new Set()]));
function visit(rules) {
  for (const rule of rules) {
    if (rule.media && !rule.media.mediaText.split(',').some(query => !/max-width\s*:\s*(?:[1-8]\d\d|900)px/i.test(query))) continue;
    if (rule.cssRules) visit(rule.cssRules);
    if (!rule.selectorText || !rule.style) continue;
    for (let i=0; i<rule.style.length; i++) {
      const prop=rule.style[i], value=rule.style.getPropertyValue(prop);
      if (prop.startsWith('--')) values.variables.add(prop);
      if (prop.endsWith('radius')) values.radii.add(value);
      if (prop==='box-shadow') values.shadows.add(value);
      if (prop==='font-size') values.fontSizes.add(value);
      for (const literal of value.replace(/url\([^)]*\)/gi,'').match(/#[\da-f]{3,8}\b|(?:rgb|hsl)a?\([^()]*\)/gi) || []) values.colors.add(literal.toLowerCase().replace(/\s+/g,''));
    }
  }
}
for (const file of new Set(files)) visit(parse(fs.readFileSync(file,'utf8')).cssRules);
const inventory=Object.fromEntries(Object.entries(values).map(([key,set])=>[key,[...set].sort()]));
const report={files:[...new Set(files)].sort(),counts:Object.fromEntries(Object.entries(inventory).map(([key,items])=>[key,items.length])),values:inventory};
const out=path.resolve('.tmp/kja-051');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'css-source.json'),JSON.stringify(report,null,2)+'\n');
console.log(report.files.length,report.counts);
