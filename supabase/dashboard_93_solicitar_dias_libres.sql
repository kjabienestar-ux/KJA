-- Aplicar después de dashboard_92. Usa el banco de saldo de dashboard_18.
-- Una fecha por solicitud, martes o viernes futuro; aprobación de Dirección.
begin;

alter table public.asis_solicitudes_personales
  add column if not exists descanso_programado boolean not null default false;
alter table public.asis_solicitudes_personales drop constraint if exists asis_sol_personal_evidencia_chk;
alter table public.asis_solicitudes_personales add constraint asis_sol_personal_evidencia_chk
  check (tipo <> 'justificacion' and (tipo <> 'dia_libre' or descanso_programado) or evidencia_path is not null);

create or replace function public.asis_dias_libres_reservados(p_colab bigint)
returns integer language sql stable security definer set search_path=public as $$
  select coalesce(sum(case when s.descanso_programado then 1 else (
    select count(*) from generate_series(s.fecha_inicio,s.fecha_fin,interval '1 day') f
    where public.asis_labora(c,f::date)
  ) end),0)::integer
  from public.asis_solicitudes_personales s join public.asis_colaboradores c on c.id=s.colaborador_id
  where s.colaborador_id=p_colab and s.tipo='dia_libre' and s.estado='pendiente';
$$;
revoke all on function public.asis_dias_libres_reservados(bigint) from public,anon,authenticated;

do $$ begin
  if to_regprocedure('public.dash_crear_solicitud_base_93(text,date,date,text,text)') is null then
    alter function public.dash_crear_solicitud(text,date,date,text,text) rename to dash_crear_solicitud_base_93;
  end if;
end $$;
revoke all on function public.dash_crear_solicitud_base_93(text,date,date,text,text) from public,anon,authenticated;

