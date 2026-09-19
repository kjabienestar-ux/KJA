-- Solo lectura. Ejecutar en el editor SQL de Supabase.
-- Cambiar el mes si se quiere revisar otro período.
with parametros as (select date '2026-09-01' mes), calendario as (
  select c.id,c.nombre,c.contrato_inicio,d::date fecha,r.estado,r.salida_at,
    public.asis_labora(c,d::date) and coalesce(r.estado,'') not in ('J','NG') laboral,
    public.asis_cierre_fin_at(c.id,d::date) fin_at,
    cfg.obligatorio_desde,cfg.salida_anticipacion_min,cfg.salida_gracia_min
  from public.asis_colaboradores c
  join public.asis_areas a on a.id=c.area_id
  cross join parametros p
  cross join lateral generate_series(p.mes::timestamp,
    least((p.mes+interval '1 month - 1 day')::date,(now() at time zone 'America/Lima')::date-1)::timestamp,interval '1 day') d
  cross join public.asis_cierre_config cfg
  left join public.asis_registros r on r.colaborador_id=c.id and r.fecha=d::date
  where c.activo and a.activo and c.contrato_inicio is not null and cfg.id=1
), evaluados as (
  select *,coalesce(fecha>=contrato_inicio and estado in ('P','T') and salida_at between
    fin_at-make_interval(mins=>salida_anticipacion_min) and fin_at+make_interval(mins=>salida_gracia_min),false) valida
  from calendario where laboral and fin_at is not null and now()>fin_at+make_interval(mins=>salida_gracia_min)
)
select id,nombre,fecha,estado,
  salida_at at time zone 'America/Lima' salida_registrada,
  fin_at at time zone 'America/Lima' fin_programado,
  (fin_at-make_interval(mins=>salida_anticipacion_min)) at time zone 'America/Lima' salida_desde,
  (fin_at+make_interval(mins=>salida_gracia_min)) at time zone 'America/Lima' salida_hasta,
  obligatorio_desde,
  case when valida then 'Suma'
    when fecha<contrato_inicio then 'Antes del ingreso: incluido en el denominador'
    when salida_at is null and fecha<obligatorio_desde then 'Sin salida antes de la obligatoriedad del sistema'
    when salida_at is null then 'Sin salida registrada'
    when estado is null or estado not in ('P','T') then 'Estado no válido para puntuar salida'
    when salida_at<fin_at-make_interval(mins=>salida_anticipacion_min) then 'Salida anterior a la ventana'
    else 'Salida posterior a la ventana' end motivo,
  count(*) over(partition by id) dias_evaluados,
  count(*) filter(where valida) over(partition by id) salidas_validas,
  round(20.0*count(*) filter(where valida) over(partition by id)/count(*) over(partition by id),2) puntos_salida
from evaluados order by nombre,fecha;
