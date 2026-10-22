-- Después de dashboard_123 y dashboard_125. Solo las ocho fechas autorizadas.
-- Puntual (P) durante todo el minuto 10:45; tardanza desde 10:46. Salida 13:00.
begin;
alter table public.asis_horarios_puntuales add column if not exists tolerancia_min integer
  check(tolerancia_min between 0 and 120);

create or replace function public.asis_tolerancia_entrada(p_colab public.asis_colaboradores,p_fecha date,p_tol integer)
returns integer language sql stable security definer set search_path=public as $$
  select coalesce((select tolerancia_min from public.asis_horarios_puntuales
    where colaborador_id=p_colab.id and fecha=p_fecha),p_tol)
$$;
revoke all on function public.asis_tolerancia_entrada(public.asis_colaboradores,date,integer) from public,anon;
grant execute on function public.asis_tolerancia_entrada(public.asis_colaboradores,date,integer) to authenticated;

do $$ begin
  if to_regprocedure('public.asis_ventana_base_127(public.asis_colaboradores,date,time without time zone,integer)') is null then
    alter function public.asis_ventana(public.asis_colaboradores,date,time,integer) rename to asis_ventana_base_127;
  end if;
  if to_regprocedure('public.asis_mi_dia_base_127(public.asis_colaboradores,integer)') is null then
    alter function public.asis_mi_dia(public.asis_colaboradores,integer) rename to asis_mi_dia_base_127;
  end if;
  if to_regprocedure('public.dash_admin_equipo_base_127(boolean)') is null then
    alter function public.dash_admin_equipo(boolean) rename to dash_admin_equipo_base_127;
  end if;
end $$;
revoke all on function public.asis_ventana_base_127(public.asis_colaboradores,date,time,integer),
  public.asis_mi_dia_base_127(public.asis_colaboradores,integer),public.dash_admin_equipo_base_127(boolean) from public,anon,authenticated;

create or replace function public.asis_ventana(p_colab public.asis_colaboradores,p_fecha date,p_hora time,p_tol integer)
returns text language sql stable security definer set search_path=public as $$
  select public.asis_ventana_base_127(p_colab,p_fecha,p_hora,public.asis_tolerancia_entrada(p_colab,p_fecha,p_tol))
$$;
create or replace function public.asis_mi_dia(p_colab public.asis_colaboradores,p_tol integer)
returns jsonb language sql stable security definer set search_path=public as $$
  select public.asis_mi_dia_base_127(p_colab,
    public.asis_tolerancia_entrada(p_colab,(now() at time zone 'America/Lima')::date,p_tol))
$$;
create or replace function public.dash_admin_equipo(p_incluir_inactivos boolean default false)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_data jsonb; v_people jsonb;
begin
  v_data:=public.dash_admin_equipo_base_127(p_incluir_inactivos);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  select coalesce(jsonb_agg(p.item||jsonb_build_object('horarios_temporales',(
    select coalesce(jsonb_agg(d.item||jsonb_build_object('puntual_hasta',
      case when (d.item->>'laborable')::boolean and h.tolerancia_min is not null
        then h.hora_inicio+make_interval(mins=>h.tolerancia_min) end) order by d.orden),'[]'::jsonb)
    from jsonb_array_elements(coalesce(p.item->'horarios_temporales','[]'::jsonb)) with ordinality d(item,orden)
    left join public.asis_horarios_puntuales h on h.colaborador_id=(p.item->>'id')::bigint and h.fecha=(d.item->>'fecha')::date
  )) order by p.orden),'[]'::jsonb) into v_people
  from jsonb_array_elements(coalesce(v_data->'personas','[]'::jsonb)) with ordinality p(item,orden);
  return v_data||jsonb_build_object('personas',v_people);
end $$;
revoke all on function public.asis_ventana(public.asis_colaboradores,date,time,integer),
  public.asis_mi_dia(public.asis_colaboradores,integer),public.dash_admin_equipo(boolean) from public,anon;
grant execute on function public.asis_ventana(public.asis_colaboradores,date,time,integer),
  public.asis_mi_dia(public.asis_colaboradores,integer),public.dash_admin_equipo(boolean) to authenticated;

do $$
declare
  c public.asis_colaboradores;
  v_dates date[]:=array[date '2026-10-21',date '2026-10-23',date '2026-10-26',date '2026-10-27',
    date '2026-10-28',date '2026-10-29',date '2026-11-02',date '2026-11-03'];
  v_before jsonb;
  v_marks jsonb;
  v_count integer;
