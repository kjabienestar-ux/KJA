import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=fs.readFileSync(new URL('../supabase/opiniones_01_enlaces.sql',import.meta.url),'utf8');

test('SQL: enlace de opinión de un solo uso crea comentario pendiente y guarda lo privado aparte',async()=>{
  const db=new PGlite();
  try{
    // Fixtures aisladas: sin conexión a Supabase.
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      create table public.perfiles(id uuid primary key, rol text, activo boolean);
      create table public.comentarios(id uuid primary key default gen_random_uuid(), nombre text, mensaje text,
        estrellas int, aprobado boolean default true, created_at timestamptz default now());
      insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
      insert into public.perfiles values ('00000000-0000-0000-0000-000000000001','admin',true),
                                         ('00000000-0000-0000-0000-000000000002','colaborador',true);
    `);
    await db.exec(migration);
    await db.exec(migration); // reaplicable

    // Un no admin no puede generar enlaces.
    await db.exec(`select set_config('test.uid','00000000-0000-0000-0000-000000000002',false)`);
    await assert.rejects(db.query(`select public.opinion_crear_enlace('Ana','Terapia')`),/No autorizado/);

    await db.exec(`select set_config('test.uid','00000000-0000-0000-0000-000000000001',false)`);
    const clave=(await db.query(`select public.opinion_crear_enlace('Ana','Terapia',30) as c`)).rows[0].c;
    assert.match(clave,/^[A-Za-z0-9_-]{16}$/);

    const res=async k=>(await db.query(`select public.opinion_resolver($1) as r`,[k])).rows[0].r;
    assert.deepEqual(await res(clave),{estado:'ok',cliente:'Ana',servicio:'Terapia'});
    assert.equal((await res('x')).estado,'invalido');
    assert.equal((await res('AAAAAAAAAAAAAAAA')).estado,'invalido');

    const enviar=async(...a)=>(await db.query(`select public.opinion_enviar($1,$2,$3,$4,$5,$6) as r`,a)).rows[0].r;
    assert.equal((await enviar(clave,'A','corto',5,9,null)).error,'datos');           // nombre y mensaje inválidos
    assert.equal((await enviar(clave,'Ana','Muy buena atención',6,9,null)).error,'datos'); // estrellas fuera de rango
    assert.equal((await enviar(clave,'Ana','Muy buena atención',5,11,null)).error,'datos'); // recomienda fuera de rango

    assert.equal((await enviar(clave,'Ana','Muy buena atención',5,9,'Más horarios')).ok,true);
    const com=(await db.query(`select nombre,mensaje,estrellas,aprobado from public.comentarios`)).rows;
    assert.deepEqual(com,[{nombre:'Ana',mensaje:'Muy buena atención',estrellas:5,aprobado:false}]);
    const priv=(await db.query(`select servicio,recomienda,nota_privada from public.opinion_respuestas`)).rows;
    assert.deepEqual(priv,[{servicio:'Terapia',recomienda:9,nota_privada:'Más horarios'}]);

    // Segundo uso rechazado.
    assert.equal((await enviar(clave,'Ana','Muy buena atención',5,9,null)).error,'usado');
    assert.equal((await res(clave)).estado,'usado');
    assert.equal((await db.query(`select count(*)::int n from public.comentarios`)).rows[0].n,1);

    // Expirado.
    const k2=(await db.query(`select public.opinion_crear_enlace('','',1) as c`)).rows[0].c;
    await db.exec(`update public.opinion_enlaces set expira_at=now()-interval '1 day' where clave='${k2}'`);
    assert.equal((await res(k2)).estado,'expirado');
    assert.equal((await enviar(k2,'Luis','Excelente servicio',4,null,null)).error,'expirado');

    // Enlace fijo por servicio (?s=terapia): validación y anti-spam.
    const pub=async(ip,srv,msg,ms=6000)=>{
      await db.query(`select set_config('request.headers',$1,false)`,[JSON.stringify({'x-forwarded-for':ip})]);
      return (await db.query(`select public.opinion_enviar_publico($1,$2,$3,5,8,'nota',$4) as r`,[srv,'Rosa Díaz',msg,ms])).rows[0].r;
    };
    assert.equal((await pub('1.1.1.1','otro','Muy buena atención recibida')).error,'datos');   // servicio no permitido
    assert.equal((await pub('1.1.1.1','terapia','Muy buena atención recibida',1000)).error,'rapido'); // bot demasiado rápido
    assert.equal((await pub('1.1.1.1','terapia','Muy buena atención recibida')).ok,true);
    assert.equal((await pub('1.1.1.1','terapia','Muy buena atención recibida')).error,'duplicado');
    assert.equal((await pub('1.1.1.1','curso','Aprendí muchísimo en el curso')).ok,true);
    assert.equal((await pub('1.1.1.1','taller','El taller fue muy útil para mí')).ok,true);
    assert.equal((await pub('1.1.1.1','taller','Otro comentario distinto del taller')).error,'limite'); // 4.º del día, misma red
    assert.equal((await pub('2.2.2.2','taller','Otro comentario distinto del taller')).ok,true);       // otra red sí puede
    assert.equal((await pub('2.2.2.2','','Me gustó mucho, sin elegir servicio')).ok,true);            // servicio opcional
    const fijos=(await db.query(`select c.aprobado,r.servicio,r.origen,r.clave from public.opinion_respuestas r join public.comentarios c on c.id=r.comentario_id where r.origen='fijo' order by r.creado_at`)).rows;
    assert.equal(fijos.length,5);
    assert.ok(fijos.every(f=>f.aprobado===false&&f.clave===null));
    assert.deepEqual(fijos.map(f=>f.servicio),['Terapia','Curso','Taller','Taller','']);
    // Solo los aprobados exponen su servicio, y sin datos privados.
    assert.deepEqual((await db.query(`select public.opinion_servicios_publicos() as r`)).rows[0].r,[]);
    await db.exec(`update public.comentarios set aprobado=true where mensaje in ('Aprendí muchísimo en el curso','Me gustó mucho, sin elegir servicio')`);
    const serv=(await db.query(`select public.opinion_servicios_publicos() as r`)).rows[0].r;
    assert.equal(serv.length,1);
    assert.deepEqual(Object.keys(serv[0]).sort(),['id','servicio']);
    assert.equal(serv[0].servicio,'Curso');

    // Tope global por hora (20): se simula con filas previas.
    await db.exec(`insert into public.opinion_respuestas(clave,servicio,origen) select null,'Terapia','fijo' from generate_series(1,20)`);
    assert.equal((await pub('3.3.3.3','curso','Un comentario nuevo en el curso')).error,'limite');

    // anon no puede leer las tablas, ni crear enlaces.
    await db.exec(`set role anon`);
    await assert.rejects(db.query(`select * from public.opinion_enlaces`),/permission denied/);
    await assert.rejects(db.query(`select * from public.opinion_respuestas`),/permission denied/);
    await assert.rejects(db.query(`select public.opinion_crear_enlace('x','y')`),/permission denied/);
    await db.exec(`reset role`);
  }finally{ await db.close(); }
});
