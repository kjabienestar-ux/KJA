import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import vm from 'node:vm';

test('server enforces admin grants, area membership, private counts and first-save deduplication',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
      create table asis_areas(id bigint primary key,nombre text,activo boolean default true);
      create table asis_colaboradores(id bigint primary key,area_id bigint references asis_areas,nombre text,activo boolean default true);
      create table asis_perfiles(id uuid primary key,colaborador_id bigint,nombre text,nivel text,activo boolean default true);
      create table marketing_accesos(usuario_id uuid primary key,puede_publicar boolean default false);
      create table marketing_publicaciones(id uuid primary key,autor uuid,copy text default '',eliminado_at timestamptz);
      insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
      insert into asis_areas values(1,'Marketing',true),(2,'Ventas',true);
      insert into asis_colaboradores values(10,1,'Pepito',true),(11,2,'Ana',true);
      insert into asis_perfiles values('00000000-0000-0000-0000-000000000001',null,'Admin','sistemas',true),('00000000-0000-0000-0000-000000000002',10,'Pepito','miembro',true),('00000000-0000-0000-0000-000000000003',11,'Ana','miembro',true);
      insert into marketing_publicaciones values('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000002','Copy anterior',null);`);
    await db.exec(fs.readFileSync(new URL('../supabase/marketing_06_accesos_equipo.sql',import.meta.url),'utf8'));
    await db.exec(fs.readFileSync(new URL('../supabase/marketing_06_accesos_equipo.sql',import.meta.url),'utf8'));
    const as=async n=>db.exec(`set app.uid='00000000-0000-0000-0000-${String(n).padStart(12,'0')}'`);
    const value=async sql=>(await db.query(sql)).rows[0].value;
    await as(2);
    assert.equal((await value('select marketing_permiso() value')).acceso,false);
    await assert.rejects(db.query('select marketing_gestion_accesos()'),/administrador/);
    await assert.rejects(db.query('select marketing_guardar_accesos(1,array[10]::bigint[])'),/administrador/);
    await as(1);
    await assert.rejects(db.query('select marketing_guardar_accesos(1,array[11]::bigint[])'),/área indicada/);
    await db.query('select marketing_guardar_accesos(1,array[10]::bigint[])');
    await as(2);
    assert.deepEqual(await value('select marketing_permiso() value'),{administrar:false,acceso:true,publicar:false});
    await db.exec('update asis_colaboradores set activo=false where id=10');
    assert.equal((await value('select marketing_permiso() value')).acceso,false);
    await db.exec('update asis_colaboradores set activo=true where id=10');
    await db.exec(`insert into marketing_publicaciones(id,autor,copy) values('00000000-0000-0000-0000-000000000020',auth.uid(),'');
      update marketing_publicaciones set copy='Nuevo copy' where id='00000000-0000-0000-0000-000000000020';
      update marketing_publicaciones set copy='Edición' where id='00000000-0000-0000-0000-000000000020';`);
    let activity=await value('select marketing_mi_actividad() value');
    assert.equal(activity.nombre,'Pepito');assert.equal(activity.dias[0].cantidad,1);assert.equal(activity.anteriores,1);
    await db.exec(`update marketing_publicaciones set eliminado_at=now(),copy='' where id='00000000-0000-0000-0000-000000000020';update marketing_publicaciones set copy='Otra edición' where id='00000000-0000-0000-0000-000000000020';`);
    assert.equal((await value('select marketing_mi_actividad() value')).dias[0].cantidad,1);
    await as(1);assert.equal((await value('select marketing_mi_actividad() value')).dias[0].cantidad,0);
    await db.exec('update asis_colaboradores set area_id=2 where id=10');await as(2);
    assert.equal((await value('select marketing_permiso() value')).acceso,false);
    await db.exec('update asis_colaboradores set area_id=1 where id=10');
    await as(1);await db.query('select marketing_guardar_accesos(1,array[]::bigint[])');await as(2);
    await assert.rejects(db.query('select marketing_mi_actividad()'),/acceso/);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from marketing_colaboradores_acceso'),/permission denied/);
  }finally{await db.close()}
});

test('access dialog filters by area, saves selected collaborators and shows private activity',async()=>{
  class Element{
    children=[];value='';hidden=true;disabled=false;checked=false;dataset={};textContent='';
    append(...nodes){this.children.push(...nodes)}replaceChildren(){this.children=[]}
    attrs={};setAttribute(name,value){this.attrs[name]=value}
    addEventListener(){}focus(){}showModal(){this.open=true}close(){this.open=false}
    querySelectorAll(selector){const all=this.children.flatMap(n=>[n,...n.children]);return all.filter(n=>n.type==='checkbox'&&(selector==='input'||selector==='input:checked'&&n.checked||selector==='input:not(:disabled)'&&!n.disabled))}
  }
  const elements=new Map([...fs.readFileSync(new URL('../dashboard.html',import.meta.url),'utf8').matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
  const w=vm.createContext({Intl,Date,document:{getElementById:id=>elements.get(id),createElement:()=>new Element()}});w.window=w;
  const $=id=>elements.get('marketing-team-'+id),calls=[];
  w.db={auth:{onAuthStateChange(){}},rpc:async(name,args)=>{calls.push({name,args});return {data:name==='marketing_gestion_accesos'?{areas:[{id:1,nombre:'Marketing'},{id:2,nombre:'Ventas'}],colaboradores:[{id:10,nombre:'Pepito',area_id:1,acceso:false},{id:11,nombre:'Ana',area_id:2,acceso:true}]}:name==='marketing_mi_actividad'?{nombre:'Pepito',dias:[{fecha:'2026-10-16',cantidad:2}],anteriores:0}:null}}};
  vm.runInContext(fs.readFileSync(new URL('../assets/js/dashboard-marketing-team.js',import.meta.url),'utf8'),w);
  w.KJAMarketingTeam.init({acceso:true,administrar:true});await w.KJAMarketingTeam.refresh();
  assert.equal($('home-count').textContent,'2');assert.match($('greeting').textContent,/Pepito/);
  await $('manage').onclick();assert.equal($('people').querySelectorAll('input').length,1);
  $('all').onclick();await $('save').onclick();
  assert.deepEqual(JSON.parse(JSON.stringify(calls.find(x=>x.name==='marketing_guardar_accesos').args)),{p_area:1,p_colaboradores:[10]});
  $('view').onclick();assert.equal($('view-panel').hidden,false);assert.equal($('edit-panel').hidden,true);
  assert.equal($('authorized').children.length,2);
  assert.equal($('authorized').children[0].children[1].children[0].textContent,'Pepito');
  $('edit').onclick();assert.equal($('edit-panel').hidden,false);
  $('area').value='2';$('area').onchange();assert.equal($('people').querySelectorAll('input')[0].value,'11');
  w.KJAMarketingTeam.init({acceso:true,administrar:false});assert.equal($('manage').hidden,true);
  assert.equal($('mobile-open').hidden,false);
  w.KJAMarketingTeam.reset();assert.equal($('home').hidden,true);assert.equal($('activity').hidden,true);
  assert.equal($('mobile-open').hidden,true);
});
