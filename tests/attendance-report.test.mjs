import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pdfHarness} from './helpers/facebook-pdf-harness.mjs';
function harness(){
  const c=pdfHarness();
  for(const name of ['dashboard-person-attendance','attendance-report-model','dashboard-attendance-report','facebook-report-excel','attendance-report-excel-layout','intern-report-excel'])vm.runInContext(fs.readFileSync(new URL(`../assets/js/${name}.js`,import.meta.url),'utf8'),c);
  return c;
}
function fixture(c){
  const person={id:1,nombre:'Ana & <Prueba>',activo:true,contrato_inicio:'2026-09-01'};
  const attendance={ok:true,end:'2026-10-12',asOf:'2026-10-12',days:[
    {fecha:'2026-10-01',estado:'P',cierre_estado:'incompleta',laborable:true},
    {fecha:'2026-10-02',estado:'T',laborable:true},
    {fecha:'2026-10-03',estado:null,laborable:true},
    {fecha:'2026-10-04',estado:null,laborable:false},
    {fecha:'2026-10-12',estado:null,laborable:true}
  ]};
  const file=(path,bucket='asis-cierre-evidencias')=>({path,bucket,mime:'image/jpeg'});
  const details=new Map(attendance.days.map(d=>[d.fecha,{ok:true,estado:d.estado,cierre:{estado:d.cierre_estado||'no_aplica'},entregas:[]}]));
  Object.assign(details.get('2026-10-01'),{entrada_at:'2026-10-01T13:00:00Z',entrada_archivos:[file('entrada','asis-evidencias')],entregas:[{tipo:'rpe',titulo:'RPE',archivos:[file('rpe'),file('rpe')],completado_at:'2026-10-01T18:10:00Z'},{tipo:'comparticiones',titulo:'Facebook',archivos:[file('fb')]}]});
  details.get('2026-10-04').entregas=[{tipo:'asignado',titulo:'Presentación',archivos:[file('ppt')]}];
  const report=c.KJAAttendanceReport.build(person,attendance,details);
  report.files.forEach((f,i)=>{f.ref=i+1;f.url=i===3?null:'https://example.test/private/'+i+'?token=a&b=c'});
  return {person,attendance,details,bundle:{reports:[report],files:report.files,range:{from:'2026-10-01',to:'2026-10-12'},unavailable:1}};
}
test('punctual entry survives incomplete closure; totals and evidence references reconcile',()=>{
  const c=harness(),{bundle}=fixture(c),r=bundle.reports[0];
  assert.equal(r.totals.puntuales,1);assert.equal(r.totals.tardanzas,1);assert.equal(r.punctuality,50);assert.equal(r.totals.incompletas,1);assert.equal(r.totals.faltas,1);
  assert.equal(r.totals.conEvidencia,2);assert.equal(r.totals.archivos,4);assert.equal(r.days[0].entry,'Puntual');assert.equal(r.days[0].jornada,'Incompleta');assert.equal(r.days[0].arrival,'08:00');
  assert.equal(r.days[3].count,1);assert.equal(r.days[4].key,'pendientes');assert.match(c.KJAAttendanceReport.dailyRow(r.days[0])[7],/#2/);
});
test('missing evidence reads are errors; missing hire date has no invented totals',()=>{
  const c=harness(),{person,attendance,details}=fixture(c);details.delete('2026-10-02');
  assert.throws(()=>c.KJAAttendanceReport.build(person,attendance,details),/02\/10\/2026/);
  const r=c.KJAAttendanceReport.build(person,{missingStart:true},new Map());assert.equal(r.note,'Falta fecha de ingreso');assert.equal(c.KJAAttendanceReport.summaryRow(r)[1],'—');
});
test('invalid, reversed and future ranges are rejected',()=>{
  const {period}=harness().KJAAttendanceReport;
  for(const [a,b] of [['2026-02-30','2026-03-01'],['2026-10-03','2026-10-01'],['2026-10-01','2026-10-13'],['','2026-10-01']])assert.throws(()=>period(a,b,'2026-10-12'));
  assert.equal(period('2026-10-01','2026-10-12','2026-10-12').from,'2026-10-01');
});
test('the last day of a historical period is not treated as today',()=>{
  const c=harness(),{person}=fixture(c);
  const r=c.KJAAttendanceReport.build(person,{end:'2026-09-30',asOf:'2026-10-12',days:[{fecha:'2026-09-30',laborable:true}]},new Map([['2026-09-30',{ok:true}]]));
  assert.equal(r.totals.faltas,1);assert.equal(r.days[0].key,'faltas');
});
test('period query reuses months, bounds concurrency and retains files with failed links',async()=>{
  const c=harness(),{person,attendance,details}=fixture(c);let bookReads=0,active=0,max=0;
  c.loadProfileAttendanceMonth=async()=>{bookReads++;return []};
  c.loadProfileAttendance=async(p,to,current,progress,month,from)=>{assert.equal(from,'2026-10-01');assert.equal(to,'2026-10-12');await month({key:'2026-10'});return attendance};
  c.db={rpc:async(name,args)=>{assert.equal(name,'dash_equipo_dia_detalle');active++;max=Math.max(max,active);await Promise.resolve();active--;return {data:details.get(args.p_fecha)}},storage:{from:()=>({createSignedUrl:async(path,seconds)=>{assert.equal(seconds,3600);return path==='ppt'?{error:{message:'denied'}}:{data:{signedUrl:'https://example.test/'+path}}}})}};
  const bundle=await c.collectAttendanceReport([person,{...person,id:2}],{from:'2026-10-01',to:'2026-10-12'});
  assert.equal(bookReads,1);assert.ok(max<=4);assert.equal(bundle.unavailable,2);assert.equal(bundle.files.length,8);assert.equal(bundle.files[7].ref,8);
  c.db.storage.from=()=>{throw Error('Preview must not sign all files')};
  const preview=await c.collectAttendanceReport([person],bundle.range,()=>{},{signFiles:false});
  assert.equal(preview.files.length,4);assert.equal(preview.reports[0].days[3].sourceDay.laborable,false);
  assert.equal(await c.collectAttendanceReport([person],bundle.range,()=>{},{isCurrent:()=>false}),null);
  c.db.rpc=async()=>({error:{message:'denied'}});await assert.rejects(c.collectAttendanceReport([person],bundle.range),/evidencias/);
});
test('date filter avoids loading months before requested period',async()=>{
  const c=harness(),called=[];
  const data=await c.loadProfileAttendance({id:1,contrato_inicio:'2026-08-01'},'2026-10-12',()=>true,()=>{},async p=>{called.push(p.key);return [{data:{ok:true,hoy:'2026-10-12',personas:[{id:1,dias:[{fecha:'2026-10-01'},{fecha:'2026-10-12'}]}]}},{data:{ok:true,cierres:[]}}]},'2026-10-05');
  assert.deepEqual(called,['2026-10']);assert.equal(data.days.length,1);assert.equal(data.days[0].fecha,'2026-10-12');
});
test('focused workbook has identity, weekly schedules and a monthly attendance matrix',()=>{
  const c=harness(),{bundle}=fixture(c),book=c.KJAInternExcel.createFocused(bundle);
  assert.deepEqual(Array.from(book.sheets,s=>s.name),['Resumen','Horarios','Asistencia']);
  const calendar=book.sheets[2].xml;
  assert.match(calendar,/octubre de 2026/);assert.doesNotMatch(calendar,/Pendientes del día|Mes \/ seguimiento/);
  assert.match(calendar,/<autoFilter ref="A5:AI6"/);
  assert.equal((calendar.match(/<row /g)||[]).length,6);
  assert.match(calendar,/<c r="D6" s="21" t="inlineStr"><is><t xml:space="preserve">P/);
  assert.match(calendar,/<c r="E6" s="22" t="inlineStr"><is><t xml:space="preserve">T/);
  assert.match(calendar,/<c r="AH5" s="18"><v>31/);
  assert.match(calendar,/Horas válidas/);
  assert.doesNotMatch(calendar,/Jornada|Foto entrada|hyperlink|#2/);
  assert.match(book.sheets[0].xml,/DNI/);assert.match(book.sheets[0].xml,/Institución/);
  assert.match(book.sheets[0].xml,/COUNTIF\(&apos;|COUNTIF\('Asistencia'/);
  assert.match(book.sheets[0].xml,/Ana &amp; &lt;Prueba&gt;/);
  const bytes=Buffer.from(c.KJAInternExcel.buildFocused(bundle));
  assert.ok(bytes.includes(Buffer.from('xl/worksheets/sheet3.xml')));
  assert.ok(!bytes.includes(Buffer.from('xl/worksheets/sheet4.xml')));
});
test('institution, leading-zero DNI, daily overrides and leap-month bounds survive export',()=>{
  const c=harness(),{bundle}=fixture(c),r=bundle.reports[0];
  Object.assign(r.person,{dni:'00123456',institucion:'UTP - LIMA CENTRO',area:'Salud',hora_inicio:'08:00',hora_fin:'13:00',dias_laborables:[1,2,3,4,5],horario_semanal:{'1':{mod:'presencial',ini:'22:00',fin:'06:00'}}});
  bundle.range={from:'2024-02-28',to:'2024-03-01'};
  r.person.contrato_inicio='2024-02-29';
  r.days=[{date:'2024-02-29',key:'puntuales',sourceDay:{horas:5,cierre_estado:'completa'},tasks:{key:'cumplio'}}];
  r.totals={puntuales:1,tardanzas:0,faltas:0};
  const book=c.KJAInternExcel.createFocused(bundle);
  assert.match(book.sheets[0].xml,/UTP - LIMA CENTRO/);assert.match(book.sheets[0].xml,/00123456/);
  assert.match(book.sheets[0].xml,/<c r="B10" s="17" t="inlineStr">/);
  assert.match(book.sheets[1].xml,/Presencial\n22:00 – 06:00 \(\+1 día\)/);
  assert.match(book.sheets[1].xml,/Virtual\n08:00 – 13:00/);assert.match(book.sheets[1].xml,/No gestiona/);
  const xml=book.sheets[2].xml;
  assert.match(xml,/<c r="AF6" s="21" t="inlineStr"><is><t xml:space="preserve">P/);
  assert.match(xml,/<c r="AG6" s="20" t="inlineStr"><is><t xml:space="preserve"><\/t>/);
  assert.match(xml,/<c r="AE6" s="20" t="inlineStr"><is><t xml:space="preserve"><\/t>/);
  assert.match(xml,/<c r="AI6" s="28"><v>5/);
  assert.match(xml,/marzo de 2024/);
  assert.match(book.sheets[0].xml,/D6:AH6/);assert.match(book.sheets[0].xml,/D7:AH7/);
});
test('task compliance uses applicable requirements, respects today and missing data',()=>{
  const c=harness(),{person,attendance,details}=fixture(c);
  const close=(requisitos,asignaciones=[])=>({estado:'incompleta',aplica_jornada:true,requisitos,asignaciones});
  details.get('2026-10-01').cierre=close([{tipo:'rpe',completo:true}]);
  details.get('2026-10-02').cierre=close([{tipo:'rpe',completo:false}]);
  details.get('2026-10-03').cierre={...close([{tipo:'rpe',completo:false}]),requiere_rpe:false};
  details.get('2026-10-12').cierre=close([],[{estado:'activa',completo:false}]);
  const r=c.KJAAttendanceReport.build(person,attendance,details);
  assert.deepEqual(Array.from(r.days,d=>d.tasks.key),['cumplio','no_cumplio','no_aplica','sin_datos','en_curso']);
  details.get('2026-10-04').cierre={...close([{tipo:'comparticiones',completo:false}]),aplica_jornada:false};
  assert.equal(c.KJAAttendanceReport.build(person,attendance,details).days[3].tasks.key,'no_cumplio');
});

test('focused PDF has matching totals, legible page bounds and links for every available file',()=>{
  const c=harness(),{bundle}=fixture(c),doc=c.buildFocusedAttendancePdf(bundle);
  assert.equal(doc.getNumberOfPages(),3);
  const pages=doc.internal.pages.flat().join('\n');assert.match(pages,/Puntual/);assert.match(pages,/Incompleta/);assert.doesNotMatch(pages,/Contrato y avance|Identidad y/);
  let links=0;for(let i=1;i<=doc.getNumberOfPages();i++){const annotations=doc.internal.getPageInfo(i).pageContext.annotations;links+=annotations.filter(a=>a.type==='link').length;}
  assert.equal(links,3);
  assert.equal(doc.internal.pageSize.getWidth()>doc.internal.pageSize.getHeight(),true);
});
