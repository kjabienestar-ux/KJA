-- Aplicar despues de dashboard_111.
-- Los dias no laborables que reemplazan una jornada programada tambien
-- avanzan la meta contractual, sin duplicar una marca que ya tenga horas.
begin;

create or replace function public.dash_admin_horas_programadas_dia(
  p_colab public.asis_colaboradores,
  p_fecha date
)
returns numeric
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_dow text:=extract(isodow from p_fecha)::int::text;
  v_dia jsonb:=coalesce(p_colab.horario_semanal->v_dow,'{}'::jsonb);
  v_mod text;
  v_ini time;
  v_fin time;
  v_horas numeric;
begin
  v_mod:=coalesce(nullif(v_dia->>'mod',''),
    case when v_dow::int=any(p_colab.dias_laborables) then 'virtual' else 'no_gestiona' end);
  if v_mod='no_gestiona' then return 0; end if;

  v_ini:=coalesce(nullif(v_dia->>'ini','')::time,p_colab.hora_inicio);
  v_fin:=coalesce(nullif(v_dia->>'fin','')::time,p_colab.hora_fin);
  if v_ini is null or v_fin is null or v_ini=v_fin then return 0; end if;

  v_horas:=extract(epoch from (v_fin-v_ini))/3600.0;
  if v_horas<0 then v_horas:=v_horas+24; end if;
  return round(v_horas,2);
end;
$$;

revoke all on function public.dash_admin_horas_programadas_dia(public.asis_colaboradores,date)
  from public,anon,authenticated;

