-- Ejecutar completo en Supabase > SQL Editor.
-- Independiente de las migraciones del portal de asistencia.
-- Los CV se guardan en una tabla privada; no son objetos de Storage.
begin;

create table if not exists public.rec_postulaciones (
  id uuid primary key,
  codigo text not null unique,
  created_at timestamptz not null default now(),
  estado text not null default 'pendiente'
    check (estado in ('pendiente','en_revision','aprobada','rechazada')),
  datos jsonb not null check (jsonb_typeof(datos) = 'object'),
  entrevista_fecha date not null,
  entrevista_hora text not null,
  entrevista_canal text not null
);

-- IF NOT EXISTS no agrega columnas a una tabla que ya estaba creada.
-- Compatibilidad con instalaciones anteriores; los históricos quedan intactos.
alter table public.rec_postulaciones
  add column if not exists entrevista_fecha date,
  add column if not exists entrevista_hora text,
  add column if not exists entrevista_canal text;

create table if not exists public.rec_postulaciones_cv (
  postulacion_id uuid primary key references public.rec_postulaciones(id) on delete cascade,
  nombre text not null,
  mime_type text not null,
  contenido bytea not null check (octet_length(contenido) between 1 and 10485760)
);

create index if not exists rec_postulaciones_estado_fecha_idx
  on public.rec_postulaciones (estado, created_at desc);

alter table public.rec_postulaciones enable row level security;
alter table public.rec_postulaciones_cv enable row level security;
revoke all on public.rec_postulaciones, public.rec_postulaciones_cv from public, anon, authenticated;
grant select, insert, update, delete on public.rec_postulaciones, public.rec_postulaciones_cv to service_role;
-- Sin políticas públicas: únicamente el servidor y SQL Editor pueden leerlas.

create or replace function public.rec_enviar_postulacion(
  p_id uuid, p_datos jsonb, p_cv_base64 text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_existente public.rec_postulaciones%rowtype;
  v_cv bytea;
  v_nombre text;
  v_mime text;
  v_fecha date;
  v_clave text;
  v_codigo text;
  v_creado timestamptz;
begin
  if p_id is null then
    raise exception 'Falta el identificador de la postulación.' using errcode = '22023';
  end if;

  -- Serializa reintentos concurrentes del mismo envío.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into v_existente from public.rec_postulaciones where id = p_id;
  if found then
    return jsonb_build_object('codigo',v_existente.codigo,'created_at',v_existente.created_at);
  end if;

  if p_datos is null or jsonb_typeof(p_datos) <> 'object'
     or octet_length(p_datos::text) > 32768 then
    raise exception 'Los datos de la postulación no son válidos.' using errcode = '22023';
  end if;
  foreach v_clave in array array[
    'nombres','dni','telefono','email','emailNotificacion','telefonoNotificacion',
    'carrera','nivel','modalidad','turno','cvName',
    'entrevistaFecha','entrevistaHora','entrevistaCanal'
  ] loop
    if jsonb_typeof(p_datos->v_clave) is distinct from 'string'
       or length(btrim(p_datos->>v_clave)) not between 1 and 255 then
      raise exception 'Completa correctamente el campo: %.', v_clave using errcode = '22023';
    end if;
  end loop;
  if p_datos->'requisitosAceptados' is distinct from 'true'::jsonb then
    raise exception 'Debes aceptar los requisitos de postulación.' using errcode = '22023';
  end if;
  if p_datos->>'dni' !~ '^[0-9]{8}$'
     or p_datos->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or p_datos->>'emailNotificacion' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Revisa el DNI y los correos electrónicos.' using errcode = '22023';
  end if;
  begin
    if p_datos->>'entrevistaFecha' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'fecha';
    end if;
    v_fecha := (p_datos->>'entrevistaFecha')::date;
  exception when others then
    raise exception 'La fecha de entrevista no es válida.' using errcode = '22023';
  end;
  if v_fecha < (now() at time zone 'America/Lima')::date
     or v_fecha > (now() at time zone 'America/Lima')::date + 366 then
    raise exception 'Selecciona una fecha de entrevista dentro del próximo año.' using errcode = '22023';
  end if;

  if p_cv_base64 is null or length(p_cv_base64) not between 4 and 13981016 then
    raise exception 'Adjunta un CV de hasta 10 MB.' using errcode = '22023';
  end if;
  begin
    v_cv := decode(p_cv_base64, 'base64');
  exception when others then
    raise exception 'No se pudo leer el CV adjunto.' using errcode = '22023';
  end;
  if octet_length(v_cv) not between 1 and 10485760 then
    raise exception 'Adjunta un CV de hasta 10 MB.' using errcode = '22023';
  end if;
  v_nombre := btrim(p_datos->>'cvName');
  -- Comprueba extensión y cabecera básica; no reemplaza un análisis antivirus.
  if lower(v_nombre) ~ '\.pdf$' and substring(v_cv from 1 for 5) = decode('255044462d','hex') then
    v_mime := 'application/pdf';
  elsif lower(v_nombre) ~ '\.doc$' and substring(v_cv from 1 for 8) = decode('d0cf11e0a1b11ae1','hex') then
    v_mime := 'application/msword';
  elsif lower(v_nombre) ~ '\.docx$' and substring(v_cv from 1 for 4) = decode('504b0304','hex') then
    v_mime := 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  else
    raise exception 'El CV debe ser un archivo PDF, DOC o DOCX válido.' using errcode = '22023';
  end if;

  v_codigo := 'KJA-' || upper(replace(p_id::text,'-',''));
  insert into public.rec_postulaciones
    (id,codigo,datos,entrevista_fecha,entrevista_hora,entrevista_canal)
  values (p_id,v_codigo,p_datos,v_fecha,p_datos->>'entrevistaHora',p_datos->>'entrevistaCanal')
  returning created_at into v_creado;
  insert into public.rec_postulaciones_cv(postulacion_id,nombre,mime_type,contenido)
  values(p_id,v_nombre,v_mime,v_cv);
  return jsonb_build_object('codigo',v_codigo,'created_at',v_creado);
end;
$$;

revoke all on function public.rec_enviar_postulacion(uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.rec_enviar_postulacion(uuid,jsonb,text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;

-- Consulta administrativa (ejecutar aparte en SQL Editor):
-- select codigo, created_at, estado, datos->>'nombres' as nombres,
--        datos->>'email' as email, entrevista_fecha, entrevista_hora,
--        entrevista_canal, datos
-- from public.rec_postulaciones order by created_at desc;
