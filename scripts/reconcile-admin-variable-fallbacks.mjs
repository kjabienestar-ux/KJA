// Keep existing module aliases. Their definitions have already been converted
// to the common KJA role; their literal *fallbacks* must use the same role.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import {scanPortal,literalColors} from './check-admin-colors.mjs';
import {allowed,directPaletteRuleAllowed} from './reconcile-admin-direct-palette.mjs';
import {moduleRoleForProperty} from './reconcile-admin-module-palettes.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
function args(n){return n.nodes.filter(x=>x.type!=='space'&&x.type!=='comment');}
function simpleVar(n){if(n.type!=='function'||n.value!=='var')return null;const a=args(n);return a.length===3&&a[0].type==='word'&&a[1].type==='div'&&a[1].value===','?{name:a[0].value,fallback:a[2]}:null;}
export function moduleFallbackCount(file,selector,prop,value){
  if(!allowed(file,selector))return 0;let count=0;valueParser(value).walk(n=>{
    const outer=simpleVar(n);if(!outer)return n.type==='function'?false:undefined;
    const role=moduleRoleForProperty(file,outer.name),inner=simpleVar(outer.fallback);
    if(role&&inner?.name==='--kja-'+role)count+=literalColors(prop,valueParser.stringify(inner.fallback)).length;
    return false;
  });return count;
}
export function reconcileModuleFallbacks(css,file){
  const tree=postcss.parse(css,{from:file}),changes=[];
  tree.walkRules(rule=>{if(!directPaletteRuleAllowed(rule)||!allowed(file,rule.selector))return;for(const d of rule.nodes){if(d.type!=='decl'||d.prop.startsWith('--'))continue;
    const parsed=valueParser(d.value);parsed.walk(n=>{
      const outer=simpleVar(n);if(!outer)return n.type==='function'?false:undefined;
      const role=moduleRoleForProperty(file,outer.name),old=valueParser.stringify(outer.fallback);
      if(!role||!literalColors(d.prop,old).length||!/^(?:#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i.test(old))return false;
      // The outer module alias remains authoritative. This only supplies its
      // existing design-system role when the original alias is absent.
      outer.fallback.type='word';outer.fallback.value=`var(--kja-${role}, ${old})`;delete outer.fallback.nodes;
      changes.push({selector:rule.selector,prop:d.prop,alias:outer.name,old,role});return false;
    });d.value=parsed.toString();
  }});return {css:tree.toString(),changes};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const changes=[];for(const file of scanPortal().keys()){
    const absolute=path.join(root,file),old=fs.readFileSync(absolute,'utf8'),r=reconcileModuleFallbacks(old,file);
    if(r.changes.length){changes.push({file,uses:r.changes.length});if(process.argv.includes('--write'))fs.writeFileSync(absolute,r.css);}
  }console.log(JSON.stringify({mode:process.argv.includes('--write')?'write':'dry-run',total:changes.reduce((n,x)=>n+x.uses,0),changes},null,2));
}
