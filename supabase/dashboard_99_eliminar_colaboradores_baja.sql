-- Ejecutar después de dashboard_98. No elimina personas al instalarse.
-- La eliminación ocurre únicamente mediante la acción confirmada del panel.
begin;
create or replace function public.dash_admin_eliminar_colaborador(p_colab bigint,p_nombre text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_persona public.asis_colaboradores; v_tabla text; v_pendiente boolean;
begin
  if auth.uid() is null or not coalesce(public.asis_puede_editar(),false)
    or not coalesce(public.dash_sesion_vigente(),false) then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  perform pg_advisory_xact_lock(p_colab);
  select * into v_persona from public.asis_colaboradores where id=p_colab for update;
  if not found then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  if v_persona.activo is distinct from false then return jsonb_build_object('ok',false,'motivo','activo'); end if;
  if p_nombre is distinct from v_persona.nombre then return jsonb_build_object('ok',false,'motivo','confirmacion'); end if;
  perform 1 from public.asis_perfiles where colaborador_id=p_colab for update;
  if exists(select 1 from public.asis_perfiles where colaborador_id=p_colab and (acceso_panel or id=auth.uid())) then
    return jsonb_build_object('ok',false,'motivo','cuenta_admin');
  end if;
  -- No perder rutas de archivos que otra operación aún debe limpiar en Storage.
  if to_regclass('public.asis_facebook_archivos_borrar') is not null then
    execute 'select exists(select 1 from public.asis_facebook_archivos_borrar where colaborador_id=$1)' into v_pendiente using p_colab;
    if v_pendiente then return jsonb_build_object('ok',false,'motivo','archivos_pendientes'); end if;
  end if;
  if to_regclass('public.asis_asignacion_archivos_borrar') is not null then
    execute 'select exists(select 1 from public.asis_asignacion_archivos_borrar q join public.asis_asignaciones_diarias a on a.id=q.asignacion_id where a.colaborador_id=$1)' into v_pendiente using p_colab;
    if v_pendiente then return jsonb_build_object('ok',false,'motivo','archivos_pendientes'); end if;
  end if;
  update public.dash_sesiones set revocada_at=now()
    where perfil_id in(select id from public.asis_perfiles where colaborador_id=p_colab) and revocada_at is null;
  update public.asis_perfiles set activo=false where colaborador_id=p_colab;
  -- Dependencias sin ON DELETE CASCADE y referencias entre entregas.
  foreach v_tabla in array array['asis_entrega_reemplazos','asis_entradas_direccion','asis_correcciones_modalidad','asis_descansos_auditoria'] loop
    if to_regclass('public.'||v_tabla) is not null then
      execute format('delete from public.%I where colaborador_id=$1',v_tabla) using p_colab;
    end if;
  end loop;
  if to_regclass('public.asis_cierre_regularizaciones_auto') is not null then
    execute 'delete from public.asis_cierre_regularizaciones_auto where registro_id in(select id from public.asis_registros where colaborador_id=$1) or entrega_salida_id in(select id from public.asis_entregas_diarias where colaborador_id=$1)' using p_colab;
  end if;
  -- Las FK existentes eliminan los registros propios y desvinculan el perfil.
  -- No elimina auth.users, archivos de Storage ni registros de otros colaboradores.
  delete from public.asis_colaboradores where id=p_colab;
  return jsonb_build_object('ok',true);
exception when foreign_key_violation then
  -- El bloque entero se revierte, incluidas la desactivación y las limpiezas.
  return jsonb_build_object('ok',false,'motivo','referencias');
end;
$$;
revoke all on function public.dash_admin_eliminar_colaborador(bigint,text) from public,anon;
grant execute on function public.dash_admin_eliminar_colaborador(bigint,text) to authenticated;
notify pgrst,'reload schema';
commit;