begin
  if (select count(*) from public.asis_colaboradores
    where regexp_replace(lower(btrim(nombre)),'[[:space:]]+',' ','g')='ronny yural ruiz pinillos' and activo)<>1 then
    raise exception 'Debe existir exactamente un Ronny Yural Ruiz Pinillos activo. No se aplicó ningún cambio.';
  end if;
  select * into c from public.asis_colaboradores
    where regexp_replace(lower(btrim(nombre)),'[[:space:]]+',' ','g')='ronny yural ruiz pinillos' and activo for update;
  perform pg_advisory_xact_lock(c.id);
  if (select count(*) from public.asis_horarios_puntuales h where h.colaborador_id=c.id
    and h.fecha=any(v_dates) and h.hora_inicio=time '10:30' and h.hora_fin=time '13:00')<>8 then
    raise exception 'Primero aplicar el horario reducido de las ocho fechas (dashboard_123). No se aplicó ningún cambio.';
  end if;
  select jsonb_agg(jsonb_build_object('fecha',fecha,'tolerancia_min',tolerancia_min) order by fecha)
    into v_before from public.asis_horarios_puntuales where colaborador_id=c.id and fecha=any(v_dates);
  update public.asis_horarios_puntuales set tolerancia_min=15,actualizado_at=now()
    where colaborador_id=c.id and fecha=any(v_dates) and tolerancia_min is distinct from 15;
  get diagnostics v_count=row_count;
  if v_count>0 then
    insert into public.asis_historial_contrato(colaborador_id,tipo,horario_anterior,horario_nuevo,nota,creado_por)
    values(c.id,'horario',v_before,jsonb_build_object('fechas',to_jsonb(v_dates),'entrada','10:30','puntual_hasta','10:45','salida','13:00'),
      'Horario temporal: puntual hasta las 10:45 (inclusive), tardanza desde las 10:46. Tolerancia de 15 minutos únicamente en las fechas autorizadas.',auth.uid());
  end if;
  perform 1 from public.asis_registros where colaborador_id=c.id and fecha=any(v_dates) for update;
  select jsonb_agg(jsonb_build_object('fecha',fecha,'estado',estado,'entrada',marcado_at) order by fecha)
    into v_marks from public.asis_registros r where r.colaborador_id=c.id and r.fecha=any(v_dates) and r.estado='T'
      and (r.marcado_at at time zone 'America/Lima')::date=r.fecha
      and public.asis_ventana(c,r.fecha,(r.marcado_at at time zone 'America/Lima')::time,15) in('antes','presente');
  if v_marks is not null then
    update public.asis_registros r set estado='P' where r.colaborador_id=c.id and r.fecha=any(v_dates) and r.estado='T'
      and (r.marcado_at at time zone 'America/Lima')::date=r.fecha
      and public.asis_ventana(c,r.fecha,(r.marcado_at at time zone 'America/Lima')::time,15) in('antes','presente');
    insert into public.asis_historial_contrato(colaborador_id,tipo,horario_anterior,horario_nuevo,nota,creado_por)
    values(c.id,'otro',v_marks,jsonb_build_object('estado','P','puntual_hasta','10:45'),
      'Corrección de puntualidad del horario temporal: entrada hasta las 10:45; conserva horas y evidencias.',auth.uid());
  end if;
end $$;

