import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function setup(){
  const nodes=new Map(),calls=[];
  const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,innerHTML:'',value:id.endsWith('-from')?'2026-10-01':'2026-10-12',classList:{add(){}},addEventListener(){},setAttribute(){},removeAttribute(){},focus(){},scrollIntoView(){}});return nodes.get(id)};
  const person={id:9,nombre:'Ana <script>',activo:true};
  const day={date:'2026-10-11',sourceDay:{fecha:'2026-10-11',laborable:false},entry:'No laborable',key:'no_laborables',arrival:'—',exit:'—',jornada:'Completa',groups:{entrada:[],comparticiones:[{}],rpe:[{}],salida:[],asignado:[{}]}};
  Object.assign(day.groups.comparticiones[0],{ref:1,bucket:'asis-cierre-evidencias',path:'facebook.jpg'});
  day.groups.rpe[0].ref=2;day.groups.asignado[0].ref=3;
  const bundle={range:{from:'2026-10-01',to:'2026-10-12'},reports:[{person,days:[day],totals:{puntuales:3,tardanzas:1,archivos:3}}]};
  const c=vm.createContext({Intl,Date,$:get,APP:{access:{acceso_panel:true},adminTeam:{personas:[person]}},ATTENDANCE_EXPORT_IDS:new Set(),ADMIN_MONTH_DIALOG:null,
    esc:v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
    attendanceExportPeople:()=>[person],renderAttendanceExport(){},
    collectAttendanceReport:async(...args)=>{calls.push(args);return bundle},
    openMonthModal:(...args)=>calls.push({modal:args}),closeMonthModal:()=>calls.push('close'),
    KJAMonthDayDetail:{mount:(host,options)=>{calls.push({mount:options});return {dispose(){}}}}
  });
  vm.runInContext(fs.readFileSync('assets/js/attendance-report-model.js','utf8'),c);
  vm.runInContext(fs.readFileSync('assets/js/dashboard-attendance-preview.js','utf8'),c);
  return {c,nodes,get,calls,bundle,person,day};
}
test('inline report uses the selected range, escapes names and makes dates keyboard buttons',async()=>{
  const x=setup();await x.c.showAttendancePreview();
  assert.equal(x.calls[0][1].from,'2026-10-01');assert.equal(x.calls[0][3].signFiles,false);
  const html=x.get('attendance-report-preview').innerHTML;
  assert.match(html,/Ana &lt;script&gt;/);assert.match(html,/data-attendance-person="9"/);assert.match(html,/data-attendance-day="2026-10-11"/);assert.match(html,/1 archivo/);assert.doesNotMatch(html,/#undefined/);
});
test('a date opens all evidence categories for the exact person and preserves a nonworking day',async()=>{
  const x=setup();await x.c.showAttendancePreview();x.c.openAttendancePreviewDay('9','2026-10-11');
  const options=x.calls.find(c=>c.mount).mount;
  assert.equal(options.person.id,9);assert.equal(options.day.fecha,'2026-10-11');assert.equal(options.day.laborable,false);
  assert.equal(options.canManageFacebook,false);assert.equal(options.facebookOnly,undefined);
  assert.equal(x.c.ADMIN_MONTH_DIALOG.kind,'attendance-report');
});
test('unknown dates and revoked access cannot open a modal',async()=>{
  const x=setup();await x.c.showAttendancePreview();x.c.openAttendancePreviewDay('9','2026-10-10');x.c.openAttendancePreviewDay('99','2026-10-11');
  x.c.APP.access.acceso_panel=false;x.c.openAttendancePreviewDay('9','2026-10-11');
  assert.equal(x.calls.filter(c=>c.modal).length,0);
});
test('PDF references are preserved and clicking Facebook opens its file within that day',async()=>{
  const x=setup();await x.c.showAttendancePreview();
  assert.match(x.get('attendance-report-preview').innerHTML,/data-attendance-kind="comparticiones"/);
  assert.match(x.get('attendance-report-preview').innerHTML,/#1/);
  x.c.openAttendancePreviewDay('9','2026-10-11','comparticiones');
  assert.equal(x.calls.find(c=>c.mount).mount.initialFile.path,'facebook.jpg');
  assert.match(x.calls.find(c=>c.modal).modal[3],/Día anterior/);
});
test('a stale request cannot repopulate a cleared report; errors offer retry',async()=>{
  const x=setup();let resolve;x.c.collectAttendanceReport=()=>new Promise(r=>resolve=r);
  const pending=x.c.showAttendancePreview();x.c.resetAttendancePreview();resolve(x.bundle);await pending;
  assert.equal(x.get('attendance-report-preview').hidden,true);assert.equal(x.get('attendance-report-preview').innerHTML,'');
  x.c.collectAttendanceReport=async()=>{throw Error('Sin conexión')};await x.c.showAttendancePreview();
  assert.match(x.get('attendance-report-preview').innerHTML,/Sin conexión/);assert.match(x.get('attendance-report-preview').innerHTML,/data-attendance-retry/);assert.equal(x.get('attendance-report-view').disabled,false);
});
test('person shortcut selects only that person and clearing closes its evidence modal',async()=>{
  const x=setup();await x.c.showAttendancePreview('9');assert.deepEqual([...x.c.ATTENDANCE_EXPORT_IDS],['9']);
  x.c.openAttendancePreviewDay('9','2026-10-11');x.c.resetAttendancePreview();assert.ok(x.calls.includes('close'));
});
