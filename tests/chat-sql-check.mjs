// Verificación aislada con PostgreSQL WASM; nunca conecta a Supabase.
// node tests/chat-sql-check.mjs <ruta-a-@electric-sql/pglite/dist/index.js>
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'@electric-sql/pglite');
const db=new PGlite();
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',c='00000000-0000-4000-8000-000000000003';
const token=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
try{
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.asis_perfiles(id uuid primary key,nombre text not null,rol text not null,activo boolean not null default true);
    grant usage on schema auth to authenticated,anon;
    insert into public.asis_perfiles values ('${a}','Yeiser','direccion',true),('${b}','Erika del Socorro Moreno Quilcate','direccion',true),('${c}','Antony','direccion',true);`);
  const sql=await fs.readFile(new URL('../supabase/chat_01_mensajes.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql); // Reejecución de la migración.
  const directionSql=await fs.readFile(new URL('../supabase/chat_02_direccion_contactos.sql',import.meta.url),'utf8');
  await db.exec(directionSql);await db.exec(directionSql);
  await db.exec(`create table public.asis_colaboradores(id bigint primary key,activo boolean,foto_path text,foto_actualizada_at timestamptz);
    alter table public.asis_perfiles add column colaborador_id bigint;
    insert into public.asis_colaboradores values(1,true,'1/avatar.webp',now()),(2,true,'2/avatar.jpg',now()),(3,true,'3/avatar.jpg',now());
    update public.asis_perfiles set colaborador_id=1 where id='${a}';
    update public.asis_perfiles set colaborador_id=2 where id='${b}';
    create schema storage;create table storage.objects(bucket_id text,name text);
    alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;
    insert into storage.objects values('perfil-fotos','1/avatar.webp'),('perfil-fotos','2/avatar.jpg'),('perfil-fotos','3/avatar.jpg'),('evidencias','1/avatar.webp'),('perfil-fotos','1/otro.jpg');`);
  const photoSql=await fs.readFile(new URL('../supabase/chat_03_fotos_perfil.sql',import.meta.url),'utf8');
  await db.exec(photoSql);await db.exec(photoSql);
  const presenceSql=await fs.readFile(new URL('../supabase/chat_04_presencia.sql',import.meta.url),'utf8');
  await db.exec(presenceSql);await db.exec(presenceSql);
  const shortcutSql=await fs.readFile(new URL('../supabase/chat_05_abrir_colaborador.sql',import.meta.url),'utf8');
  await db.exec(shortcutSql);await db.exec(shortcutSql);
  const login=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${role}`)};
  const heartbeat=(session,visible=true)=>db.query('select * from public.chat_presencia($1,$2)',[session,visible]);
  await login(a);
  assert.equal((await db.query('select public.chat_cuenta_colaborador(2) as id')).rows[0].id,b);
  await assert.rejects(db.query('select public.chat_cuenta_colaborador(1)'),/contigo mismo/);
  await assert.rejects(db.query('select public.chat_cuenta_colaborador(3)'),/cuenta activa/);
  await db.exec('reset role');await db.query("update public.asis_perfiles set rol='visor' where id=$1",[c]);
  await login(c);await assert.rejects(db.query('select public.chat_cuenta_colaborador(2)'),/Solo Dirección/);
  await db.exec('reset role');await db.query("update public.asis_perfiles set rol='direccion' where id=$1",[c]);
  await login(b);await heartbeat(token(100));await heartbeat(token(101));
  await login(a);assert.ok((await heartbeat(token(102))).rows.some(r=>r.id===b&&r.vigencia_segundos>0));
  await assert.rejects(db.query('select * from public.chat_sesiones'),/permission denied/);
  await heartbeat(token(100),false); // A no puede cerrar una sesión de B.
  assert.ok((await heartbeat(token(102))).rows.some(r=>r.id===b));
  await login(b);await heartbeat(token(100),false);assert.ok((await heartbeat(token(101))).rows.some(r=>r.id===b));
  await heartbeat(token(101),false);await login(a);assert.ok(!(await heartbeat(token(102))).rows.some(r=>r.id===b));
  await login(b);await heartbeat(token(100));await db.exec('reset role');await db.query("update public.chat_sesiones set visto_at=clock_timestamp()-interval '71 seconds' where usuario_id=$1",[b]);
  await login(a);assert.ok(!(await heartbeat(token(102))).rows.some(r=>r.id===b));
  await login(a);
  const contacts=await db.query('select * from public.chat_contactos()');assert.equal(contacts.rows.length,2);assert.equal(contacts.rows.find(r=>r.id===b).direccion,true);
  assert.equal(contacts.rows.find(r=>r.id===c).direccion,false); // Otro administrador sigue en Equipo.
  await login(c);
  assert.equal((await db.query('select * from public.chat_fotos()')).rows.length,2);
  assert.equal((await db.query('select * from storage.objects')).rows.length,2); // Solo avatares actuales de cuentas activas.
  await assert.rejects(db.query('select * from public.asis_colaboradores'),/permission denied/);
  assert.deepEqual((await db.query('select * from public.chat_contactos() where direccion')).rows.map(r=>r.id).sort(),[a,b]);
  await assert.rejects(db.query('insert into public.chat_direccion_contactos values ($1)',[c]),/permission denied/);
  await db.exec('reset role');await db.query('update public.asis_perfiles set nombre=$1 where id=$2',['Nombre actualizado',a]);
  await db.exec(directionSql); // La pertenencia se conserva por UUID, incluso tras cambiar de nombre.
  await login(c);assert.equal((await db.query('select * from public.chat_contactos()')).rows.find(r=>r.id===a).direccion,true);
  await login(a);
  const send=async(to,text,id)=>db.query('select * from public.chat_enviar($1,$2,$3)',[to,text,id]);
  const first=(await send(b,'Hola',token(1))).rows[0];const retry=(await send(b,'Hola',token(1))).rows[0];assert.equal(first.id,retry.id);
  await assert.rejects(send(b,'Otro texto',token(1)),/otro mensaje/);
  await assert.rejects(send(a,'A mí',token(2)),/no está disponible/);
  await assert.rejects(send(b,' '.repeat(4),token(2)),/4000/);
  await assert.rejects(send(b,'x'.repeat(4001),token(2)),/4000/);
  await assert.rejects(db.query('select * from public.chat_mensajes'),/permission denied/);
  await assert.rejects(db.query('delete from public.chat_mensajes'),/permission denied/);
  await login(c);assert.equal((await db.query('select * from public.chat_historial($1)',[b])).rows.length,0);
  await db.query('select public.chat_leer($1,$2)',[a,first.id]); // Un tercero no marca la conversación de A/B.
  await login(b);
  assert.equal((await db.query('select * from public.chat_historial($1)',[a])).rows[0].leido_at,null);
  assert.equal((await db.query('select * from public.chat_contactos()')).rows.find(r=>r.id===a).no_leidos,1);
  await db.query('select public.chat_leer($1,$2)',[a,first.id]);
  assert.ok((await db.query('select * from public.chat_historial($1)',[a])).rows[0].leido_at);
  await login(a);
  for(let n=2;n<=30;n++)await send(b,'Mensaje '+n,token(n));
  await assert.rejects(send(b,'Exceso',token(31)),/Espera un minuto/);
  assert.equal((await send(b,'Hola',token(1))).rows[0].id,first.id); // Reintento permitido incluso con cuota llena.
  await db.exec('reset role');
  await db.exec(`insert into public.chat_mensajes(cliente_id,remitente,destinatario,contenido) select gen_random_uuid(),'${b}','${a}','Historial '||n from generate_series(1,60) n;`);
  await login(a);
  const page=(await db.query('select * from public.chat_historial($1)',[b])).rows;assert.equal(page.length,50);
  const older=(await db.query('select * from public.chat_historial($1,$2)',[b,page.at(-1).id])).rows;assert.equal(older.length,40);
  assert.equal(new Set([...page,...older].map(m=>m.id)).size,90);
  await db.exec('reset role');await db.query('update public.asis_perfiles set activo=false where id=$1',[b]);
  await login(a);await assert.rejects(send(b,'Inactivo',token(32)),/no está disponible/);
  await assert.rejects(db.query('select public.chat_cuenta_colaborador(2)'),/cuenta activa/);
  assert.equal((await db.query('select * from public.chat_contactos()')).rows.find(r=>r.id===b).activo,false);
  assert.equal((await db.query('select * from public.chat_fotos()')).rows.length,0);
  assert.equal((await db.query('select * from storage.objects')).rows.length,1);
  await login(b);await assert.rejects(db.query('select * from public.chat_contactos()'),/no tiene acceso/);await assert.rejects(db.query('select * from public.chat_historial($1)',[a]),/no tiene acceso/);
  await login('', 'anon');await assert.rejects(db.query('select * from public.chat_contactos()'),/permission denied/);
  await assert.rejects(db.query('select * from public.chat_fotos()'),/permission denied/);
  await assert.rejects(heartbeat(token(103)),/permission denied/);
  await assert.rejects(db.query('select public.chat_cuenta_colaborador(2)'),/permission denied/);
  console.log('SQL OK: migración repetible, privacidad entre 3 cuentas, permisos, envío, idempotencia, cuota, paginación, lectura e inactivos.');
}finally{await db.close()}
