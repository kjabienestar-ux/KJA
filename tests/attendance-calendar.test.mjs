import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import model from '../assets/js/attendance-calendar-model.js';
test('missing Facebook on a non-working day explains why it is red',()=>{
  const v=model.present({lab:false,aplica_comparticiones:true,comparticiones_vencidas:true});
  assert.equal(v.tone,'missing');assert.match(v.reason,/No tenías jornada laboral, pero sí comparticiones asignadas/);
});
test('delivered, not assigned, future and open-window dates are distinct',()=>{
  const day={lab:false,aplica_comparticiones:true};
  assert.equal(model.present({...day,comparticiones_completas:true}).tone,'shared');
  assert.match(model.present({...day,comparticiones_completas:true}).sharing,/aprobación se revisa por separado/);
  assert.equal(model.present(day).tone,'sharing-pending');
  assert.equal(model.present({...day,futuro:true,comparticiones_vencidas:true}).tone,'future');
  assert.equal(model.present({lab:false,aplica_comparticiones:false}).tone,'off');
  assert.match(model.present({lab:false}).sharing,/no disponible/);
});
test('attendance and sharing remain independent and future dates are never red',()=>{
  assert.equal(model.present({lab:true,estado:'P'}).tone,'p');
  assert.equal(model.present({lab:true,estado:'P',aplica_comparticiones:true,comparticiones_vencidas:true}).tone,'missing');
  assert.equal(model.present({lab:true,cierre_estado:'incompleta'}).tone,'incomplete');
  assert.equal(model.present({lab:true,estado:'T'}).tone,'t');
  assert.equal(model.present({lab:true,futuro:true,cierre_estado:'incompleta'}).tone,'future');
});
test('day selection ignores stale responses and exposes recoverable errors',async()=>{
  const elements=new Map();
  const el=id=>{if(!elements.has(id))elements.set(id,{dataset:{},innerHTML:'',setAttribute(k,v){this[k]=v;},focus(){}});return elements.get(id);};
  const requests=[];
  const code=fs.readFileSync('assets/js/dashboard.js','utf8');
  const section=code.slice(code.indexOf("let selectedAttendanceDate="),code.indexOf('function renderHistory()'));
  const ctx=vm.createContext({APP:{historial:{dias:[{fecha:'2026-09-19',lab:false,aplica_comparticiones:true,comparticiones_vencidas:true},{fecha:'2026-09-21',lab:true,estado:'P'}]}},KJAAttendanceCalendar:model,$:el,document:{querySelectorAll:()=>[]},window:{matchMedia:()=>({matches:false})},esc:x=>String(x??'').replaceAll('<','&lt;'),formatAttendanceDayDate:x=>x,formatAttendanceClock:x=>x||'—',fmtTime:x=>x||'—',attendanceModeLabel:x=>x||'—',personalRequestLabel:x=>x,db:{rpc:()=>new Promise(resolve=>requests.push(resolve))}});
  vm.runInContext(section,ctx);
  const first=ctx.selectAttendanceDate('2026-09-19'),second=ctx.selectAttendanceDate('2026-09-21');
  requests[1]({data:{ok:true,nota:'Segunda fecha',horas:6}});await second;
  requests[0]({data:{ok:true,nota:'Respuesta antigua'}});await first;
  assert.equal(el('attendance-selected-title').textContent,'2026-09-21');
  assert.match(el('attendance-selected-extra').innerHTML,/Segunda fecha/);
  assert.doesNotMatch(el('attendance-selected-extra').innerHTML,/Respuesta antigua/);
  const retry=ctx.selectAttendanceDate('2026-09-19');requests[2]({error:{message:'offline'}});await retry;
  assert.match(el('attendance-selected-content').innerHTML,/No tenías jornada laboral/);
  assert.match(el('attendance-selected-extra').innerHTML,/Reintentar/);
});
