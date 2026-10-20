-- Ejecutar después de chat_10 y chat_07. Conserva las RPC anteriores.
begin;
do $$
declare t text;
begin
 foreach t in array array['chat_mensajes','chat_grupo_mensajes'] loop
  execute format('alter table public.%I
    add column if not exists respuesta_id bigint,
    add column if not exists editado_at timestamptz,
    add column if not exists eliminado_at timestamptz,
    add column if not exists archivo_path text,
    add column if not exists archivo_nombre text,
    add column if not exists archivo_mime text,
    add column if not exists archivo_bytes bigint',t);
 end loop;
end $$;

create table if not exists public.chat_reacciones (
 grupo boolean not null, mensaje_id bigint not null,
 usuario uuid not null references public.asis_perfiles(id),
 emoji text not null check (emoji in ('👍','❤️','😂','😮','😢','🙏')),
 primary key(grupo,mensaje_id,usuario)
);
alter table public.chat_reacciones enable row level security;
revoke all on public.chat_reacciones from public,anon,authenticated;

-- Un único control de acceso para historial, acciones y archivos.
create or replace function public.chat_v2_mensaje(p_grupo boolean,p_id bigint)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare m jsonb;
begin
 if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
 if p_grupo then
  select to_jsonb(x) into m from public.chat_grupo_mensajes x
   where x.id=p_id and public.chat_grupo_miembro(x.grupo_id);
 else
  select to_jsonb(x) into m from public.chat_mensajes x
   where x.id=p_id and auth.uid() in (x.remitente,x.destinatario);
 end if;
 if m is null then raise exception 'Mensaje no disponible.'; end if;
 return m;
end $$;

create or replace function public.chat_v2_decorar(p_grupo boolean,p_id bigint)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare m jsonb; r jsonb;
begin
 m:=public.chat_v2_mensaje(p_grupo,p_id);
 if m->>'respuesta_id' is not null then
  r:=public.chat_v2_mensaje(p_grupo,(m->>'respuesta_id')::bigint);
  m:=m||jsonb_build_object('respuesta',jsonb_build_object('id',r->'id','contenido',r->>'contenido',
    'autor',(select nombre from public.asis_perfiles where id=(r->>'remitente')::uuid)));
 end if;
 return m||jsonb_build_object(
  'autor',(select nombre from public.asis_perfiles where id=(m->>'remitente')::uuid),
  'reacciones',case when m->>'eliminado_at' is not null then '[]'::jsonb else coalesce((
    select jsonb_agg(to_jsonb(s)) from (
      select emoji,count(*) as total,bool_or(usuario=auth.uid()) as propia
      from public.chat_reacciones where grupo=p_grupo and mensaje_id=p_id group by emoji order by emoji
    ) s),'[]'::jsonb) end);
end $$;

create or replace function public.chat_capacidades()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
 return '{"version":2,"grupos":true,"archivos":true}'::jsonb;
end $$;

-- La búsqueda recorre el historial del servidor, con paginación.
create or replace function public.chat_v2_historial(
 p_contacto uuid default null,p_grupo bigint default null,p_antes bigint default null,p_buscar text default '')
returns setof jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
 if (p_contacto is null)=(p_grupo is null) then raise exception 'Elige una conversación.'; end if;
 if char_length(coalesce(p_buscar,''))>200 then raise exception 'La búsqueda es demasiado larga.'; end if;
 if p_grupo is not null then
  if not public.chat_grupo_miembro(p_grupo) then raise exception 'No perteneces a este grupo.'; end if;
  return query select public.chat_v2_decorar(true,x.id) from public.chat_grupo_mensajes x
   where x.grupo_id=p_grupo and (p_antes is null or x.id<p_antes)
   and (coalesce(p_buscar,'')='' or (x.eliminado_at is null and strpos(lower(x.contenido||' '||coalesce(x.archivo_nombre,'')),lower(p_buscar))>0))
   order by x.id desc limit 50;
 else
  return query select public.chat_v2_decorar(false,x.id) from public.chat_mensajes x
   where ((x.remitente=auth.uid() and x.destinatario=p_contacto) or (x.destinatario=auth.uid() and x.remitente=p_contacto))
   and (p_antes is null or x.id<p_antes)
   and (coalesce(p_buscar,'')='' or (x.eliminado_at is null and strpos(lower(x.contenido||' '||coalesce(x.archivo_nombre,'')),lower(p_buscar))>0))
   order by x.id desc limit 50;
 end if;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-archivos','chat-archivos',false,20971520,array[
 'application/pdf','text/plain','text/csv','application/msword',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
 'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav',
 'video/mp4','video/webm','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists chat_archivo_subir on storage.objects;
create policy chat_archivo_subir on storage.objects for insert to authenticated
with check(bucket_id='chat-archivos' and public.chat_activo()
 and name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}$'));
create or replace function public.chat_archivo_visible(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
 select public.chat_activo() and (
 exists(select 1 from public.chat_mensajes where archivo_path=p_path and eliminado_at is null and auth.uid() in(remitente,destinatario))
 or exists(select 1 from public.chat_grupo_mensajes where archivo_path=p_path and eliminado_at is null and public.chat_grupo_miembro(grupo_id)));
$$;
drop policy if exists chat_archivo_leer on storage.objects;
create policy chat_archivo_leer on storage.objects for select to authenticated
using(bucket_id='chat-archivos' and public.chat_archivo_visible(name));

create or replace function public.chat_v2_enviar(
 p_cliente_id uuid,p_contenido text,p_contacto uuid default null,p_grupo bigint default null,
 p_respuesta bigint default null,p_archivo text default null,p_nombre text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare m jsonb; r jsonb; v_id bigint; v_table text; v_meta jsonb;
 v_texto text:=coalesce(nullif(btrim(p_contenido),''),case when p_archivo is not null then 'Archivo adjunto' end);
begin
 if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
 if (p_contacto is null)=(p_grupo is null) then raise exception 'Elige una conversación.'; end if;
 if p_cliente_id is null or v_texto is null or char_length(v_texto) not between 1 and 4000 then raise exception 'Escribe un mensaje de hasta 4000 caracteres.'; end if;
 v_table:=case when p_grupo is null then 'chat_mensajes' else 'chat_grupo_mensajes' end;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,case when p_grupo is null then 741 else 742 end));
 execute format('select to_jsonb(x) from public.%I x where remitente=$1 and cliente_id=$2',v_table)
 into m using auth.uid(),p_cliente_id;
 if m is not null then
  if m->>'contenido' is distinct from v_texto or (m->>'destinatario')::uuid is distinct from p_contacto
    or (m->>'grupo_id')::bigint is distinct from p_grupo or (m->>'respuesta_id')::bigint is distinct from p_respuesta
    or m->>'archivo_path' is distinct from p_archivo or m->>'archivo_nombre' is distinct from p_nombre then
   raise exception 'Este identificador ya corresponde a otro mensaje.';
  end if;
  return public.chat_v2_decorar(p_grupo is not null,(m->>'id')::bigint);
 end if;
 if p_respuesta is not null then
  r:=public.chat_v2_mensaje(p_grupo is not null,p_respuesta);
  if (p_grupo is not null and (r->>'grupo_id')::bigint<>p_grupo)
    or (p_grupo is null and p_contacto not in ((r->>'remitente')::uuid,(r->>'destinatario')::uuid))
    or r->>'eliminado_at' is not null then raise exception 'No puedes responder a ese mensaje.'; end if;
 end if;
 if p_archivo is not null then
  if p_archivo<>auth.uid()::text||'/'||p_cliente_id::text or char_length(coalesce(p_nombre,'')) not between 1 and 180 then
   raise exception 'Archivo inválido.';
  end if;
  select metadata into v_meta from storage.objects where bucket_id='chat-archivos' and name=p_archivo;
  if v_meta is null or coalesce((v_meta->>'size')::bigint,0) not between 1 and 20971520
    or not exists(select 1 from storage.buckets where id='chat-archivos' and v_meta->>'mimetype'=any(allowed_mime_types)) then
   raise exception 'El archivo no se ha subido correctamente.';
  end if;
 elsif p_nombre is not null then raise exception 'Archivo inválido.';
 end if;
 if p_grupo is null then
  m:=to_jsonb(public.chat_enviar(p_contacto,v_texto,p_cliente_id));
 else m:=public.chat_grupo_enviar(p_grupo,v_texto,p_cliente_id);
 end if;
 v_id:=(m->>'id')::bigint;
 execute format('update public.%I set respuesta_id=$1,archivo_path=$2,archivo_nombre=$3,archivo_mime=$4,archivo_bytes=$5 where id=$6',v_table)
 using p_respuesta,p_archivo,p_nombre,v_meta->>'mimetype',(v_meta->>'size')::bigint,v_id;
 return public.chat_v2_decorar(p_grupo is not null,v_id);
end $$;

create or replace function public.chat_v2_accion(p_grupo boolean,p_id bigint,p_accion text,p_texto text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare m jsonb; t text:=case when p_grupo then 'chat_grupo_mensajes' else 'chat_mensajes' end;
begin
 -- Bloqueo antes de comprobar autor/estado: evita carreras entre editar, eliminar y reaccionar.
 execute format('select id from public.%I where id=$1 for update',t) using p_id;
 m:=public.chat_v2_mensaje(p_grupo,p_id);
 if p_accion='eliminar' and m->>'eliminado_at' is not null and (m->>'remitente')::uuid=auth.uid() then return public.chat_v2_decorar(p_grupo,p_id); end if;
 if m->>'eliminado_at' is not null then raise exception 'Este mensaje fue eliminado.'; end if;
 if p_accion in ('editar','eliminar') then
  if (m->>'remitente')::uuid<>auth.uid() then raise exception 'Solo puedes modificar tus mensajes.'; end if;
  if p_accion='editar' then
   if (m->>'creado_at')::timestamptz<clock_timestamp()-interval '15 minutes' then raise exception 'Solo puedes editar durante los primeros 15 minutos.'; end if;
   if char_length(btrim(coalesce(p_texto,''))) not between 1 and 4000 then raise exception 'Escribe un mensaje de hasta 4000 caracteres.'; end if;
   execute format('update public.%I set contenido=$1,editado_at=clock_timestamp() where id=$2',t) using btrim(p_texto),p_id;
  else
   execute format('update public.%I set contenido=''Mensaje eliminado'',eliminado_at=clock_timestamp(),respuesta_id=null,archivo_path=null,archivo_nombre=null,archivo_mime=null,archivo_bytes=null where id=$1',t) using p_id;
   if not p_grupo then update public.chat_mensajes set imagen_path=null where id=p_id; end if;
   delete from public.chat_reacciones where grupo=p_grupo and mensaje_id=p_id;
  end if;
 elsif p_accion='reaccionar' then
  if p_texto is null then delete from public.chat_reacciones where grupo=p_grupo and mensaje_id=p_id and usuario=auth.uid();
  else insert into public.chat_reacciones values(p_grupo,p_id,auth.uid(),p_texto)
   on conflict(grupo,mensaje_id,usuario) do update set emoji=excluded.emoji;
  end if;
 else raise exception 'Acción no disponible.';
 end if;
 return public.chat_v2_decorar(p_grupo,p_id);
end $$;

revoke all on function public.chat_v2_mensaje(boolean,bigint),public.chat_v2_decorar(boolean,bigint),
 public.chat_capacidades(),public.chat_v2_historial(uuid,bigint,bigint,text),
 public.chat_archivo_visible(text),public.chat_v2_enviar(uuid,text,uuid,bigint,bigint,text,text),
 public.chat_v2_accion(boolean,bigint,text,text) from public,anon,authenticated;
grant execute on function public.chat_capacidades(),public.chat_v2_historial(uuid,bigint,bigint,text),
 public.chat_archivo_visible(text),public.chat_v2_enviar(uuid,text,uuid,bigint,bigint,text,text),
 public.chat_v2_accion(boolean,bigint,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
