// Synthetic samples for visual QA. No production records are read.
import fs from 'node:fs';
import path from 'node:path';
import {pdfHarness} from './facebook-pdf-harness.mjs';
const output=process.env.KJA_PDF_QA_DIR;
if(!output)throw new Error('Set KJA_PDF_QA_DIR to a temporary directory.');
fs.mkdirSync(output,{recursive:true});
const c=pdfHarness(),m=c.KJAFacebookReport;
for(const [name,count,from,to] of [['corte',4,'2026-09-14','2026-09-16'],['mensual',32,'2026-08-01','2026-08-31']]){
  const dates=m.days(from,to),rows=[];
  for(const [a,area] of ['Administración (prueba)','Ingeniería (prueba)','Voluntariado (prueba)'].entries()){
    for(let i=0;i<(a===2?1:count);i++)for(const [d,fecha] of dates.entries())rows.push({id:a*100+i,nombre:['Ana María Gómez de la Cruz','José Antonio Pérez Huamán','Cynthia Rosmery Paredes Sánchez','Jaser Fabricio Peña Ramírez'][i%4]+` (prueba ${i+1})`,area,fecha,estado:['con_evidencia','sin_evidencia','no_programado','con_evidencia'][(i+d+a)%4]});
  }
  fs.writeFileSync(path.join(output,name+'.pdf'),c.KJAFacebookPDF.build(m.matrix(rows,from,to),{desde:from,hasta:to,generado_at:'2026-09-17T05:00:00Z',provisional:name==='corte'}));
}
console.log('PDFs sintéticos listos para revisión.');
