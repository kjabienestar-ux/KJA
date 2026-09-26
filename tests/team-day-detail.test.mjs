import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';

const source=fs.readFileSync('assets/js/dashboard.js','utf8');
test('team day groups count activities rather than files, preserve assignments and exclude cancelled pending work',()=>{
  const env={};
  vm.runInNewContext(source.slice(source.indexOf('function teamDayActivities('),source.indexOf('\nasync function openTeamDay(')),env);
  const groups=env.teamDayActivities({cierre:{requisitos:[
    {tipo:'rpe',titulo:'RPE',completo:true},{tipo:'salida',titulo:'Salida',completo:true},
    {tipo:'comparticiones',titulo:'Facebook',completo:false}],asignaciones:[
    {id:7,titulo:'Informe',completo:false},{id:8,titulo:'Cancelada',estado:'cancelada',completo:false}]},entregas:[
    {tipo:'rpe',titulo:'RPE',archivos:[{path:'rpe1'},{path:'rpe2'}]},
    {tipo:'salida',titulo:'Salida',archivos:[{path:'salida'}]},
    {tipo:'asignado',asignacion_id:9,titulo:'Entrega anterior',archivos:Array.from({length:50},(_,i)=>({path:String(i)}))}]});
  assert.equal(groups.length,5);
  assert.equal(groups.filter(x=>x.completo).length,3);
  assert.equal(groups.filter(x=>!x.completo).length,2);
  assert.equal(groups.reduce((n,x)=>n+x.files.length,0),53);
  assert.equal(groups.find(x=>x.key==='asignado-9').files[49].path,'49');
  assert.equal(env.teamDayActivities({cierre:{},entregas:[]}).length,0);
});

test('team day RPC restricts scope and session, validates dates, preserves complete deliveries and file order',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create schema auth;
      create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
      create function dash_sesion_vigente() returns boolean language sql as $$select current_setting('test.valid')::boolean$$;
      create function puede_ver_colab(bigint) returns boolean language sql as $$select $1 in (1,2)$$;
      set test.valid='true';
      create table asis_registros(colaborador_id bigint,fecha date,estado text,marcado_at timestamptz,salida_at timestamptz,horas numeric,evidencia_path text);
      create table asis_asignaciones_diarias(id bigint,titulo text);
      create table asis_entregas_diarias(id bigint,colaborador_id bigint,fecha date,requisito text,asignacion_id bigint,detalle text,completado_at timestamptz,estado text);
      create table asis_entrega_archivos(id bigint,entrega_id bigint,path text,mime text,orden integer);
      create function dash_cierre_resumen_colab(bigint,date) returns jsonb language sql as $$select '{"ok":true,"pendientes":1,"modalidad":"virtual"}'::jsonb$$;
      insert into asis_registros values(2,'2026-01-12','P','2026-01-12T13:15Z','2026-01-12T19:00Z',5.75,'entrada');
      insert into asis_asignaciones_diarias values(9,'Informe');
      insert into asis_entregas_diarias values
        (1,2,'2026-01-12','rpe',null,'Reporte',now(),'completo'),
        (2,2,'2026-01-12','salida',null,'Salida',now(),'completo'),
        (3,2,'2026-01-12','asignado',9,'Documento',now(),'completo'),
        (4,3,'2026-01-12','rpe',null,'Otra persona',now(),'completo'),
        (5,2,'2026-01-11','rpe',null,'Otra fecha',now(),'completo'),
        (6,2,'2026-01-12','comparticiones',null,'Anulada',now(),'anulado');
      insert into asis_entrega_archivos values(1,1,'segundo','image/png',2),(2,1,'primero','application/pdf',1),(3,2,'salida','image/jpeg',0),(4,4,'privado','image/png',0),(5,6,'anulado','image/png',0);`);
    const sql=fs.readFileSync('supabase/dashboard_81_equipo_dia_detalle.sql','utf8');
    await db.exec(sql);await db.exec(sql);
    const get=async(id,date)=> (await db.query('select dash_equipo_dia_detalle($1,$2) data',[id,date])).rows[0].data;
    const data=await get(2,'2026-01-12');
    assert.equal(data.ok,true);assert.equal(data.colaborador_id,2);
    assert.equal(data.entrada_archivos[0].bucket,'asis-evidencias');
    assert.equal(data.entregas.length,3);assert.equal(data.cierre.pendientes,1);
    assert.deepEqual(data.entregas[0].archivos.map(x=>x.path),['primero','segundo']);
    assert.equal(data.entregas[2].titulo,'Informe');
    assert.equal(JSON.stringify(data).includes('privado'),false);
    assert.equal((await get(3,'2026-01-12')).motivo,'sin_permiso');
    assert.equal((await get(null,'2026-01-12')).motivo,'sin_permiso');
    assert.equal((await get(2,null)).motivo,'fecha');
    assert.equal((await get(2,'2099-01-01')).motivo,'fecha');
    assert.equal((await get(2,'2019-01-01')).motivo,'fecha');
    assert.equal((await get(2,'2026-01-10')).entregas.length,0);
    await db.exec("set test.valid='false'");
    assert.equal((await get(2,'2026-01-12')).motivo,'sin_permiso');
    const grants=await db.query("select has_function_privilege('anon','dash_equipo_dia_detalle(bigint,date)','execute') anon,has_function_privilege('authenticated','dash_equipo_dia_detalle(bigint,date)','execute') member");
    assert.deepEqual(grants.rows[0],{anon:false,member:true});
  }finally{await db.close();}
});

test('changing the date ignores stale RPC responses',async()=>{
  const host={isConnected:true,setAttribute(){},removeAttribute(){},scrollIntoView(){}};
  let resolves=[];
  const env={APP:{selectedTeamPersonId:'2'},Symbol,Intl,Date,esc:String,
    $:id=>id==='team-day-detail'?host:{querySelectorAll:()=>[]},
    db:{rpc:()=>new Promise(resolve=>resolves.push(resolve))}};
  vm.runInNewContext(source.slice(source.indexOf('async function openTeamDay('),source.indexOf('\nasync function openTeamDayFile(')),env);
  const a=env.openTeamDay('2026-01-12'),b=env.openTeamDay('2026-01-13');
  resolves[1]({error:{code:'PGRST202'}});await b;
  const current=host.innerHTML;
  resolves[0]({data:{ok:true}});await a;
  assert.equal(host.innerHTML,current);
  assert.match(current,/13 de enero/);assert.match(current,/migración 81/);
});