-- La confirmación administrativa también utiliza la tolerancia por fecha.
create or replace function public.dash_admin_confirmar_entrada(p_permiso uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_permiso public.asis_entradas_direccion; v_colab public.asis_colaboradores;
  v_reg public.asis_registros; v_estado text; v_ini time; v_fin time; v_tol int; v_resultado jsonb;
begin
  if public.asis_rol() is distinct from 'direccion' or auth.uid() is null then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if not public.dash_sesion_vigente() then return jsonb_build_object('ok',false,'motivo','sesion'); end if;
  select * into v_permiso from public.asis_entradas_direccion
    where id=p_permiso and registrado_por=auth.uid() for update;
  if v_permiso.id is null then return jsonb_build_object('ok',false,'motivo','permiso_invalido'); end if;
  perform pg_advisory_xact_lock(v_permiso.colaborador_id);
  select * into v_reg from public.asis_registros where colaborador_id=v_permiso.colaborador_id and fecha=v_permiso.fecha;
  if v_permiso.confirmado_at is not null then
    if v_reg.id=v_permiso.registro_id and v_reg.evidencia_path=v_permiso.ruta then return v_permiso.resultado; end if;
    return jsonb_build_object('ok',false,'motivo','registro_cambiado');
  end if;
  if v_reg.id is not null then return jsonb_build_object('ok',false,'motivo','ya_marcado'); end if;
  if v_permiso.vence_at<now() then return jsonb_build_object('ok',false,'motivo','permiso_vencido'); end if;
  select * into v_colab from public.asis_colaboradores where id=v_permiso.colaborador_id and activo;
  if v_colab.id is null then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  if v_colab.contrato_inicio is not null and v_permiso.fecha<v_colab.contrato_inicio then
    return jsonb_build_object('ok',false,'motivo','antes_contrato');
  end if;
  if not public.asis_labora(v_colab,v_permiso.fecha) then return jsonb_build_object('ok',false,'motivo','no_labora'); end if;
  v_ini:=public.asis_hora_entrada(v_colab,v_permiso.fecha);v_fin:=public.asis_hora_salida(v_colab,v_permiso.fecha);
  if v_ini is null or v_fin is null or v_fin<=v_ini then return jsonb_build_object('ok',false,'motivo','horario_incompleto'); end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='asis-evidencias' and o.name=v_permiso.ruta
    and o.created_at>=v_permiso.creado_at
    and o.metadata->>'mimetype'='image/jpeg'
    and (o.metadata->>'size')::numeric between 1 and 2097152) then
    return jsonb_build_object('ok',false,'motivo','evidencia_no_verificada');
  end if;
  select coalesce(tolerancia_min,15) into v_tol from public.asis_portal_config where id=1;
  if exists(select 1 from public.asis_horarios_puntuales h where h.colaborador_id=v_colab.id
    and h.fecha=v_permiso.fecha and h.tolerancia_min is not null) then
    v_estado:=case when public.asis_ventana(v_colab,v_permiso.fecha,v_permiso.hora,v_tol) in('antes','presente') then 'P' else 'T' end;
  else
    v_estado:=case when v_permiso.hora<=v_ini+make_interval(mins=>coalesce(v_tol,15)) then 'P' else 'T' end;
  end if;
  insert into public.asis_registros(colaborador_id,fecha,estado,nota,marcado_por,marcado_at,origen,
    horas,vinculo,evidencia_path,evidencia_origen,evidencia_at,modalidad_marcada)
  values(v_colab.id,v_permiso.fecha,v_estado,v_permiso.nota,auth.uid(),
    (v_permiso.fecha+v_permiso.hora) at time zone 'America/Lima','panel',
    public.asis_horas_dia(v_colab,v_permiso.fecha),public.asis_vinc_dia(v_colab,v_permiso.fecha),
    v_permiso.ruta,'archivo',now(),v_permiso.modalidad)
  returning * into v_reg;
  v_resultado:=jsonb_build_object('ok',true,'registro_id',v_reg.id,'estado',v_estado,
    'modalidad',v_permiso.modalidad,'marcado_at',v_reg.marcado_at,'fecha',v_permiso.fecha,'origen','panel');
  update public.asis_entradas_direccion set confirmado_at=now(),registro_id=v_reg.id,resultado=v_resultado where id=v_permiso.id;
  return v_resultado;
exception when unique_violation then return jsonb_build_object('ok',false,'motivo','ya_marcado');
end $$;

revoke all on function public.dash_admin_confirmar_entrada(uuid) from public,anon;
grant execute on function public.dash_admin_confirmar_entrada(uuid) to authenticated;
notify pgrst,'reload schema';
commit;

select c.nombre,h.fecha,h.hora_inicio,h.hora_fin,h.tolerancia_min,
  public.asis_ventana(c,h.fecha,time '10:45',0) as estado_1045,
  public.asis_ventana(c,h.fecha,time '10:46',0) as estado_1046
from public.asis_horarios_puntuales h join public.asis_colaboradores c on c.id=h.colaborador_id
where regexp_replace(lower(btrim(c.nombre)),'[[:space:]]+',' ','g')='ronny yural ruiz pinillos'
  and h.tolerancia_min=15 order by h.fecha;
