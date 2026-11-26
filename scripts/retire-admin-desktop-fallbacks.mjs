// A literal backup is needed in shared styles, but not if both the media
// query and every selector alternative prove the generated token scope.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import {anchored,explicitDesktop} from './refactor-admin-desktop-tokens.mjs';
import {scanPortal,literalColors} from './check-admin-colors.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const tokens=JSON.parse(fs.readFileSync(path.join(root,'assets/admin-tokens.json'),'utf8')).values;
function eligible(rule){
  if(!postcss.list.comma(rule.selector).every(anchored))return false;let desktop=false;
  for(let p=rule.parent;p&&p.type!=='root';p=p.parent){
    if(p.type==='atrule'&&(p.name.endsWith('keyframes')||p.name==='supports'||p.name==='media'&&/prefers-reduced-transparency|forced-colors|\bprint\b/.test(p.params)))return false;
    if(p.type==='atrule'&&p.name==='media'&&explicitDesktop(p.params))desktop=true;
  }
  return desktop;
}
export function retireDesktopFallbacks(css,file){
  const tree=postcss.parse(css,{from:file}),changes=[];tree.walkRules(rule=>{if(!eligible(rule))return;
    for(const d of rule.nodes){if(d.type!=='decl')continue;const parsed=valueParser(d.value);parsed.walk(n=>{
      if(n.type!=='function'||n.value!=='var')return;
      const args=n.nodes.filter(x=>x.type!=='space'&&x.type!=='comment');const name=args[0]?.value;
      if(typeof name!=='string'||!name.startsWith('--kja-')||!Object.hasOwn(tokens,name.slice(6)))return;
      const comma=n.nodes.findIndex(x=>x.type==='div'&&x.value===',');if(comma<0)return;
      const fallback=valueParser.stringify(n.nodes.slice(comma+1)),count=literalColors(d.prop,fallback).length;if(!count)return;
      n.nodes=[{type:'word',value:name}];changes.push({selector:rule.selector,prop:d.prop,token:name,fallback,count});return false;
    });d.value=parsed.toString();}
  });return {css:tree.toString(),changes};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const changes=[];for(const file of scanPortal().keys()){
    const absolute=path.join(root,file),old=fs.readFileSync(absolute,'utf8'),r=retireDesktopFallbacks(old,file);if(r.changes.length){changes.push({file,uses:r.changes.reduce((n,c)=>n+c.count,0)});if(process.argv.includes('--write'))fs.writeFileSync(absolute,r.css);}
  }console.log(JSON.stringify({mode:process.argv.includes('--write')?'write':'dry-run',total:changes.reduce((n,x)=>n+x.uses,0),changes},null,2));
}
