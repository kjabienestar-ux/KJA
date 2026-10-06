-- Aplicar después de dashboard_93. Martes a viernes y contraofertas consentidas.
begin;
alter table public.asis_solicitudes_personales
  add column if not exists contra_fecha date,
  add column if not exists contra_estado text,
  add column if not exists contra_motivo text,
  add column if not exists contra_por uuid,
  add column if not exists contra_at timestamptz;
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
    or extract(isodow from p_fecha_inicio) not in (2,3,4,5) then
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
    and (p_fecha_inicio between fecha_inicio and fecha_fin or (contra_estado='pendiente' and contra_fecha=p_fecha_inicio))) then
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
        and s.tipo='dia_libre' and s.estado in ('pendiente','aprobada') and (f::date between s.fecha_inicio and s.fecha_fin or (s.contra_estado='pendiente' and s.contra_fecha=f::date)));
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'contra_fecha',s.contra_fecha,'contra_estado',s.contra_estado,'contra_motivo',s.contra_motivo,'fecha_inicio',s.fecha_inicio,'estado',s.estado,'respuesta',s.respuesta)
    order by s.creado_at desc),'[]'::jsonb) into v_solicitudes
    from (select * from public.asis_solicitudes_personales where colaborador_id=v_id
      and tipo='dia_libre' and descanso_programado and (fecha_inicio>=v_hoy or estado='pendiente')
      order by creado_at desc) s;
  return jsonb_build_object('ok',true,'hoy',v_hoy,'saldo',v_colab.dias_libres_saldo,
    'reservados',v_reservados,'disponibles',greatest(0,v_colab.dias_libres_saldo-v_reservados),
    'ocupadas',v_ocupadas,'solicitudes',v_solicitudes);
end $$;

-- Validación compartida; el llamador bloquea primero solicitud y colaborador.
create or replace function public.asis_validar_fecha_libre(p_colab bigint,p_fecha date,p_excluir bigint default null)
returns text language plpgsql security definer set search_path=public as $$
declare c public.asis_colaboradores; hoy date:=(now() at time zone 'America/Lima')::date;
begin
  select * into c from public.asis_colaboradores where id=p_colab for update;
  if not found or not c.activo then return 'colaborador'; end if;
  if p_fecha is null or p_fecha<=hoy or p_fecha>hoy+180 or extract(isodow from p_fecha) not in(2,3,4,5) then return 'dia_no_permitido'; end if;
  if p_fecha<c.contrato_inicio or not coalesce(public.asis_labora(c,p_fecha),false) then return 'no_laborable'; end if;
  if exists(select 1 from public.asis_solicitudes_personales s where s.colaborador_id=p_colab
    and s.id is distinct from p_excluir and s.tipo='dia_libre' and s.estado in('pendiente','aprobada')
    and (p_fecha between s.fecha_inicio and s.fecha_fin or (s.contra_estado='pendiente' and s.contra_fecha=p_fecha))) then return 'duplicada'; end if;
  return null;
end $$;

