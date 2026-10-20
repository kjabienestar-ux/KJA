-- Ejecutar en el SQL Editor del proyecto antes de publicar el formulario.
-- Registro y CV se guardan en una transacción. No hay lectura pública.
begin;

create sequence if not exists public.rec_codigo_seq;
revoke all on sequence public.rec_codigo_seq from public,anon,authenticated;

create table if not exists public.rec_postulaciones (
  id uuid primary key,
  codigo text not null unique,
  created_at timestamptz not null default now(),
  datos jsonb not null,
  estado text not null default 'Pendiente' check (estado in ('Pendiente','En revisión','Entrevista','Aprobado','No seleccionado')),
  notas_revision text not null default '',
  revision integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create table if not exists public.rec_curriculos (
  postulacion_id uuid primary key references public.rec_postulaciones(id) on delete cascade,
  nombre text not null,
  mime text not null,
  archivo bytea not null check (octet_length(archivo) between 1 and 10485760)
);
create index if not exists rec_postulaciones_fecha on public.rec_postulaciones(created_at desc);
create index if not exists rec_postulaciones_estado on public.rec_postulaciones(estado,created_at desc);
alter table public.rec_postulaciones enable row level security;
alter table public.rec_curriculos enable row level security;
revoke all on public.rec_postulaciones,public.rec_curriculos from public,anon,authenticated;

create or replace function public.rec_es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists(select 1 from public.asis_perfiles where id=auth.uid() and activo and acceso_panel and rol='direccion')
    or exists(select 1 from public.perfiles where id=auth.uid() and rol='admin')
  );
$$;
revoke all on function public.rec_es_admin() from public,anon;
grant execute on function public.rec_es_admin() to authenticated;

