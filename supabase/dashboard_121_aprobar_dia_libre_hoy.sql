-- Ejecutar después de dashboard_94 (y las migraciones posteriores instaladas).
-- Permite resolver un día libre pendiente durante el propio día solicitado.
-- Crear solicitudes y proponer fechas alternativas sigue exigiendo fechas futuras.
-- No aprueba solicitudes ni modifica saldos al ejecutar esta migración.
begin;

create or replace function public.asis_validar_aprobacion_libre(p_colab bigint,p_fecha date,p_excluir bigint)
returns text language plpgsql security definer set search_path=public as $$
declare c public.asis_colaboradores; hoy date:=(now() at time zone 'America/Lima')::date;
begin
  select * into c from public.asis_colaboradores where id=p_colab for update;
  if not found or not c.activo then return 'colaborador'; end if;
  if p_fecha<hoy then return 'dia_libre_fecha_vencida'; end if;
  if p_fecha is null or p_fecha>hoy+180 or extract(isodow from p_fecha) not in(2,3,4) then return 'dia_no_permitido'; end if;
  if p_fecha<c.contrato_inicio or not coalesce(public.asis_labora(c,p_fecha),false) then return 'no_laborable'; end if;
  if exists(select 1 from public.asis_solicitudes_personales s where s.colaborador_id=p_colab
    and s.id is distinct from p_excluir and s.tipo='dia_libre' and s.estado in('pendiente','aprobada')
    and (p_fecha between s.fecha_inicio and s.fecha_fin or (s.contra_estado='pendiente' and s.contra_fecha=p_fecha))) then return 'duplicada'; end if;
  return null;
end $$;

create or replace function public.asis_validar_resolucion_libre()
returns trigger language plpgsql security definer set search_path=public as $$
declare motivo text;
begin
  if new.descanso_programado and new.tipo='dia_libre' and old.estado='pendiente' then
    if new.estado='aprobada' then
      if new.contra_estado='pendiente' then raise exception 'contraoferta_pendiente'; end if;
      -- La aceptación de una contraoferta también pasa por este trigger.
      -- dash_responder_contraoferta mantiene su validación de fecha futura.
      motivo:=public.asis_validar_aprobacion_libre(new.colaborador_id,new.fecha_inicio,new.id);
      if motivo is not null then raise exception '%',motivo; end if;
    elsif new.estado='rechazada' and new.contra_estado='pendiente' then new.contra_estado:='rechazada'; end if;
  end if;
  return new;
end $$;

create or replace function public.asis_programar_dia_libre_aprobado()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.tipo='dia_libre' and new.descanso_programado and new.estado='aprobada' and old.estado='pendiente' then
    if new.fecha_inicio < (now() at time zone 'America/Lima')::date then
      raise exception 'dia_libre_fecha_vencida';
    end if;
    insert into public.asis_descansos_presenciales(colaborador_id,fecha,motivo,asignado_por)
      values(new.colaborador_id,new.fecha_inicio,left('Solicitud aprobada: '||new.detalle,180),auth.uid());
    insert into public.asis_descansos_auditoria(colaborador_id,fecha,accion,motivo,actor)
      values(new.colaborador_id,new.fecha_inicio,'asignar',left('Solicitud aprobada: '||new.detalle,180),auth.uid());
  end if;
  return new;
end $$;

revoke all on function public.asis_validar_aprobacion_libre(bigint,date,bigint),public.asis_validar_resolucion_libre(),public.asis_programar_dia_libre_aprobado() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
