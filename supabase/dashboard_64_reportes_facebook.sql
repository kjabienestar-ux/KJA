-- Aplicar después de dashboard_63. Consulta privada, sin modificar evidencias.
begin;
create or replace function public.dash_reporte_facebook(p_desde date,p_hasta date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_hoy date:=(now() at time zone 'America/Lima')::date;
  v_cfg public.asis_cierre_config;
  v_filas jsonb;
begin
  if not exists(select 1 from public.asis_perfiles where id=auth.uid() and activo and rol='direccion') then
    raise exception 'Solo Dirección puede consultar los reportes de Facebook.';
  end if;
  if p_desde is null or p_hasta is null or p_desde<date '2020-01-01'
    or p_hasta<p_desde or p_hasta>v_hoy or p_hasta-p_desde>92 then
    raise exception 'Selecciona hasta 93 días, como máximo hasta hoy (hora de Lima).';
  end if;
  select * into v_cfg from public.asis_cierre_config where id=1;
  if v_cfg.id is null then raise exception 'Falta la configuración del cierre de jornada.'; end if;
  with calendario as (
    select c.id,c.nombre,a.nombre area,c.contrato_inicio,d::date fecha,
      public.asis_compartir_programado(c.id,d::date) programado,
      public.asis_compartir_fin_at(c.id,d::date) fin_at
    from public.asis_colaboradores c join public.asis_areas a on a.id=c.area_id
    cross join generate_series(p_desde::timestamp,p_hasta::timestamp,interval '1 day') d
    where c.activo and a.activo
  ), detalle as (
    select c.*,e.id entrega_id,e.revision_estado,e.completado_at,
      coalesce(f.capturas,0) capturas,
      case
        when c.fecha<v_cfg.obligatorio_desde then 'sin_historial'
        when c.contrato_inicio is null then 'sin_inicio'
        when c.fecha<c.contrato_inicio then 'no_incorporado'
        when not c.programado then 'no_programado'
        when e.estado='completo' and f.capturas>0 then 'con_evidencia'
        when c.fin_at is null then 'sin_horario'
        when now()<=c.fin_at then 'en_plazo'
        else 'sin_evidencia'
      end estado
    from calendario c
    left join lateral (
      select e.id,e.estado,e.revision_estado,e.completado_at
      from public.asis_entregas_diarias e
      where e.colaborador_id=c.id and e.fecha=c.fecha
        and e.requisito='comparticiones' and e.asignacion_id is null
      order by e.creado_at desc,e.id desc limit 1
    ) e on true
    left join lateral (
      select count(*) capturas from public.asis_entrega_archivos f where f.entrega_id=e.id
        and f.mime in ('image/jpeg','image/png','image/webp')
    ) f on true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'nombre',nombre,'area',area,'fecha',fecha,'estado',estado,
    'revision',case when estado='con_evidencia' then revision_estado end,
    'capturas',case when estado='con_evidencia' then capturas else 0 end,
    'entrega_id',entrega_id,'registrado_at',completado_at
  ) order by fecha,area,nombre,id),'[]'::jsonb) into v_filas from detalle;
  return jsonb_build_object('desde',p_desde,'hasta',p_hasta,
    'inicio_sistema',v_cfg.obligatorio_desde,'habilitado',v_cfg.habilitado,
    'generado_at',now(),'hoy',v_hoy,
    'provisional',p_hasta=v_hoy or exists(select 1 from jsonb_array_elements(v_filas) f where f->>'estado'='en_plazo'),
    'filas',v_filas);
end $$;
revoke all on function public.dash_reporte_facebook(date,date) from public,anon,authenticated;
grant execute on function public.dash_reporte_facebook(date,date) to authenticated;
notify pgrst,'reload schema';
commit;