create or replace function public.dash_admin_resumen_contrato(
  p_colab public.asis_colaboradores
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_hoy date:=(now() at time zone 'America/Lima')::date;
  v_mixto boolean:=p_colab.tipo_vinculo='ambos';
  v_marcadas numeric:=0;
  v_vol_marcadas numeric:=0;
  v_acreditadas numeric:=0;
  v_vol_acreditadas numeric:=0;
  v_cumplidas numeric:=coalesce(p_colab.horas_previas,0);
  v_meta numeric:=p_colab.contrato_horas;
  v_semana numeric;
  v_faltantes numeric;
  v_fin date;
  v_vol_meta numeric:=p_colab.contrato_horas_voluntariado;
  v_vol_semana numeric:=0;
  v_vol_faltantes numeric;
  v_vol_fin date;
  v_alertas text[]:=array[]::text[];
begin
  select
    coalesce(sum(r.horas) filter(
      where not v_mixto or coalesce(r.vinculo,public.asis_vinc_dia(p_colab,r.fecha))='practicas'
    ),0),
    coalesce(sum(r.horas) filter(
      where v_mixto and coalesce(r.vinculo,public.asis_vinc_dia(p_colab,r.fecha))='voluntariado'
    ),0)
  into v_marcadas,v_vol_marcadas
  from public.asis_registros r
  where r.colaborador_id=p_colab.id
    and r.estado in ('P','T','J') and r.horas is not null;

  -- Solo se generan creditos hasta hoy y desde el inicio del contrato. Las
  -- fechas candidatas son feriados, permisos, descansos y justificaciones
  -- antiguas sin horas. Un registro positivo siempre manda y evita duplicados.
  if p_colab.contrato_inicio is not null then
    with fechas_candidatas as (
      select e.fecha
      from public.asis_excepciones e
      where e.fecha between p_colab.contrato_inicio and v_hoy
        and ((e.ambito='empresa' and e.tipo='feriado')
          or (e.ambito='colaborador' and e.colaborador_id=p_colab.id and e.tipo='no_laborable'))
      union
      select d.fecha
      from public.asis_descansos_presenciales d
      where d.colaborador_id=p_colab.id
        and d.fecha between p_colab.contrato_inicio and v_hoy
      union
      select r.fecha
      from public.asis_registros r
      where r.colaborador_id=p_colab.id and r.estado='J'
        and coalesce(r.horas,0)<=0
        and r.fecha between p_colab.contrato_inicio and v_hoy
    ), creditos as (
      select f.fecha,
        public.dash_admin_horas_programadas_dia(p_colab,f.fecha) horas,
        public.asis_vinc_dia(p_colab,f.fecha) vinculo
      from fechas_candidatas f
      where (
          exists(select 1 from public.asis_registros j
            where j.colaborador_id=p_colab.id and j.fecha=f.fecha
              and j.estado='J' and coalesce(j.horas,0)<=0)
          or not coalesce(public.asis_labora(p_colab,f.fecha),false)
        )
        and not exists(select 1 from public.asis_registros r
          where r.colaborador_id=p_colab.id and r.fecha=f.fecha
            and r.estado in ('P','T','J') and coalesce(r.horas,0)>0)
    )
    select
      coalesce(sum(horas) filter(where not v_mixto or vinculo='practicas'),0),
      coalesce(sum(horas) filter(where v_mixto and vinculo='voluntariado'),0)
    into v_acreditadas,v_vol_acreditadas
    from creditos;
  end if;

  v_cumplidas:=v_cumplidas+v_marcadas+v_acreditadas;
  v_semana:=public.dash_admin_horas_semana(
    p_colab,case when v_mixto then 'practicas' else null end);
  if v_meta is not null and v_meta>0 then
    v_faltantes:=greatest(0,v_meta-v_cumplidas);
    if v_faltantes>0 and v_semana>0 then
      v_fin:=v_hoy+ceil(v_faltantes/v_semana*7)::int;
    end if;
  end if;

  if not coalesce(p_colab.contrato_pendiente,false) then
    if v_meta is null or v_meta<=0 then v_alertas:=array_append(v_alertas,'Sin horas de contrato definidas'); end if;
    if p_colab.contrato_inicio is null then v_alertas:=array_append(v_alertas,'Sin fecha de inicio de contrato'); end if;
    if v_semana<=0 then v_alertas:=array_append(v_alertas,'Sin horario activo esta semana'); end if;
    if v_meta is not null and v_cumplidas>v_meta then v_alertas:=array_append(v_alertas,'Superó las horas de contrato'); end if;
    if p_colab.contrato_fin_referencia is not null and p_colab.contrato_fin_referencia<v_hoy
       and coalesce(v_faltantes,0)>0 then
      v_alertas:=array_append(v_alertas,'Venció la fecha del contrato y aún faltan horas');
    end if;
  end if;

  if v_mixto then
    v_vol_marcadas:=v_vol_marcadas+v_vol_acreditadas;
    v_vol_semana:=public.dash_admin_horas_semana(p_colab,'voluntariado');
    if v_vol_meta is not null and v_vol_meta>0 then
      v_vol_faltantes:=greatest(0,v_vol_meta-v_vol_marcadas);
      if v_vol_faltantes>0 and v_vol_semana>0 then
        v_vol_fin:=v_hoy+ceil(v_vol_faltantes/v_vol_semana*7)::int;
      end if;
    end if;
    if not coalesce(p_colab.contrato_pendiente,false) then
      if v_vol_semana<=0 then v_alertas:=array_append(v_alertas,'Sin días de voluntariado'); end if;
      if v_vol_meta is null or v_vol_meta<=0 then v_alertas:=array_append(v_alertas,'Sin meta de voluntariado'); end if;
      if v_vol_meta is not null and v_vol_marcadas>v_vol_meta then
        v_alertas:=array_append(v_alertas,'Superó las horas de voluntariado');
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'cumplidas',round(v_cumplidas,2),'marcadas',round(v_marcadas,2),
    'horas_no_laborables',round(v_acreditadas,2),
    'previas',coalesce(p_colab.horas_previas,0),'meta',v_meta,
    'faltantes',v_faltantes,'semana_horas',v_semana,
    'completado',coalesce(v_meta>0 and v_cumplidas>=v_meta,false),
    'fecha_fin_estimada',v_fin,'pendiente',coalesce(p_colab.contrato_pendiente,false),
    'nota',p_colab.contrato_nota,'alertas',to_jsonb(v_alertas),
    'voluntariado',case when v_mixto then jsonb_build_object(
      'cumplidas',round(v_vol_marcadas,2),'marcadas',round(v_vol_marcadas-v_vol_acreditadas,2),
      'horas_no_laborables',round(v_vol_acreditadas,2),'meta',v_vol_meta,
      'faltantes',v_vol_faltantes,'semana_horas',v_vol_semana,
      'completado',coalesce(v_vol_meta>0 and v_vol_marcadas>=v_vol_meta,false),
      'fecha_fin_estimada',v_vol_fin) else null end
  );
end;
$$;

revoke all on function public.dash_admin_resumen_contrato(public.asis_colaboradores)
  from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
