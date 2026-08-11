-- =====================================================================
--  KJA · Asistencia — Migración 7: historial propio en el portal
--  Aditiva y segura (no borra datos). Requiere la migración 6.
--
--  Cada persona puede ver SU historial del mes desde el portal: qué días
--  asistió, cuáles llegó tarde y cómo va su acumulado de horas. Solo el
--  suyo: la función exige su clave y devuelve únicamente sus datos, así
--  que nadie ve la asistencia de otro.
--
--  Es el pilar de que el registro sea transparente: hasta ahora solo
--  dirección sabía quién llegó tarde, y la persona se enteraba tarde o
--  nunca.
-- =====================================================================

create or replace function public.asis_portal_historial(p_clave text, p_colab bigint, p_pin text,
                                                        p_anio int, p_mes int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg    public.asis_portal_config;
  v_colab  public.asis_colaboradores;
  v_k      public.asis_claves;
  v_ini    date;
  v_fin    date;
  v_hoy    date := (now() at time zone 'America/Lima')::date;
  v_dias   jsonb;
  v_p int; v_t int; v_j int; v_ng int; v_lab int;
  v_horas  numeric;
  v_meta   numeric;
begin
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_cfg is null or not v_cfg.activo or v_cfg.clave is distinct from p_clave then
    return jsonb_build_object('ok', false, 'motivo', 'clave');
  end if;

  -- Se vuelve a exigir la clave: el historial es dato personal, no se
  -- entrega solo con saber el id de alguien.
  select * into v_colab from public.asis_colaboradores where id = p_colab and activo;
  select * into v_k     from public.asis_claves        where colaborador_id = p_colab;
  if v_colab is null or v_k.colaborador_id is null
     or v_k.huella is distinct from public.asis_huella(v_k.sal, p_pin) then
    return jsonb_build_object('ok', false, 'motivo', 'incorrecta');
  end if;

  -- Mes pedido, con tope en el mes actual (no tiene sentido navegar al futuro)
  v_ini := make_date(p_anio, p_mes, 1);
  if v_ini > date_trunc('month', v_hoy)::date then
    v_ini := date_trunc('month', v_hoy)::date;
  end if;
  v_fin := (v_ini + interval '1 month' - interval '1 day')::date;

  select jsonb_agg(jsonb_build_object(
           'd',      extract(day from g.d)::int,
           'dow',    extract(isodow from g.d)::int,
           'lab',    public.asis_labora(v_colab, g.d::date),
           'estado', r.estado,
           'futuro', g.d::date > v_hoy
         ) order by g.d)
    into v_dias
    from generate_series(v_ini, v_fin, interval '1 day') g(d)
    left join public.asis_registros r
           on r.colaborador_id = p_colab and r.fecha = g.d::date;

  select count(*) filter (where r.estado = 'P'),
         count(*) filter (where r.estado = 'T'),
         count(*) filter (where r.estado = 'J'),
         count(*) filter (where r.estado = 'NG')
    into v_p, v_t, v_j, v_ng
    from public.asis_registros r
   where r.colaborador_id = p_colab and r.fecha between v_ini and v_fin;

  select count(*) into v_lab
    from generate_series(v_ini, least(v_fin, v_hoy), interval '1 day') g(d)
   where public.asis_labora(v_colab, g.d::date);

  -- Acumulado del contrato: lo ya traído más lo marcado en el sistema
  select coalesce(v_colab.horas_previas, 0) + coalesce(sum(r.horas), 0)
    into v_horas
    from public.asis_registros r
   where r.colaborador_id = p_colab and r.estado in ('P','T','J');

  v_meta := coalesce(v_colab.contrato_horas, 0)
          + case when v_colab.tipo_vinculo = 'ambos'
                 then coalesce(v_colab.contrato_horas_voluntariado, 0) else 0 end;

  return jsonb_build_object(
    'ok', true,
    'anio', extract(year from v_ini)::int,
    'mes',  extract(month from v_ini)::int,
    'hoy',  v_hoy,
    'dias', coalesce(v_dias, '[]'::jsonb),
    'totales', jsonb_build_object('P', v_p, 'T', v_t, 'J', v_j, 'NG', v_ng,
                                  'laborables', v_lab),
    'horas', round(v_horas, 1),
    'meta',  nullif(v_meta, 0),
    'vinculo', v_colab.tipo_vinculo);
end;
$$;

grant execute on function public.asis_portal_historial(text, bigint, text, int, int) to anon, authenticated;

notify pgrst, 'reload schema';
