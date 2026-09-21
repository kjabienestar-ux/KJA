-- Aplicar despues de dashboard_68_alviery_asistencia_comparticiones.sql.
-- El calendario de Alviery debe usar la misma regla que su detalle diario.
-- No modifica marcaciones, evidencias ni horas; conserva las reglas del resto.
begin;

create or replace function public.dash_admin_cierres_mes(p_anio int, p_mes int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inicio date;
  v_fin date;
  v_cfg public.asis_cierre_config;
  v_cierres jsonb;
begin
  if not public.asis_es_miembro() then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_mes is null or p_anio is null
     or p_mes not between 1 and 12 or p_anio not between 2020 and 2100 then
    return jsonb_build_object('ok', false, 'motivo', 'periodo');
  end if;

  v_inicio := make_date(p_anio, p_mes, 1);
  v_fin := (v_inicio + interval '1 month - 1 day')::date;
  select * into v_cfg from public.asis_cierre_config where id = 1;

  select coalesce(jsonb_agg(jsonb_build_object(
           'colaborador_id', r.colaborador_id,
           'fecha', r.fecha,
           'salida_at', r.salida_at,
           'estado', case
             when c.dni='73939131' then public.dash_cierre_resumen_colab(r.colaborador_id,r.fecha)->>'estado'
             when not coalesce(v_cfg.habilitado, false)
                  or r.fecha < v_cfg.obligatorio_desde
                  or not public.asis_labora(c, r.fecha) then 'no_aplica'
             when r.salida_at is not null then case when r.cierre_regularizado then 'regularizada' else 'completa' end
             when public.asis_cierre_fin_at(r.colaborador_id, r.fecha) is not null
                  and now() > public.asis_cierre_fin_at(r.colaborador_id, r.fecha)
                              + make_interval(mins => v_cfg.salida_gracia_min)
               then 'incompleta'
             else 'en_curso'
           end
         ) order by r.colaborador_id, r.fecha), '[]'::jsonb)
    into v_cierres
    from public.asis_registros r
    join public.asis_colaboradores c on c.id = r.colaborador_id
   where r.fecha between v_inicio and v_fin and r.estado in ('P','T');

  return jsonb_build_object('ok', true, 'cierres', v_cierres);
end;
$$;

revoke all on function public.dash_admin_cierres_mes(int, int) from public, anon;
grant execute on function public.dash_admin_cierres_mes(int, int) to authenticated;


notify pgrst, 'reload schema';
commit;

-- Verificar los dos dias reportados usando el mismo calculo del calendario.
select c.id,c.nombre,r.fecha,r.estado as asistencia,
       cierre->>'estado' as estado_dia,
       cierre->>'solo_asistencia_comparticiones' as excepcion_activa,
       cierre->'requisitos' as requisitos
from public.asis_colaboradores c
join public.asis_registros r on r.colaborador_id=c.id
cross join lateral (select public.dash_cierre_resumen_colab(c.id,r.fecha) as cierre) resumen
where c.dni='73939131' and r.fecha in (date '2026-09-08',date '2026-09-09')
order by r.fecha;
