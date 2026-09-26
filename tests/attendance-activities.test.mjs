import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';

test('compact stage displays one file, handles media types and keeps paging boundaries',()=>{
  const source=fs.readFileSync('assets/js/dashboard.js','utf8'),nodes=new Map();
  const $=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',querySelector:key=>$('button-'+key),querySelectorAll:()=>[]});return nodes.get(id);};
  const env={$,esc:x=>String(x||'').replaceAll('<','&lt;')};
  vm.runInNewContext(source.slice(source.indexOf('function renderAttendanceActivity('),source.indexOf('\nfunction openAttendanceEvidence(')),env);
  const content=$('attendance-day-content');content._activities=[{files:[
    {index:0,url:'photo',mime:'image/jpeg',label:'Entrada'},
    {index:1,url:'doc',mime:'application/pdf',label:'RPE'},
    {index:2,url:'video',mime:'video/mp4',label:'Video anterior'},
    {index:3,url:'',label:'No disponible'}]}];content._activity=0;content._file=0;
  env.renderAttendanceActivity();assert.match($('attendance-compact-stage').innerHTML,/<img/);
  assert.equal($('attendance-file-count').textContent,'1 de 4 archivos');
  assert.equal(content.querySelector('[data-attendance-page="-1"]').disabled,true);
  content._file=1;env.renderAttendanceActivity();assert.match($('attendance-compact-stage').innerHTML,/Abrir documento/);
  content._file=2;env.renderAttendanceActivity();assert.match($('attendance-compact-stage').innerHTML,/<video controls/);
  content._file=3;env.renderAttendanceActivity();assert.match($('attendance-compact-stage').innerHTML,/Reintentar/);
  assert.equal(content.querySelector('[data-attendance-page="1"]').disabled,true);
});

test('activity navigation preserves every file, failed URLs, assignments and notes',()=>{
  const source=fs.readFileSync('assets/js/dashboard.js','utf8');
  const env={personalRequestLabel:()=> 'Solicitud'};
  vm.runInNewContext(source.slice(source.indexOf('function attendanceActivityGroups('),source.indexOf('\nfunction renderAttendanceCompact(')),env);
  const groups=env.attendanceActivityGroups({marcado_at:'2026-09-11',nota:'Observación',actividades:[
    {id:'entrega-1',titulo:'RPE'},{id:'entrega-2',titulo:'Salida'},
    {id:'entrega-3',titulo:'Facebook'},{id:'entrega-4',titulo:'Informe'}
  ]},[{bucket:'asis-evidencias',url:'entrada'},
    {actividad:'entrega-1',url:'rpe'}, {actividad:'entrega-2',url:''},
    ...Array.from({length:50},(_,i)=>({actividad:'entrega-3',url:'fb-'+i})),
    {actividad:'entrega-4',mime:'application/pdf',url:'documento'}]);
  assert.equal(groups.length,6);
  assert.equal(groups[2].files.length,1);
  assert.equal(groups[2].files[0].url,'');
  assert.equal(groups[3].files.length,50);
  assert.equal(groups[3].files[49].index,52);
  assert.equal(groups[4].files[0].mime,'application/pdf');
  assert.equal(groups[5].detalle,'Observación');
});

test('historical SQL only returns this person/date, excludes annulled deliveries and preserves base validation',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      create role anon;create role authenticated;create schema auth;
      create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
      create function public.dash_colab() returns bigint language sql as $$select 1::bigint$$;
      create function public.dash_sesion_vigente() returns boolean language sql as $$select current_setting('test.valid')::boolean$$;
      set test.valid='true';
      create table public.asis_registros(colaborador_id bigint,fecha date,salida_at timestamptz);
      create table public.asis_asignaciones_diarias(id bigint,titulo text);
      create table public.asis_entregas_diarias(id bigint,colaborador_id bigint,fecha date,requisito text,asignacion_id bigint,detalle text,completado_at timestamptz,estado text);
      create table public.asis_entrega_archivos(id bigint,entrega_id bigint,path text,mime text,orden integer);
      create function public.dash_dia_detalle(p_fecha date) returns jsonb language sql as $$
        select case when p_fecha is null then '{"ok":false,"motivo":"fecha"}'::jsonb else
        '{"ok":true,"evidencias":[{"bucket":"asis-evidencias","path":"entrada"}],"horas":5.7}'::jsonb end $$;
      insert into asis_registros values(1,'2026-09-11','2026-09-11T19:00:00Z');
      insert into asis_asignaciones_diarias values(8,'Informe');
      insert into asis_entregas_diarias values
        (1,1,'2026-09-11','rpe',null,'Reporte',now(),'completo'),
        (2,1,'2026-09-11','salida',null,null,now(),'completo'),
        (3,1,'2026-09-11','comparticiones',null,null,now(),'completo'),
        (4,1,'2026-09-11','asignado',8,null,now(),'completo'),
        (5,2,'2026-09-11','rpe',null,null,now(),'completo'),
        (6,1,'2026-09-10','rpe',null,null,now(),'completo'),
        (7,1,'2026-09-11','rpe',null,null,now(),'anulado');
      insert into asis_entrega_archivos select id,id,'archivo-'||id,'image/jpeg',1 from asis_entregas_diarias;
      insert into asis_entrega_archivos values(8,4,'documento','application/pdf',2);
    `);
    const sql=fs.readFileSync('supabase/dashboard_79_historial_evidencias.sql','utf8');
    await db.exec(sql);await db.exec(sql);
    const read=async date=>(await db.query('select public.dash_dia_detalle($1::date) as data',[date])).rows[0].data;
    const data=await read('2026-09-11');
    assert.equal(data.horas,5.7);
    assert.equal(data.actividades.length,4);
    assert.equal(data.evidencias.length,6);
    assert.equal(data.evidencias[0].path,'entrada');
    assert.equal(data.evidencias.at(-1).mime,'application/pdf');
    assert.equal(data.actividades.at(-1).titulo,'Informe');
    assert.ok(data.salida_at);
    assert.equal((await read(null)).motivo,'fecha');
    assert.equal((await read('2026-09-12')).actividades.length,0);
    const permissions=await db.query("select has_function_privilege('authenticated','public.dash_dia_detalle(date)','execute') as rpc,has_function_privilege('authenticated','public.dash_dia_detalle_base_79(date)','execute') as base");
    assert.deepEqual(permissions.rows[0],{rpc:true,base:false});
    await db.exec("set test.valid='false'");
    assert.equal((await read('2026-09-11')).motivo,'sesion');
  }finally{await db.close();}
});
