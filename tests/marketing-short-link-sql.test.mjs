import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('public short-link resolver exposes only a valid campaign destination, not draft data',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create table marketing_publicaciones(id uuid primary key);
      insert into marketing_publicaciones values('00000000-0000-0000-0000-000000000001');`);
    const sql=fs.readFileSync('supabase/marketing_03_whatsapp_enlaces.sql','utf8');await db.exec(sql);await db.exec(sql);
    const message='Hola KJA. Vengo de Facebook, deseo información sobre la TERAPIA FAMILIAR Y DE PAREJA de la siguiente publicación: https://www.facebook.com/photo?fbid=123';
    const destination='https://wa.me/51988918238?text='+encodeURIComponent(message);
    await db.query("insert into marketing_whatsapp_enlaces(clave,publicacion_id,firma,destino) values('abcdefghijklmnop','00000000-0000-0000-0000-000000000001','signature',$1)",[destination]);
    await assert.rejects(db.query("insert into marketing_whatsapp_enlaces(clave,publicacion_id,firma,destino) values('qrstuvwxyz123456','00000000-0000-0000-0000-000000000001','other','https://evil.test')"),/check constraint/);
    await db.exec('set role anon');
    const result=await db.query("select marketing_resolver_whatsapp('abcdefghijklmnop') target");assert.equal(result.rows[0].target,destination);assert.equal(new URL(result.rows[0].target).searchParams.get('text'),message);
    assert.equal((await db.query("select marketing_resolver_whatsapp('no-such-key') target")).rows[0].target,null);
    await assert.rejects(db.query('select * from marketing_whatsapp_enlaces'),/permission denied/);
    await assert.rejects(db.query("update marketing_whatsapp_enlaces set destino='https://evil.test'"),/permission denied/);
  }finally{await db.close();}
});
