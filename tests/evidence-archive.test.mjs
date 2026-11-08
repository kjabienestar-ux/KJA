import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
const source=fs.readFileSync('assets/js/evidence-archive.js','utf8');
function helper(){const ctx={};vm.createContext(ctx);vm.runInContext(source,ctx);return ctx.KJAEvidenceArchive;}
test('available files do not query archival records; errors are not invented archival',async()=>{
 const h=helper();let lookups=0;
 const rpc=async()=>{lookups++;return {data:{archivado:false}}};
 const storage={from:()=>({createSignedUrl:async()=>({data:{signedUrl:'https://example.test/file'},error:null})})};
 assert.equal((await h.resolve(storage,'asis-evidencias','a',900,rpc)).data.signedUrl,'https://example.test/file');
 assert.equal(lookups,0);
 storage.from=()=>({createSignedUrl:async()=>({data:null,error:{message:'not found'}})});
 assert.equal((await h.resolve(storage,'asis-evidencias','a',900,rpc)).error.message,'not found');
 const archived=await h.resolve(storage,'asis-evidencias','a',900,async()=>({data:{archivado:true,retirado_at:'2026-11-07'}}));
 assert.equal(archived.archived,true);assert.equal(archived.data,null);
 assert.equal((await h.resolve(storage,'perfil-fotos','a',900,async()=>{throw Error('must not query')})).archived,undefined);
 assert.equal((await h.resolve(storage,'asis-evidencias','a',900,async()=>{throw Error('offline')})).archived,undefined);
 assert.match(h.markup(),/estado de revisión original/);
});
test('archive status respects bucket permissions, confirmed retirement and private hashes',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;create table storage.objects(bucket_id text,name text);
   create function auth.uid() returns uuid language sql as $$select case when current_setting('test.signed',true)='no' then null else '00000000-0000-0000-0000-000000000001'::uuid end$$;
   create function dash_sesion_vigente() returns boolean language sql as $$select current_setting('test.session',true)='yes'$$;
   create function asis_rol() returns text language sql as $$select current_setting('test.role',true)$$;
   create function asis_es_miembro() returns boolean language sql as $$select current_setting('test.role',true)='direccion'$$;
   create function dash_nivel() returns text language sql as $$select current_setting('test.level',true)$$;
   create function dash_colab() returns bigint language sql as $$select 20::bigint$$;
   create function puede_ver_colab(bigint) returns boolean language sql as $$select $1 in (20,30)$$;
   set test.session='yes';set test.role='colaborador';set test.level='colaborador';`);
  const sql=fs.readFileSync('supabase/dashboard_133_archivo_evidencias.sql','utf8');
  await db.exec(sql);await db.exec(sql);
  const path='2026/10/01/20/abcdef.jpg',other='2026/10/01/30/abcdef.jpg';
  for(const name of [path,other])await db.query(`insert into asis_archivos_archivados(bucket_id,path,objeto_id,bytes,sha256,respaldo_id,objeto_creado_at,objeto_actualizado_at) values('asis-cierre-evidencias',$1,'00000000-0000-0000-0000-000000000002',100,$2,'test',now(),now())`,[name,'a'.repeat(64)]);
  const get=async name=>(await db.query("select dash_archivo_archivado('asis-cierre-evidencias',$1) d",[name])).rows[0].d;
  assert.equal((await get(path)).archivado,false);
  await db.query("insert into storage.objects values('asis-cierre-evidencias',$1)",[path]);
  await assert.rejects(db.query("select asis_archivo_confirmar('asis-cierre-evidencias',$1,'test')",[[path]]),/todavía existen/);
  await db.exec('delete from storage.objects');
  await db.query("select asis_archivo_confirmar('asis-cierre-evidencias',$1,'test')",[[path,other]]);
  assert.equal((await get(path)).archivado,true);assert.equal((await get(other)).archivado,false);
  await db.exec("set test.level='lider'");assert.equal((await get(other)).archivado,true);
  await db.exec("set test.session='no'");assert.equal((await get(other)).archivado,false);
  await db.exec("set test.role='direccion'");assert.equal((await get(other)).archivado,true);
  await db.exec("set test.signed='no'");assert.equal((await get(other)).archivado,false);
  const perms=(await db.query("select has_table_privilege('authenticated','asis_archivos_archivados','select') t,has_function_privilege('anon','dash_archivo_archivado(text,text)','execute') a")).rows[0];
  assert.equal(perms.t,false);assert.equal(perms.a,false);
  assert.equal((await db.query("select has_function_privilege('authenticated','asis_archivo_confirmar(text,text[],text)','execute') a")).rows[0].a,false);
 }finally{await db.close()}
});