create or replace function public.dash_admin_proponer_dia_libre(p_id bigint,p_fecha date,p_motivo text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.asis_solicitudes_personales; motivo text;
begin
  if auth.uid() is null or not coalesce(public.dash_sesion_vigente(),false) or public.asis_rol() is distinct from 'direccion' then return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
  select * into s from public.asis_solicitudes_personales where id=p_id for update;
  if not found or s.estado<>'pendiente' or s.tipo<>'dia_libre' or not s.descanso_programado then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  if s.contra_estado='pendiente' then return jsonb_build_object('ok',false,'motivo','contraoferta_pendiente'); end if;
  if length(btrim(coalesce(p_motivo,''))) not between 3 and 500 or p_fecha=s.fecha_inicio then return jsonb_build_object('ok',false,'motivo','detalle'); end if;
  motivo:=public.asis_validar_fecha_libre(s.colaborador_id,p_fecha,s.id);
  if motivo is not null then return jsonb_build_object('ok',false,'motivo',motivo); end if;
  update public.asis_solicitudes_personales set contra_fecha=p_fecha,contra_estado='pendiente',contra_motivo=btrim(p_motivo),contra_por=auth.uid(),contra_at=now() where id=s.id;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.dash_responder_contraoferta(p_id bigint,p_aceptar boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.asis_solicitudes_personales; motivo text;
begin
  if auth.uid() is null or not coalesce(public.dash_sesion_vigente(),false) or public.dash_colab() is null then return jsonb_build_object('ok',false,'motivo','sesion'); end if;
  if p_aceptar is null then return jsonb_build_object('ok',false,'motivo','estado'); end if;
  select * into s from public.asis_solicitudes_personales where id=p_id and colaborador_id=public.dash_colab() for update;
  if not found or s.estado<>'pendiente' or s.contra_estado is distinct from 'pendiente' then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  if p_aceptar then
    motivo:=public.asis_validar_fecha_libre(s.colaborador_id,s.contra_fecha,s.id);
    if motivo is not null then return jsonb_build_object('ok',false,'motivo',motivo); end if;
    if (select dias_libres_saldo from public.asis_colaboradores where id=s.colaborador_id)<1 then return jsonb_build_object('ok',false,'motivo','saldo_insuficiente'); end if;
  end if;
  update public.asis_solicitudes_personales set
    contra_estado=case when p_aceptar then 'aceptada' else 'rechazada' end,
    fecha_inicio=case when p_aceptar then s.contra_fecha else s.fecha_inicio end,
    fecha_fin=case when p_aceptar then s.contra_fecha else s.fecha_fin end,
    estado=case when p_aceptar then 'aprobada' else 'rechazada' end,
    respuesta=case when p_aceptar then 'Fecha propuesta por Dirección y aceptada por el colaborador.' else 'El colaborador rechazó la fecha alternativa. Puede enviar una nueva solicitud.' end,
    resuelto_por=s.contra_por,resuelto_at=now()
  where id=s.id;
  insert into public.asis_admin_eventos(actor_id,accion,colaborador_id,detalle)
    values(auth.uid(),'resolver_solicitud',s.colaborador_id,jsonb_build_object('solicitud_id',s.id,'contraoferta_aceptada',p_aceptar,'fecha_original',s.fecha_inicio,'fecha_propuesta',s.contra_fecha,'propuesta_por',s.contra_por));
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.asis_validar_resolucion_libre()
returns trigger language plpgsql security definer set search_path=public as $$
declare motivo text;
begin
  if new.descanso_programado and new.tipo='dia_libre' and old.estado='pendiente' then
    if new.estado='aprobada' then
      if new.contra_estado='pendiente' then raise exception 'contraoferta_pendiente'; end if;
      motivo:=public.asis_validar_fecha_libre(new.colaborador_id,new.fecha_inicio,new.id);
      if motivo is not null then raise exception '%',motivo; end if;
    elsif new.estado='rechazada' and new.contra_estado='pendiente' then new.contra_estado:='rechazada'; end if;
  end if;
  return new;
end $$;
drop trigger if exists asis_aa_validar_libre on public.asis_solicitudes_personales;
create trigger asis_aa_validar_libre before update of estado on public.asis_solicitudes_personales
for each row execute function public.asis_validar_resolucion_libre();

-- Enriquecer bandejas existentes conservando autorización y datos originales.
do $$ begin
 if to_regprocedure('public.dash_solicitudes_personales_base_94()') is null then
  alter function public.dash_solicitudes_personales() rename to dash_solicitudes_personales_base_94;
 end if;
 if to_regprocedure('public.dash_admin_solicitudes_personales_base_94()') is null then
  alter function public.dash_admin_solicitudes_personales() rename to dash_admin_solicitudes_personales_base_94;
 end if;
end $$;
create or replace function public.asis_enriquecer_contraofertas(p_data jsonb)
returns jsonb language sql stable security definer set search_path=public as $$
 select case when p_data->>'ok'='true' then p_data||jsonb_build_object('solicitudes',coalesce((
  select jsonb_agg(item||jsonb_build_object('contra_fecha',s.contra_fecha,'contra_estado',s.contra_estado,'contra_motivo',s.contra_motivo,'descanso_programado',s.descanso_programado) order by ord)
  from jsonb_array_elements(p_data->'solicitudes') with ordinality x(item,ord)
  join public.asis_solicitudes_personales s on s.id=(item->>'id')::bigint),'[]'::jsonb)) else p_data end;
$$;
create or replace function public.dash_solicitudes_personales() returns jsonb language sql stable security definer set search_path=public as $$select public.asis_enriquecer_contraofertas(public.dash_solicitudes_personales_base_94())$$;
create or replace function public.dash_admin_solicitudes_personales() returns jsonb language sql stable security definer set search_path=public as $$select public.asis_enriquecer_contraofertas(public.dash_admin_solicitudes_personales_base_94())$$;
revoke all on function public.asis_validar_fecha_libre(bigint,date,bigint),public.asis_validar_resolucion_libre(),public.asis_enriquecer_contraofertas(jsonb),public.dash_solicitudes_personales_base_94(),public.dash_admin_solicitudes_personales_base_94() from public,anon,authenticated;
revoke all on function public.dash_admin_proponer_dia_libre(bigint,date,text),public.dash_responder_contraoferta(bigint,boolean),public.dash_solicitudes_personales(),public.dash_admin_solicitudes_personales() from public,anon,authenticated;
grant execute on function public.dash_admin_proponer_dia_libre(bigint,date,text),public.dash_responder_contraoferta(bigint,boolean),public.dash_solicitudes_personales(),public.dash_admin_solicitudes_personales() to authenticated;
notify pgrst,'reload schema';
commit;
