import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
export function checkCorrespondence(){
const r=JSON.parse(fs.readFileSync('docs/auditorias/KJA-051/correspondencias.json','utf8'));
const d=new JSDOM(fs.readFileSync(r.catalog,'utf8')).window.document,keys=new Set(),ids=new Set(),errors=[];
for(const family of r.families){
  if(keys.has(family.key))errors.push('Clave repetida: '+family.key);keys.add(family.key);
  if(!d.getElementById(family.section))errors.push('Sección del catálogo ausente: '+family.section);
  if(!family.figma.length||family.figma.some(x=>!/^\d+:\d+$/.test(x)))errors.push('ID Figma inválido: '+family.key);
  for(const id of family.figma)ids.add(id);
  if(!family.code.length)errors.push('Sin implementación: '+family.key);
  for(const [file,marker] of family.code){if(!fs.existsSync(file)||!fs.readFileSync(file,'utf8').includes(marker))errors.push(family.key+': '+file+' no contiene '+marker);}
}
const missingSections=[...d.querySelectorAll('section[id]')].map(x=>x.id).filter(id=>!r.families.some(f=>f.section===id));
if(missingSections.length)errors.push('Secciones sin correspondencia: '+missingSections.join(', '));
const figma=JSON.parse(fs.readFileSync('docs/auditorias/KJA-051/figma-state.json','utf8'));
if(JSON.stringify([...ids].sort())!==JSON.stringify([...figma.correspondence?.verifiedNodeIds??[]].sort()))errors.push('Nodos Figma nuevos o sin verification MCP registrada');
return {families:r.families.length,catalogSections:d.querySelectorAll('section[id]').length,uniqueFigmaNodes:ids.size,errors};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const result=checkCorrespondence();console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;
}
