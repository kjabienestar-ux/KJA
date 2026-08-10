-- =====================================================================
--  KJA · Asistencia — Migración 6: portal de marcado con clave propia
--  Aditiva y segura (no borra datos). Pegar en el SQL Editor y ejecutar.
--
--  Cada colaborador marca su propia asistencia entrando con su NOMBRE y
--  una CLAVE DE 4 DÍGITOS que él mismo crea la primera vez. Sin cuentas
--  de correo, sin contraseñas que administrar.
--
--  Por qué clave y no "recordar el dispositivo": la clave viaja con la
--  persona. Puede entrar desde su celular, desde la laptop de la oficina
--  o desde una cabina, y sigue siendo ella. Amarrar la identidad al
--  navegador dejaba fuera a quien cambiaba de equipo, borraba los datos
--  de navegación o entraba en incógnito.
--
--  Qué protege y qué no:
--    · Una clave se puede prestar. Eso no lo impide ningún sistema sin
--      biometría; se cubre con evidencia externa (la foto de los
--      presentes al inicio de la reunión).
--    · Probar claves ajenas sí se impide: 5 intentos fallidos bloquean a
--      esa persona 15 minutos, y los intentos quedan a la vista de
--      dirección.
--    · Toda marca guarda desde qué equipo se hizo, para que una anomalía
--      (cinco personas marcando desde el mismo aparato) se vea.
--
--  La RLS bloquea a los anónimos en todas las tablas asis_*, así que el
--  portal entra SOLO por estas funciones security definer, igual que
--  verificar_codigo() en el sistema de certificados.
-- =====================================================================

-- ── 1) CONFIGURACIÓN DEL PORTAL ──────────────────────────────────────
--    Fila única. La clave del enlace viaja en la URL: sin ella las
--    funciones no responden, para que la lista del equipo no quede
--    expuesta a cualquiera que adivine la dirección de la página.
create table if not exists public.asis_portal_config (
  id             int primary key default 1 check (id = 1),
  clave          text not null,
  tolerancia_min int  not null default 15,
  activo         boolean not null default true,
  actualizado_at timestamptz not null default now()
);

comment on column public.asis_portal_config.clave is
  'Clave del enlace público: /marcar?k=<clave>. Cambiarla invalida el enlace repartido';
comment on column public.asis_portal_config.tolerancia_min is
  'Minutos de gracia desde la hora de entrada de cada persona antes de que la marca cuente como tardanza';

insert into public.asis_portal_config (id, clave, tolerancia_min)
values (1, encode(sha256((random()::text || clock_timestamp()::text)::bytea), 'hex'), 15)
on conflict (id) do nothing;

-- ── 2) CLAVES PERSONALES ─────────────────────────────────────────────
--    Tabla aparte y CERRADA: tiene RLS activada y ninguna policy, así que
--    nadie la puede leer desde la API, ni siquiera dirección. Solo entran
--    las funciones security definer de más abajo.
--    Nunca se guarda la clave, solo su huella con una sal por persona.
create table if not exists public.asis_claves (
  colaborador_id   bigint primary key references public.asis_colaboradores(id) on delete cascade,
  sal              text not null,
  huella           text not null,
  creado_at        timestamptz not null default now(),
  intentos         int not null default 0,
  bloqueado_hasta  timestamptz,
  fallidos_total   int not null default 0,
  ultimo_ingreso   timestamptz
);

comment on table public.asis_claves is
  'Claves de 4 dígitos del portal. Cerrada por RLS sin policies: solo la tocan las funciones security definer';

-- ── 3) RASTRO EN LOS REGISTROS ───────────────────────────────────────
alter table public.asis_registros
  add column if not exists origen text not null default 'panel'
    check (origen in ('panel','portal'));
alter table public.asis_registros
  add column if not exists dispositivo text;

comment on column public.asis_registros.origen is
  'panel = lo marcó dirección/editor; portal = lo marcó la propia persona con su clave';

-- ── 4) HELPERS ───────────────────────────────────────────────────────
create or replace function public.asis_huella(p_sal text, p_pin text)
returns text language sql immutable as $$
  select encode(sha256((p_sal || '·' || p_pin)::bytea), 'hex');
$$;

