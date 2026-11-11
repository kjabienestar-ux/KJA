-- KJA-035. PREPARADA; aplicar solo tras frontend publicado y revisión grill-me.
-- Conserva datos y buckets; no elimina tablas ni modifica asistencia.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
do $preflight$
declare r record;
begin
  for r in select * from (values
('public.dash_marcar_notificaciones_revision(bigint[])','5064287a9300ae6483048a3d9942eaae'),
('public.chat_contactos()','aa7ff3d58f3380ec31446a5571de760a'),
('public.chat_emitir_evento_trg()','b59be65dfa72d404a95e6c3ac98cd190'),
('public.chat_imagen_visible(text)','ea3d7abc5af3c2ad46d2c023a53cca01'),
('public.dash_eliminar_notificacion_revision(bigint)','4d6f43862a0f1d5c272ba321c0544881'),
('public.chat_puede_ver_foto(text)','068de2e1aefca288a6b545407c7aae75'),
('public.chat_fotos()','9bafb614b2175309989253191ceb1a92'),
('public.chat_puede_ver_foto_admin(text)','708543a552663e8a93af361ec06e14e7'),
('public.chat_cuenta_colaborador(bigint)','a4c730f9e869c9b224717dd8ec04ba4d'),
('public.chat_activo()','8184a12abfbd55a56b37fbe401a5ec80'),
('public.chat_historial(uuid,bigint)','072c13d4b125c8629a89ac181fac1302'),
('public.chat_enviar(uuid,text,uuid)','a0cabd724e7796a5e2e2a642d670bb38'),
('public.dash_notificar_revision_trg()','4e0b501aca6b9811c114cb90cbb8b911'),
('public.dash_notificar_asignacion_trg()','95dd15557fda551e0860f99a66e3392e'),
('public.chat_leer(uuid,bigint)','b07ffced91ad8b30db555b9a20a9b7f7'),
('public.dash_admin_enviar_mensaje(bigint,text,text)','a045e615a49053637f8edd549d7fe0ae'),
('public.dash_mis_notificaciones_revision(integer)','ea7f7e72a694f4c664467294a8fd3038'),
('public.chat_presencia(uuid,boolean)','57953e42988b6bbaba35e833183a58c8'),
('public.chat_enviar_imagen(uuid,text,uuid,text)','bca113d0b1c79de7c40dd88ceb8dcbfe'),
('public.dash_mis_pausas()','65a3bf61003d1bcadc997b645d58f190'),
('public.dash_admin_reset_pausas(bigint,date)','ec1c05fb65b4f04bf6d6c3056d012300'),
('public.dash_admin_reset_todas_pausas(date)','246a356c06c77b461663f291abea28df'),
('public.dash_pausas_estado(bigint)','1e185c66602d4e04338788d66f8577e1'),
('public.dash_registrar_pausa(text)','68bfb798543206746154a7f5aeeb349c'),
('public.dash_iniciar_pausa(text)','eb5db7fc76fbfc4404b8a9961fa540cf'),
('public.dash_cerrar_pausa(uuid,boolean)','f55ac49ea8d6b422c060109fa1bba17f'),
('public.dash_admin_pausas_diarias(date)','7add48a950e473b56c3de38f4d2454bf'),
('public.chat_fotos_perfiles()','fb4c41edfc43a01835a187b58853811c'),
('public.chat_grupo_evento_trg()','f8346fad86aa80126f55ffbdccc82eed'),
('public.chat_grupo_miembro(bigint)','fb0f1e0644047e1a085872fa558396c3'),
('public.chat_grupo_salir(bigint)','5831149d533084e0a3415563d8d23dc7'),
('public.chat_grupo_historial(bigint,bigint)','bec27be0320492b3d26e42902a3f7daa'),
('public.chat_grupo_leer(bigint,bigint)','e4f513ad06258871621e9663cc79e7a4'),
('public.chat_grupos()','b8904a28ea51968b7b0dafdc4fe1fad8'),
('public.chat_grupo_unirse(bigint)','aff43f27fef33744c803597a55f7fe4b'),
('public.chat_grupo_enviar(bigint,text,uuid)','85f17f21af06510acce2d5ae01263f06'),
('public.chat_v2_mensaje(boolean,bigint)','58b3d2ce07cad6e4bddb005395426a76'),
('public.chat_v2_decorar(boolean,bigint)','cd929297f08c116b7c9da997108487e9'),
('public.chat_capacidades()','ec89763a94aa04e69b637732e80df6ef'),
('public.chat_v2_accion(boolean,bigint,text,text)','0705a6d85d20ffac659c2b3efcca63d0'),
('public.chat_v2_historial(uuid,bigint,bigint,text)','d64a433b3b483d3b31a52fd8d0869b59'),
('public.chat_archivo_visible(text)','dc9b82c255d6fdaaf9f808d380ff6339'),
('public.chat_v2_enviar(uuid,text,uuid,bigint,bigint,text,text)','25f28173f7fa1bd77f55db9e018712ac'),
('public.chat_grupo_crear(text,uuid[])','d3b01eb0cd02ea573e80de7e8e972ef4'),
('public.chat_grupo_detalle(bigint)','a14233813b8f434ff37c3878db4ee19a'),
('public.chat_grupo_administrar(bigint,text,uuid,text)','cecb87a037dabf3dd26cd8a309faf632')) as expected(signature,hash) loop
    if to_regprocedure(r.signature) is null or md5(pg_get_functiondef(to_regprocedure(r.signature))) <> r.hash then
      raise exception 'KJA-035: definición cambió o falta: %. Rehacer inventario.',r.signature;
    end if;
  end loop;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname ~ '^(chat_|dash_.*(pausa|notific)|dash_admin_enviar_mensaje)'
    and p.oid not in (select to_regprocedure(sig)::oid from unnest(array['public.dash_marcar_notificaciones_revision(bigint[])','public.chat_contactos()','public.chat_emitir_evento_trg()','public.chat_imagen_visible(text)','public.dash_eliminar_notificacion_revision(bigint)','public.chat_puede_ver_foto(text)','public.chat_fotos()','public.chat_puede_ver_foto_admin(text)','public.chat_cuenta_colaborador(bigint)','public.chat_activo()','public.chat_historial(uuid,bigint)','public.chat_enviar(uuid,text,uuid)','public.dash_notificar_revision_trg()','public.dash_notificar_asignacion_trg()','public.chat_leer(uuid,bigint)','public.dash_admin_enviar_mensaje(bigint,text,text)','public.dash_mis_notificaciones_revision(integer)','public.chat_presencia(uuid,boolean)','public.chat_enviar_imagen(uuid,text,uuid,text)','public.dash_mis_pausas()','public.dash_admin_reset_pausas(bigint,date)','public.dash_admin_reset_todas_pausas(date)','public.dash_pausas_estado(bigint)','public.dash_registrar_pausa(text)','public.dash_iniciar_pausa(text)','public.dash_cerrar_pausa(uuid,boolean)','public.dash_admin_pausas_diarias(date)','public.chat_fotos_perfiles()','public.chat_grupo_evento_trg()','public.chat_grupo_miembro(bigint)','public.chat_grupo_salir(bigint)','public.chat_grupo_historial(bigint,bigint)','public.chat_grupo_leer(bigint,bigint)','public.chat_grupos()','public.chat_grupo_unirse(bigint)','public.chat_grupo_enviar(bigint,text,uuid)','public.chat_v2_mensaje(boolean,bigint)','public.chat_v2_decorar(boolean,bigint)','public.chat_capacidades()','public.chat_v2_accion(boolean,bigint,text,text)','public.chat_v2_historial(uuid,bigint,bigint,text)','public.chat_archivo_visible(text)','public.chat_v2_enviar(uuid,text,uuid,bigint,bigint,text,text)','public.chat_grupo_crear(text,uuid[])','public.chat_grupo_detalle(bigint)','public.chat_grupo_administrar(bigint,text,uuid,text)']) as sig)) then
    raise exception 'KJA-035: función exclusiva no inventariada';
  end if;
