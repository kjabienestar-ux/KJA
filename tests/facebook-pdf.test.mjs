import test from 'node:test';
import assert from 'node:assert/strict';
import {pdfHarness} from './helpers/facebook-pdf-harness.mjs';
const meta={desde:'2026-09-14',hasta:'2026-09-16',generado_at:'2026-09-17T05:00:00Z',provisional:false};
function observe(c){
  const tables=[],cells=[],original=c.jspdf.jsPDF.API.autoTable;
  c.jspdf.jsPDF.API.autoTable=function(options){
    tables.push(options);
    return original.call(this,{...options,didDrawCell:data=>{cells.push({x:data.cell.x,y:data.cell.y,width:data.cell.width,height:data.cell.height,text:data.cell.text,section:data.section});}});
  };
  return {tables,cells};
}
test('ranking uses total evidence days, shares positions for ties and excludes non-evaluated areas',()=>{
  const c=pdfHarness(),m=c.KJAFacebookReport;
  const make=(area,yes,no)=>({area,persons:[{nombre:'Ejemplo'}],totals:[{yes,no}]});
  const ranks=m.ranking([make('Sin agenda',0,0),make('B',2,0),make('A',2,5),make('C',0,2),make('D',5,9)]);
  assert.deepEqual(Array.from(ranks,r=>[r.area,r.yes,r.rank]),[['D',5,1],['A',2,2],['B',2,2],['C',0,4],['Sin agenda',0,null]]);
});
test('PDF contains complete area matrices and ends with ranking matching all evidence totals',()=>{
  const c=pdfHarness(),m=c.KJAFacebookReport,{tables,cells}=observe(c);
  const dates=m.days(meta.desde,meta.hasta),rows=['Ingeniería','Administración','Voluntariado'].flatMap((area,id)=>dates.map((fecha,i)=>({id,nombre:`José Peña ${id}`,area,fecha,estado:id===2?'no_programado':i===0?'con_evidencia':'sin_evidencia'})));
  const groups=m.matrix(rows,meta.desde,meta.hasta),bytes=c.KJAFacebookPDF.build(groups,meta);
  assert.ok(Buffer.from(bytes).subarray(0,8).toString().startsWith('%PDF-1.'));
  assert.equal(tables.length,4);assert.equal(tables.at(-1).head[0][0],'Puesto');
  assert.deepEqual(Array.from(tables.at(-1).body,r=>Array.from(r)),[['1','Administración',1,1],['1','Ingeniería',1,1],['Sin evaluación','Voluntariado',1,0]]);
  assert.equal(tables.at(-1).foot[0][3],2);
  assert.ok(cells.some(cell=>cell.text.join(' ').includes('No comparte ese día')));
  for(const cell of cells){assert.ok(cell.x>=13.9);assert.ok(cell.x+cell.width<=283.2);assert.ok(cell.y>=53.9);assert.ok(cell.y+cell.height<=190.2);}
});
test('monthly detail keeps every date and person, repeats names per date block, and paginates tall tables',()=>{
  const c=pdfHarness(),m=c.KJAFacebookReport,{tables,cells}=observe(c);
  const period={...meta,desde:'2026-08-01',hasta:'2026-08-31'};
  const dates=m.days(period.desde,period.hasta);
  const rows=Array.from({length:45},(_,id)=>dates.map((fecha,i)=>({id,nombre:`Persona de prueba con nombre largo ${id}`,area:'Ingeniería y sistemas',fecha,estado:i%3===0?'no_programado':i%3===1?'con_evidencia':'sin_evidencia'}))).flat();
  const bytes=c.KJAFacebookPDF.build(m.matrix(rows,period.desde,period.hasta),period);
  assert.equal(tables.length,6);assert.equal(tables.slice(0,-1).reduce((n,t)=>n+t.head[1].length-1,0),31);
  assert.ok(tables.slice(0,-1).every(t=>t.body.length===45&&t.head[1].length<=8));
  assert.equal(tables.at(-1).body[0][3],45*10);
  assert.ok((Buffer.from(bytes).toString('latin1').match(/\/Type \/Page\b/g)||[]).length>6);
  for(const cell of cells){assert.ok(cell.y>=53.9);assert.ok(cell.y+cell.height<=190.2);}
});
test('PDF rejects an empty report rather than downloading a blank file',()=>{
  assert.throws(()=>pdfHarness().KJAFacebookPDF.build([],meta),/No hay áreas/);
});
