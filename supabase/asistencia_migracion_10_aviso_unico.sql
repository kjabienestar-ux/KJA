-- =====================================================================
--  KJA · Asistencia — Migración 10: un solo aviso de horario pendiente
--  Aditiva y segura (no borra datos). Requiere la migración 9.
--
--  Antes, volver a entrar mostraba el formulario en blanco y se podía
--  mandar el mismo aviso una y otra vez. Ahora:
--
--    · El servidor rechaza un segundo aviso mientras haya uno pendiente.
--    · asis_mi_dia informa si ya hay uno, con qué se escribió y cuándo,
--      para que la pantalla muestre "ya lo enviaste" en vez del formulario.
--
--  Si alguien necesita corregir lo que escribió, dirección descarta el
--  aviso desde el panel y la persona puede mandar uno nuevo.
-- =====================================================================

-- ── 1) EL DÍA, AHORA CON EL AVISO PENDIENTE ──────────────────────────
create or replace function public.asis_mi_dia(p_colab public.asis_colaboradores, p_tol int)
returns jsonb language plpgsql stable as $$
declare
  v_hoy   date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_reg   public.asis_registros;
  v_ini   time := public.asis_hora_entrada(p_colab, v_hoy);
  v_fin   time := public.asis_hora_salida(p_colab, v_hoy);
  v_vent  text := public.asis_ventana(p_colab, v_hoy, v_ahora, p_tol);
  v_sol   public.asis_solicitudes_horario;
begin
  select * into v_reg from public.asis_registros
   where colaborador_id = p_colab.id and fecha = v_hoy;

  select * into v_sol from public.asis_solicitudes_horario
   where colaborador_id = p_colab.id and estado = 'pendiente' limit 1;

  return jsonb_build_object(
    'id', p_colab.id, 'nombre', p_colab.nombre,
    'fecha', v_hoy, 'ahora', v_ahora,
    'labora', public.asis_labora(p_colab, v_hoy),
    'modalidad', coalesce(p_colab.horario_semanal -> extract(isodow from v_hoy)::text ->> 'mod', 'virtual'),
    'hora_entrada', v_ini,
    'hora_salida', v_fin,
    'limite', case when v_ini is null then null else v_ini + make_interval(mins => p_tol) end,
    'tolerancia', p_tol,
    'ventana', v_vent,
    'puede_marcar', v_vent in ('presente','tardanza','sin_horario'),
    'marcado', v_reg.id is not null,
    'estado', v_reg.estado,
    'marcado_at', v_reg.marcado_at,
    'origen', v_reg.origen,
    -- null si no hay ninguno pendiente
    'aviso_horario', case when v_sol.id is null then null else jsonb_build_object(
        'texto', v_sol.horario_nuevo, 'creado_at', v_sol.creado_at) end);
end;
$$;

-- ── 2) PEDIR EL CAMBIO: uno a la vez ─────────────────────────────────
create or replace function public.asis_portal_pedir_horario(p_clave text, p_colab bigint,
                                                            p_pin text, p_texto text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg    public.asis_portal_config;
  v_colab  public.asis_colaboradores;
  v_k      public.asis_claves;
  v_hoy    date := (now() at time zone 'America/Lima')::date;
  v_sol    public.asis_solicitudes_horario;
  v_previo text;
begin
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_cfg is null or not v_cfg.activo or v_cfg.clave is distinct from p_clave then
    return jsonb_build_object('ok', false, 'motivo', 'clave');
  end if;

  select * into v_colab from public.asis_colaboradores where id = p_colab and activo;
  select * into v_k     from public.asis_claves        where colaborador_id = p_colab;
  if v_colab is null or v_k.colaborador_id is null
     or v_k.huella is distinct from public.asis_huella(v_k.sal, p_pin) then
    return jsonb_build_object('ok', false, 'motivo', 'incorrecta');
  end if;

  -- Ya hay uno esperando: no se manda otro, se le confirma el que tiene
  select * into v_sol from public.asis_solicitudes_horario
   where colaborador_id = p_colab and estado = 'pendiente' limit 1;
  if v_sol.id is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ya_pendiente',
      'texto', v_sol.horario_nuevo, 'creado_at', v_sol.creado_at);
  end if;

  if length(coalesce(btrim(p_texto), '')) < 6 then
    return jsonb_build_object('ok', false, 'motivo', 'corto');
  end if;

  -- Se guarda qué decía su ficha, para que dirección compare sin buscarlo
  v_previo := coalesce(
    to_char(public.asis_hora_entrada(v_colab, v_hoy), 'HH24:MI') || ' a ' ||
    to_char(public.asis_hora_salida(v_colab, v_hoy),  'HH24:MI'), 'sin horario cargado');

  insert into public.asis_solicitudes_horario (colaborador_id, horario_nuevo, horario_previo)
  values (p_colab, left(btrim(p_texto), 400), v_previo)
  returning * into v_sol;

  return jsonb_build_object('ok', true, 'texto', v_sol.horario_nuevo, 'creado_at', v_sol.creado_at);
exception when unique_violation then
  -- Dos envíos casi simultáneos: gana el primero
  select * into v_sol from public.asis_solicitudes_horario
   where colaborador_id = p_colab and estado = 'pendiente' limit 1;
  return jsonb_build_object('ok', false, 'motivo', 'ya_pendiente',
    'texto', v_sol.horario_nuevo, 'creado_at', v_sol.creado_at);
end;
$$;

notify pgrst, 'reload schema';
