import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';

test('simulation preserves contractual goals and reproduces the August discrepancy',()=>{
 const source=fs.readFileSync('assets/js/dashboard-admin-equipo.js','utf8');
 const fields={'admin-contract-hours':{value:'700'},'admin-volunteer-hours':{value:'120'},'admin-contract-estimate':{textContent:''}};
 const day={mod:'virtual',ini:'08:00',fin:'14:00',vinc:'practicas'};
 const old=Object.fromEntries([1,2,5,6].map(d=>[d,day])),current={...old,3:day};
 const person={contrato_inicio:'2026-05-18',contrato_fin_referencia:'2026-11-13',tipo_vinculo:'practicas',horario_semanal:current};
 const ctx=vm.createContext({$:id=>fields[id],collectAdminPerson:()=>person});
 vm.runInContext(source.slice(source.indexOf('function estimateAdminContractHours('),source.indexOf('function collectAdminPerson(')),ctx);
 ctx.calculateAdminContractHours();
 assert.match(fields['admin-contract-estimate'].textContent,/774/);
 assert.equal(fields['admin-contract-hours'].value,'700');
 assert.equal(ctx.estimateAdminContractHours('2026-05-18','2026-08-11',old).hours,300);
 assert.equal(ctx.estimateAdminContractHours('2026-08-12','2026-11-13',current).hours,402);
 person.tipo_vinculo='ambos';person.contrato_fin_referencia='2026-12-31';ctx.calculateAdminContractHours();
 assert.equal(fields['admin-contract-hours'].value,'700');assert.equal(fields['admin-volunteer-hours'].value,'120');
 person.contrato_inicio='';ctx.calculateAdminContractHours();assert.equal(fields['admin-contract-hours'].value,'700');
});

test('SQL protects goals from legacy clients and allows explicit corrections',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon;create role authenticated;
   create table asis_colaboradores(id bigint primary key,contrato_horas numeric,contrato_horas_voluntariado numeric);
   insert into asis_colaboradores values(1,700,120);
   create function asis_puede_editar() returns boolean language sql as $$select true$$;
   create function dash_admin_guardar_colaborador(p_datos jsonb,p_motivo text default null)
   returns jsonb language plpgsql as $$begin
    update asis_colaboradores set contrato_horas=(p_datos->>'contrato_horas')::numeric,
      contrato_horas_voluntariado=(p_datos->>'contrato_horas_voluntariado')::numeric
      where id=(p_datos->>'id')::bigint;
    return jsonb_build_object('ok',true);
   end$$;
  `);
  const migration=fs.readFileSync('supabase/dashboard_114_proteger_meta_contractual.sql','utf8');
  await db.exec(migration);await db.exec(migration);
  const save=async data=>(await db.query('select dash_admin_guardar_colaborador($1::jsonb) result',[JSON.stringify(data)])).rows[0].result;
  const current={id:1,contrato_horas:700,contrato_horas_voluntariado:120};
  assert.equal((await save({...current,contrato_horas:774})).motivo,'meta_requiere_edicion_explicita');
  assert.equal((await save({...current,contrato_horas_voluntariado:180})).ok,false);
  assert.equal((await save({...current,contrato_horas:774,meta_editada_explicitamente:'true'})).ok,false);
  assert.equal((await save({...current,contrato_inicio:'2026-05-18'})).ok,true);
  assert.equal((await save({...current,contrato_horas:750,meta_editada_explicitamente:true})).ok,true);
  assert.equal((await save({...current,meta_editada_explicitamente:true})).ok,true);
  assert.equal(Number((await db.query('select contrato_horas from asis_colaboradores where id=1')).rows[0].contrato_horas),700);
  assert.equal((await db.query("select has_function_privilege('authenticated','dash_admin_guardar_colaborador_base_114(jsonb,text)','execute') allowed")).rows[0].allowed,false);
  await db.exec('create or replace function asis_puede_editar() returns boolean language sql as $$select false$$');
  assert.equal((await save({...current,meta_editada_explicitamente:true})).motivo,'sin_permiso');
 }finally{await db.close();}
});
