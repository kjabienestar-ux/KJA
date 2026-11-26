// A declaration-level companion to the consumer audit. A rule may contain a
// managed fallback as well as unrelated literals; never subtract by hue alone.
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {scanPortal,literalColors,desktopPossible} from './check-admin-colors.mjs';
import {managedFallbackUses} from './reconcile-admin-shared-tokens.mjs';
import {outsideAdmin,exceptionReason} from './admin-legacy-exceptions.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export function pendingDeclarations({includeJustified=false}={}){
  const rows=[];
  for(const [file,entries] of scanPortal()){
    const css=fs.readFileSync(path.join(root,file),'utf8'),managed=managedFallbackUses(css,file,{perDeclaration:true});
    postcss.parse(css,{from:file}).walkDecls(d=>{
      if(d.parent.type!=='rule')return;
      const parts=[];for(let p=d.parent;p&&p.type!=='root';p=p.parent){
        if(p.type==='atrule'){if(p.name==='media'&&!desktopPossible(p.params))return;parts.unshift('@'+p.name+' '+p.params.trim());}
        if(p.type==='rule')parts.unshift(p.selector.trim());
      }
      if(outsideAdmin(d.parent.selector,file))return;
      const key=parts.join(' / ')+' | '+d.prop,known=entries.get(key);if(!known)return;
      const colors=literalColors(d.prop,d.value);if(!colors.length)return;
      const m=managed.get(JSON.stringify([file,parts,d.prop,d.source.start.line,d.source.start.column]))??0;
      if(m>=colors.length)return;
      const reason=exceptionReason(file,d.parent.selector,d.prop,d.value,parts.slice(0,-1));
      if(reason&&!includeJustified)return;
      rows.push({file,selector:d.parent.selector,at:parts.slice(0,-1),prop:d.prop,value:d.value,line:d.source.start.line,colors,pending:colors.length-m,reason});
    });
  }
  return rows;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const rows=pendingDeclarations(),total=rows.reduce((n,x)=>n+x.pending,0),files={};
  for(const row of rows){const f=files[row.file]??={total:0,props:{}};f.total+=row.pending;f.props[row.prop]=(f.props[row.prop]??0)+row.pending;}
  const output=path.join(root,'.tmp/kja-051/pending-declarations.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(rows,null,2));
  console.log(JSON.stringify({total,files: Object.fromEntries(Object.entries(files).sort((a,b)=>b[1].total-a[1].total)),output},null,2));
}
