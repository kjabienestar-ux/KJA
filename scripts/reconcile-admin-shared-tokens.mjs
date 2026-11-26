// Shared rules must keep their original literal fallback; KJA tokens only exist
// in the desktop admin scope. Dry run by default, with a conservative semantic map.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import {anchored,explicitDesktop,colorToken} from './refactor-admin-desktop-tokens.mjs';
import {desktopPossible,scanPortal,literalColors} from './check-admin-colors.mjs';
import {modulePaletteToken} from './reconcile-admin-module-palettes.mjs';
import {directPaletteToken,directPaletteRuleAllowed} from './reconcile-admin-direct-palette.mjs';
import {effectToken} from './reconcile-admin-effects.mjs';
import {moduleFallbackCount} from './reconcile-admin-variable-fallbacks.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const tokens=JSON.parse(fs.readFileSync(path.join(root,'assets/admin-tokens.json'),'utf8')).values;
const normalized=value=>/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value??'')?(value.length===4?'#'+[...value.slice(1)].map(c=>c+c).join(''):value).toLowerCase():null;
const nonExactRoles=new Set(['text-primary','text-secondary']);
function tokenColor(name,visited=new Set()){
  if(visited.has(name))return null;visited.add(name);
  const value=tokens[name],alias=/^var\(--kja-([\w-]+)\)$/.exec(value??'');
  return alias?tokenColor(alias[1],visited):normalized(value);
}
function eligibleSharedRule(rule){
  if(!postcss.list.comma(rule.selector).every(anchored))return false;
  for(let p=rule.parent;p&&p.type!=='root';p=p.parent){
    if(p.type==='atrule'&&(p.name.endsWith('keyframes')||p.name==='media'&&(explicitDesktop(p.params)||!desktopPossible(p.params))))return false;
  }
  return true;
}
function semanticToken(value,decl,rule,file){
  const hex=normalized(value);if(!hex)return null;
  const token=colorToken(hex,decl.prop,rule.selector,file);if(!token)return null;
  const exact=hex===tokenColor(token);
  if(!exact&&!nonExactRoles.has(token))return null;
  if(!exact&&/disabled|status|badge|pill|tag|selected|pressed|active|error|warn|danger|chart|map|qr|avatar|progress/i.test(rule.selector))return null;
  return {token,exact};
}

export function reconcileShared(css,file='input.css'){
  const tree=postcss.parse(css,{from:file});const report={fallbacks:0,exact:0,ink:0};
  tree.walkRules(rule=>{
    if(!eligibleSharedRule(rule))return;
    for(const decl of rule.nodes){
      if(decl.type!=='decl'||decl.prop.startsWith('--kja-'))continue;
      // Avoid guessing meaning of gradients/shadows or dynamic values. A fallback
      // is evaluated in exactly the consumer scope, not in the underlying view.
      const parsed=valueParser(decl.value);parsed.walk(n=>{
        if(n.type==='function')return false;
        if(n.type!=='word')return;
        const semantic=semanticToken(n.value,decl,rule,file);if(!semantic)return;
        const {token,exact}=semantic;
        n.value=`var(--kja-${token}, ${n.value})`;report.fallbacks++;report[exact?'exact':'ink']++;
      });
      decl.value=parsed.toString();
    }
  });
  return {css:tree.toString(),report};
}

// Count only a direct, semantically reviewed fallback whose consumer is in the
// shared-rule scope. Keep it in the literal registry for regression protection.
export function managedFallbackUses(css,file='input.css',{perDeclaration=false}={}){
  const result=new Map(),tree=postcss.parse(css,{from:file});
  tree.walkRules(rule=>{
    const eligible=eligibleSharedRule(rule);
    const parts=[];for(let p=rule;p&&p.type!=='root';p=p.parent){if(p.type==='atrule')parts.unshift('@'+p.name+' '+p.params.trim());else if(p.type==='rule')parts.unshift(p.selector.trim());}
    for(const decl of rule.nodes){if(decl.type!=='decl')continue;
      const key=JSON.stringify(perDeclaration?[file,parts,decl.prop,decl.source.start.line,decl.source.start.column]:[file,parts]);
      const effect=/^var\(--kja-([\w-]+),\s*([\s\S]*)\)$/.exec(decl.value);
      if(effect&&directPaletteRuleAllowed(rule)&&effectToken(file,rule.selector,decl.prop,effect[2])===effect[1]){
        const count=literalColors(decl.prop,effect[2]).length;if(count)result.set(key,(result.get(key)??0)+count);continue;
      }
      const moduleToken=modulePaletteToken(file,decl.prop,rule.selector);
      if(moduleToken&&decl.value.startsWith('var(--kja-'+moduleToken+',')){
        const count=literalColors(decl.prop,decl.value).length;
        if(count)result.set(key,(result.get(key)??0)+count);
        continue;
      }
      if(decl.prop.startsWith('--kja-'))continue;
      const nested=directPaletteRuleAllowed(rule)?moduleFallbackCount(file,rule.selector,decl.prop,decl.value):0;
      if(nested)result.set(key,(result.get(key)??0)+nested);
      // The legacy shimmer keeps its gradient geometry and exact fallback
      // stops. Only this known loading rule may count nested gradient aliases.
      if(file.endsWith('/dashboard-admin-seguimiento.css')&&rule.selector.trim()==='#admin-seguimiento-section .seg-skeleton'&&decl.prop==='background'&&
         decl.value.replace(/\s+/g,'')==='linear-gradient(110deg,var(--kja-loading-neutral,#e5dfd5),var(--kja-loading-shine,#faf9f5),var(--kja-loading-neutral,#e5dfd5))'){
        result.set(key,(result.get(key)??0)+3);continue;
      }
      valueParser(decl.value).walk(n=>{
        if(n.type!=='function')return;
        if(n.value==='var'){
          const args=n.nodes.filter(x=>x.type!=='space'&&x.type!=='comment');
          if(args.length===3&&args[0].type==='word'&&args[1].type==='div'&&args[1].value===','&&['word','function'].includes(args[2].type)){
            const fallback=valueParser.stringify(args[2]);
            const direct=directPaletteRuleAllowed(rule)?directPaletteToken(file,rule.selector,decl.prop,fallback):null;
            const m=eligible?semanticToken(fallback,decl,rule,file):null;
            if((direct&&args[0].value==='--kja-'+direct)||(m&&args[0].value==='--kja-'+m.token))result.set(key,(result.get(key)??0)+1);
          }
        }
        return false;
      });
    }
  });return result;
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const changed=[],totals={fallbacks:0,exact:0,ink:0};
  for(const file of scanPortal().keys()){
    const absolute=path.join(root,file),original=fs.readFileSync(absolute,'utf8'),{css,report}=reconcileShared(original,file);
    if(!report.fallbacks)continue;
    changed.push({file,...report});for(const k of Object.keys(totals))totals[k]+=report[k];
    if(process.argv.includes('--write'))fs.writeFileSync(absolute,css);
  }
  console.log(JSON.stringify({mode:process.argv.includes('--write')?'write':'dry-run',totals,changed},null,2));
}
