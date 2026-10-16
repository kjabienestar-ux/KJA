import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const source=fs.readFileSync('assets/js/dashboard.js','utf8');
const helper=source.slice(source.indexOf('async function loadAccessBootstrap('),source.indexOf('async function openPortal('));
test('startup uses one RPC and only falls back when the migration is missing',async()=>{
  for(const code of [null,'PGRST202','42501']){
    const calls=[];
    const context=vm.createContext({accessWithDeadline:request=>request,db:{rpc:async name=>{calls.push(name);return name==='dash_inicio'?{data:{ok:true}}:code?{error:{code}}:{data:{inicio:{ok:true},acceso:{rol:'visor',acceso_panel:false}}}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>{calls.push('perfil');return {data:{rol:'visor'}}}})})})}});
    vm.runInContext(helper,context);const result=await context.loadAccessBootstrap({user:{id:'user'}});
    assert.equal(calls.length,code==='PGRST202'?3:1);
    if(code==='42501')assert.equal(result.error.code,code);else assert.equal(result.data.ok,true);
  }
});
test('combined startup never returns another user permissions or bypasses expired sessions',async()=>{
  const db=new PGlite();try{
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create table asis_perfiles(id uuid,rol text,acceso_panel boolean,activo boolean);
      create function dash_inicio() returns jsonb language sql as $$select jsonb_build_object('ok',current_setting('test.valid',true)='yes')$$;
      insert into asis_perfiles values('00000000-0000-0000-0000-000000000001','direccion',true,true),('00000000-0000-0000-0000-000000000002','visor',false,true);
      set test.uid='00000000-0000-0000-0000-000000000002';set test.valid='yes';`);
    await db.exec(fs.readFileSync('supabase/dashboard_117_arranque_portal.sql','utf8'));
    const get=async()=>(await db.query('select dash_arranque() data')).rows[0].data;
    assert.deepEqual((await get()).acceso,{rol:'visor',acceso_panel:false});
    await db.exec("set test.valid='no'");assert.equal((await get()).acceso,null);
    await db.exec("set test.valid='yes';update asis_perfiles set activo=false");assert.equal((await get()).inicio.ok,false);
  }finally{await db.close()}
});
