-- Sustituye los bloqueos de aprobación de dashboard_94 y dashboard_121.
-- Dirección decide sobre solicitudes existentes, incluso pasadas o no laborables.
-- Crear solicitudes y aceptar contraofertas conserva sus validaciones originales.
-- Ejecutar no resuelve ninguna solicitud: después se utiliza el botón Aprobar.
begin;

create or replace function public.asis_validar_resolucion_libre()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.descanso_programado and new.tipo='dia_libre' and old.estado='pendiente'
    and new.estado in('aprobada','rechazada') and new.contra_estado='pendiente' then
    -- La decisión sobre la fecha original cierra la propuesta aún no aceptada.
    new.contra_estado:='rechazada';
  end if;
  return new;
end $$;

create or replace function public.asis_descontar_dia_libre_aprobado()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_colab public.asis_colaboradores;
  v_dias integer;
  v_anterior integer;
begin
  if new.tipo<>'dia_libre' or new.estado<>'aprobada' or old.estado='aprobada' then return new; end if;
  select * into v_colab from public.asis_colaboradores where id=new.colaborador_id for update;

  if new.descanso_programado then
    -- Un descanso ya asignado no consume un segundo día del banco.
    if exists(select 1 from public.asis_descansos_presenciales
      where colaborador_id=new.colaborador_id and fecha=new.fecha_inicio) then return new; end if;
    -- La unidad solicitada es un día; el horario actual no invalida la decisión.
    v_dias:=1;
  else
    select count(*)::integer into v_dias
    from generate_series(new.fecha_inicio,new.fecha_fin,interval '1 day') fecha
    where public.asis_labora(v_colab,fecha::date);
    if v_dias<=0 then raise exception 'dia_libre_sin_dias_laborables'; end if;
  end if;

  v_anterior:=v_colab.dias_libres_saldo;
  if v_anterior<v_dias then raise exception 'saldo_dias_libres_insuficiente'; end if;
  update public.asis_colaboradores set dias_libres_saldo=v_anterior-v_dias where id=new.colaborador_id;
  insert into public.asis_dias_libres_movimientos(
    colaborador_id,cantidad,saldo_anterior,saldo_resultante,motivo,solicitud_id,creado_por
  ) values(new.colaborador_id,-v_dias,v_anterior,v_anterior-v_dias,
    left('Uso aprobado: '||new.detalle,180),new.id,auth.uid());
  return new;
end $$;

create or replace function public.asis_programar_dia_libre_aprobado()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.tipo='dia_libre' and new.descanso_programado and new.estado='aprobada' and old.estado='pendiente' then
    insert into public.asis_descansos_presenciales(colaborador_id,fecha,motivo,asignado_por)
      values(new.colaborador_id,new.fecha_inicio,left('Solicitud aprobada: '||new.detalle,180),auth.uid())
      on conflict(colaborador_id,fecha) do nothing;
    if found then
      insert into public.asis_descansos_auditoria(colaborador_id,fecha,accion,motivo,actor)
        values(new.colaborador_id,new.fecha_inicio,'asignar',left('Solicitud aprobada: '||new.detalle,180),auth.uid());
    end if;
  end if;
  return new;
end $$;

revoke all on function public.asis_validar_resolucion_libre(),public.asis_descontar_dia_libre_aprobado(),public.asis_programar_dia_libre_aprobado() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