--    Hora de entrada del día: primero su horario semanal, y si ese día no
--    la tiene, la hora general de su ficha.
create or replace function public.asis_hora_entrada(p_colab public.asis_colaboradores, p_fecha date)
returns time language sql stable as $$
  select coalesce(
    nullif(p_colab.horario_semanal -> extract(isodow from p_fecha)::text ->> 'ini', ''),
    nullif(p_colab.hora_inicio::text, '')
  )::time;
$$;

create or replace function public.asis_hora_salida(p_colab public.asis_colaboradores, p_fecha date)
returns time language sql stable as $$
  select coalesce(
    nullif(p_colab.horario_semanal -> extract(isodow from p_fecha)::text ->> 'fin', ''),
    nullif(p_colab.hora_fin::text, '')
  )::time;
$$;

--    ¿Labora esa fecha? Réplica en SQL de estadoDia() del front: manda la
--    excepción de la persona, luego el feriado de empresa, luego su horario.
create or replace function public.asis_labora(p_colab public.asis_colaboradores, p_fecha date)
returns boolean language plpgsql stable as $$
declare
  v_dow text := extract(isodow from p_fecha)::text;
  v_mod text;
  v_pex text;
begin
  select tipo into v_pex from public.asis_excepciones
   where fecha = p_fecha and ambito = 'colaborador' and colaborador_id = p_colab.id limit 1;
  if v_pex = 'laborable_extra' then return true; end if;

  if exists (select 1 from public.asis_excepciones
              where fecha = p_fecha and ambito = 'empresa') then return false; end if;

  if v_pex = 'no_laborable' then return false; end if;

  v_mod := p_colab.horario_semanal -> v_dow ->> 'mod';
  if v_mod is null then
    v_mod := case when extract(isodow from p_fecha)::int = any(p_colab.dias_laborables)
                  then 'virtual' else 'no_gestiona' end;
  end if;
  return v_mod <> 'no_gestiona';
end;
$$;

create or replace function public.asis_horas_dia(p_colab public.asis_colaboradores, p_fecha date)
returns numeric language sql stable as $$
  select nullif(extract(epoch from (
    public.asis_hora_salida(p_colab, p_fecha) - public.asis_hora_entrada(p_colab, p_fecha)
  )) / 3600.0, 0);
$$;

create or replace function public.asis_vinc_dia(p_colab public.asis_colaboradores, p_fecha date)
returns text language sql stable as $$
  select case when p_colab.tipo_vinculo = 'ambos'
              then coalesce(nullif(p_colab.horario_semanal -> extract(isodow from p_fecha)::text ->> 'vinc',''), 'practicas')
              else p_colab.tipo_vinculo end;
$$;

--    Retrato del día de una persona: es lo que ve apenas entra.
create or replace function public.asis_mi_dia(p_colab public.asis_colaboradores, p_tol int)
returns jsonb language plpgsql stable as $$
declare
  v_hoy   date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_reg   public.asis_registros;
  v_ini   time := public.asis_hora_entrada(p_colab, v_hoy);
begin
  select * into v_reg from public.asis_registros
   where colaborador_id = p_colab.id and fecha = v_hoy;
  return jsonb_build_object(
    'id', p_colab.id, 'nombre', p_colab.nombre,
    'fecha', v_hoy, 'ahora', v_ahora,
    'labora', public.asis_labora(p_colab, v_hoy),
    'modalidad', coalesce(p_colab.horario_semanal -> extract(isodow from v_hoy)::text ->> 'mod', 'virtual'),
    'hora_entrada', v_ini,
    'hora_salida', public.asis_hora_salida(p_colab, v_hoy),
    'limite', case when v_ini is null then null else v_ini + make_interval(mins => p_tol) end,
    'tolerancia', p_tol,
    'marcado', v_reg.id is not null,
    'estado', v_reg.estado,
    'marcado_at', v_reg.marcado_at,
    'origen', v_reg.origen);
end;
$$;

-- ── 5) RPC: LISTA DE NOMBRES ─────────────────────────────────────────
create or replace function public.asis_portal_personas(p_clave text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cfg public.asis_portal_config;
begin
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_cfg is null or not v_cfg.activo or v_cfg.clave is distinct from p_clave then
    return jsonb_build_object('ok', false, 'motivo', 'clave');
  end if;
  return jsonb_build_object('ok', true, 'personas', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'nombre', c.nombre, 'area', a.nombre,
             'tiene_clave', k.colaborador_id is not null) order by a.nombre, c.nombre)
      from public.asis_colaboradores c
      join public.asis_areas a on a.id = c.area_id
      left join public.asis_claves k on k.colaborador_id = c.id
     where c.activo), '[]'::jsonb));
