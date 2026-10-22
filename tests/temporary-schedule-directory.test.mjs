import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const team=fs.readFileSync('assets/js/dashboard-admin-equipo.js','utf8');
function harness(){
  const context={APP:{adminTeam:{hoy:'2026-10-21'}},fmtTime:value=>String(value||'').slice(0,5),
    esc:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')};
  vm.createContext(context);
  vm.runInContext(team.slice(0,team.indexOf('async function loadAdminTeam(')),context);
  return context;
}
const person={horario_semanal:{},dias_laborables:[1,2,3,4,5],hora_inicio:'08:00',hora_fin:'13:00',
  horarios_temporales:[{fecha:'2026-10-20',laborable:false},{fecha:'2026-10-21',laborable:true,entrada:'10:30',salida:'13:00'},
    {fecha:'2026-10-22',laborable:false},{fecha:'2026-10-23',laborable:true,entrada:'10:30',salida:'13:00'},
    {fecha:'2026-11-03',laborable:true,entrada:'10:30',salida:'13:00'}],
  semana_vigente:Array.from({length:7},(_,i)=>({fecha:`2026-10-${19+i}`,laborable:![1,3,5,6].includes(i),
    entrada:[2,4].includes(i)?'10:30':'08:00',salida:'13:00',modalidad:'virtual',temporal:[1,2,3,4].includes(i)}))};

test('directory shows dated temporary shifts and days off without mutating weekly data',()=>{
  const c=harness(),before=JSON.stringify(person),dom=new JSDOM(c.adminScheduleMarkup(person));
  try{
    const chips=[...dom.window.document.querySelectorAll('.admin-day-chip')];
    assert.equal(chips.length,7);
    assert.match(chips[0].textContent,/Lun 19.*08:00–13:00/);
    assert.match(chips[1].textContent,/Mar 20.*Libre.*Sin gestión/);
    assert.match(chips[2].textContent,/Mié 21.*10:30–13:00/);
    assert.match(chips[3].textContent,/Jue 22.*Libre/);
    assert.match(chips[4].textContent,/Vie 23.*10:30–13:00/);
    assert.equal(dom.window.document.querySelectorAll('.admin-temporary-group').length,2);
    assert.match(dom.window.document.querySelector('.admin-temporary-heading').textContent,/Horario temporal.*03 nov\.? 2026/);
    assert.match(dom.window.document.querySelector('.admin-temporary-return').textContent,/4 de noviembre.*automáticamente/);
    assert.equal(dom.window.document.querySelector('.admin-temporary-return time').dateTime,'2026-11-04');
    assert.match(dom.window.document.querySelector('.admin-temporary-dates').getAttribute('aria-label'),/21, 23 de octubre · 3 de noviembre/);
    const reduced=dom.window.document.querySelector('.admin-temporary-group.is-working');
    assert.match(reduced.querySelector('.admin-temporary-times').textContent,/Entrada10:30.*Salida13:00/);
    assert.equal(reduced.querySelectorAll('time[datetime]').length,3);
    assert.equal(JSON.stringify(person),before);
  }finally{dom.window.close();}
});

test('punctuality limit is displayed only when confirmed by the server for all grouped dates',()=>{
  const c=harness();
  assert.doesNotMatch(c.adminScheduleMarkup(person),/Puntual hasta/);
  const confirmed={...person,horarios_temporales:person.horarios_temporales.map(day=>({...day,puntual_hasta:day.laborable?'10:45:00':null}))};
  assert.match(c.adminScheduleMarkup(confirmed),/Puntual hasta las <strong>10:45 a\. m\./);
});

test('the temporary status clears on the first day after the last override, even within the same week',()=>{
  const c=harness();c.APP.adminTeam.hoy='2026-11-04';
  const html=c.adminScheduleMarkup(person);
  assert.match(html,/Horario habitual/);
  assert.doesNotMatch(html,/Horario temporal|10:30/);
});

test('after the temporary dates end the directory returns to the usual weekly schedule',()=>{
  const c=harness();c.APP.adminTeam.hoy='2026-11-09';
  const normal={...person,semana_vigente:person.semana_vigente.map((d,i)=>({...d,fecha:`2026-11-${String(9+i).padStart(2,'0')}`,temporal:false}))};
  const html=c.adminScheduleMarkup(normal);
  assert.match(html,/Horario habitual/);
  assert.doesNotMatch(html,/Horario temporal|10:30/);
  assert.match(html,/08:00–13:00/);
});

test('a directory without the new SQL still shows its real weekly data',()=>{
  const c=harness();
  const html=c.adminScheduleMarkup({horario_semanal:{},dias_laborables:[1],hora_inicio:'08:00',hora_fin:'13:00'});
  assert.match(html,/Horario habitual/);
  assert.doesNotMatch(html,/Horario temporal/);
});
