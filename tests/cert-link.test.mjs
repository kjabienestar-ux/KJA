import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
test('linking validates identity, unique collaborator, inactive users and leaves PIN profile unchanged',async()=>{
 const db=new PGlite();
 const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',c='00000000-0000-0000-0000-000000000003';
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql as $$select '${a}'::uuid$$;
 create table allowed(value boolean);insert into allowed values(true);
 create function dash_gestiona_certificados() returns boolean language sql as $$select value from allowed$$;
 create table asis_areas(id bigint primary key,nombre text);
 create table asis_colaboradores(id bigint primary key,nombre text,dni text,area_id bigint,activo boolean);
 create table asis_perfiles(id uuid primary key,colaborador_id bigint,activo boolean);
 create table perfiles(id uuid primary key,nombre text,rol text,serie int,activo boolean);
 create table cert_cuentas_eventos(actor uuid,cuenta uuid,accion text,antes jsonb,despues jsonb);
 create function dash_cert_guardar(p_id uuid,p_nombre text,p_rol text,p_serie int,p_activo boolean) returns jsonb language plpgsql as $$begin
 insert into perfiles(id,nombre,rol,serie,activo) values(p_id,p_nombre,p_rol,p_serie,p_activo) on conflict(id) do update set nombre=excluded.nombre;
 return '{"ok":true}'::jsonb;end;$$;
 insert into auth.users values('${a}','admin@test.com'),('${b}','person@test.com'),('${c}','other@test.com');
 insert into asis_areas values(1,'Marketing');
 insert into asis_colaboradores values(10,'Ana Real','12345678',1,true),(20,'Otra Persona','87654321',1,true),(30,'Baja',null,1,false);
 insert into asis_perfiles values('${c}',20,true);`);
 const sql=fs.readFileSync('supabase/dashboard_101_vincular_cuentas_certificados.sql','utf8');await db.exec(sql);await db.exec(sql);
 const save=(id,colab)=>db.query("select dash_cert_guardar_vinculado($1,'Nombre manipulado','colaborador',1000,true,$2)",[id,colab]);
 await save(b,10);
 assert.equal((await db.query('select nombre from perfiles')).rows[0].nombre,'Ana Real');
 await assert.rejects(save(a,10),/ya tiene/);
 await assert.rejects(save(c,30),/activo/);
 await assert.rejects(save(c,999),/no existe/);
 await db.exec('update perfiles set colaborador_id=null');
 await assert.rejects(save(c,10),/otro colaborador/);
 await save(b,10);
 const list=(await db.query('select dash_cert_cuentas() data')).rows[0].data.cuentas;
 assert.equal(list[0].dni,'12345678');assert.equal(list[0].area,'Marketing');
 const candidates=(await db.query('select dash_cert_colaboradores() data')).rows[0].data.colaboradores;
 assert.equal(candidates.find(p=>p.id===10).cuenta_id,b);
 assert.deepEqual((await db.query('select * from asis_perfiles')).rows,[{id:c,colaborador_id:20,activo:true}]);
 await db.exec('update allowed set value=false');
 await assert.rejects(save(b,20),/Sin permiso/);await assert.rejects(db.query('select dash_cert_colaboradores()'),/Sin permiso/);
 }finally{await db.close();}
});
test('selecting collaborator fills name and details; free series excludes suspended assignments',()=>{
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:''});return nodes.get(id);};
 const context=vm.createContext({$,esc:String,CERT_ACCOUNTS:{linksReady:true,collaborators:[{id:10,nombre:'Ana Real',dni:'12345678',area:'Marketing'}],rows:[{id:'old',serie:1000,activo:false},{id:'other',serie:2000,activo:true}]}});
 const source=fs.readFileSync('assets/js/dashboard-cert-accounts.js','utf8');
 vm.runInContext(source.slice(source.indexOf('function fillCertificateCollaborators'),source.indexOf('function certAccountsBusy')),context);
 $('cert-collaborator').value='10';context.applyCertificateCollaborator();
 assert.equal($('cert-account-name').value,'Ana Real');assert.equal($('cert-account-name').readOnly,true);
 assert.match($('cert-collaborator-detail').textContent,/12345678.*Marketing/);
 assert.equal($('cert-account-role').value,'colaborador');
 context.fillCertificateSeries();assert.match($('cert-series-options').innerHTML,/value="3000"/);assert.doesNotMatch($('cert-series-options').innerHTML,/value="1000"/);
});

test('live collaborator results filter accents, DNI and multiple words without pinning a nonmatching selection',()=>{
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:''});return nodes.get(id);};
 const context=vm.createContext({$,esc:String,CERT_ACCOUNTS:{linksReady:true,collaborators:[
  {id:1,nombre:'María Pérez',dni:'12345678',area:'Diseño gráfico',activo:true},
  {id:2,nombre:'Ana Ruiz',dni:'87654321',area:'Marketing',activo:true,cuenta_id:'taken'},
  {id:3,nombre:'Dado de baja',activo:false}
 ]}});
 const source=fs.readFileSync('assets/js/dashboard-cert-accounts.js','utf8');
 vm.runInContext(source.slice(source.indexOf('function fillCertificateCollaborators'),source.indexOf('function certAccountsBusy')),context);
 $('cert-collaborator').value='1';$('cert-collaborator-search').value='  maria   diseno ';
 context.fillCertificateCollaborators();assert.match($('cert-collaborator-results').innerHTML,/María Pérez/);assert.doesNotMatch($('cert-collaborator-results').innerHTML,/Ana Ruiz/);
 $('cert-collaborator-search').value='87654321';context.fillCertificateCollaborators();
 assert.doesNotMatch($('cert-collaborator-results').innerHTML,/María Pérez/);assert.match($('cert-collaborator-results').innerHTML,/disabled/);assert.equal($('cert-collaborator').value,'1');
 $('cert-collaborator-search').value='no existe';context.fillCertificateCollaborators();
 assert.match($('cert-collaborator-results').innerHTML,/No hay coincidencias/);assert.equal($('cert-collaborator-count').textContent,'0 resultados');
});