end;
$$;

-- ── 6) RPC: CREAR LA CLAVE (solo si todavía no tiene) ────────────────
create or replace function public.asis_portal_crear_clave(p_clave text, p_colab bigint, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg   public.asis_portal_config;
  v_colab public.asis_colaboradores;
  v_sal   text;
begin
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_cfg is null or not v_cfg.activo or v_cfg.clave is distinct from p_clave then
    return jsonb_build_object('ok', false, 'motivo', 'clave');
  end if;
  if p_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'motivo', 'formato');
  end if;
  -- Las que cualquiera probaría de primeras
  if p_pin in ('0000','1111','2222','3333','4444','5555','6666','7777','8888','9999',
               '1234','4321','1212','2580','0123','9876') then
    return jsonb_build_object('ok', false, 'motivo', 'obvia');
  end if;

  select * into v_colab from public.asis_colaboradores where id = p_colab and activo;
  if v_colab is null then return jsonb_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if exists (select 1 from public.asis_claves where colaborador_id = p_colab) then
    return jsonb_build_object('ok', false, 'motivo', 'ya_tiene');
  end if;

  v_sal := encode(sha256((random()::text || clock_timestamp()::text)::bytea), 'hex');
  insert into public.asis_claves (colaborador_id, sal, huella, ultimo_ingreso)
  values (p_colab, v_sal, public.asis_huella(v_sal, p_pin), now());

  return jsonb_build_object('ok', true, 'dia', public.asis_mi_dia(v_colab, v_cfg.tolerancia_min));
exception when unique_violation then
  return jsonb_build_object('ok', false, 'motivo', 'ya_tiene');
end;
$$;

-- ── 7) RPC: ENTRAR ───────────────────────────────────────────────────
--    Devuelve el día completo de la persona. El freno de intentos vive
--    acá, del lado del servidor: el navegador no puede saltárselo.
create or replace function public.asis_portal_entrar(p_clave text, p_colab bigint, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg    public.asis_portal_config;
  v_colab  public.asis_colaboradores;
  v_k      public.asis_claves;
  v_espera int;
begin
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_cfg is null or not v_cfg.activo or v_cfg.clave is distinct from p_clave then
    return jsonb_build_object('ok', false, 'motivo', 'clave');
  end if;

  select * into v_colab from public.asis_colaboradores where id = p_colab and activo;
  if v_colab is null then return jsonb_build_object('ok', false, 'motivo', 'no_existe'); end if;

  select * into v_k from public.asis_claves where colaborador_id = p_colab;
  if v_k.colaborador_id is null then return jsonb_build_object('ok', false, 'motivo', 'sin_clave'); end if;

  if v_k.bloqueado_hasta is not null and v_k.bloqueado_hasta > now() then
    v_espera := ceil(extract(epoch from (v_k.bloqueado_hasta - now())) / 60.0);
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado', 'minutos', v_espera);
  end if;

  if v_k.huella is distinct from public.asis_huella(v_k.sal, p_pin) then
    update public.asis_claves
       set fallidos_total  = fallidos_total + 1,
           intentos        = case when intentos + 1 >= 5 then 0 else intentos + 1 end,
           bloqueado_hasta = case when intentos + 1 >= 5
                                  then now() + interval '15 minutes' else bloqueado_hasta end
     where colaborador_id = p_colab;
    return jsonb_build_object('ok', false, 'motivo', 'incorrecta',
      'restantes', greatest(0, 4 - v_k.intentos));
  end if;

  update public.asis_claves
     set intentos = 0, bloqueado_hasta = null, ultimo_ingreso = now()
   where colaborador_id = p_colab;

  return jsonb_build_object('ok', true, 'dia', public.asis_mi_dia(v_colab, v_cfg.tolerancia_min));
end;
$$;

-- ── 8) RPC: MARCAR ───────────────────────────────────────────────────
--    Vuelve a pedir la clave: cada marca se autentica sola, así no hay
--    sesión que robar ni que expirar.
create or replace function public.asis_portal_marcar(p_clave text, p_colab bigint,
                                                     p_pin text, p_disp text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg    public.asis_portal_config;
  v_colab  public.asis_colaboradores;
  v_k      public.asis_claves;
  v_hoy    date := (now() at time zone 'America/Lima')::date;
  v_ahora  time := (now() at time zone 'America/Lima')::time;
  v_reg    public.asis_registros;
  v_ini    time;
  v_estado text;
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

  if not public.asis_labora(v_colab, v_hoy) then
    return jsonb_build_object('ok', false, 'motivo', 'no_labora');
  end if;

  select * into v_reg from public.asis_registros
   where colaborador_id = v_colab.id and fecha = v_hoy;
  if v_reg.id is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ya_marcado',
      'estado', v_reg.estado, 'marcado_at', v_reg.marcado_at);
  end if;

  v_ini := public.asis_hora_entrada(v_colab, v_hoy);
  -- Sin hora de entrada cargada no se puede juzgar el atraso: se da por presente
  v_estado := case
    when v_ini is null then 'P'
    when v_ahora <= v_ini + make_interval(mins => v_cfg.tolerancia_min) then 'P'
    else 'T' end;

  insert into public.asis_registros
    (colaborador_id, fecha, estado, origen, dispositivo, horas, vinculo)
  values (v_colab.id, v_hoy, v_estado, 'portal', left(coalesce(p_disp,''), 80),
          public.asis_horas_dia(v_colab, v_hoy), public.asis_vinc_dia(v_colab, v_hoy));

  return jsonb_build_object('ok', true, 'estado', v_estado, 'hora', v_ahora,
    'dia', public.asis_mi_dia(v_colab, v_cfg.tolerancia_min));