create or replace function public.dash_crear_solicitud(
  p_tipo text,p_fecha_inicio date,p_fecha_fin date,p_detalle text,p_evidencia text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_id bigint:=public.dash_colab();
  v_hoy date:=(now() at time zone 'America/Lima')::date;
  v_colab public.asis_colaboradores;
  v_sol bigint;
begin
  if auth.uid() is null or not coalesce(public.dash_sesion_vigente(),false) or v_id is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  if btrim(coalesce(p_tipo,'')) <> 'dia_libre' then
    return public.dash_crear_solicitud_base_93(p_tipo,p_fecha_inicio,p_fecha_fin,p_detalle,p_evidencia);
  end if;
  if p_fecha_inicio is null or p_fecha_fin is distinct from p_fecha_inicio
    or p_fecha_inicio <= v_hoy or p_fecha_inicio > v_hoy+180
    or extract(isodow from p_fecha_inicio) not in (2,5) then
    return jsonb_build_object('ok',false,'motivo','dia_no_permitido');
  end if;
  if length(btrim(coalesce(p_detalle,''))) not between 8 and 700 then
    return jsonb_build_object('ok',false,'motivo','detalle');
  end if;
  -- Serializa solicitudes simultáneas y ajustes de saldo para la misma persona.
  select * into v_colab from public.asis_colaboradores where id=v_id for update;
  if not found or not v_colab.activo or p_fecha_inicio<v_colab.contrato_inicio then
    return jsonb_build_object('ok',false,'motivo','colaborador');
  end if;
  if exists(select 1 from public.asis_solicitudes_personales where colaborador_id=v_id
    and tipo='dia_libre' and estado in ('pendiente','aprobada')
    and p_fecha_inicio between fecha_inicio and fecha_fin) then
    return jsonb_build_object('ok',false,'motivo','duplicada');
  end if;
  if not coalesce(public.asis_labora(v_colab,p_fecha_inicio),false) then
    return jsonb_build_object('ok',false,'motivo','no_laborable');
  end if;
  if v_colab.dias_libres_saldo-public.asis_dias_libres_reservados(v_id)<1 then
    return jsonb_build_object('ok',false,'motivo','saldo_insuficiente');
  end if;
  insert into public.asis_solicitudes_personales(colaborador_id,tipo,fecha_inicio,fecha_fin,detalle,descanso_programado)
    values(v_id,'dia_libre',p_fecha_inicio,p_fecha_inicio,btrim(p_detalle),true) returning id into v_sol;
  return jsonb_build_object('ok',true,'id',v_sol);
end $$;

create or replace function public.dash_mis_dias_libres()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_id bigint:=public.dash_colab();
  v_colab public.asis_colaboradores;
  v_hoy date:=(now() at time zone 'America/Lima')::date;
  v_reservados integer;
  v_ocupadas jsonb;
  v_solicitudes jsonb;
begin
  if auth.uid() is null or not coalesce(public.dash_sesion_vigente(),false) or v_id is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  select * into v_colab from public.asis_colaboradores where id=v_id and activo;
  if not found then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  v_reservados:=public.asis_dias_libres_reservados(v_id);
  select coalesce(jsonb_agg(jsonb_build_object('inicio',f::date,'fin',f::date)),'[]'::jsonb)
    into v_ocupadas from generate_series(v_hoy+1,v_hoy+180,interval '1 day') f
    where not coalesce(public.asis_labora(v_colab,f::date),false)
      or f::date<v_colab.contrato_inicio
      or exists(select 1 from public.asis_solicitudes_personales s where s.colaborador_id=v_id
        and s.tipo='dia_libre' and s.estado in ('pendiente','aprobada') and f::date between s.fecha_inicio and s.fecha_fin);
  select coalesce(jsonb_agg(jsonb_build_object('fecha_inicio',s.fecha_inicio,'estado',s.estado,'respuesta',s.respuesta)
    order by s.creado_at desc),'[]'::jsonb) into v_solicitudes
    from (select * from public.asis_solicitudes_personales where colaborador_id=v_id
      and tipo='dia_libre' and descanso_programado and (fecha_inicio>=v_hoy or estado='pendiente')
      order by creado_at desc limit 5) s;
  return jsonb_build_object('ok',true,'hoy',v_hoy,'saldo',v_colab.dias_libres_saldo,
    'reservados',v_reservados,'disponibles',greatest(0,v_colab.dias_libres_saldo-v_reservados),
    'ocupadas',v_ocupadas,'solicitudes',v_solicitudes);
end $$;

-- El trigger anterior descuenta el saldo. Este materializa el descanso DESPUÉS
-- del descuento, en la misma transacción, para que asis_labora no lo cuente dos veces.
create or replace function public.asis_programar_dia_libre_aprobado()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.tipo='dia_libre' and new.descanso_programado and new.estado='aprobada' and old.estado='pendiente' then
    if new.fecha_inicio <= (now() at time zone 'America/Lima')::date then
      raise exception 'dia_libre_fecha_vencida';
    end if;
    insert into public.asis_descansos_presenciales(colaborador_id,fecha,motivo,asignado_por)
      values(new.colaborador_id,new.fecha_inicio,left('Solicitud aprobada: '||new.detalle,180),auth.uid());
    insert into public.asis_descansos_auditoria(colaborador_id,fecha,accion,motivo,actor)
      values(new.colaborador_id,new.fecha_inicio,'asignar',left('Solicitud aprobada: '||new.detalle,180),auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists asis_sol_programar_dia_libre on public.asis_solicitudes_personales;
create trigger asis_sol_programar_dia_libre after update of estado on public.asis_solicitudes_personales
  for each row execute function public.asis_programar_dia_libre_aprobado();

revoke all on function public.asis_programar_dia_libre_aprobado() from public,anon,authenticated;
revoke all on function public.dash_crear_solicitud(text,date,date,text,text),public.dash_mis_dias_libres() from public,anon,authenticated;
grant execute on function public.dash_crear_solicitud(text,date,date,text,text),public.dash_mis_dias_libres() to authenticated;
notify pgrst,'reload schema';
commit;
