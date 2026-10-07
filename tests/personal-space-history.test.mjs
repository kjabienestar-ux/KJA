import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {PGlite} from '@electric-sql/pglite';

const source=fs.readFileSync('assets/js/dashboard.js','utf8');
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
function ui(){
  const dom=new JSDOM('<div id="attendance-day-content"></div><div id="personal-request-count"></div><div id="personal-request-list"></div><button id="personal-requests-refresh"></button>');
  const env={$:id=>dom.window.document.getElementById(id),esc,APP:{personalRequests:[]},
    attendanceMobileQuery:{matches:false},statusLabel:()=> 'Presente',formatAttendanceDayDate:()=> '6 de octubre',
    fmtTime:x=>x,formatAttendanceClock:()=> '08:00 a. m.',attendanceModeLabel:()=> 'Virtual',
    attendanceOriginLabel:()=> 'Portal personal',isoLima:()=> '2026-10-07',addIsoDays:()=> '2026-07-01',
    personalRequestLabel:()=> 'Cambio de horario',formatRequestDate:x=>x,leaveCounterofferMarkup:()=>'',toast(){},
    ATTENDANCE_DAY_EVIDENCES:[]};
  vm.runInNewContext(source.slice(source.indexOf('function renderAttendanceDay('),source.indexOf('\nfunction openAttendanceEvidence(')),env);
  vm.runInNewContext(source.slice(source.indexOf('function renderPersonalRequests('),source.indexOf('\nfunction resetPersonalRequestEvidence(')),env);
  return env;
}

test('desktop day shows one selected file and preserves activity/file navigation',()=>{
  const env=ui(),evidences=[{url:'entry.jpg',label:'Entrada'},
    ...Array.from({length:6},(_,i)=>({actividad:'facebook',url:`facebook-${i}.jpg`,label:'Facebook'}))];
  env.renderAttendanceDay({fecha:'2026-10-06',estado:'P',labora:true,actividades:[{id:'facebook',titulo:'Facebook'}]},evidences);
  const content=env.$('attendance-day-content');
  assert.equal(content.querySelectorAll('img').length,1);
  assert.equal(content.querySelectorAll('[data-attendance-activity]').length,2);
  assert.equal(content._activities[1].files.length,6);
  assert.ok(content.innerHTML.indexOf('HORARIO PROGRAMADO')<content.innerHTML.indexOf('Evidencias del día'));
  content._activity=1;content._file=5;env.renderAttendanceActivity();
  assert.equal(content.querySelector('img').getAttribute('src'),'facebook-5.jpg');
  assert.equal(content.querySelector('[data-attendance-evidence]').dataset.attendanceEvidence,'6');
  assert.equal(env.$('attendance-file-count').textContent,'6 de 6 archivos');
  assert.equal(content.querySelector('[data-attendance-page="1"]').disabled,true);
  assert.equal(content.querySelector('[data-attendance-activity="1"]').getAttribute('aria-pressed'),'true');
});

test('trash appears only for resolved requests and failed deletion keeps the row',async()=>{
  const env=ui();env.APP.personalRequests=['pendiente','aprobada','rechazada'].map((estado,i)=>({id:i+1,estado,tipo:'cambio_horario',fecha_inicio:'2026-10-06',fecha_fin:'2026-10-06'}));
  env.renderPersonalRequests();
  assert.equal(env.$('personal-request-count').textContent,'1');
  assert.deepEqual([...env.$('personal-request-list').querySelectorAll('[data-delete-personal-request]')].map(x=>x.dataset.deletePersonalRequest),['2','3']);
  let calls=0;env.db={rpc:async()=>{calls++;return {error:{code:'PGRST202'}}}};
  let message;env.toast=text=>message=text;
  const button=env.$('personal-request-list').querySelector('[data-delete-personal-request="2"]');
  await env.deletePersonalRequest(button);
  assert.equal(env.APP.personalRequests.length,3);assert.equal(button.disabled,false);
  assert.match(message,/migración 102/);
  env.db.rpc=async(name,args)=>{calls++;assert.equal(name,'dash_eliminar_solicitud_historial');assert.equal(args.p_id,2);return {data:{ok:true}}};
  await env.deletePersonalRequest(button);
  assert.equal(env.APP.personalRequests.length,2);
  assert.equal(env.$('personal-request-list').querySelector('[data-delete-personal-request="2"]'),null);
  await env.deletePersonalRequest({dataset:{deletePersonalRequest:'1'}});
  assert.equal(calls,2);
});

test('persistent removal enforces ownership/session/final status and preserves original records',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create schema auth;
      create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
      create function dash_colab() returns bigint language sql as $$select 1::bigint$$;
      create function dash_sesion_vigente() returns boolean language sql as $$select current_setting('test.valid')::boolean$$;
      create function asis_enriquecer_contraofertas(jsonb) returns jsonb language sql as $$select $1$$;
      set test.valid='true';
      create table asis_solicitudes_personales(id bigint primary key,colaborador_id bigint,tipo text,fecha_inicio date,fecha_fin date,detalle text,evidencia_path text,estado text,respuesta text,creado_at timestamptz default now(),resuelto_at timestamptz);
      insert into asis_solicitudes_personales(id,colaborador_id,tipo,estado,evidencia_path)
        values(1,1,'dia_libre','aprobada','preservar.jpg'),(2,1,'cambio_horario','rechazada',null),(3,1,'justificacion','pendiente',null),(4,2,'dia_libre','aprobada',null);`);
    const sql=fs.readFileSync('supabase/dashboard_102_historial_solicitudes.sql','utf8');
    await db.exec(sql);await db.exec(sql);
    const remove=async id=>(await db.query('select dash_eliminar_solicitud_historial($1) data',[id])).rows[0].data;
    const list=async()=>(await db.query('select dash_solicitudes_personales() data')).rows[0].data;
    assert.deepEqual((await list()).solicitudes.map(x=>x.id),[3,2,1]);
    assert.equal((await remove(3)).motivo,'pendiente');
    assert.equal((await remove(4)).motivo,'no_existe');
    assert.equal((await remove(999)).motivo,'no_existe');
    assert.equal((await remove(1)).ok,true);assert.equal((await remove(1)).ok,true);
    assert.equal((await remove(2)).ok,true);
    assert.deepEqual((await list()).solicitudes.map(x=>x.id),[3]);
    const original=(await db.query('select estado,evidencia_path,ocultado_historial_at from asis_solicitudes_personales where id=1')).rows[0];
    assert.equal(original.estado,'aprobada');assert.equal(original.evidencia_path,'preservar.jpg');assert.ok(original.ocultado_historial_at);
    await db.exec(`insert into asis_solicitudes_personales(id,colaborador_id,estado,ocultado_historial_at)
      select n,1,'rechazada',now() from generate_series(5,30) n;`);
    assert.deepEqual((await list()).solicitudes.map(x=>x.id),[3]);
    await db.exec("set test.valid='false'");
    assert.equal((await remove(1)).motivo,'sesion');assert.equal((await list()).motivo,'sesion');
    const grants=(await db.query("select has_function_privilege('anon','dash_eliminar_solicitud_historial(bigint)','execute') anon,has_function_privilege('authenticated','dash_eliminar_solicitud_historial(bigint)','execute') member")).rows[0];
    assert.deepEqual(grants,{anon:false,member:true});
  }finally{await db.close();}
});
