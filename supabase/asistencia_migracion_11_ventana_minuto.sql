-- =====================================================================
--  KJA · Asistencia — Migración 11: la ventana se juzga por minuto
--  Aditiva y segura (no borra datos, no cambia tablas). Requiere la 9.
--
--  EL PROBLEMA
--  La tolerancia se comparaba con los segundos incluidos. Con entrada
--  07:00 y 15 min de margen, el límite es 07:15:00 exacto: quien tocaba
--  el botón a las 07:15:20 quedaba con TARDANZA aunque su reloj —y el de
--  la pantalla— dijeran "07:15" y el portal le dijera "último minuto para
--  marcar como presente". Un segundo de diferencia decidía el estado.
--
--  LA REGLA CORRECTA
--  El minuto del límite cuenta entero. Se compara con la hora truncada al
--  minuto, que es la que la persona ve:
--
--    entrada 07:00 + 15 min → 07:15:00 a 07:15:59 siguen siendo PRESENTE
--    desde las 07:16:00                        → TARDANZA
--
--  Lo mismo al abrir: la ventana abre en el minuto de la entrada, no un
--  segundo después. Vale igual para los turnos de la tarde (14:00 → el
--  minuto 14:15 completo es presente).
--
--  Solo se redefine asis_ventana; asis_portal_marcar y asis_mi_dia ya la
--  usan, así que el portal y el panel quedan alineados sin tocarlos.
-- =====================================================================

create or replace function public.asis_ventana(p_colab public.asis_colaboradores,
                                               p_fecha date, p_hora time, p_tol int)
returns text language plpgsql stable as $$
declare
  v_ini  time := public.asis_hora_entrada(p_colab, p_fecha);
  v_fin  time := public.asis_hora_salida(p_colab, p_fecha);
  -- la hora tal como la ve la persona en pantalla: sin segundos
  v_hora time := date_trunc('minute', p_hora)::time;
  v_lim  time;
begin
  if v_ini is null then return 'sin_horario'; end if;
  v_lim := v_ini + make_interval(mins => p_tol);

  if v_hora < v_ini then return 'antes'; end if;
  if v_hora <= v_lim then return 'presente'; end if;

  -- Sin hora de salida, o si cruza medianoche, se acepta hasta fin del día
  if v_fin is null or v_fin <= v_ini or v_hora <= v_fin then return 'tardanza'; end if;
  return 'cerrada';
end;
$$;

comment on function public.asis_ventana(public.asis_colaboradores, date, time, int) is
  'Tramo de la jornada (antes/presente/tardanza/cerrada). La hora se compara truncada al minuto: el minuto del límite cuenta completo.';

notify pgrst, 'reload schema';

-- ── COMPROBACIÓN ─────────────────────────────────────────────────────
-- Con entrada 07:00 y tolerancia 15, los tres primeros deben dar
-- 'presente' y el último 'tardanza':
--
--   select public.asis_ventana(c, current_date, t, 15)
--     from public.asis_colaboradores c,
--          (values ('07:00:00'::time),('07:15:00'),('07:15:59'),('07:16:00')) v(t)
--    where c.nombre = 'Ida Laura Bermúdez Reyes';
--
-- ── HORARIOS MAL CARGADOS ────────────────────────────────────────────
-- Días gestionados cuya salida no es posterior a la entrada (nadie puede
-- marcar bien en esos días). Deberían salir cero filas:
--
--   select c.nombre, d.key as dia, d.value->>'ini' ini, d.value->>'fin' fin
--     from public.asis_colaboradores c,
--          jsonb_each(coalesce(c.horario_semanal,'{}'::jsonb)) d
--    where c.activo and coalesce(d.value->>'mod','no_gestiona') <> 'no_gestiona'
--      and coalesce(nullif(d.value->>'fin','')::time, c.hora_fin)
--       <= coalesce(nullif(d.value->>'ini','')::time, c.hora_inicio);
