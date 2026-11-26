// Per-declaration decisions from inspection of legacy component families.
// Exact file, selector, property and old value: no match by hue or line number.
import fs from 'node:fs';
import path from 'node:path';
import {literalColors} from './check-admin-colors.mjs';
const rows=JSON.parse(fs.readFileSync(new URL('./admin-reviewed-declarations.json',import.meta.url),'utf8'));
const tokens=JSON.parse(fs.readFileSync(new URL('../assets/admin-tokens.json',import.meta.url),'utf8')).values;
const key=(file,selector,prop,value,mode)=>JSON.stringify([path.posix.basename(file.replaceAll('\\','/')),selector.trim(),prop,value,mode]);
const table=new Map();
for(const [file,selector,prop,value,role,mode] of rows){
  if(!Object.hasOwn(tokens,role)||!['whole','color'].includes(mode))throw Error('Invalid reviewed declaration role: '+role);
  const k=key(file,selector,prop,value,mode);
  if(table.has(k)&&table.get(k)!==role)throw Error('Conflicting reviewed declaration: '+k);
  table.set(k,role);
}
export function reviewedDeclarationToken(file,selector,prop,value,mode){
  if(mode==='color'){
    const colors=literalColors(prop,value);
    if(colors.length!==1)return null;
    value=colors[0];
  }
  return table.get(key(file,selector,prop,value,mode))??null;
}
