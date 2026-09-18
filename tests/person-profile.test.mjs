import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pdfHarness} from './helpers/facebook-pdf-harness.mjs';
const source=fs.readFileSync(new URL('../assets/js/dashboard-person-profile.js',import.meta.url),'utf8');
const team=fs.readFileSync(new URL('../assets/js/dashboard-admin-equipo.js',import.meta.url),'utf8');
test('directory loads with RPC thenables and optional institution failures',async()=>{
  for(const outcome of ['success','missing','rejected']){
    const nodes=new Map();let rendered=0;
    const c=vm.createContext({
      APP:{access:{acceso_panel:true,rol:'direccion'},adminTeamRequest:0,adminSection:'colaboradores'},
      $:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)},
      teamMsg:()=>{},hydrateProfilePhotos:async people=>people,fillAdminTeamFilters:()=>{},
      renderAdminPeople:()=>rendered++,renderAdminContracts:()=>{},
      db:{rpc(name){return {then(resolve,reject){
        if(name==='dash_admin_instituciones'){
          if(outcome==='rejected')return reject(Error('Network unavailable'));
          return resolve(outcome==='missing'?{data:null,error:{code:'PGRST202'}}:{data:{ok:true,personas:[{id:1,institucion:'Instituto'}]}});
        }
        resolve(name==='dash_admin_equipo'?{data:{ok:true,personas:[{id:1,nombre:'Ana'}]}}:{data:{ok:true,saldos:[]}});
      }}}}
    });
    vm.runInContext(team.slice(team.indexOf('async function loadAdminTeam()'),team.indexOf('function fillAdminTeamFilters()')),c);
    await c.loadAdminTeam();
    assert.equal(rendered,1);assert.equal(nodes.get('admin-refresh').disabled,false);
    assert.equal(c.APP.adminTeam.personas[0].nombre,'Ana');
    assert.equal(c.APP.adminTeam.instituciones_disponibles,outcome==='success');
    assert.equal(c.APP.adminTeam.personas[0].institucion,outcome==='success'?'Instituto':null);
  }
});
function harness(){
  const c=pdfHarness();
  c.APP={access:{rol:'direccion',acceso_panel:true}};
  c.fmtTime=value=>value?String(value).slice(0,5):'—';
  c.esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  vm.runInContext(team.slice(0,team.indexOf('async function loadAdminTeam()')),c);
  vm.runInContext(team.slice(team.indexOf('function contractState('),team.indexOf('function renderAdminContracts(')),c);
  vm.runInContext(team.slice(team.indexOf('function fallbackFacebookSchedule('),team.indexOf('function facebookScheduleRows(')),c);
  vm.runInContext(fs.readFileSync(new URL('../assets/js/dashboard-person-attendance.js',import.meta.url),'utf8'),c);
  vm.runInContext(source,c);
  return c;
}
const person={id:1,nombre:'María Peña',dni:'00123456',area:'Salud',activo:true,tipo_vinculo:'ambos',dias_laborables:[1,2],hora_inicio:'08:00',hora_fin:'13:00',horario_semanal:{'1':{mod:'presencial',ini:'22:00',fin:'06:00',vinc:'voluntariado'}},contrato_horas:300,horas_previas:0,resumen:{meta:300,cumplidas:25,faltantes:275,marcadas:25,semana_horas:13},dias_libres_saldo:0};
const extra={facebook:{ok:true,configurado:true,horario:{}},history:{ok:true,historial:[]}};
function exportHarness(nodes){
  const c=harness();c.$=nodes?id=>{if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,innerHTML:'',textContent:''});return nodes.get(id)}:()=>null;
  vm.runInContext(fs.readFileSync(new URL('../assets/js/dashboard-attendance-export.js',import.meta.url),'utf8'),c);
  return c;
}
const exportNames=['Melina Gabriela Loyola León','DORIS INGA','Erika del Socorro Moreno Quilcate','Alviery Gonzales Chonta','Ronny Yural Ruiz Pinillos','Gian Franco Miranda Ramos','Alejandra Victoria Pimentel'];
const exportPeople=exportNames.map((nombre,index)=>({...person,id:index+1,nombre,dni:'',contrato_inicio:'2026-09-01'}));
test('picker retains selected people across searches, supports clearing and arbitrary individuals',()=>{
  const nodes=new Map(),c=exportHarness(nodes);c.APP.adminTeam={personas:[...exportPeople,{...person,id:99,nombre:'Óscar Nuevo',dni:'00000123'}]};
  c.renderAttendanceExport();assert.equal(c.attendanceExportPeople().length,7);
  c.$('attendance-export-search').value='oscar';c.$('attendance-export-search').oninput();
  assert.equal(c.attendanceExportPeople().length,7);assert.equal(c.attendanceExportVisible().length,1);
  c.$('attendance-export-visible').onclick();assert.equal(c.attendanceExportPeople().length,8);
  c.$('attendance-export-clear').onclick();assert.equal(c.attendanceExportPeople().length,0);assert.equal(c.$('admin-attendance-excel').disabled,true);
  c.$('attendance-export-options').onchange({target:{type:'checkbox',checked:true,value:'99'}});
  assert.deepEqual(Array.from(c.attendanceExportPeople(),p=>p.id),[99]);assert.equal(c.$('admin-attendance-excel').disabled,false);
  c.$('attendance-export-search').value='doris';c.renderAttendanceExport();assert.equal(c.attendanceExportPeople()[0].id,99);
  c.$('attendance-export-original').onclick();assert.equal(c.attendanceExportPeople().length,7);
});
test('Excel button downloads only the selection and restores controls on success and failure',async()=>{
  const nodes=new Map(),c=exportHarness(nodes),links=[],blobs=[];c.APP.adminTeam={personas:exportPeople};c.renderAttendanceExport();
  c.$('attendance-export-clear').onclick();c.$('attendance-export-options').onchange({target:{type:'checkbox',checked:true,value:'2'}});
  c.document.createElement=()=>({click(){},remove(){}});c.document.body={append:link=>links.push(link)};
  c.URL={createObjectURL:blob=>{blobs.push(blob);return 'blob:test'},revokeObjectURL(){}};c.setTimeout=fn=>fn();
  let finish,selected,full;c.collectAttendanceExport=(people,today,progress,includeProfile)=>{selected=people;full=includeProfile;return new Promise(resolve=>finish=resolve)};
  c.KJAInternExcel={build:()=>new Uint8Array([80,75])};
  const downloading=c.$('admin-attendance-excel').onclick();assert.equal(c.$('attendance-export-picker').disabled,true);assert.equal(c.$('admin-attendance-export').disabled,true);
  finish([{person:selected[0],sections:[]}]);await downloading;
  assert.deepEqual(Array.from(selected,p=>p.id),[2]);assert.equal(full,true);assert.equal(links.length,1);assert.match(links[0].download,/KJA_Consolidado_1_internos_.*\.xlsx$/);
  assert.equal(blobs[0].type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');assert.equal(c.$('attendance-export-picker').disabled,false);
  c.collectAttendanceExport=async()=>{throw Error('Fallo de lectura')};await c.$('admin-attendance-excel').onclick();assert.equal(links.length,1);assert.match(c.$('admin-attendance-export-status').textContent,/Fallo de lectura/);assert.equal(c.$('admin-attendance-excel').disabled,false);
});
function workbookFixture(){
  const c=exportHarness();
  for(const file of ['facebook-report-excel','intern-report-excel'])vm.runInContext(fs.readFileSync(new URL(`../assets/js/${file}.js`,import.meta.url),'utf8'),c);
  const p={...person,nombre:'=SUM(1,2) & <María>',dni:'00123456',contrato_inicio:'2026-09-01'};
  const attendance={ok:true,start:'2026-09-01',end:'2026-09-18',missing:[],days:[
    {fecha:'2026-09-01',estado:'P',laborable:true,horas:5,marcado_at:'2026-09-01T13:00:00Z',salida_at:'2026-09-01T18:00:00Z'},
    {fecha:'2026-09-02',estado:'T',laborable:true,horas:4,cierre_estado:'incompleta'},
    {fecha:'2026-09-03',estado:null,laborable:true}
  ]};
  const extra={attendance,facebook:{ok:true,configurado:true,horario:{'1':{ini:'09:00',fin:'10:00'}}},history:{ok:true,historial:[{fecha:'2026-09-01',tipo:'horario',nota:'Cambio de horario',creado_por:'Dirección'}]},activity:{desde:'2026-09-01',hasta:'2026-09-18',filas:[{id:1,fecha:'2026-09-01',estado:'con_evidencia',capturas:3,revision:'pendiente'},{id:2,fecha:'2026-09-01',estado:'con_evidencia',capturas:99}]}};
  return {c,p,attendance,extra,reports:[{person:p,attendance,extra,sections:c.adminProfileSections(p,extra)}]};
}
function unzipReport(bytes){
  const buffer=Buffer.from(bytes),files=new Map();let offset=0;
  while(buffer.readUInt32LE(offset)===0x04034b50){
    const length=buffer.readUInt32LE(offset+18),nameLength=buffer.readUInt16LE(offset+26),start=offset+30+nameLength,content=buffer.subarray(start,start+length);
    let crc=0xffffffff;for(const byte of content){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    assert.equal((crc^0xffffffff)>>>0,buffer.readUInt32LE(offset+14));
    files.set(buffer.subarray(offset+30,start).toString(),content.toString());offset=start+length;
  }
  return files;
}
test('compact Excel has only essential summary and colored monthly attendance, with reconciled totals',()=>{
  const {c,reports}=workbookFixture(),files=unzipReport(c.KJAInternExcel.build(reports,'2026-09-18'));
  assert.deepEqual([...files.get('xl/workbook.xml').matchAll(/<sheet name="([^"]+)"/g)].map(match=>match[1]),['Resumen','Horarios','Asistencia']);
  const summary=files.get('xl/worksheets/sheet1.xml'),matrix=files.get('xl/worksheets/sheet3.xml');
  assert.match(summary,/<dimension ref="A1:J4"/);assert.doesNotMatch(summary,/Fichas y contratos|Historial de cambios|Cobertura/);
  assert.match(summary,/<c r="F4" s="4"><f>COUNTIF\(&apos;Asistencia&apos;!D6:AH6,&quot;P&quot;\)<\/f><v>1<\/v>/);
  assert.match(summary,/<c r="B4" s="0" t="inlineStr"><is><t xml:space="preserve">00123456/);
  assert.match(summary,/<c r="C4" s="0" t="inlineStr"><is><t xml:space="preserve"><\/t>/);
  assert.match(summary,/<autoFilter ref="A3:J4"/);assert.match(summary,/s="18"/);
  assert.match(matrix,/<dimension ref="A1:AI6"/);assert.match(matrix,/xSplit="3" ySplit="5" topLeftCell="D6"/);
  assert.match(matrix,/<c r="D6" s="11" t="inlineStr"><is><t xml:space="preserve">P/);
  assert.match(matrix,/<c r="E6" s="16" t="inlineStr"><is><t xml:space="preserve">INC/);
  assert.match(matrix,/<c r="F6" s="12" t="inlineStr"><is><t xml:space="preserve">F/);
  assert.match(matrix,/<c r="AI6" s="8"><v>5<\/v>/);
  assert.doesNotMatch(matrix,/Entrada \(Lima\)|Salida \(Lima\)|Categoría|DNI/);
  assert.match(matrix,/t="inlineStr"><is><t xml:space="preserve">=SUM\(1,2\) &amp; &lt;María&gt;/);
  for(let i=1;i<=3;i++){const xml=files.get(`xl/worksheets/sheet${i}.xml`);assert.match(xml,/<autoFilter/);assert.match(xml,/state="frozen"/);assert.doesNotMatch(xml,/<v>(NaN|Infinity)<\/v>/);}
});
test('monthly matrix preserves month boundaries and does not fill dates outside the period',()=>{
  const {c,reports}=workbookFixture(),report=reports[0];
  report.attendance.days.push({fecha:'2026-08-31',estado:'T',laborable:true,horas:4});
  const files=unzipReport(c.KJAInternExcel.build(reports,'2026-09-18')),matrix=files.get('xl/worksheets/sheet3.xml'),summary=files.get('xl/worksheets/sheet1.xml');
  assert.match(matrix,/<dimension ref="A1:AI7"/);
  assert.match(matrix,/<c r="AH6" s="10" t="inlineStr"><is><t xml:space="preserve">T/);
  assert.match(matrix,/<c r="D6" s="0" t="inlineStr"><is><t xml:space="preserve"><\/t>/);
  assert.match(summary,/<c r="G4" s="4"><f>COUNTIF\(&apos;Asistencia&apos;!D6:AH6,&quot;T&quot;\)\+COUNTIF\(&apos;Asistencia&apos;!D7:AH7,&quot;T&quot;\)<\/f><v>1<\/v>/);
});
test('missing hire date remains an explicit note with no invented zero totals',()=>{
  const {c,p}=workbookFixture(),attendance={ok:true,missingStart:true};
  const files=unzipReport(c.KJAInternExcel.build([{person:{...p,contrato_inicio:null},attendance,extra:{}}],'2026-09-18'));
  const summary=files.get('xl/worksheets/sheet1.xml');assert.match(summary,/Falta fecha de ingreso/);assert.doesNotMatch(summary,/<f>COUNTIF/);
});
test('institution is exported when populated and remains blank otherwise',()=>{
  const {c,reports}=workbookFixture();reports[0].person.institucion='Universidad & Instituto';
  const files=unzipReport(c.KJAInternExcel.build(reports,'2026-09-18'));
  assert.match(files.get('xl/worksheets/sheet1.xml'),/<c r="C4" s="0" t="inlineStr"><is><t xml:space="preserve">Universidad &amp; Instituto/);
  const sections=c.adminProfileSections(reports[0].person,reports[0].extra);
  assert.equal(sections[0].rows.find(row=>row[0]==='Institución')[1],'Universidad & Instituto');
});
test('Horarios remains a colored weekly matrix',()=>{
  const {c,reports}=workbookFixture(),files=unzipReport(c.KJAInternExcel.build(reports,'2026-09-18')),schedule=files.get('xl/worksheets/sheet2.xml');
  assert.match(schedule,/<dimension ref="A1:L6"/);assert.match(schedule,/Domingo/);
  assert.match(schedule,/<c r="F6" s="11" t="inlineStr"><is><t xml:space="preserve">PRESENCIAL\n22:00 – 06:00 \(\+1 día\)\nVoluntariado/);
  assert.match(schedule,/<c r="H6" s="12" t="inlineStr"><is><t xml:space="preserve">NO GESTIONA/);
});
test('full export collects history, weekly Facebook and profile fields for any selected person',async()=>{
  const c=exportHarness(),calls=[];c.APP.access.rol='direccion';
  c.db={rpc:async(name,args)=>{calls.push(name);
    return {data:name==='dash_admin_mes'?{ok:true,hoy:'2026-09-18',personas:[{id:1,dias:[]}]}:name==='dash_admin_cierres_mes'?{ok:true,cierres:[]}:name==='dash_reporte_facebook'?{desde:'2026-09-01',hasta:'2026-09-18',filas:[]}:name==='dash_admin_historial_colaborador'?{ok:true,historial:[{fecha:'2026-09-01',tipo:'horario',nota:'Horario nuevo'}]}:{ok:true,configurado:true,horario:{}}};
  }};
  const [report]=await c.collectAttendanceExport([exportPeople[0]],'2026-09-18',()=>{},true);
  assert.ok(report.sections.some(section=>section.title==='Identidad y vínculo'));
  assert.ok(report.sections.some(section=>section.title==='Horario semanal'));
  assert.equal(report.extra.history.historial.length,1);assert.equal(calls.length,5);
});
test('group export selects exactly the requested seven and rejects ambiguous or missing names',()=>{
  const c=exportHarness(),result=c.attendanceExportSelection([...exportPeople,{id:99,nombre:'Otra persona'}]);
  assert.deepEqual(Array.from(result.selected,p=>p.nombre),exportNames);assert.equal(result.issues.length,0);
  assert.equal(c.attendanceExportSelection(exportPeople.slice(1)).issues.length,1);
  assert.equal(c.attendanceExportSelection([...exportPeople,{id:99,nombre:'Melina Loyola Dos'}]).issues.length,1);
  const renamed=exportPeople.map(p=>p.id===1?{...p,nombre:'Melina G. Loyola',dni:'72686519'}:p);
  assert.equal(c.attendanceExportSelection([...renamed,{id:99,nombre:'Melina Loyola Dos'}]).issues.length,0);
});
test('group export reads each month once for all seven and stops on incomplete data',async()=>{
  const c=exportHarness(),calls=[];
  c.db={rpc:async(name,args)=>{calls.push(name);return {data:name==='dash_admin_cierres_mes'?{ok:true,cierres:[]}:{ok:true,hoy:'2026-09-18',personas:exportPeople.map(p=>({id:p.id,dias:[{fecha:'2026-09-01',estado:'P',laborable:true,horas:5}]}))}}}};
  const reports=await c.collectAttendanceExport(exportPeople,'2026-09-18');
  assert.equal(reports.length,7);assert.equal(calls.length,2);assert.ok(reports.every(r=>r.attendance.days.length===1));
  c.db.rpc=async()=>({error:{message:'Sin conexión'}});
  await assert.rejects(()=>c.collectAttendanceExport(exportPeople,'2026-09-18'),/No se pudo completar la asistencia de Melina/);
});
test('group PDF includes seven summary rows, all daily details and printable page bounds',()=>{
  const c=exportHarness(),tables=[],cells=[],original=c.jspdf.jsPDF.API.autoTable;
  c.jspdf.jsPDF.API.autoTable=function(options){tables.push(options);return original.call(this,{...options,didDrawCell:data=>cells.push(data.cell)})};
  const reports=exportPeople.map(p=>{const attendance={ok:true,start:'2026-09-01',end:'2026-09-18',missing:[],days:Array.from({length:18},(_,i)=>({fecha:`2026-09-${String(i+1).padStart(2,'0')}`,estado:i%2?'T':'P',laborable:true,horas:5}))};return {person:p,attendance,sections:c.profileAttendanceSections(p,{attendance})}});
  const doc=c.buildAttendanceExportPdf(reports,'2026-09-18');
  assert.match(Buffer.from(doc.output('arraybuffer')).subarray(0,8).toString(),/^%PDF-1\./);
  assert.equal(tables[0].body.length,7);assert.equal(tables.length,15);
  assert.equal(tables.filter(t=>t.head?.[0]?.[0]==='Fecha').reduce((n,t)=>n+t.body.length,0),126);
  assert.ok(doc.getNumberOfPages()>=8);
  for(const cell of cells){assert.ok(cell.x>=15.9);assert.ok(cell.x+cell.width<=194.1);assert.ok(cell.y>=19.9);assert.ok(cell.y+cell.height<=277.1);}
  assert.throws(()=>c.buildAttendanceExportPdf([],'2026-09-18'),/al menos un interno/);
  assert.ok(c.buildAttendanceExportPdf(reports.slice(0,1),'2026-09-18').getNumberOfPages()>=2);
});
test('attendance spans every month from hire date and preserves validated closures',async()=>{
  const c=harness(),calls=[];
  c.db={rpc:async(name,args)=>{
    calls.push([name,args]);const month=String(args.p_mes).padStart(2,'0');
    if(name==='dash_admin_cierres_mes')return {data:{ok:true,cierres:[{colaborador_id:1,fecha:`2026-${month}-15`,estado:'incompleta'}]}};
    return {data:{ok:true,hoy:'2026-03-18',personas:[{id:1,dias:[{fecha:`2026-${month}-01`,estado:'J',laborable:true},{fecha:`2026-${month}-15`,estado:'P',laborable:true},{fecha:`2026-${month}-30`,futura:args.p_mes===3}]}]}};
  }};
  const report=await c.loadProfileAttendance({...person,contrato_inicio:'2026-01-10'},'2026-03-18');
  assert.equal(calls.length,6);assert.ok(calls.every(([,args])=>args.p_mes>=1&&args.p_mes<=3));
  assert.ok(report.days.every(day=>day.fecha>='2026-01-10'&&day.fecha<='2026-03-18'));
  assert.equal(report.days.filter(day=>day.cierre_estado==='incompleta').length,3);
  assert.equal(report.missing.length,0);
  assert.equal(c.profileAttendanceMonths('2026-99-10','2027-03-18').length,0);
});
test('attendance does not turn holidays, today, overnight shifts or incomplete entries into absences',()=>{
  const c=harness(),day={fecha:'2026-09-17',laborable:true};
  assert.equal(c.profileAttendanceState(day,'2026-09-18',person)[0],'faltas');
  assert.equal(c.profileAttendanceState({...day,fecha:'2026-09-18'},'2026-09-18',person)[0],'pendientes');
  assert.equal(c.profileAttendanceState({...day,laborable:false,motivo:'feriado'},'2026-09-18',person)[0],'no_laborables');
  assert.equal(c.profileAttendanceState({...day,estado:'P',cierre_estado:'incompleta'},'2026-09-18',person)[0],'incompletas');
  assert.equal(c.profileAttendanceState({...day,estado:'T',cierre_estado:'completa'},'2026-09-18',person)[0],'tardanzas');
  assert.equal(c.profileAttendanceState({...day,estado:'J'},'2026-09-18',person)[0],'justificados');
  assert.equal(c.profileAttendanceState(day,'2026-09-18',{...person,activo:false})[0],'sin_datos');
  assert.equal(c.profileAttendanceState(day,'2026-09-18',{...person,hora_inicio:'22:00',hora_fin:'06:00'},new Date('2026-09-18T04:00:00-05:00'))[0],'pendientes');
});
test('failed attendance months are explicit partial data, never invented absences',async()=>{
  const c=harness();c.db={rpc:async()=>({error:{message:'Sin conexión'}})};
  const report=await c.loadProfileAttendance({...person,contrato_inicio:'2026-08-01'},'2026-09-18');
  assert.equal(report.missing.length,2);assert.equal(report.days.length,0);
  const sections=c.profileAttendanceSections(person,{attendance:report});
  assert.match(sections[0].note,/Lectura parcial/);
  assert.equal(sections[0].rows.find(row=>row[0]==='Faltas (sin registro)')[1],'0');
  let calls=0;c.db.rpc=async()=>{calls++;return {}};
  assert.equal((await c.loadProfileAttendance(person,'2026-09-18')).missingStart,true);
  await c.loadProfileAttendance({...person,contrato_inicio:'2026-08-01'},'2026-09-18',()=>false);
  assert.equal(calls,0);
});
test('attendance totals match detail and the PDF includes every historical day',()=>{
  const c=harness(),days=Array.from({length:180},(_,i)=>({fecha:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),laborable:true,estado:i%2?'P':null,cierre_estado:i%2?'completa':null,horas:i%2?5:null}));
  const sections=c.profileAttendanceSections(person,{attendance:{ok:true,start:'2026-01-01',end:'2026-09-18',days,missing:[]}});
  assert.equal(sections[0].rows.find(row=>row[0]==='Presentes (puntuales)')[1],'90');
  assert.equal(sections[0].rows.find(row=>row[0]==='Faltas (sin registro)')[1],'90');
  assert.equal(sections[0].rows.find(row=>row[0]==='Horas válidas registradas')[1],'450 h');
  const tables=[],original=c.jspdf.jsPDF.API.autoTable;
  c.jspdf.jsPDF.API.autoTable=function(options){tables.push(options);return original.call(this,options)};
  const doc=c.buildAdminProfilePdf(person,sections);assert.equal(tables.at(-1).body.length,180);assert.ok(doc.getNumberOfPages()>3);
});
test('Facebook filters by person and separates evidence, overdue, pending and unscheduled days',()=>{
  const c=harness(),activity={desde:'2026-09-01',hasta:'2026-09-18',filas:[
    {id:1,fecha:'2026-09-18',estado:'en_plazo'},
    {id:1,fecha:'2026-09-17',estado:'con_evidencia',capturas:3},
    {id:1,fecha:'2026-09-16',estado:'sin_evidencia'},
    {id:1,fecha:'2026-09-15',estado:'no_programado'},
    {id:2,fecha:'2026-09-18',estado:'con_evidencia',capturas:10}
  ]};
  const section=c.profileFacebookActivity(person,{activity});
  assert.equal(section.rows.length,4);
  assert.match(section.note,/1 días con evidencia · 1 días sin evidencia/);
  assert.match(section.rows[0][1],/aún en plazo/);
  assert.equal(section.rows[1][1],'Sí, con evidencia');assert.equal(section.rows[1][2],'3');
  assert.equal(section.rows[2][1],'No, sin evidencia');assert.equal(section.rows[3][1],'No le corresponde');
  assert.match(c.profileFacebookActivity(person,{}).note,/No se pudo consultar/);
  c.APP.access.rol='lider';assert.match(c.profileFacebookActivity(person,{activity}).note,/disponible para Dirección/);
});
test('directory renders a prominent profile action for each person',()=>{
  const c=harness(),nodes=new Map();
  c.$=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,innerHTML:''});return nodes.get(id)};
  c.APP.adminTeam={personas:[person],puede_editar:false};c.profileAvatarMarkup=()=>'';
  vm.runInContext(team.slice(team.indexOf('function filteredAdminPeople('),team.indexOf('function contractState(')),c);
  c.renderAdminPeople();
  assert.match(c.$('admin-people-list').innerHTML,/class="admin-person-view-profile" data-team-profile="1"/);
  assert.match(c.$('admin-people-list').innerHTML,/Ver ficha completa/);
});
test('ficha preserves weekly overrides, overnight shifts, days off and zero balances',()=>{
  const c=harness(),sections=c.adminProfileSections(person,extra),schedule=sections.find(s=>s.title==='Horario semanal');
  assert.equal(schedule.rows.length,7);
  assert.deepEqual(Array.from(schedule.rows[0]),['Lunes','Presencial','22:00 – 06:00 (día siguiente)','Voluntariado']);
  assert.equal(schedule.rows[1][2],'08:00 – 13:00');
  assert.equal(schedule.rows[2][2],'No laborable');
  assert.equal(sections.find(s=>s.title==='Días libres').rows[0][1],'0');
  assert.equal(sections[0].rows[1][1],'00123456');
  assert.equal(sections.find(s=>s.title==='Horario de Facebook').rows[0][1],'No comparte');
});
test('missing data and failed supplementary requests are explicit and user strings are escaped',()=>{
  const c=harness(),sections=c.adminProfileSections({...person,nombre:'<img src=x onerror=alert(1)>',dni:null,resumen:{}});
  const html=c.profileSectionsMarkup(sections);
  assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);
  assert.equal(sections[0].rows[1][1],'Sin registrar');
  assert.match(html,/No se pudo cargar el historial/);
  assert.match(html,/No se pudo cargar el horario/);
  c.APP.access.rol='lider';assert.ok(!c.adminProfileSections(person,extra).some(s=>s.title==='Días libres'));
});
test('PDF includes every history entry and paginates within printable bounds',()=>{
  const c=harness(),cells=[],tables=[],original=c.jspdf.jsPDF.API.autoTable;
  c.jspdf.jsPDF.API.autoTable=function(options){tables.push(options);return original.call(this,{...options,didDrawCell:data=>cells.push(data.cell)})};
  const sections=c.adminProfileSections(person,{...extra,history:{ok:true,historial:Array.from({length:65},(_,i)=>({fecha:'2026-09-18',tipo:'horario',nota:`Cambio ${i}: jornada revisada para prácticas y voluntariado`,creado_por:'Dirección'}))}});
  const doc=c.buildAdminProfilePdf(person,sections),bytes=Buffer.from(doc.output('arraybuffer'));
  assert.match(bytes.subarray(0,8).toString(),/^%PDF-1\./);
  assert.ok(doc.getNumberOfPages()>2);
  assert.equal(tables.at(-1).body.length,65);
  for(const cell of cells){assert.ok(cell.x>=15.9);assert.ok(cell.x+cell.width<=194.1);assert.ok(cell.y>=17.9);assert.ok(cell.y+cell.height<=277.1);}
});
test('a late response cannot replace a closed or newer profile',async()=>{
  const c=harness(),nodes=new Map();
  const node=()=>({hidden:false,disabled:false,textContent:'',innerHTML:'',focus(){},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector)}});
  const host=node();c.$=id=>id==='admin-person-profile'?host:node();c.document.querySelectorAll=()=>[];c.profileAvatarMarkup=()=>'';
  c.APP.adminTeam={personas:[person],puede_editar:false};
  let finish;const pending=new Promise(resolve=>finish=resolve);c.db={rpc:()=>pending};
  const opening=c.openAdminProfile(1);c.closeAdminProfile(false);const markup=host.innerHTML;
  finish({data:{ok:true,historial:[],horario:{}}});await opening;
  assert.equal(host.hidden,true);assert.equal(host.innerHTML,markup);
  assert.equal(nodes.get('.person-profile-content'),undefined);
});
