import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const meeting='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const sid='20000000-0000-4000-8000-000000000001',sid2='20000000-0000-4000-8000-000000000002';
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
 create table auth.users(id uuid primary key,email text);
 create table asis_areas(id bigint primary key,nombre text,activo boolean);
 create table asis_colaboradores(id bigint primary key,nombre text,area_id bigint,activo boolean);
 create table asis_perfiles(id uuid primary key,activo boolean,acceso_panel boolean,rol text,nivel text,colaborador_id bigint);
 insert into asis_perfiles values
 ('00000000-0000-4000-8000-000000000001',true,true,'direccion','sistemas',null),
 ('00000000-0000-4000-8000-000000000002',true,true,'visor','miembro',null),
 ('00000000-0000-4000-8000-000000000003',true,true,'visor','miembro',null);`);
 for(const file of ['109_zoom','110_zoom_operadores','118_zoom_camaras'])await db.exec(fs.readFileSync(`supabase/dashboard_${file}.sql`,'utf8'));
 await db.exec(fs.readFileSync('supabase/dashboard_118_zoom_camaras.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/dashboard_119_zoom_camaras_sala.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/dashboard_119_zoom_camaras_sala.sql','utf8'));
 await db.query("insert into zoom_reuniones(id,topic,status) values($1,'Diaria','ready'),($2,'Otra','ready')",[meeting,other]);
 await db.query("insert into zoom_operadores(reunion_id,perfil_id) values($1,'00000000-0000-4000-8000-000000000002')",[meeting]);
 const identity=n=>db.query("select set_config('request.uid',$1,false)",['00000000-0000-4000-8000-'+String(n).padStart(12,'0')]);
 const start=(id=sid,r=meeting)=>db.query('select dash_zoom_camera_start($1,$2) data',[r,id]);
 const sample=(seq,people,scope='main',id=sid)=>db.query('select dash_zoom_camera_sample($1,$2,$3,$4::jsonb) data',[id,seq,scope,JSON.stringify(people)]);
 const report=async(id=null,r=meeting)=>(await db.query('select dash_zoom_camera_report($1,$2) data',[r,id])).rows[0].data;
 await identity(2);return {db,identity,start,sample,report};
}

test('camera history enforces meeting/observer scope, immutable order and private tables',async()=>{
 const h=await fixture();try{
  await h.start();await h.start();assert.equal((await h.db.query('select count(*)::int n from zoom_camera_sessions')).rows[0].n,1);
  await h.sample(1,[{id:'a',name:'Ana',state:'on',token:'MUST_NOT_STORE'}]);
  const saved=(await h.db.query('select participants from zoom_camera_samples')).rows[0].participants;
  assert.deepEqual(saved,{a:{name:'Ana',state:'on'}});
  await h.sample(1,[{id:'a',name:'Changed',state:'off'}]);
  assert.equal((await h.report()).people[0].name,'Ana');
  await assert.rejects(h.sample(2,[{id:'a',name:'Ana',state:'on'},{id:'a',name:'Otro',state:'off'}]),/duplicado/);
  await assert.rejects(h.sample(2,[{id:'a',name:'Ana',state:'maybe'}]),/válido/);
  await assert.rejects(h.sample(2,[],'invalid'),/válida/);
  await assert.rejects(h.start(sid2,other),/permiso/);
  await h.identity(3);await assert.rejects(h.report(),/permiso/);await assert.rejects(h.sample(2,[]),/permiso/);
  await h.identity(1);assert.equal((await h.report()).people.length,1);await assert.rejects(h.sample(2,[]),/permiso/);
  await assert.rejects(h.start(),/disponible/);
  const perms=(await h.db.query("select has_table_privilege('authenticated','zoom_camera_samples','select') rd,has_table_privilege('authenticated','zoom_camera_samples','insert') wr,has_function_privilege('anon','dash_zoom_camera_report(uuid,uuid)','execute') anon")).rows[0];
  assert.deepEqual(perms,{rd:false,wr:false,anon:false});
  await h.identity(2);await h.db.exec('delete from zoom_operadores');await assert.rejects(h.report(),/permiso/);
  await h.db.query('select dash_zoom_camera_stop($1)',[sid]);
 }finally{await h.db.close();}
});

test('server computes confirmed times, unknown gaps and percentages without merging names',async()=>{
 const h=await fixture();try{
  await h.start();
  await h.sample(1,[{id:'a',name:'Mismo nombre',state:'on'}]);
  await h.sample(2,[{id:'a',name:'Mismo nombre',state:'off'},{id:'b',name:'Mismo nombre',state:'on'}]);
  await h.sample(3,[{id:'a',name:'Renombrado',state:'unknown'}]);
  await h.sample(4,[{id:'a',name:'Renombrado',state:'on'}]);
  await h.db.exec(`update zoom_camera_samples set received_at=timestamptz '2026-01-01 12:00:00Z'+make_interval(secs=>case seq when 1 then 0 when 2 then 10 when 3 then 70 else 90 end);
   update zoom_camera_sessions set started_at='2026-01-01 12:00:00Z',last_seen_at='2026-01-01 12:01:30Z',ended_at='2026-01-01 12:01:40Z';`);
  const data=await h.report(),a=data.people.find(p=>p.id==='a'),b=data.people.find(p=>p.id==='b');
  assert.equal(a.name,'Renombrado');assert.equal(a.on_seconds,20);assert.equal(a.off_seconds,20);assert.equal(a.unknown_seconds,60);assert.equal(a.percentage,50);
  assert.equal(b.on_seconds,20);assert.equal(b.off_seconds,0);assert.equal(b.unknown_seconds,70);assert.equal(b.percentage,100);
  assert.ok(data.people.every(p=>p.state==='unknown'));
  await assert.rejects(h.sample(5,[]),/terminó/);
  await h.start(sid2);assert.equal((await h.report(sid2)).people.length,0);assert.equal((await h.report(sid)).people.length,2);
  await assert.rejects(h.report(sid,other),/permiso/);
 }finally{await h.db.close();}
});

test('breakout observations stay unknown; stale observers cannot imply indefinite camera time',async()=>{
 const h=await fixture();try{
  await h.start();await h.sample(1,[{id:'a',name:'Ana',state:'on'}],'breakout');
  await h.db.exec("update zoom_camera_samples set received_at=now()-interval '1 hour';update zoom_camera_sessions set last_seen_at=now()-interval '1 hour'");
  const person=(await h.report()).people[0];
  assert.equal(person.on_seconds,0);assert.equal(person.off_seconds,0);assert.equal(person.percentage,null);assert.equal(person.unknown_seconds,40);assert.equal(person.state,'unknown');
 }finally{await h.db.close();}
});

test('local room observations preserve explicit camera states without rewriting legacy unknown samples',async()=>{
 const h=await fixture();try{
  await h.start();await h.sample(1,[{id:'a',name:'Local',state:'on'}],'breakout');
  await h.sample(2,[{id:'a',name:'Local',state:'on'},{id:'b',name:'Remoto',state:'unknown'}],'local');
  const samples=(await h.db.query('select participants from zoom_camera_samples order by seq')).rows;
  assert.equal(samples[0].participants.a.state,'unknown');assert.equal(samples[1].participants.a.state,'on');assert.equal(samples[1].participants.b.state,'unknown');
  const report=await h.report();assert.equal(report.scope,'local');
  assert.equal(report.people.find(p=>p.id==='a').state,'on');assert.equal(report.people.find(p=>p.id==='b').state,'unknown');
 }finally{await h.db.close();}
});