exception when unique_violation then
  return jsonb_build_object('ok', false, 'motivo', 'ya_marcado');
end;
$$;

-- ── 9) RPC: ESTADO DE LAS CLAVES (para el panel) ─────────────────────
--    Devuelve lo que dirección necesita ver, nunca la huella ni la sal.
create or replace function public.asis_estado_claves()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.asis_es_miembro() then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  return jsonb_build_object('ok', true, 'claves', coalesce((
    select jsonb_agg(jsonb_build_object(
             'colaborador_id', k.colaborador_id,
             'creado_at', k.creado_at,
             'ultimo_ingreso', k.ultimo_ingreso,
             'fallidos_total', k.fallidos_total,
             'bloqueado', k.bloqueado_hasta is not null and k.bloqueado_hasta > now(),
             'bloqueado_hasta', k.bloqueado_hasta))
      from public.asis_claves k), '[]'::jsonb));
end;
$$;

-- ── 10) RPC: REINICIAR LA CLAVE DE ALGUIEN (solo dirección) ──────────
--    Para quien la olvidó: se borra la suya y la vuelve a crear al entrar.
create or replace function public.asis_reiniciar_clave(p_colab bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  delete from public.asis_claves where colaborador_id = p_colab;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── 11) PERMISOS ─────────────────────────────────────────────────────
--    asis_claves queda con RLS y SIN policies: nadie la lee por la API.
alter table public.asis_claves        enable row level security;
alter table public.asis_portal_config enable row level security;

drop policy if exists asis_cfg_sel on public.asis_portal_config;
drop policy if exists asis_cfg_upd on public.asis_portal_config;
create policy asis_cfg_sel on public.asis_portal_config for select using (public.asis_es_miembro());
create policy asis_cfg_upd on public.asis_portal_config for update using (public.asis_rol() = 'direccion')
                                                          with check (public.asis_rol() = 'direccion');

grant execute on function public.asis_portal_personas(text)                   to anon, authenticated;
grant execute on function public.asis_portal_crear_clave(text, bigint, text)  to anon, authenticated;
grant execute on function public.asis_portal_entrar(text, bigint, text)       to anon, authenticated;
grant execute on function public.asis_portal_marcar(text, bigint, text, text) to anon, authenticated;
grant execute on function public.asis_estado_claves()                         to authenticated;
grant execute on function public.asis_reiniciar_clave(bigint)                 to authenticated;

notify pgrst, 'reload schema';

-- ── 12) EL ENLACE QUE HAY QUE REPARTIR ───────────────────────────────
--    Ejecutar aparte para ver la dirección final:
--
--    select 'https://www.kjadmb.com/marcar?k=' || clave as enlace
--      from public.asis_portal_config where id = 1;
