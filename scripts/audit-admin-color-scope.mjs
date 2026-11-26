// Classify inherited literals without discarding exceptions or assuming that a
// shared stylesheet is either all administrative or all mobile.
import fs from 'node:fs';
import postcss from 'postcss';
import {explicitDesktop,anchored} from './refactor-admin-desktop-tokens.mjs';

const registry=JSON.parse(fs.readFileSync(new URL('../docs/auditorias/KJA-051/excepciones-colores.json',import.meta.url),'utf8'));
const buckets={};
for(const [file,entries] of Object.entries(registry))for(const [key,colors] of entries){
  const parts=key.split(' | ')[0].split(' / '),selector=parts.at(-1);
  const desktop=parts.some(p=>p.startsWith('@media ')&&explicitDesktop(p.slice(7)));
  const scoped=postcss.list.comma(selector).every(anchored);
  const category=(desktop?'desktop':'shared-or-unrestricted')+'-'+(scoped?'anchored':'unproven');
  const bucket=buckets[category]??={count:0,files:{},colors:{}};
  for(const [literal,count] of Object.entries(colors)){
    bucket.count+=count;bucket.files[file]=(bucket.files[file]??0)+count;bucket.colors[literal]=(bucket.colors[literal]??0)+count;
  }
}
const top=(obj,n)=>Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,n);
const report=Object.fromEntries(Object.entries(buckets).map(([key,b])=>[key,{count:b.count,files:top(b.files,10),colors:top(b.colors,12)}]));
console.log(JSON.stringify({total:Object.values(buckets).reduce((n,b)=>n+b.count,0),categories:report},null,2));
