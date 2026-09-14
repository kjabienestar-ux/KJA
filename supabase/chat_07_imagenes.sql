-- Ejecutar después de chat_06. Imágenes privadas, máximo 300 KiB por mensaje.
begin;
alter table public.chat_mensajes add column if not exists imagen_path text;
create unique index if not exists chat_imagen_unica on public.chat_mensajes(imagen_path) where imagen_path is not null;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-imagenes','chat-imagenes',false,307200,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=307200,allowed_mime_types=array['image/jpeg'];
drop policy if exists chat_imagen_subir on storage.objects;
create policy chat_imagen_subir on storage.objects for insert to authenticated
with check(bucket_id='chat-imagenes' and public.chat_activo()
  and name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.jpg$'));
-- Helper evita conceder lectura directa sobre mensajes.
create or replace function public.chat_imagen_visible(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
 select public.chat_activo() and exists(select 1 from public.chat_mensajes
 where imagen_path=p_path and auth.uid() in (remitente,destinatario));
$$;
revoke all on function public.chat_imagen_visible(text) from public,anon,authenticated;
grant execute on function public.chat_imagen_visible(text) to authenticated;
drop policy if exists chat_imagen_leer on storage.objects;
create policy chat_imagen_leer on storage.objects for select to authenticated
using(bucket_id='chat-imagenes' and public.chat_imagen_visible(name));
create or replace function public.chat_enviar_imagen(p_contacto uuid,p_contenido text,p_cliente_id uuid,p_path text)
returns public.chat_mensajes language plpgsql security definer set search_path=public as $$
declare v_mensaje public.chat_mensajes; v_texto text:=coalesce(nullif(btrim(p_contenido),''),'Imagen');
begin
 if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
 if p_cliente_id is null or p_path is distinct from auth.uid()::text||'/'||p_cliente_id::text||'.jpg' then
 raise exception 'Ruta de imagen inválida.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,741));
 select * into v_mensaje from public.chat_mensajes where remitente=auth.uid() and cliente_id=p_cliente_id;
 if found then
   if v_mensaje.destinatario is distinct from p_contacto or v_mensaje.contenido<>v_texto or v_mensaje.imagen_path is distinct from p_path then
     raise exception 'Este identificador ya corresponde a otro mensaje.';
   end if;
   return v_mensaje;
 end if;
 if not exists(select 1 from storage.objects where bucket_id='chat-imagenes' and name=p_path
   and metadata->>'mimetype'='image/jpeg' and (metadata->>'size')::bigint between 1 and 307200) then
   raise exception 'La imagen no se ha subido correctamente.';
 end if;
 v_mensaje:=public.chat_enviar(p_contacto,v_texto,p_cliente_id);
 update public.chat_mensajes set imagen_path=p_path where id=v_mensaje.id returning * into v_mensaje;
 return v_mensaje;
end $$;
revoke all on function public.chat_enviar_imagen(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.chat_enviar_imagen(uuid,text,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
