-- KJA-035: reversión de DDL y permisos; NO recupera ni altera filas.
-- Ejecutar solo si se aplicó la retirada y después de revisar cambios posteriores.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
set local check_function_bodies = off;
CREATE OR REPLACE FUNCTION public.dash_marcar_notificaciones_revision(p_ids bigint[] DEFAULT NULL::bigint[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_colab bigint := public.dash_colab();
  v_marcadas integer := 0;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;
  if p_ids is not null and cardinality(p_ids) > 50 then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;

  with actualizadas as (
    update public.asis_notificaciones
       set leida_at = now()
     where colaborador_id = v_colab
       and ocultada_at is null
       and leida_at is null
       and (p_ids is null or id = any(p_ids))
    returning id
  )
  select count(*)::integer into v_marcadas from actualizadas;

  return jsonb_build_object('ok', true, 'marcadas', v_marcadas);
end;
$function$;
alter function public.dash_marcar_notificaciones_revision(bigint[]) owner to "postgres";
revoke all on function public.dash_marcar_notificaciones_revision(bigint[]) from public,anon,authenticated,service_role;
grant execute on function public.dash_marcar_notificaciones_revision(bigint[]) to "postgres";
grant execute on function public.dash_marcar_notificaciones_revision(bigint[]) to "authenticated";
grant execute on function public.dash_marcar_notificaciones_revision(bigint[]) to "service_role";
CREATE OR REPLACE FUNCTION public.chat_contactos()
 RETURNS TABLE(id uuid, nombre text, direccion boolean, activo boolean, ultimo text, ultimo_at timestamp with time zone, no_leidos bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  return query
  select p.id,coalesce(case when p.acceso_panel then nullif(left(btrim(u.raw_user_meta_data->>'kja_nombre_visible'),80),'') end,p.nombre),
    (p.activo and p.rol='direccion' and exists(
      select 1 from public.chat_direccion_contactos d where d.perfil_id=p.id
    )),p.activo,m.contenido,m.creado_at,
    (select count(*) from public.chat_mensajes n where n.destinatario=auth.uid() and n.remitente=p.id and n.leido_at is null)
  from public.asis_perfiles p
  left join auth.users u on u.id=p.id
  left join lateral (
    select c.contenido,c.creado_at from public.chat_mensajes c
    where (c.remitente=auth.uid() and c.destinatario=p.id) or (c.destinatario=auth.uid() and c.remitente=p.id)
    order by c.id desc limit 1
  ) m on true
  where p.id<>auth.uid() and (p.activo or m.creado_at is not null)
  order by m.creado_at desc nulls last,p.nombre,p.id;
end;
$function$;
alter function public.chat_contactos() owner to "postgres";
revoke all on function public.chat_contactos() from public,anon,authenticated,service_role;
grant execute on function public.chat_contactos() to "postgres";
grant execute on function public.chat_contactos() to "service_role";
grant execute on function public.chat_contactos() to "authenticated";
CREATE OR REPLACE FUNCTION public.chat_emitir_evento_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.chat_eventos(mensaje_id,destinatario)
    values(new.id,new.destinatario)
    on conflict (mensaje_id) do nothing;
  return new;
end;
$function$;
alter function public.chat_emitir_evento_trg() owner to "postgres";
revoke all on function public.chat_emitir_evento_trg() from public,anon,authenticated,service_role;
grant execute on function public.chat_emitir_evento_trg() to "postgres";
grant execute on function public.chat_emitir_evento_trg() to "service_role";
CREATE OR REPLACE FUNCTION public.chat_imagen_visible(p_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select public.chat_activo() and exists(select 1 from public.chat_mensajes
 where imagen_path=p_path and auth.uid() in (remitente,destinatario));
$function$;
alter function public.chat_imagen_visible(text) owner to "postgres";
revoke all on function public.chat_imagen_visible(text) from public,anon,authenticated,service_role;
grant execute on function public.chat_imagen_visible(text) to "postgres";
grant execute on function public.chat_imagen_visible(text) to "service_role";
grant execute on function public.chat_imagen_visible(text) to "authenticated";
CREATE OR REPLACE FUNCTION public.dash_eliminar_notificacion_revision(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_colab bigint := public.dash_colab();
  v_ocultada bigint;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;
  if p_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'datos');
  end if;

  update public.asis_notificaciones
     set ocultada_at = coalesce(ocultada_at, now())
   where id = p_id
     and colaborador_id = v_colab
  returning id into v_ocultada;

  if v_ocultada is null then
    return jsonb_build_object('ok', false, 'motivo', 'no_encontrada');
  end if;

  return jsonb_build_object('ok', true, 'id', v_ocultada);
end;
$function$;
alter function public.dash_eliminar_notificacion_revision(bigint) owner to "postgres";
revoke all on function public.dash_eliminar_notificacion_revision(bigint) from public,anon,authenticated,service_role;
grant execute on function public.dash_eliminar_notificacion_revision(bigint) to "postgres";
grant execute on function public.dash_eliminar_notificacion_revision(bigint) to "authenticated";
grant execute on function public.dash_eliminar_notificacion_revision(bigint) to "service_role";
CREATE OR REPLACE FUNCTION public.chat_puede_ver_foto(p_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.chat_activo() and exists (
    select 1 from public.asis_perfiles p
    join public.asis_colaboradores c on c.id=p.colaborador_id
    where p.activo and c.activo and c.foto_path=p_path
      and c.foto_path in (c.id::text||'/avatar.webp',c.id::text||'/avatar.jpg')
  );
$function$;
alter function public.chat_puede_ver_foto(text) owner to "postgres";
revoke all on function public.chat_puede_ver_foto(text) from public,anon,authenticated,service_role;
grant execute on function public.chat_puede_ver_foto(text) to "postgres";
grant execute on function public.chat_puede_ver_foto(text) to "service_role";
grant execute on function public.chat_puede_ver_foto(text) to "authenticated";
CREATE OR REPLACE FUNCTION public.chat_fotos()
 RETURNS TABLE(id uuid, foto_path text, foto_actualizada_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  return query
    select p.id,c.foto_path,c.foto_actualizada_at
    from public.asis_perfiles p
    join public.asis_colaboradores c on c.id=p.colaborador_id
    where p.activo and c.activo and p.id<>auth.uid()
      and c.foto_path in (c.id::text||'/avatar.webp',c.id::text||'/avatar.jpg');
end;
$function$;
alter function public.chat_fotos() owner to "postgres";
revoke all on function public.chat_fotos() from public,anon,authenticated,service_role;
grant execute on function public.chat_fotos() to "postgres";
grant execute on function public.chat_fotos() to "service_role";
grant execute on function public.chat_fotos() to "authenticated";
CREATE OR REPLACE FUNCTION public.chat_puede_ver_foto_admin(p_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select public.chat_activo() and exists (
 select 1 from public.asis_perfiles p join auth.users u on u.id=p.id
 where p.activo and p.acceso_panel and p.colaborador_id is null
 and p_path in (p.id::text||'/avatar.jpg',p.id::text||'/avatar.webp')
 and u.raw_user_meta_data->>'kja_admin_foto'=p_path);
$function$;
alter function public.chat_puede_ver_foto_admin(text) owner to "postgres";
revoke all on function public.chat_puede_ver_foto_admin(text) from public,anon,authenticated,service_role;
grant execute on function public.chat_puede_ver_foto_admin(text) to "postgres";
grant execute on function public.chat_puede_ver_foto_admin(text) to "authenticated";
grant execute on function public.chat_puede_ver_foto_admin(text) to "service_role";
CREATE OR REPLACE FUNCTION public.chat_cuenta_colaborador(p_colaborador bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_cuenta uuid;
begin
  if not exists(select 1 from public.asis_perfiles where id=auth.uid() and activo and rol='direccion') then
    raise exception 'Solo Dirección puede abrir conversaciones desde este panel.';
  end if;
  select p.id into v_cuenta from public.asis_perfiles p
    join public.asis_colaboradores c on c.id=p.colaborador_id
    where c.id=p_colaborador and c.activo and p.activo;
  if v_cuenta is null then raise exception 'Este colaborador todavía no tiene una cuenta activa vinculada al chat.'; end if;
  if v_cuenta=auth.uid() then raise exception 'No puedes abrir una conversación contigo mismo.'; end if;
  return v_cuenta;
end;
$function$;
alter function public.chat_cuenta_colaborador(bigint) owner to "postgres";
revoke all on function public.chat_cuenta_colaborador(bigint) from public,anon,authenticated,service_role;
grant execute on function public.chat_cuenta_colaborador(bigint) to "postgres";
grant execute on function public.chat_cuenta_colaborador(bigint) to "service_role";
grant execute on function public.chat_cuenta_colaborador(bigint) to "authenticated";
CREATE OR REPLACE FUNCTION public.chat_activo()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from public.asis_perfiles where id=auth.uid() and activo);
$function$;
alter function public.chat_activo() owner to "postgres";
revoke all on function public.chat_activo() from public,anon,authenticated,service_role;
grant execute on function public.chat_activo() to "postgres";
grant execute on function public.chat_activo() to "service_role";
grant execute on function public.chat_activo() to "authenticated";
CREATE OR REPLACE FUNCTION public.chat_historial(p_contacto uuid, p_antes bigint DEFAULT NULL::bigint)
 RETURNS SETOF chat_mensajes
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  return query select m.* from public.chat_mensajes m
    where ((m.remitente=auth.uid() and m.destinatario=p_contacto) or (m.destinatario=auth.uid() and m.remitente=p_contacto))
      and (p_antes is null or m.id<p_antes)
    order by m.id desc limit 50;
end;
$function$;
alter function public.chat_historial(uuid,bigint) owner to "postgres";
revoke all on function public.chat_historial(uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.chat_historial(uuid,bigint) to "postgres";
grant execute on function public.chat_historial(uuid,bigint) to "service_role";
grant execute on function public.chat_historial(uuid,bigint) to "authenticated";
CREATE OR REPLACE FUNCTION public.chat_enviar(p_contacto uuid, p_contenido text, p_cliente_id uuid)
 RETURNS chat_mensajes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_mensaje public.chat_mensajes;
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  if p_contacto=auth.uid() or not exists(select 1 from public.asis_perfiles where id=p_contacto and activo) then
    raise exception 'El destinatario no está disponible.';
  end if;
  if p_cliente_id is null or p_contenido is null or char_length(btrim(p_contenido)) not between 1 and 4000 then
    raise exception 'Escribe un mensaje de hasta 4000 caracteres.';
  end if;
  -- Serializa envíos por cuenta; los reintentos no duplican mensajes.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,741));
  select * into v_mensaje from public.chat_mensajes where remitente=auth.uid() and cliente_id=p_cliente_id;
  if found then
    if v_mensaje.destinatario<>p_contacto or v_mensaje.contenido<>btrim(p_contenido) then
      raise exception 'Este identificador ya corresponde a otro mensaje.';
    end if;
    return v_mensaje;
  end if;
  if (select count(*) from public.chat_mensajes where remitente=auth.uid() and creado_at>clock_timestamp()-interval '1 minute')>=30 then
    raise exception 'Has enviado muchos mensajes. Espera un minuto y vuelve a intentar.';
  end if;
  insert into public.chat_mensajes(remitente,destinatario,contenido,cliente_id)
    values(auth.uid(),p_contacto,btrim(p_contenido),p_cliente_id) returning * into v_mensaje;
  return v_mensaje;
end;
$function$;
alter function public.chat_enviar(uuid,text,uuid) owner to "postgres";
revoke all on function public.chat_enviar(uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.chat_enviar(uuid,text,uuid) to "postgres";
grant execute on function public.chat_enviar(uuid,text,uuid) to "service_role";
grant execute on function public.chat_enviar(uuid,text,uuid) to "authenticated";
CREATE OR REPLACE FUNCTION public.dash_notificar_revision_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_entrega public.asis_entregas_diarias;
  v_titulo text;
begin
  select * into v_entrega
    from public.asis_entregas_diarias
   where id = new.entrega_id;

  if v_entrega.id is null then
    return new;
  end if;

  select case v_entrega.requisito
           when 'comparticiones' then 'Comparticiones de Facebook'
           when 'rpe' then 'RPE y evidencias del día'
           when 'salida' then 'Evidencia de hora de salida'
           else coalesce(asignacion.titulo, 'Entregable asignado')
         end
    into v_titulo
    from (select 1) base
    left join public.asis_asignaciones_diarias asignacion
      on asignacion.id = v_entrega.asignacion_id;

  insert into public.asis_notificaciones (
    colaborador_id, tipo, titulo, mensaje, fecha, entrega_id, actor_id,
    creado_at, dedupe_key
  ) values (
    v_entrega.colaborador_id,
    case new.estado_nuevo when 'observada' then 'revision_observada' else 'revision_aprobada' end,
    v_titulo,
    new.nota,
    v_entrega.fecha,
    v_entrega.id,
    new.actor_id,
    new.creado_at,
    'revision:' || new.id::text
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$function$;
alter function public.dash_notificar_revision_trg() owner to "postgres";
revoke all on function public.dash_notificar_revision_trg() from public,anon,authenticated,service_role;
grant execute on function public.dash_notificar_revision_trg() to public;
grant execute on function public.dash_notificar_revision_trg() to "postgres";
grant execute on function public.dash_notificar_revision_trg() to "anon";
grant execute on function public.dash_notificar_revision_trg() to "authenticated";
grant execute on function public.dash_notificar_revision_trg() to "service_role";
CREATE OR REPLACE FUNCTION public.dash_notificar_asignacion_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not new.activo then
    return new;
  end if;

  insert into public.asis_notificaciones (
    colaborador_id, tipo, titulo, mensaje, fecha, asignacion_id, actor_id,
    datos, creado_at, dedupe_key
  )
  select
    colaborador.id,
    'asignacion',
    new.titulo,
    new.instrucciones,
    new.fecha,
    new.id,
    new.creado_por,
    jsonb_build_object('tipo_entregable', new.tipo),
    new.creado_at,
    'asignacion:' || new.id::text || ':colaborador:' || colaborador.id::text
  from public.asis_colaboradores colaborador
  where colaborador.activo
    and (
      colaborador.id = new.colaborador_id
      or (new.colaborador_id is null and colaborador.area_id = new.area_id)
    )
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$function$;
alter function public.dash_notificar_asignacion_trg() owner to "postgres";
revoke all on function public.dash_notificar_asignacion_trg() from public,anon,authenticated,service_role;
grant execute on function public.dash_notificar_asignacion_trg() to public;
grant execute on function public.dash_notificar_asignacion_trg() to "postgres";
grant execute on function public.dash_notificar_asignacion_trg() to "anon";
grant execute on function public.dash_notificar_asignacion_trg() to "authenticated";
grant execute on function public.dash_notificar_asignacion_trg() to "service_role";
CREATE OR REPLACE FUNCTION public.chat_leer(p_contacto uuid, p_hasta bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  update public.chat_mensajes set leido_at=clock_timestamp()
    where destinatario=auth.uid() and remitente=p_contacto and id<=p_hasta and leido_at is null;
end;
$function$;
alter function public.chat_leer(uuid,bigint) owner to "postgres";
revoke all on function public.chat_leer(uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.chat_leer(uuid,bigint) to "postgres";
grant execute on function public.chat_leer(uuid,bigint) to "service_role";
grant execute on function public.chat_leer(uuid,bigint) to "authenticated";
CREATE OR REPLACE FUNCTION public.dash_admin_enviar_mensaje(p_colaborador bigint, p_mensaje text, p_asunto text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id bigint;
  v_mensaje text := nullif(left(btrim(coalesce(p_mensaje, '')), 700), '');
  v_asunto text := coalesce(nullif(left(btrim(coalesce(p_asunto, '')), 120), ''), 'Mensaje de Dirección');
  v_envios_recientes integer;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_colaborador is null or v_mensaje is null or char_length(v_mensaje) < 3
     or char_length(v_asunto) < 2 then
    return jsonb_build_object('ok', false, 'motivo', 'datos');
  end if;
  if not exists (
    select 1 from public.asis_colaboradores
     where id = p_colaborador and activo
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'colaborador');
  end if;

  select count(*)::integer into v_envios_recientes
    from public.asis_notificaciones
   where actor_id = auth.uid()
     and tipo = 'mensaje_direccion'
     and creado_at >= now() - interval '1 hour';
  if v_envios_recientes >= 30 then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;

  insert into public.asis_notificaciones (
    colaborador_id, tipo, titulo, mensaje, fecha, actor_id
  ) values (
    p_colaborador, 'mensaje_direccion', v_asunto, v_mensaje,
    (now() at time zone 'America/Lima')::date, auth.uid()
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'colaborador_id', p_colaborador);
end;
$function$;
alter function public.dash_admin_enviar_mensaje(bigint,text,text) owner to "postgres";
revoke all on function public.dash_admin_enviar_mensaje(bigint,text,text) from public,anon,authenticated,service_role;
grant execute on function public.dash_admin_enviar_mensaje(bigint,text,text) to "postgres";
grant execute on function public.dash_admin_enviar_mensaje(bigint,text,text) to "authenticated";
grant execute on function public.dash_admin_enviar_mensaje(bigint,text,text) to "service_role";
CREATE OR REPLACE FUNCTION public.dash_mis_notificaciones_revision(p_limite integer DEFAULT 24)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_colab bigint := public.dash_colab();
  v_limite integer := greatest(1, least(coalesce(p_limite, 24), 50));
  v_no_leidas integer := 0;
  v_notificaciones jsonb := '[]'::jsonb;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;

  select count(*)::integer into v_no_leidas
    from public.asis_notificaciones notificacion
   where notificacion.colaborador_id = v_colab
     and notificacion.leida_at is null
     and notificacion.ocultada_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', item.id,
           'tipo', item.tipo,
           'estado', case item.tipo
             when 'revision_observada' then 'observada'
             when 'revision_aprobada' then 'aprobada'
             else item.tipo
           end,
           'nota', item.mensaje,
           'titulo', item.titulo,
           'fecha', item.fecha,
           'creado_at', item.creado_at,
           'leida', item.leida_at is not null,
           'entrega_id', item.entrega_id,
           'asignacion_id', item.asignacion_id,
           'meta', item.datos
         ) order by item.creado_at desc, item.id desc), '[]'::jsonb)
    into v_notificaciones
    from (
      select *
        from public.asis_notificaciones
       where colaborador_id = v_colab
         and ocultada_at is null
       order by creado_at desc, id desc
       limit v_limite
    ) item;

  return jsonb_build_object(
    'ok', true,
    'no_leidas', v_no_leidas,
    'notificaciones', v_notificaciones
  );
end;
$function$;
alter function public.dash_mis_notificaciones_revision(integer) owner to "postgres";
revoke all on function public.dash_mis_notificaciones_revision(integer) from public,anon,authenticated,service_role;
grant execute on function public.dash_mis_notificaciones_revision(integer) to "postgres";
grant execute on function public.dash_mis_notificaciones_revision(integer) to "authenticated";
grant execute on function public.dash_mis_notificaciones_revision(integer) to "service_role";
CREATE OR REPLACE FUNCTION public.chat_presencia(p_sesion uuid, p_visible boolean DEFAULT true)
 RETURNS TABLE(id uuid, vigencia_segundos double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  if p_sesion is null or p_visible is null then raise exception 'Sesión de chat inválida.'; end if;
  delete from public.chat_sesiones where visto_at<clock_timestamp()-interval '70 seconds';
  if p_visible then
    insert into public.chat_sesiones(usuario_id,sesion_id,visto_at)
      values(auth.uid(),p_sesion,clock_timestamp())
      on conflict(usuario_id,sesion_id) do update set visto_at=excluded.visto_at;
  else
    delete from public.chat_sesiones where usuario_id=auth.uid() and sesion_id=p_sesion;
  end if;
  return query select s.usuario_id,
    extract(epoch from (max(s.visto_at)+interval '70 seconds'-clock_timestamp()))::double precision
    from public.chat_sesiones s join public.asis_perfiles p on p.id=s.usuario_id
    where p.activo and s.visto_at>clock_timestamp()-interval '70 seconds'
    group by s.usuario_id;
end;
$function$;
alter function public.chat_presencia(uuid,boolean) owner to "postgres";
revoke all on function public.chat_presencia(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.chat_presencia(uuid,boolean) to "postgres";
grant execute on function public.chat_presencia(uuid,boolean) to "service_role";
grant execute on function public.chat_presencia(uuid,boolean) to "authenticated";
CREATE OR REPLACE FUNCTION public.chat_enviar_imagen(p_contacto uuid, p_contenido text, p_cliente_id uuid, p_path text)
 RETURNS chat_mensajes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;
alter function public.chat_enviar_imagen(uuid,text,uuid,text) owner to "postgres";
revoke all on function public.chat_enviar_imagen(uuid,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.chat_enviar_imagen(uuid,text,uuid,text) to "postgres";
grant execute on function public.chat_enviar_imagen(uuid,text,uuid,text) to "service_role";
grant execute on function public.chat_enviar_imagen(uuid,text,uuid,text) to "authenticated";
CREATE OR REPLACE FUNCTION public.dash_mis_pausas()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id bigint;
begin
  if auth.uid() is null or not public.dash_sesion_vigente() then
    return jsonb_build_object('ok',false,'motivo','sin_sesion');
  end if;
  select id into v_id from public.asis_colaboradores where id=public.dash_colab() and activo;
  if v_id is null then return jsonb_build_object('ok',false,'motivo','sin_colaborador'); end if;
  perform pg_advisory_xact_lock(750075);
  return public.dash_pausas_estado(v_id);
end $function$;
alter function public.dash_mis_pausas() owner to "postgres";
revoke all on function public.dash_mis_pausas() from public,anon,authenticated,service_role;
grant execute on function public.dash_mis_pausas() to "postgres";
grant execute on function public.dash_mis_pausas() to "service_role";
grant execute on function public.dash_mis_pausas() to "authenticated";
CREATE OR REPLACE FUNCTION public.dash_admin_reset_pausas(p_colaborador_id bigint, p_fecha date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_fecha date := coalesce(p_fecha, (now() at time zone 'America/Lima')::date);
begin
  if auth.uid() is null or public.asis_rol() is distinct from 'direccion' or not public.dash_sesion_vigente() then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;

  if v_fecha <> (now() at time zone 'America/Lima')::date then
    return jsonb_build_object('ok',false,'motivo','solo_hoy');
  end if;
  perform pg_advisory_xact_lock(750075);
  delete from public.asis_pausas_activas
  where colaborador_id = p_colaborador_id and fecha = v_fecha;

  return jsonb_build_object('ok', true, 'colaborador_id', p_colaborador_id, 'fecha', v_fecha);
end;
$function$;
alter function public.dash_admin_reset_pausas(bigint,date) owner to "postgres";
revoke all on function public.dash_admin_reset_pausas(bigint,date) from public,anon,authenticated,service_role;
grant execute on function public.dash_admin_reset_pausas(bigint,date) to "postgres";
grant execute on function public.dash_admin_reset_pausas(bigint,date) to "authenticated";
grant execute on function public.dash_admin_reset_pausas(bigint,date) to "service_role";
CREATE OR REPLACE FUNCTION public.dash_admin_reset_todas_pausas(p_fecha date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_fecha date := coalesce(p_fecha, (now() at time zone 'America/Lima')::date);
begin
  if auth.uid() is null or public.asis_rol() is distinct from 'direccion' or not public.dash_sesion_vigente() then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;

  if v_fecha <> (now() at time zone 'America/Lima')::date then
    return jsonb_build_object('ok',false,'motivo','solo_hoy');
  end if;
  perform pg_advisory_xact_lock(750075);
  delete from public.asis_pausas_activas
  where fecha = v_fecha;

  return jsonb_build_object('ok', true, 'fecha', v_fecha);
end;
$function$;
alter function public.dash_admin_reset_todas_pausas(date) owner to "postgres";
revoke all on function public.dash_admin_reset_todas_pausas(date) from public,anon,authenticated,service_role;
grant execute on function public.dash_admin_reset_todas_pausas(date) to "postgres";
grant execute on function public.dash_admin_reset_todas_pausas(date) to "authenticated";
grant execute on function public.dash_admin_reset_todas_pausas(date) to "service_role";
CREATE OR REPLACE FUNCTION public.dash_pausas_estado(p_colab bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_now timestamptz:=clock_timestamp();
  v_fecha date:=(v_now at time zone 'America/Lima')::date;
  v_pausas jsonb;
  v_sesion jsonb;
begin
  update public.asis_pausa_sesiones set estado='completada',cerrado_at=fin_at
    where colaborador_id=p_colab and estado='en_curso' and fin_at<=v_now;
  select pausas into v_pausas from public.asis_pausas_activas
    where colaborador_id=p_colab and fecha=v_fecha;
  select jsonb_build_object('id',s.id,'pausa',s.pausa,'estado',s.estado,
    'inicio_at',s.inicio_at,'fin_at',s.fin_at,'cerrado_at',s.cerrado_at)
    into v_sesion from public.asis_pausa_sesiones s
    where s.colaborador_id=p_colab and s.fecha=v_fecha
    order by s.inicio_at desc,s.id desc limit 1;
  return jsonb_build_object('ok',true,'version',2,'colaborador_id',p_colab,
    'fecha',v_fecha,'ahora',v_now,'pausas',coalesce(v_pausas,'[]'::jsonb),'sesion',v_sesion);
end $function$;
alter function public.dash_pausas_estado(bigint) owner to "postgres";
revoke all on function public.dash_pausas_estado(bigint) from public,anon,authenticated,service_role;
grant execute on function public.dash_pausas_estado(bigint) to "postgres";
grant execute on function public.dash_pausas_estado(bigint) to "service_role";
CREATE OR REPLACE FUNCTION public.dash_registrar_pausa(p_break_id text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object('ok',false,'motivo','actualizar_portal')
$function$;
alter function public.dash_registrar_pausa(text) owner to "postgres";
revoke all on function public.dash_registrar_pausa(text) from public,anon,authenticated,service_role;
grant execute on function public.dash_registrar_pausa(text) to "postgres";
grant execute on function public.dash_registrar_pausa(text) to "service_role";
grant execute on function public.dash_registrar_pausa(text) to "authenticated";
CREATE OR REPLACE FUNCTION public.dash_iniciar_pausa(p_break_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_colab public.asis_colaboradores;
  v_now timestamptz; v_fecha date; v_duracion interval; v_limite timestamptz;
  v_estado jsonb; v_pausas jsonb; v_reg uuid;
begin
  if auth.uid() is null or not public.dash_sesion_vigente() then
    return jsonb_build_object('ok',false,'motivo','sin_sesion');
  end if;
  if p_break_id is null or p_break_id not in ('movilidad','visual') then
    return jsonb_build_object('ok',false,'motivo','pausa_invalida');
  end if;
  select * into v_colab from public.asis_colaboradores where id=public.dash_colab() and activo;
  if v_colab.id is null then return jsonb_build_object('ok',false,'motivo','sin_colaborador'); end if;
  perform pg_advisory_xact_lock(750075);
  v_now:=clock_timestamp(); v_fecha:=(v_now at time zone 'America/Lima')::date;
  v_estado:=public.dash_pausas_estado(v_colab.id);
  -- Reintentos, recargas y otras pestanas recuperan la misma sesion.
  if v_estado->'sesion'->>'estado'='en_curso' then return v_estado; end if;
  if not coalesce(public.asis_labora(v_colab,v_fecha),false)
    or not coalesce((v_now at time zone 'America/Lima')::time >= public.asis_hora_entrada(v_colab,v_fecha)
      and (v_now at time zone 'America/Lima')::time < public.asis_hora_salida(v_colab,v_fecha),false)
    or not exists(select 1 from public.asis_registros where colaborador_id=v_colab.id
      and fecha=v_fecha and estado in ('P','T') and marcado_at<=v_now and salida_at is null) then
    return jsonb_build_object('ok',false,'motivo','fuera_horario');
  end if;
  v_duracion:=case when p_break_id='movilidad' then interval '20 minutes' else interval '10 minutes' end;
  v_limite:=(v_fecha+public.asis_hora_salida(v_colab,v_fecha)) at time zone 'America/Lima';
  if v_limite is null or v_now+v_duracion>v_limite then
    return jsonb_build_object('ok',false,'motivo','tiempo_insuficiente');
  end if;
  v_pausas:=v_estado->'pausas';
  if v_pausas ? p_break_id then return jsonb_build_object('ok',false,'motivo','consumida'); end if;
  if jsonb_array_length(v_pausas)>=2 then return jsonb_build_object('ok',false,'motivo','limite'); end if;
  v_pausas:=v_pausas||jsonb_build_array(p_break_id);
  insert into public.asis_pausas_activas(colaborador_id,fecha,pausas,completadas_count)
    values(v_colab.id,v_fecha,v_pausas,jsonb_array_length(v_pausas))
    on conflict(colaborador_id,fecha) do update set pausas=excluded.pausas,
      completadas_count=excluded.completadas_count,actualizado_at=v_now
    returning id into v_reg;
  insert into public.asis_pausa_sesiones(registro_id,colaborador_id,fecha,pausa,inicio_at,fin_at)
    values(v_reg,v_colab.id,v_fecha,p_break_id,v_now,v_now+v_duracion);
  return public.dash_pausas_estado(v_colab.id);
end $function$;
alter function public.dash_iniciar_pausa(text) owner to "postgres";
revoke all on function public.dash_iniciar_pausa(text) from public,anon,authenticated,service_role;
grant execute on function public.dash_iniciar_pausa(text) to "postgres";
grant execute on function public.dash_iniciar_pausa(text) to "service_role";
grant execute on function public.dash_iniciar_pausa(text) to "authenticated";
CREATE OR REPLACE FUNCTION public.dash_cerrar_pausa(p_sesion uuid, p_abandonar boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id bigint; v_sesion public.asis_pausa_sesiones; v_now timestamptz;
begin
  if auth.uid() is null or not public.dash_sesion_vigente() then
    return jsonb_build_object('ok',false,'motivo','sin_sesion');
  end if;
  select id into v_id from public.asis_colaboradores where id=public.dash_colab() and activo;
  if v_id is null then return jsonb_build_object('ok',false,'motivo','sin_colaborador'); end if;
  perform pg_advisory_xact_lock(750075);
  select * into v_sesion from public.asis_pausa_sesiones where id=p_sesion and colaborador_id=v_id;
  if v_sesion.id is null then return jsonb_build_object('ok',false,'motivo','sesion_no_disponible'); end if;
  v_now:=clock_timestamp();
  if v_sesion.estado='en_curso' then
    if v_now<v_sesion.fin_at and not coalesce(p_abandonar,false) then
      return jsonb_build_object('ok',false,'motivo','tiempo_pendiente');
    end if;
    update public.asis_pausa_sesiones set
      estado=case when v_now>=fin_at then 'completada' else 'abandonada' end,
      cerrado_at=case when v_now>=fin_at then fin_at else v_now end
      where id=v_sesion.id;
  end if;
  return public.dash_pausas_estado(v_id);
end $function$;
alter function public.dash_cerrar_pausa(uuid,boolean) owner to "postgres";
revoke all on function public.dash_cerrar_pausa(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.dash_cerrar_pausa(uuid,boolean) to "postgres";
grant execute on function public.dash_cerrar_pausa(uuid,boolean) to "service_role";
grant execute on function public.dash_cerrar_pausa(uuid,boolean) to "authenticated";
CREATE OR REPLACE FUNCTION public.dash_admin_pausas_diarias(p_fecha date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_fecha date:=coalesce(p_fecha,(now() at time zone 'America/Lima')::date); v_filas jsonb;
begin
  if auth.uid() is null or public.asis_rol() is distinct from 'direccion' or not public.dash_sesion_vigente() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'colaborador_id',c.id,'colaborador',c.nombre,'area_id',c.area_id,'area',coalesce(a.nombre,'Sin área'),
    'activo',c.activo,'pausas',coalesce(p.pausas,'[]'::jsonb),'completadas_count',coalesce(p.completadas_count,0),
    'actualizado_at',p.actualizado_at,'sesiones',(select coalesce(jsonb_agg(jsonb_build_object(
      'pausa',s.pausa,'estado',case when s.estado='en_curso' and s.fin_at<=clock_timestamp() then 'completada' else s.estado end,
      'inicio_at',s.inicio_at,'fin_at',s.fin_at) order by s.inicio_at),'[]'::jsonb)
      from public.asis_pausa_sesiones s where s.registro_id=p.id)
  ) order by c.nombre),'[]'::jsonb) into v_filas
  from public.asis_colaboradores c left join public.asis_areas a on a.id=c.area_id
    left join public.asis_pausas_activas p on p.colaborador_id=c.id and p.fecha=v_fecha where c.activo;
  return jsonb_build_object('ok',true,'fecha',v_fecha,'filas',v_filas);
end $function$;
alter function public.dash_admin_pausas_diarias(date) owner to "postgres";
revoke all on function public.dash_admin_pausas_diarias(date) from public,anon,authenticated,service_role;
grant execute on function public.dash_admin_pausas_diarias(date) to "postgres";
grant execute on function public.dash_admin_pausas_diarias(date) to "service_role";
grant execute on function public.dash_admin_pausas_diarias(date) to "authenticated";
CREATE OR REPLACE FUNCTION public.chat_fotos_perfiles()
 RETURNS TABLE(id uuid, foto_path text, foto_actualizada_at text, bucket text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if not public.chat_activo() then raise exception 'Sin acceso al chat'; end if;
 return query
 select f.id,f.foto_path,f.foto_actualizada_at::text,'perfil-fotos'::text from public.chat_fotos() f
 union all
 select p.id,u.raw_user_meta_data->>'kja_admin_foto',u.raw_user_meta_data->>'kja_admin_foto_fecha','admin-perfil-fotos'::text
 from public.asis_perfiles p join auth.users u on u.id=p.id
 where p.activo and p.acceso_panel and p.colaborador_id is null and p.id<>auth.uid()
 and u.raw_user_meta_data->>'kja_admin_foto' in (p.id::text||'/avatar.jpg',p.id::text||'/avatar.webp');
end;
$function$;
alter function public.chat_fotos_perfiles() owner to "postgres";
revoke all on function public.chat_fotos_perfiles() from public,anon,authenticated,service_role;
grant execute on function public.chat_fotos_perfiles() to "postgres";
grant execute on function public.chat_fotos_perfiles() to "authenticated";
grant execute on function public.chat_fotos_perfiles() to "service_role";
CREATE OR REPLACE FUNCTION public.chat_grupo_evento_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.chat_grupo_eventos(mensaje_id,destinatario)
    select new.id,m.usuario_id from public.chat_grupo_miembros m join public.asis_perfiles p on p.id=m.usuario_id
     where m.grupo_id=new.grupo_id and p.activo and m.usuario_id<>new.remitente
    on conflict do nothing;
  return new;
end;
$function$;
alter function public.chat_grupo_evento_trg() owner to "postgres";
revoke all on function public.chat_grupo_evento_trg() from public,anon,authenticated,service_role;
grant execute on function public.chat_grupo_evento_trg() to "postgres";
grant execute on function public.chat_grupo_evento_trg() to "service_role";
CREATE OR REPLACE FUNCTION public.chat_grupo_miembro(p_grupo bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.chat_activo() and exists(
    select 1 from public.chat_grupo_miembros m join public.chat_grupos g on g.id=m.grupo_id
     where m.grupo_id=p_grupo and m.usuario_id=auth.uid() and g.activo);
$function$;
alter function public.chat_grupo_miembro(bigint) owner to "postgres";
revoke all on function public.chat_grupo_miembro(bigint) from public,anon,authenticated,service_role;
grant execute on function public.chat_grupo_miembro(bigint) to "postgres";
grant execute on function public.chat_grupo_miembro(bigint) to "service_role";
CREATE OR REPLACE FUNCTION public.chat_grupo_salir(p_grupo bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
 perform id from public.chat_grupos where id=p_grupo for update;
 if exists(select 1 from public.chat_grupos where id=p_grupo and creador=auth.uid()) then
  raise exception 'Transfiere la administración a otra persona antes de salir.';
 end if;
 delete from public.chat_grupo_miembros where grupo_id=p_grupo and usuario_id=auth.uid();
end $function$;
alter function public.chat_grupo_salir(bigint) owner to "postgres";
revoke all on function public.chat_grupo_salir(bigint) from public,anon,authenticated,service_role;
grant execute on function public.chat_grupo_salir(bigint) to "postgres";
grant execute on function public.chat_grupo_salir(bigint) to "authenticated";
grant execute on function public.chat_grupo_salir(bigint) to "service_role";
CREATE OR REPLACE FUNCTION public.chat_grupo_historial(p_grupo bigint, p_antes bigint DEFAULT NULL::bigint)
 RETURNS TABLE(id bigint, grupo_id bigint, remitente uuid, autor text, contenido text, creado_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.chat_grupo_miembro(p_grupo) then raise exception 'Únete al grupo para ver sus mensajes.'; end if;
  return query
  select x.id,x.grupo_id,x.remitente,p.nombre,x.contenido,x.creado_at
    from public.chat_grupo_mensajes x join public.asis_perfiles p on p.id=x.remitente
   where x.grupo_id=p_grupo and (p_antes is null or x.id<p_antes)
   order by x.id desc limit 50;
end;
$function$;
alter function public.chat_grupo_historial(bigint,bigint) owner to "postgres";
revoke all on function public.chat_grupo_historial(bigint,bigint) from public,anon,authenticated,service_role;
grant execute on function public.chat_grupo_historial(bigint,bigint) to "postgres";
grant execute on function public.chat_grupo_historial(bigint,bigint) to "authenticated";
grant execute on function public.chat_grupo_historial(bigint,bigint) to "service_role";
CREATE OR REPLACE FUNCTION public.chat_grupo_leer(p_grupo bigint, p_hasta bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.chat_grupo_miembro(p_grupo) then raise exception 'Únete al grupo para ver sus mensajes.'; end if;
  update public.chat_grupo_miembros m
     set leido_hasta=greatest(m.leido_hasta,least(p_hasta,coalesce((select max(x.id) from public.chat_grupo_mensajes x where x.grupo_id=p_grupo),0)))
   where m.grupo_id=p_grupo and m.usuario_id=auth.uid();
end;
$function$;
alter function public.chat_grupo_leer(bigint,bigint) owner to "postgres";
revoke all on function public.chat_grupo_leer(bigint,bigint) from public,anon,authenticated,service_role;
grant execute on function public.chat_grupo_leer(bigint,bigint) to "postgres";
grant execute on function public.chat_grupo_leer(bigint,bigint) to "authenticated";
grant execute on function public.chat_grupo_leer(bigint,bigint) to "service_role";
CREATE OR REPLACE FUNCTION public.chat_grupos()
 RETURNS TABLE(id bigint, nombre text, miembros bigint, unido boolean, ultimo text, ultimo_autor text, ultimo_remitente uuid, ultimo_at timestamp with time zone, no_leidos bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  return query
  select g.id,g.nombre,
    (select count(*) from public.chat_grupo_miembros m join public.asis_perfiles p on p.id=m.usuario_id
      where m.grupo_id=g.id and p.activo),
    yo.usuario_id is not null,
    case when yo.usuario_id is not null then u.contenido end,
    case when yo.usuario_id is not null then u.autor end,
    case when yo.usuario_id is not null then u.remitente end,
    case when yo.usuario_id is not null then u.creado_at end,
    case when yo.usuario_id is null then 0::bigint else
      (select count(*) from public.chat_grupo_mensajes n
        where n.grupo_id=g.id and n.remitente<>auth.uid() and n.id>yo.leido_hasta) end
  from public.chat_grupos g
  left join public.chat_grupo_miembros yo on yo.grupo_id=g.id and yo.usuario_id=auth.uid()
  left join lateral (
    select x.contenido,p.nombre as autor,x.remitente,x.creado_at
      from public.chat_grupo_mensajes x join public.asis_perfiles p on p.id=x.remitente
     where x.grupo_id=g.id order by x.id desc limit 1
  ) u on true
  where g.activo and (not g.privado or yo.usuario_id is not null)
  order by g.orden,g.nombre;
end;
$function$;
alter function public.chat_grupos() owner to "postgres";
revoke all on function public.chat_grupos() from public,anon,authenticated,service_role;
grant execute on function public.chat_grupos() to "postgres";
grant execute on function public.chat_grupos() to "authenticated";
grant execute on function public.chat_grupos() to "service_role";
CREATE OR REPLACE FUNCTION public.chat_grupo_unirse(p_grupo bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
 if not exists(select 1 from public.chat_grupos where id=p_grupo and activo and (not privado or public.chat_grupo_miembro(id))) then
  raise exception 'Este grupo es privado o no está disponible.';
 end if;
 insert into public.chat_grupo_miembros(grupo_id,usuario_id,leido_hasta)
 values(p_grupo,auth.uid(),coalesce((select max(id) from public.chat_grupo_mensajes where grupo_id=p_grupo),0))
 on conflict do nothing;
end $function$;
alter function public.chat_grupo_unirse(bigint) owner to "postgres";
revoke all on function public.chat_grupo_unirse(bigint) from public,anon,authenticated,service_role;
grant execute on function public.chat_grupo_unirse(bigint) to "postgres";
grant execute on function public.chat_grupo_unirse(bigint) to "authenticated";
grant execute on function public.chat_grupo_unirse(bigint) to "service_role";
CREATE OR REPLACE FUNCTION public.chat_grupo_enviar(p_grupo bigint, p_contenido text, p_cliente_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_mensaje public.chat_grupo_mensajes; v_texto text:=btrim(p_contenido);
begin
  if not public.chat_grupo_miembro(p_grupo) then raise exception 'Únete al grupo para enviar mensajes.'; end if;
  if p_cliente_id is null or v_texto is null or char_length(v_texto) not between 1 and 4000 then
    raise exception 'Escribe un mensaje de hasta 4000 caracteres.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,742));
  select * into v_mensaje from public.chat_grupo_mensajes where remitente=auth.uid() and cliente_id=p_cliente_id;
  if found then
    if v_mensaje.grupo_id<>p_grupo or v_mensaje.contenido<>v_texto then
      raise exception 'Este identificador ya corresponde a otro mensaje.';
    end if;
  else
    if (select count(*) from public.chat_grupo_mensajes
         where remitente=auth.uid() and creado_at>clock_timestamp()-interval '1 minute')>=30 then
      raise exception 'Has enviado muchos mensajes. Espera un minuto y vuelve a intentar.';
    end if;
    insert into public.chat_grupo_mensajes(grupo_id,remitente,cliente_id,contenido)
      values(p_grupo,auth.uid(),p_cliente_id,v_texto) returning * into v_mensaje;
  end if;
  return jsonb_build_object('id',v_mensaje.id,'grupo_id',v_mensaje.grupo_id,'remitente',v_mensaje.remitente,
    'autor',(select nombre from public.asis_perfiles where id=v_mensaje.remitente),
    'contenido',v_mensaje.contenido,'creado_at',v_mensaje.creado_at);
end;
$function$;
alter function public.chat_grupo_enviar(bigint,text,uuid) owner to "postgres";
revoke all on function public.chat_grupo_enviar(bigint,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.chat_grupo_enviar(bigint,text,uuid) to "postgres";
grant execute on function public.chat_grupo_enviar(bigint,text,uuid) to "authenticated";
grant execute on function public.chat_grupo_enviar(bigint,text,uuid) to "service_role";
CREATE OR REPLACE FUNCTION public.chat_v2_mensaje(p_grupo boolean, p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;
alter function public.chat_v2_mensaje(boolean,bigint) owner to "postgres";
revoke all on function public.chat_v2_mensaje(boolean,bigint) from public,anon,authenticated,service_role;
grant execute on function public.chat_v2_mensaje(boolean,bigint) to "postgres";
grant execute on function public.chat_v2_mensaje(boolean,bigint) to "service_role";
CREATE OR REPLACE FUNCTION public.chat_v2_decorar(p_grupo boolean, p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;
alter function public.chat_v2_decorar(boolean,bigint) owner to "postgres";
revoke all on function public.chat_v2_decorar(boolean,bigint) from public,anon,authenticated,service_role;
grant execute on function public.chat_v2_decorar(boolean,bigint) to "postgres";
grant execute on function public.chat_v2_decorar(boolean,bigint) to "service_role";
CREATE OR REPLACE FUNCTION public.chat_capacidades()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
 return '{"version":2,"grupos":true,"archivos":true,"administrar_grupos":true}'::jsonb;
end $function$;
alter function public.chat_capacidades() owner to "postgres";
revoke all on function public.chat_capacidades() from public,anon,authenticated,service_role;
grant execute on function public.chat_capacidades() to "postgres";
grant execute on function public.chat_capacidades() to "service_role";
grant execute on function public.chat_capacidades() to "authenticated";
CREATE OR REPLACE FUNCTION public.chat_v2_accion(p_grupo boolean, p_id bigint, p_accion text, p_texto text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;
alter function public.chat_v2_accion(boolean,bigint,text,text) owner to "postgres";
revoke all on function public.chat_v2_accion(boolean,bigint,text,text) from public,anon,authenticated,service_role;
grant execute on function public.chat_v2_accion(boolean,bigint,text,text) to "postgres";
grant execute on function public.chat_v2_accion(boolean,bigint,text,text) to "service_role";
grant execute on function public.chat_v2_accion(boolean,bigint,text,text) to "authenticated";
CREATE OR REPLACE FUNCTION public.chat_v2_historial(p_contacto uuid DEFAULT NULL::uuid, p_grupo bigint DEFAULT NULL::bigint, p_antes bigint DEFAULT NULL::bigint, p_buscar text DEFAULT ''::text)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;
alter function public.chat_v2_historial(uuid,bigint,bigint,text) owner to "postgres";
revoke all on function public.chat_v2_historial(uuid,bigint,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.chat_v2_historial(uuid,bigint,bigint,text) to "postgres";
grant execute on function public.chat_v2_historial(uuid,bigint,bigint,text) to "service_role";
grant execute on function public.chat_v2_historial(uuid,bigint,bigint,text) to "authenticated";
CREATE OR REPLACE FUNCTION public.chat_archivo_visible(p_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select public.chat_activo() and (
 exists(select 1 from public.chat_mensajes where archivo_path=p_path and eliminado_at is null and auth.uid() in(remitente,destinatario))
 or exists(select 1 from public.chat_grupo_mensajes where archivo_path=p_path and eliminado_at is null and public.chat_grupo_miembro(grupo_id)));
$function$;
alter function public.chat_archivo_visible(text) owner to "postgres";
revoke all on function public.chat_archivo_visible(text) from public,anon,authenticated,service_role;
grant execute on function public.chat_archivo_visible(text) to "postgres";
grant execute on function public.chat_archivo_visible(text) to "service_role";
grant execute on function public.chat_archivo_visible(text) to "authenticated";
CREATE OR REPLACE FUNCTION public.chat_v2_enviar(p_cliente_id uuid, p_contenido text, p_contacto uuid DEFAULT NULL::uuid, p_grupo bigint DEFAULT NULL::bigint, p_respuesta bigint DEFAULT NULL::bigint, p_archivo text DEFAULT NULL::text, p_nombre text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;
alter function public.chat_v2_enviar(uuid,text,uuid,bigint,bigint,text,text) owner to "postgres";
revoke all on function public.chat_v2_enviar(uuid,text,uuid,bigint,bigint,text,text) from public,anon,authenticated,service_role;
grant execute on function public.chat_v2_enviar(uuid,text,uuid,bigint,bigint,text,text) to "postgres";
grant execute on function public.chat_v2_enviar(uuid,text,uuid,bigint,bigint,text,text) to "service_role";
grant execute on function public.chat_v2_enviar(uuid,text,uuid,bigint,bigint,text,text) to "authenticated";
CREATE OR REPLACE FUNCTION public.chat_grupo_crear(p_nombre text, p_miembros uuid[])
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint;
begin
 if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
 if char_length(btrim(coalesce(p_nombre,''))) not between 1 and 60 then raise exception 'Escribe un nombre de hasta 60 caracteres.'; end if;
 if cardinality(p_miembros) is null or cardinality(p_miembros) not between 1 and 100
  or exists(select 1 from unnest(p_miembros) x where not exists(select 1 from public.asis_perfiles where id=x and activo)) then
  raise exception 'Selecciona entre 1 y 100 personas activas.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,743));
 if (select count(*) from public.chat_grupos where creador=auth.uid() and activo)>=30 then raise exception 'Ya administras 30 grupos activos.'; end if;
 insert into public.chat_grupos(nombre,privado,creador) values(btrim(p_nombre),true,auth.uid()) returning id into v_id;
 insert into public.chat_grupo_miembros(grupo_id,usuario_id)
 select v_id,x from (select distinct unnest(p_miembros||array[auth.uid()]) as x) t;
 return v_id;
exception when unique_violation then raise exception 'Ya existe un grupo con ese nombre. Elige otro.';
end $function$;
alter function public.chat_grupo_crear(text,uuid[]) owner to "postgres";
revoke all on function public.chat_grupo_crear(text,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.chat_grupo_crear(text,uuid[]) to "postgres";
grant execute on function public.chat_grupo_crear(text,uuid[]) to "service_role";
grant execute on function public.chat_grupo_crear(text,uuid[]) to "authenticated";
CREATE OR REPLACE FUNCTION public.chat_grupo_detalle(p_grupo bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if not public.chat_grupo_miembro(p_grupo) then raise exception 'No perteneces a este grupo.'; end if;
 return (select jsonb_build_object('id',g.id,'nombre',g.nombre,'creador',g.creador,'privado',g.privado,
  'miembros',(select jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre,'activo',p.activo) order by p.nombre)
    from public.chat_grupo_miembros m join public.asis_perfiles p on p.id=m.usuario_id where m.grupo_id=g.id))
  from public.chat_grupos g where g.id=p_grupo);
end $function$;
alter function public.chat_grupo_detalle(bigint) owner to "postgres";
revoke all on function public.chat_grupo_detalle(bigint) from public,anon,authenticated,service_role;
grant execute on function public.chat_grupo_detalle(bigint) to "postgres";
grant execute on function public.chat_grupo_detalle(bigint) to "service_role";
grant execute on function public.chat_grupo_detalle(bigint) to "authenticated";
CREATE OR REPLACE FUNCTION public.chat_grupo_administrar(p_grupo bigint, p_accion text, p_usuario uuid DEFAULT NULL::uuid, p_nombre text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_owner uuid;
begin
 select creador into v_owner from public.chat_grupos where id=p_grupo and activo for update;
 if not public.chat_grupo_miembro(p_grupo) or v_owner is distinct from auth.uid() then raise exception 'Solo quien administra este grupo puede cambiarlo.'; end if;
 if p_accion='nombre' then
  if char_length(btrim(coalesce(p_nombre,''))) not between 1 and 60 then raise exception 'Escribe un nombre de hasta 60 caracteres.'; end if;
  update public.chat_grupos set nombre=btrim(p_nombre) where id=p_grupo;
 elsif p_accion='agregar' then
  if not exists(select 1 from public.asis_perfiles where id=p_usuario and activo) then raise exception 'Cuenta no disponible.'; end if;
  if (select count(*) from public.chat_grupo_miembros where grupo_id=p_grupo)>=100 then raise exception 'El grupo llegó a 100 integrantes.'; end if;
  insert into public.chat_grupo_miembros(grupo_id,usuario_id,leido_hasta)
   values(p_grupo,p_usuario,coalesce((select max(id) from public.chat_grupo_mensajes where grupo_id=p_grupo),0)) on conflict do nothing;
 elsif p_accion='quitar' then
  if p_usuario=auth.uid() then raise exception 'Transfiere la administración antes de salir.'; end if;
  delete from public.chat_grupo_miembros where grupo_id=p_grupo and usuario_id=p_usuario;
 elsif p_accion='transferir' then
  if not exists(select 1 from public.chat_grupo_miembros m join public.asis_perfiles p on p.id=m.usuario_id where m.grupo_id=p_grupo and m.usuario_id=p_usuario and p.activo) then raise exception 'Elige una persona activa del grupo.'; end if;
  update public.chat_grupos set creador=p_usuario where id=p_grupo;
 else raise exception 'Acción no disponible.';
 end if;
exception when unique_violation then raise exception 'Ya existe un grupo con ese nombre.';
end $function$;
alter function public.chat_grupo_administrar(bigint,text,uuid,text) owner to "postgres";
revoke all on function public.chat_grupo_administrar(bigint,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.chat_grupo_administrar(bigint,text,uuid,text) to "postgres";
grant execute on function public.chat_grupo_administrar(bigint,text,uuid,text) to "service_role";
grant execute on function public.chat_grupo_administrar(bigint,text,uuid,text) to "authenticated";
create policy "chat_imagen_leer" on "storage"."objects" as PERMISSIVE for SELECT to "authenticated" using (((bucket_id = 'chat-imagenes'::text) AND chat_imagen_visible(name)));
create policy "chat_imagen_subir" on "storage"."objects" as PERMISSIVE for INSERT to "authenticated" with check (((bucket_id = 'chat-imagenes'::text) AND chat_activo() AND (name ~ (('^'::text || (auth.uid())::text) || '/[0-9a-f-]{36}\.jpg$'::text))));
create policy "perfil fotos: directorio chat" on "storage"."objects" as PERMISSIVE for SELECT to "authenticated" using (((bucket_id = 'perfil-fotos'::text) AND chat_puede_ver_foto(name)));
create policy "chat_archivo_leer" on "storage"."objects" as PERMISSIVE for SELECT to "authenticated" using (((bucket_id = 'chat-archivos'::text) AND chat_archivo_visible(name)));
create policy "chat_archivo_subir" on "storage"."objects" as PERMISSIVE for INSERT to "authenticated" with check (((bucket_id = 'chat-archivos'::text) AND chat_activo() AND (name ~ (('^'::text || (auth.uid())::text) || '/[0-9a-f-]{36}$'::text))));
create policy "admin fotos: directorio chat" on "storage"."objects" as PERMISSIVE for SELECT to "authenticated" using (((bucket_id = 'admin-perfil-fotos'::text) AND chat_puede_ver_foto_admin(name)));
create policy "asis_notificaciones_propias" on "public"."asis_notificaciones" as PERMISSIVE for SELECT to "authenticated" using ((colaborador_id = dash_colab()));
create policy "chat_eventos_propios" on "public"."chat_eventos" as PERMISSIVE for SELECT to "authenticated" using ((chat_activo() AND (destinatario = auth.uid())));
create policy "asis_pausas_activas_select" on "public"."asis_pausas_activas" as PERMISSIVE for SELECT to "authenticated" using (((asis_rol() = 'direccion'::text) OR (colaborador_id = dash_colab())));
create policy "chat_grupo_eventos_propios" on "public"."chat_grupo_eventos" as PERMISSIVE for SELECT to "authenticated" using ((chat_activo() AND (destinatario = auth.uid())));
CREATE TRIGGER asis_entrega_revision_notificar AFTER INSERT ON public.asis_entrega_revisiones FOR EACH ROW EXECUTE FUNCTION dash_notificar_revision_trg();
CREATE TRIGGER asis_asignacion_notificar AFTER INSERT ON public.asis_asignaciones_diarias FOR EACH ROW EXECUTE FUNCTION dash_notificar_asignacion_trg();
CREATE TRIGGER chat_mensajes_emitir_evento AFTER INSERT ON public.chat_mensajes FOR EACH ROW EXECUTE FUNCTION chat_emitir_evento_trg();
CREATE TRIGGER chat_grupo_mensajes_evento AFTER INSERT ON public.chat_grupo_mensajes FOR EACH ROW EXECUTE FUNCTION chat_grupo_evento_trg();
alter publication "supabase_realtime" add table "public"."asis_notificaciones";
alter publication "supabase_realtime" add table "public"."chat_eventos";
alter publication "supabase_realtime" add table "public"."chat_grupo_eventos";
grant select on table public."asis_notificaciones" to authenticated;
grant select on table public."chat_eventos" to authenticated;
grant select on table public."chat_grupo_eventos" to authenticated;
grant select on table public."asis_pausas_activas" to authenticated;
grant select,update,usage on sequence public."asis_notificaciones_id_seq" to anon,authenticated;
grant select,update,usage on sequence public."chat_grupos_id_seq" to anon,authenticated;
grant select,update,usage on sequence public."chat_grupo_mensajes_id_seq" to anon,authenticated;
grant select,update,usage on sequence public."chat_mensajes_id_seq" to anon,authenticated;
notify pgrst, 'reload schema';
commit;
