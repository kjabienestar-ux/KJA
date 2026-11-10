import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const inventory=JSON.parse(fs.readFileSync('supabase/retirement/kja035-inventory.json','utf8'));
const migration=fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_retirar_chat_notificaciones_pausas_kja035.sql')),'utf8');
const rollback=fs.readFileSync('supabase/retirement/kja035-rollback.sql','utf8');
async function fixture(){
  const db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create function public.dash_colab() returns bigint language sql as 'select 1::bigint';
    create function public.asis_rol() returns text language sql as $$select 'colaborador'::text$$;
    create table storage.objects(id bigint,bucket_id text,name text);
    create table public.asis_entrega_revisiones(id bigint);
    create table public.asis_asignaciones_diarias(id bigint);
    create table public.audit_test(event text);
    create function public.audit_test_trg() returns trigger language plpgsql as $$begin insert into public.audit_test values(TG_TABLE_NAME);return new;end;$$;
    create trigger keep_audit after insert on public.asis_entrega_revisiones for each row execute function public.audit_test_trg();
    create policy keep_profile on storage.objects for select to authenticated using (bucket_id='perfil-fotos');
    create publication supabase_realtime;
    create table public.keep_realtime(id bigint);
    alter publication supabase_realtime add table public.keep_realtime;
    set check_function_bodies=off;`);
  for(const t of inventory.tables){
    await db.exec(`create table public.${t.name}(id bigint,colaborador_id bigint,destinatario uuid);alter table public.${t.name} enable row level security;insert into public.${t.name}(id) values(123);grant all on public.${t.name} to service_role;`);
  }
  for(const name of ['asis_notificaciones_id_seq','chat_grupos_id_seq','chat_grupo_mensajes_id_seq','chat_mensajes_id_seq'])await db.exec(`create sequence public.${name};grant all on sequence public.${name} to anon,authenticated,service_role;`);
  // Restore installs the exact inspected functions/policies/grants on synthetic tables only.
  await db.exec(rollback);
  await db.exec('set check_function_bodies=on;');
  return db;
}
test('retirement preserves all rows and shared audit/profile/Realtime while denying retired clients; rollback restores metadata',async()=>{
  const db=await fixture();
  try{
    const fnBefore=(await db.query(`select oid::regprocedure::text signature,pg_get_functiondef(oid) definition,proacl::text acl from pg_proc where pronamespace='public'::regnamespace order by 1`)).rows;
    const policiesBefore=(await db.query('select * from pg_policies order by schemaname,tablename,policyname')).rows;
    const pubsBefore=(await db.query('select * from pg_publication_tables order by tablename')).rows;
    await db.exec(migration);
    for(const t of inventory.tables){
      assert.equal((await db.query(`select count(*)::int n from public.${t.name}`)).rows[0].n,1);
      for(const role of ['anon','authenticated'])assert.equal((await db.query(`select has_table_privilege('${role}','public.${t.name}','select,insert,update,delete') allowed`)).rows[0].allowed,false);
    }
    assert.equal((await db.query(`select count(*)::int n from pg_proc where pronamespace='public'::regnamespace and proname ~ '^(chat_|dash_.*(pausa|notific)|dash_admin_enviar_mensaje)'`)).rows[0].n,0);
    for(const name of ['asis_notificaciones_id_seq','chat_grupos_id_seq','chat_grupo_mensajes_id_seq','chat_mensajes_id_seq']){
      for(const role of ['anon','authenticated'])assert.equal((await db.query(`select has_sequence_privilege('${role}','public.${name}','usage,select,update') allowed`)).rows[0].allowed,false);
    }
    assert.deepEqual((await db.query('select tablename from pg_publication_tables')).rows,[{tablename:'keep_realtime'}]);
    assert.equal((await db.query("select count(*)::int n from pg_policies where policyname='keep_profile'")).rows[0].n,1);
    await db.exec('insert into public.asis_entrega_revisiones values(1);insert into public.asis_asignaciones_diarias values(1);');
    assert.equal((await db.query('select count(*)::int n from public.audit_test')).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int n from public.asis_notificaciones')).rows[0].n,1);
    await db.exec(rollback);
    assert.deepEqual((await db.query(`select oid::regprocedure::text signature,pg_get_functiondef(oid) definition,proacl::text acl from pg_proc where pronamespace='public'::regnamespace order by 1`)).rows,fnBefore);
    assert.deepEqual((await db.query('select * from pg_policies order by schemaname,tablename,policyname')).rows,policiesBefore);
    assert.deepEqual((await db.query('select * from pg_publication_tables order by tablename')).rows,pubsBefore);
  }finally{await db.close();}
});
test('unexpected shared dependency rolls the whole retirement back',async()=>{
  const db=await fixture();try{
    await db.exec('create policy unexpected_shared on storage.objects using (public.chat_activo());');
    await assert.rejects(db.exec(migration),/dependencias compartidas/);await db.exec('rollback;');
    assert.equal((await db.query("select count(*)::int n from pg_trigger where tgname='asis_asignacion_notificar'")).rows[0].n,1);
    assert.equal((await db.query("select count(*)::int n from pg_publication_tables where tablename='chat_eventos'")).rows[0].n,1);
  }finally{await db.close();}
});
test('changed function aborts transaction before any retirement',async()=>{
  const db=await fixture();try{
    await db.exec('create or replace function public.chat_activo() returns boolean language sql as $$select false$$;');
    await assert.rejects(db.exec(migration),/definición cambió/);await db.exec('rollback;');
    assert.equal((await db.query("select count(*)::int n from pg_trigger where tgname='asis_asignacion_notificar'")).rows[0].n,1);
  }finally{await db.close();}
});