end;
$preflight$;
drop trigger "asis_entrega_revision_notificar" on public."asis_entrega_revisiones";
drop trigger "asis_asignacion_notificar" on public."asis_asignaciones_diarias";
drop trigger "chat_mensajes_emitir_evento" on public."chat_mensajes";
drop trigger "chat_grupo_mensajes_evento" on public."chat_grupo_mensajes";
drop policy "chat_imagen_leer" on "storage"."objects";
drop policy "chat_imagen_subir" on "storage"."objects";
drop policy "perfil fotos: directorio chat" on "storage"."objects";
drop policy "chat_archivo_leer" on "storage"."objects";
drop policy "chat_archivo_subir" on "storage"."objects";
drop policy "admin fotos: directorio chat" on "storage"."objects";
drop policy "asis_notificaciones_propias" on "public"."asis_notificaciones";
drop policy "chat_eventos_propios" on "public"."chat_eventos";
drop policy "asis_pausas_activas_select" on "public"."asis_pausas_activas";
drop policy "chat_grupo_eventos_propios" on "public"."chat_grupo_eventos";
alter publication "supabase_realtime" drop table "public"."asis_notificaciones";
alter publication "supabase_realtime" drop table "public"."chat_eventos";
alter publication "supabase_realtime" drop table "public"."chat_grupo_eventos";
revoke all privileges on table public."asis_notificaciones" from public,anon,authenticated;
revoke all privileges on table public."chat_grupo_miembros" from public,anon,authenticated;
revoke all privileges on table public."chat_grupos" from public,anon,authenticated;
revoke all privileges on table public."chat_sesiones" from public,anon,authenticated;
revoke all privileges on table public."chat_mensajes" from public,anon,authenticated;
revoke all privileges on table public."chat_direccion_contactos" from public,anon,authenticated;
revoke all privileges on table public."chat_eventos" from public,anon,authenticated;
revoke all privileges on table public."chat_grupo_eventos" from public,anon,authenticated;
revoke all privileges on table public."chat_reacciones" from public,anon,authenticated;
revoke all privileges on table public."chat_grupo_mensajes" from public,anon,authenticated;
revoke all privileges on table public."asis_pausas_activas" from public,anon,authenticated;
revoke all privileges on sequence public."asis_notificaciones_id_seq" from public,anon,authenticated;
revoke all privileges on sequence public."chat_grupos_id_seq" from public,anon,authenticated;
revoke all privileges on sequence public."chat_grupo_mensajes_id_seq" from public,anon,authenticated;
revoke all privileges on sequence public."chat_mensajes_id_seq" from public,anon,authenticated;
-- RESTRICT y transacción: una dependencia inesperada aborta todo el retiro.
do $retire$
declare pending text[] := array['public.dash_marcar_notificaciones_revision(bigint[])','public.chat_contactos()','public.chat_emitir_evento_trg()','public.chat_imagen_visible(text)','public.dash_eliminar_notificacion_revision(bigint)','public.chat_puede_ver_foto(text)','public.chat_fotos()','public.chat_puede_ver_foto_admin(text)','public.chat_cuenta_colaborador(bigint)','public.chat_activo()','public.chat_historial(uuid,bigint)','public.chat_enviar(uuid,text,uuid)','public.dash_notificar_revision_trg()','public.dash_notificar_asignacion_trg()','public.chat_leer(uuid,bigint)','public.dash_admin_enviar_mensaje(bigint,text,text)','public.dash_mis_notificaciones_revision(integer)','public.chat_presencia(uuid,boolean)','public.chat_enviar_imagen(uuid,text,uuid,text)','public.dash_mis_pausas()','public.dash_admin_reset_pausas(bigint,date)','public.dash_admin_reset_todas_pausas(date)','public.dash_pausas_estado(bigint)','public.dash_registrar_pausa(text)','public.dash_iniciar_pausa(text)','public.dash_cerrar_pausa(uuid,boolean)','public.dash_admin_pausas_diarias(date)','public.chat_fotos_perfiles()','public.chat_grupo_evento_trg()','public.chat_grupo_miembro(bigint)','public.chat_grupo_salir(bigint)','public.chat_grupo_historial(bigint,bigint)','public.chat_grupo_leer(bigint,bigint)','public.chat_grupos()','public.chat_grupo_unirse(bigint)','public.chat_grupo_enviar(bigint,text,uuid)','public.chat_v2_mensaje(boolean,bigint)','public.chat_v2_decorar(boolean,bigint)','public.chat_capacidades()','public.chat_v2_accion(boolean,bigint,text,text)','public.chat_v2_historial(uuid,bigint,bigint,text)','public.chat_archivo_visible(text)','public.chat_v2_enviar(uuid,text,uuid,bigint,bigint,text,text)','public.chat_grupo_crear(text,uuid[])','public.chat_grupo_detalle(bigint)','public.chat_grupo_administrar(bigint,text,uuid,text)']; next_pending text[]; sig text; progress boolean;
begin
  loop
    next_pending := array[]::text[]; progress := false;
    foreach sig in array pending loop
      begin
        execute 'drop function '||sig||' restrict'; progress := true;
      exception when dependent_objects_still_exist then
        next_pending := array_append(next_pending,sig);
      end;
    end loop;
    exit when cardinality(next_pending)=0;
    if not progress then raise exception 'KJA-035: dependencias compartidas: %',next_pending; end if;
    pending := next_pending;
  end loop;
end;
$retire$;
notify pgrst, 'reload schema';
commit;