create or replace function public.rec_enviar_postulacion(p_id uuid,p_datos jsonb,p_cv_base64 text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_archivo bytea; v_codigo text; v_numero text; v_created timestamptz; v_nombre text; v_ext text;
  v_datos jsonb := '{}'::jsonb; k text; v_fecha date; v_mime text; v_existente jsonb; v_cv bytea;
begin
  if p_id is null or jsonb_typeof(p_datos) is distinct from 'object' then
    raise exception 'Datos de postulación inválidos';
  end if;
  -- Serializa reintentos con el mismo UUID: jamás duplica el expediente.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  foreach k in array array['nombres','dni','telefono','email','emailNotificacion','telefonoNotificacion','carrera','nivel','modalidad','turno','motivacion','entrevistaFecha','entrevistaHora','entrevistaCanal','notasEntrevista','cvName'] loop
    if length(coalesce(p_datos->>k,''))>2000 then raise exception 'Campo demasiado extenso: %',k; end if;
    v_datos := v_datos || jsonb_build_object(k,btrim(coalesce(p_datos->>k,'')));
  end loop;
  select codigo,created_at,datos into v_codigo,v_created,v_existente from public.rec_postulaciones where id=p_id;
  if found then
    select archivo into v_cv from public.rec_curriculos where postulacion_id=p_id;
    if (v_existente-'cvBytes'-'requisitosAceptados') is distinct from v_datos
      or p_cv_base64 is null or length(p_cv_base64)>13981016
      or v_cv is distinct from decode(p_cv_base64,'base64') then
      raise exception 'El envío anterior ya fue registrado con otros datos. Contacta con KJA para actualizar tu expediente';
    end if;
    return jsonb_build_object('id',p_id,'codigo',v_codigo,'created_at',v_created);
  end if;
  foreach k in array array['nombres','dni','telefono','email','emailNotificacion','carrera','nivel','modalidad','turno','entrevistaFecha','entrevistaHora','entrevistaCanal','cvName'] loop
    if coalesce(v_datos->>k,'')='' then raise exception 'Falta completar: %',k; end if;
  end loop;
  if length(v_datos->>'nombres')<3 or length(v_datos->>'dni') not between 8 and 20
    or (v_datos->>'telefono') !~ '^[+0-9 ()-]{7,25}$'
    or (v_datos->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or (v_datos->>'emailNotificacion') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_datos->>'requisitosAceptados' is distinct from 'true' then
    raise exception 'Revisa tus datos de contacto y acepta los requisitos';
  end if;
  v_fecha := (v_datos->>'entrevistaFecha')::date;
  if v_fecha <= (now() at time zone 'America/Lima')::date or v_fecha > (now() at time zone 'America/Lima')::date+365 or extract(dow from v_fecha)=0 then
    raise exception 'Selecciona una fecha futura disponible';
  end if;
  if (v_datos->>'entrevistaHora') not in ('09:30 AM','11:00 AM','03:30 PM','05:00 PM','06:30 PM') then raise exception 'Horario no disponible'; end if;
  -- Límite de reenvíos por correo y documento, serializado para concurrencia.
  perform pg_advisory_xact_lock(hashtextextended(lower(v_datos->>'emailNotificacion'),1));
  if (select count(*) from public.rec_postulaciones where created_at>now()-interval '1 hour'
      and (lower(datos->>'emailNotificacion')=lower(v_datos->>'emailNotificacion') or datos->>'dni'=v_datos->>'dni'))>=3 then
    raise exception 'Ya recibimos tus solicitudes recientes. Intenta más tarde';
  end if;
  if p_cv_base64 is null or length(p_cv_base64)>13981016 then raise exception 'CV vacío o mayor de 10 MB'; end if;
  v_archivo := decode(p_cv_base64,'base64');
  if octet_length(v_archivo) not between 8 and 10485760 then raise exception 'CV vacío o mayor de 10 MB'; end if;
  v_nombre := v_datos->>'cvName'; v_ext := lower(substring(v_nombre from '\.([^.]+)$'));
  if length(v_nombre)>200 or v_nombre ~ '[/\\]' then raise exception 'Nombre de archivo inválido'; end if;
  if v_ext='pdf' and substring(v_archivo from 1 for 5)=decode('255044462d','hex') then v_mime:='application/pdf';
  elsif v_ext='docx' and substring(v_archivo from 1 for 4)=decode('504b0304','hex') then v_mime:='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  elsif v_ext='doc' and substring(v_archivo from 1 for 8)=decode('d0cf11e0a1b11ae1','hex') then v_mime:='application/msword';
  else raise exception 'El CV debe ser un archivo PDF, DOC o DOCX válido'; end if;
  v_datos := v_datos || jsonb_build_object('requisitosAceptados',true,'cvBytes',octet_length(v_archivo));
  v_numero := nextval('public.rec_codigo_seq')::text;
  v_codigo := 'KJA-REC-'||to_char(now() at time zone 'America/Lima','YYYY')||'-'||lpad(v_numero,greatest(6,length(v_numero)),'0');
  insert into public.rec_postulaciones(id,codigo,datos) values(p_id,v_codigo,v_datos) returning created_at into v_created;
  insert into public.rec_curriculos(postulacion_id,nombre,mime,archivo) values(p_id,v_nombre,v_mime,v_archivo);
  return jsonb_build_object('id',p_id,'codigo',v_codigo,'created_at',v_created);
end;
$$;
revoke all on function public.rec_enviar_postulacion(uuid,jsonb,text) from public;
grant execute on function public.rec_enviar_postulacion(uuid,jsonb,text) to anon,authenticated;

create or replace function public.rec_listar(p_estado text default '',p_busqueda text default '',p_pagina integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_items jsonb; v_total integer; v_counts jsonb;
begin
  if not public.rec_es_admin() then raise exception 'Acceso reservado a administración' using errcode='42501'; end if;
  if p_pagina<0 or length(p_busqueda)>100 then raise exception 'Filtro inválido'; end if;
  select jsonb_build_object('total',count(*),'pendientes',count(*) filter(where estado='Pendiente'),
    'revision',count(*) filter(where estado in ('En revisión','Entrevista')),'aprobados',count(*) filter(where estado='Aprobado')) into v_counts from public.rec_postulaciones;
  select count(*) into v_total from public.rec_postulaciones
    where (coalesce(p_estado,'')='' or estado=p_estado)
    and (coalesce(p_busqueda,'')='' or position(lower(p_busqueda) in lower(codigo||' '||(datos->>'nombres')||' '||(datos->>'dni')||' '||(datos->>'carrera')))>0);
  select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_items from (
    select * from public.rec_postulaciones
    where (coalesce(p_estado,'')='' or estado=p_estado)
    and (coalesce(p_busqueda,'')='' or position(lower(p_busqueda) in lower(codigo||' '||(datos->>'nombres')||' '||(datos->>'dni')||' '||(datos->>'carrera')))>0)
    order by created_at desc,id limit 25 offset p_pagina*25
  ) t;
  return jsonb_build_object('items',v_items,'total',v_total,'counts',v_counts);
end;
$$;

create or replace function public.rec_actualizar(p_id uuid,p_estado text,p_notas text,p_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.rec_postulaciones;
begin
  if not public.rec_es_admin() then raise exception 'Acceso reservado a administración' using errcode='42501'; end if;
  if p_estado not in ('Pendiente','En revisión','Entrevista','Aprobado','No seleccionado') or length(p_notas)>4000 then raise exception 'Estado o notas inválidos'; end if;
  update public.rec_postulaciones set estado=p_estado,notas_revision=coalesce(p_notas,''),revision=revision+1,updated_at=now(),updated_by=auth.uid()
    where id=p_id and revision=p_revision returning * into v_row;
  if not found then raise exception 'El expediente cambió. Actualiza la bandeja antes de guardar'; end if;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.rec_descargar_cv(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_cv public.rec_curriculos;
begin
  if not public.rec_es_admin() then raise exception 'Acceso reservado a administración' using errcode='42501'; end if;
  select * into v_cv from public.rec_curriculos where postulacion_id=p_id;
  if not found then raise exception 'CV no disponible'; end if;
  return jsonb_build_object('nombre',v_cv.nombre,'mime',v_cv.mime,'base64',encode(v_cv.archivo,'base64'));
end;
$$;
revoke all on function public.rec_listar(text,text,integer),public.rec_actualizar(uuid,text,text,integer),public.rec_descargar_cv(uuid) from public,anon;
grant execute on function public.rec_listar(text,text,integer),public.rec_actualizar(uuid,text,text,integer),public.rec_descargar_cv(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
