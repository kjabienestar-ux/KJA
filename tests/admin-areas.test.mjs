import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';

test('areas: permissions, validation and deletion preserve every referenced record',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated;
      create table access_flag(allowed boolean); insert into access_flag values(true);
      create function asis_puede_editar() returns boolean language sql as $$ select allowed from access_flag $$;
      create table asis_areas(id bigint primary key,nombre text unique,activo boolean default true,orden int default 0);
      create table people(id bigint,area_id bigint references asis_areas(id) on delete restrict,activo boolean);
      create table assignments(id bigint,area_id bigint references asis_areas(id) on delete cascade);
      create table history(id bigint,area_id bigint references asis_areas(id) on delete set null);
      insert into asis_areas(id,nombre) values(1,'Marketing'),(2,'Clínica'),(3,'Vacía'),(4,'Historial'),(5,'Asignaciones');
      insert into people values(1,1,false); insert into assignments values(1,5); insert into history values(1,4);`);
    const migration=fs.readFileSync('supabase/dashboard_98_gestion_areas.sql','utf8');
    await db.exec(migration);await db.exec(migration);
    const edit=async(id,name)=>(await db.query('select dash_admin_editar_area($1,$2) data',[id,name])).rows[0].data;
    const remove=async(id)=>(await db.query('select dash_admin_eliminar_area($1) data',[id])).rows[0].data;
    assert.equal((await edit(1,'  Comunicación  ')).area.nombre,'Comunicación');
    assert.equal((await edit(1,'clínica')).motivo,'duplicada');
    assert.equal((await edit(1,' ')).motivo,'nombre');
    assert.equal((await edit(1,'a'.repeat(61))).motivo,'nombre');
    assert.equal((await edit(99,'Válida')).motivo,'no_existe');
    for(const id of [1,4,5])assert.equal((await remove(id)).motivo,'en_uso');
    assert.equal((await db.query('select area_id from history')).rows[0].area_id,4);
    assert.equal((await db.query('select count(*)::int n from assignments')).rows[0].n,1);
    assert.equal((await remove(3)).ok,true);assert.equal((await remove(3)).motivo,'no_existe');
    await db.exec('update access_flag set allowed=false');
    assert.equal((await edit(2,'Otra')).motivo,'sin_permiso');
    assert.equal((await remove(2)).motivo,'sin_permiso');
    const permissions=(await db.query(`select has_function_privilege('anon','dash_admin_editar_area(bigint,text)','execute') edit,
      has_function_privilege('anon','dash_admin_eliminar_area(bigint)','execute') del`)).rows[0];
    assert.deepEqual(permissions,{edit:false,del:false});
  }finally{await db.close();}
});

test('area UI refreshes names and filters; failed requests preserve state and restore controls',async()=>{
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id))elements.set(id,{textContent:'',innerHTML:'',hidden:true,value:'',dataset:{},handlers:{},
      addEventListener(type,fn){this.handlers[type]=fn;},setAttribute(){},querySelectorAll(){return [];},querySelector(){return {focus(){}};},focus(){},select(){},scrollIntoView(){},click(){this.handlers.click?.();}});
    return elements.get(id);
  };
  let result={data:{ok:true,area:{id:1,nombre:'Nueva',activo:true}}},reject=false,calls=0,refreshes=0;
  const app={adminTeam:{puede_editar:true,areas:[{id:1,nombre:'Antes',activo:true}],personas:[{id:2,area_id:1,area:'Antes'}]}};
  const context=vm.createContext({APP:app,$:element,esc:s=>String(s),
    db:{rpc:async()=>{calls++;if(reject)throw Error('offline');return result;}},
    fillAdminTeamFilters(){refreshes++;},renderAdminPeople(){},renderAdminContracts(){}});
  vm.runInContext(fs.readFileSync('assets/js/dashboard-areas.js','utf8'),context);
  const clickAction=action=>element('admin-areas-list').handlers.click({target:{closest:()=>({dataset:{areaAction:action,areaId:'1'}})}});
  clickAction('delete');
  assert.match(element('admin-areas-list').innerHTML,/No se puede eliminar Antes/);
  assert.match(element('admin-areas-list').innerHTML,/Ver colaboradores del área/);
  assert.doesNotMatch(element('admin-areas-list').innerHTML,/data-area-action="confirm"/);
  assert.equal(calls,0);
  clickAction('people');
  assert.equal(element('admin-people-area').value,'1');
  assert.equal(element('admin-people-inactive').checked,true);
  assert.equal(element('admin-areas-panel').hidden,true);
  await vm.runInContext("saveAdminArea('1','Nueva')",context);
  assert.equal(app.adminTeam.personas[0].area,'Nueva');assert.equal(refreshes,1);
  result={data:{ok:false,motivo:'en_uso'}};
  await vm.runInContext("saveAdminArea('1',null)",context);
  assert.equal(app.adminTeam.areas.length,1);assert.match(element('admin-areas-message').textContent,/historial/);
  reject=true;
  await vm.runInContext("saveAdminArea('1','Cambio')",context);
  assert.equal(vm.runInContext('ADMIN_AREAS.busy',context),false);
  assert.match(element('admin-areas-message').textContent,/conexión/);
  assert.equal(app.adminTeam.areas[0].nombre,'Nueva');
  app.adminTeam.puede_editar=false;
  await vm.runInContext("saveAdminArea('1',null)",context);
  assert.equal(calls,3);
});
