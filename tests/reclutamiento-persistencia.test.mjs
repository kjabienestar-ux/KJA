import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('Reclutamiento: registro atómico, reintentos, permisos y revisión concurrente', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
      grant usage on schema auth,public to anon,authenticated;
      create table public.asis_perfiles(id uuid,activo boolean,acceso_panel boolean,rol text);
      create table public.perfiles(id uuid,rol text);
      insert into asis_perfiles values
      ('00000000-0000-4000-8000-000000000001',true,true,'direccion'),
      ('00000000-0000-4000-8000-000000000002',true,false,'visor'),
      ('00000000-0000-4000-8000-000000000003',false,true,'direccion');
      insert into perfiles values ('00000000-0000-4000-8000-000000000004','admin');`);
    const migration=fs.readFileSync('supabase/reclutamiento_01_solicitudes.sql','utf8');
    await db.exec(migration);await db.exec(migration);
    const deletion=fs.readFileSync('supabase/reclutamiento_05_eliminar_solicitudes.sql','utf8');
    await db.exec(deletion);await db.exec(deletion);
    const interviewColumns=fs.readFileSync('supabase/reclutamiento_02_columnas_entrevista.sql','utf8');
    await db.exec(interviewColumns);await db.exec(interviewColumns);
    const id='10000000-0000-4000-8000-000000000001';
    const day=new Date();day.setUTCDate(day.getUTCDate()+4);if(day.getUTCDay()===0)day.setUTCDate(day.getUTCDate()+1);
    const datos={nombres:'Postulante de prueba',dni:'12345678',telefono:'987654321',email:'test@example.com',emailNotificacion:'test@example.com',carrera:'Psicología',nivel:'Egresado',modalidad:'Remoto',turno:'Mañana',entrevistaFecha:day.toISOString().slice(0,10),entrevistaHora:'09:30 AM',entrevistaCanal:'Virtual',cvName:'curriculum.pdf',requisitosAceptados:true};
    const cv=Buffer.from('%PDF-1.7\nCV de prueba').toString('base64');
    const submit=async (uuid=id,d=datos,file=cv)=>(await db.query('select rec_enviar_postulacion($1,$2,$3) data',[uuid,JSON.stringify(d),file])).rows[0].data;
    const asUser=async n=>{
      await db.exec('reset role');
      await db.query("select set_config('request.uid',$1,false)",[n?`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`:'']);
      await db.exec(n?'set role authenticated':'set role anon');
    };
    await asUser(null);
    const receipt=await submit();assert.match(receipt.codigo,/^KJA-REC-\d{4}-\d{6,}$/);
    assert.deepEqual(await submit(),receipt);
    await assert.rejects(()=>submit(id,{...datos,nombres:'Otro nombre'}),/otros datos/);
    await assert.rejects(()=>db.query('select * from rec_postulaciones'),/permission denied/);
    await assert.rejects(()=>db.query('select rec_listar()'),/permission denied/);
    await assert.rejects(()=>db.query('select rec_eliminar($1,0)',[id]),/permission denied/);
    await assert.rejects(()=>submit('10000000-0000-4000-8000-000000000002',datos,Buffer.from('not-a-pdf').toString('base64')),/PDF, DOC o DOCX/);
    await assert.rejects(()=>submit('10000000-0000-4000-8000-000000000002',{...datos,requisitosAceptados:false}),/acepta los requisitos/);
    await assert.rejects(()=>submit('10000000-0000-4000-8000-000000000002',{...datos,entrevistaHora:'12:00 PM'}),/Horario/);
    for(const n of [2,3]){
      await asUser(n);
      await assert.rejects(()=>db.query('select rec_listar()'),/reservado/);
      await assert.rejects(()=>db.query('select rec_eliminar($1,0)',[id]),/reservado/);
      await assert.rejects(()=>db.query('select rec_descargar_cv($1)',[id]),/reservado/);
      await assert.rejects(()=>db.query('select rec_actualizar($1,$2,$3,0)',[id,'Aprobado','']),/reservado/);
    }
    await asUser(1);
    let result=(await db.query('select rec_listar() data')).rows[0].data;
    assert.equal(result.total,1);assert.equal(result.counts.pendientes,1);assert.equal(JSON.stringify(result).includes(cv),false);
    const download=(await db.query('select rec_descargar_cv($1) data',[id])).rows[0].data;
    assert.equal(download.base64.replace(/\s/g,''),cv);
    await db.query('select rec_actualizar($1,$2,$3,0)',[id,'En revisión','Revisar disponibilidad']);
    await assert.rejects(()=>db.query('select rec_actualizar($1,$2,$3,0)',[id,'Aprobado','otra revisión']),/expediente cambió/);
    result=(await db.query('select rec_listar($1,$2,0) data',['En revisión','Postulante'])).rows[0].data;
    assert.equal(result.total,1);assert.equal(result.items[0].revision,1);
    await asUser(4);assert.equal((await db.query('select rec_listar() data')).rows[0].data.total,1);
    await asUser(null);
    await submit('10000000-0000-4000-8000-000000000002');await submit('10000000-0000-4000-8000-000000000003');
    await assert.rejects(()=>submit('10000000-0000-4000-8000-000000000004'),/solicitudes recientes/);
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::int n from rec_postulaciones')).rows[0].n,3);
    assert.equal((await db.query('select count(*)::int n from rec_curriculos')).rows[0].n,3);
    await asUser(1);
    await assert.rejects(()=>db.query('select rec_eliminar($1,0)',[id]),/expediente cambió/);
    assert.equal((await db.query('select rec_descargar_cv($1) data',[id])).rows.length,1);
    assert.equal((await db.query('select rec_eliminar($1,1) data',[id])).rows[0].data.eliminado,true);
    await assert.rejects(()=>db.query('select rec_eliminar($1,1)',[id]),/ya fue eliminado/);
    await assert.rejects(()=>db.query('select rec_descargar_cv($1)',[id]),/CV no disponible/);
    assert.equal((await db.query('select rec_listar() data')).rows[0].data.total,2);
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::int n from rec_curriculos')).rows[0].n,2);
  } finally {await db.close();}
});
