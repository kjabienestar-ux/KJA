-- ══════════════════════════════════════════════════════════════════════
--  KJA · Dashboard — Paso 2b: portal personal y asistencia autenticada
--
--  REQUISITOS
--    · dashboard_01_identidad_y_roles.sql
--    · dashboard_03_cerrar_panel.sql
--    · migraciones de asistencia 1–14
--
--  QUÉ AÑADE
--    · Entrada por DNI + PIN sin exponer la lista de colaboradores.
--    · Sesiones del dashboard con tope absoluto de 8 horas.
--    · RLS: miembro ve lo suyo, líder su área, sistemas todo.
--    · RPC autenticadas para inicio, historial, evidencia y marcado.
--
--  QUÉ CONSERVA
--    · marcar.html y sus RPC siguen funcionando durante la transición.
--    · Las cuentas del panel conservan exactamente sus permisos actuales.
--    · El PIN sigue en asis_claves y nunca se devuelve al navegador.
--
--  IMPORTANTE
--  NO volver a ejecutar dashboard_03_cerrar_panel.sql después de crear
--  cuentas del dashboard: aquel archivo marca como acceso_panel a todas
--  las cuentas que existan en el momento de ejecutarlo.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1) DNI UTILIZABLE COMO IDENTIFICADOR ─────────────────────────────
-- El índice no obliga a que todos tengan DNI hoy, pero impide que dos
-- personas terminen compartiendo el mismo acceso cuando sí está cargado.
-- Todo el archivo se aplica como una sola unidad: si alguna sentencia falla,
-- PostgreSQL revierte esta ejecución y conserva intacto el estado anterior.
begin;

do $$
begin
  if exists (
    select 1
      from public.asis_colaboradores
     where nullif(regexp_replace(coalesce(dni, ''), '[^0-9]', '', 'g'), '') is not null
     group by regexp_replace(dni, '[^0-9]', '', 'g')
    having count(*) > 1
  ) then
    raise exception 'Hay DNI duplicados en asis_colaboradores. Corrígelos antes de habilitar el dashboard.';
  end if;
end;
$$;

create unique index if not exists asis_colab_dni_normalizado_uniq
  on public.asis_colaboradores ((regexp_replace(dni, '[^0-9]', '', 'g')))
  where nullif(regexp_replace(coalesce(dni, ''), '[^0-9]', '', 'g'), '') is not null;


-- ── 2) SESIONES DE OCHO HORAS ────────────────────────────────────────
-- Supabase puede refrescar su JWT; esta tabla impone además un vencimiento
-- de negocio. Aunque una pestaña conserve el token, RLS deja de responder.
create table if not exists public.dash_sesiones (
  session_id  text primary key,
  perfil_id   uuid not null references public.asis_perfiles(id) on delete cascade,
  creada_at   timestamptz not null default now(),
  vence_at    timestamptz not null,
  revocada_at timestamptz,
  constraint dash_sesion_vence_chk check (vence_at > creada_at)
);
create index if not exists dash_sesiones_perfil_idx
  on public.dash_sesiones(perfil_id, vence_at desc);

alter table public.dash_sesiones enable row level security;
revoke all on table public.dash_sesiones from public, anon, authenticated;
grant all on table public.dash_sesiones to service_role;

create or replace function public.dash_sesion_vigente()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_sid   text := auth.jwt() ->> 'session_id';
  v_panel boolean;
begin
  select acceso_panel into v_panel
    from public.asis_perfiles
   where id = auth.uid() and activo = true;

  -- Las cuentas administrativas entran con correo y se rigen por la
  -- sesión normal de Supabase. El tope de 8 h aplica a las cuentas PIN.
  if coalesce(v_panel, false) then return true; end if;
  if auth.uid() is null or coalesce(v_sid, '') = '' then return false; end if;

  return exists (
    select 1 from public.dash_sesiones s
     where s.session_id = v_sid
       and s.perfil_id = auth.uid()
       and s.revocada_at is null
       and s.vence_at > now()
  );
end;
$$;

revoke all on function public.dash_sesion_vigente() from public, anon;
grant execute on function public.dash_sesion_vigente() to authenticated;


-- ── 3) CONTEXTO Y VISIBILIDAD, AHORA LIGADOS A LA SESIÓN ─────────────
create or replace function public.dash_colab()
returns bigint language sql stable security definer set search_path = public as $$
  select colaborador_id from public.asis_perfiles
   where id = auth.uid() and activo = true and public.dash_sesion_vigente();
$$;

create or replace function public.dash_nivel()
returns text language sql stable security definer set search_path = public as $$
  select nivel from public.asis_perfiles
   where id = auth.uid() and activo = true and public.dash_sesion_vigente();
$$;

create or replace function public.dash_area()
returns bigint language sql stable security definer set search_path = public as $$
  select c.area_id
    from public.asis_perfiles p
    join public.asis_colaboradores c on c.id = p.colaborador_id
   where p.id = auth.uid() and p.activo = true and public.dash_sesion_vigente();
$$;

create or replace function public.puede_ver_colab(p_colab bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.dash_sesion_vigente() and case
    when p_colab is null                       then false
    when public.dash_nivel() = 'sistemas'      then true
    when p_colab = public.dash_colab()         then true
    when public.dash_nivel() = 'lider'         then exists (
           select 1 from public.asis_colaboradores c
            where c.id = p_colab and c.area_id = public.dash_area())
    else false
  end;
$$;

grant execute on function public.dash_colab(), public.dash_nivel(),
                          public.dash_area(), public.puede_ver_colab(bigint)
  to authenticated;


-- ── 4) VALIDAR DNI + PIN (SOLO LA EDGE FUNCTION) ─────────────────────
-- Devuelve el colaborador únicamente después de validar el PIN. La fila
-- de asis_claves se bloquea durante la comprobación para que dos intentos
-- simultáneos no eviten el contador de fallos.
create or replace function public.dash_validar_pin(p_dni text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dni    text := regexp_replace(coalesce(p_dni, ''), '[^0-9]', '', 'g');
  v_colab  public.asis_colaboradores;
  v_k      public.asis_claves;
  v_espera int;
begin
  if v_dni !~ '^[0-9]{8}$' or coalesce(p_pin, '') !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'motivo', 'credenciales');
  end if;

  select * into v_colab
    from public.asis_colaboradores
   where activo and regexp_replace(coalesce(dni, ''), '[^0-9]', '', 'g') = v_dni;
  if v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'credenciales');
  end if;

  select * into v_k from public.asis_claves
   where colaborador_id = v_colab.id for update;
  if v_k.colaborador_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_clave');
  end if;

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
     where colaborador_id = v_colab.id;
    return jsonb_build_object('ok', false, 'motivo', 'credenciales',
      'restantes', greatest(0, 4 - v_k.intentos));
  end if;

  update public.asis_claves
     set intentos = 0, bloqueado_hasta = null, ultimo_ingreso = now()
   where colaborador_id = v_colab.id;

  return jsonb_build_object('ok', true, 'colab', v_colab.id, 'nombre', v_colab.nombre,
                            'area', v_colab.area_id);
end;
$$;

revoke all on function public.dash_validar_pin(text, text) from public, anon, authenticated;
grant execute on function public.dash_validar_pin(text, text) to service_role;


-- ── 5) DATOS DE INICIO ───────────────────────────────────────────────
-- p_colab permite que un líder abra a alguien de su área. Nulo = lo mío.
create or replace function public.dash_inicio(p_colab bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_objetivo bigint := coalesce(p_colab, public.dash_colab());
  v_perfil   public.asis_perfiles;
  v_colab    public.asis_colaboradores;
  v_area     text;
  v_cfg      public.asis_portal_config;
begin
  if not public.dash_sesion_vigente() then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;

  select * into v_perfil from public.asis_perfiles
   where id = auth.uid() and activo = true;

  -- Sistemas puede no estar vinculado a una ficha de colaborador.
  if v_objetivo is null then
    return jsonb_build_object('ok', true,
      'perfil', jsonb_build_object('nombre', v_perfil.nombre, 'nivel', v_perfil.nivel,
                                   'colab', v_perfil.colaborador_id),
      'colaborador', null, 'dia', null);
  end if;

  if not public.puede_ver_colab(v_objetivo) then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;

  -- PostgreSQL no permite combinar una variable de fila completa con otra
  -- variable escalar dentro del mismo INTO. Se cargan por separado.
  select * into v_colab
    from public.asis_colaboradores
   where id = v_objetivo;
  if v_colab is null then return jsonb_build_object('ok', false, 'motivo', 'no_existe'); end if;

  select nombre into v_area
    from public.asis_areas
   where id = v_colab.area_id;

  select * into v_cfg from public.asis_portal_config where id = 1;

  return jsonb_build_object(
    'ok', true,
    'perfil', jsonb_build_object('nombre', v_perfil.nombre, 'nivel', v_perfil.nivel,
                                 'colab', v_perfil.colaborador_id),
    'colaborador', jsonb_build_object(
      'id', v_colab.id,
      'nombre', v_colab.nombre,
      'dni', case when length(regexp_replace(coalesce(v_colab.dni,''),'[^0-9]','','g')) >= 4
                  then '••••' || right(regexp_replace(v_colab.dni,'[^0-9]','','g'), 4)
                  else '—' end,
      'area_id', v_colab.area_id,
      'area', v_area,
      'tipo_vinculo', v_colab.tipo_vinculo,
      'dias_laborables', v_colab.dias_laborables,
      'hora_inicio', v_colab.hora_inicio,
      'hora_fin', v_colab.hora_fin,
      'horario_semanal', v_colab.horario_semanal,
      'contrato_inicio', v_colab.contrato_inicio,
      'contrato_fin_referencia', v_colab.contrato_fin_referencia,
      'contrato_horas', v_colab.contrato_horas,
      'contrato_horas_voluntariado', v_colab.contrato_horas_voluntariado,
      'horas_previas', v_colab.horas_previas,
      'activo', v_colab.activo),
    'dia', public.asis_mi_dia(v_colab, coalesce(v_cfg.tolerancia_min, 15)),
    'exigir_evidencia', coalesce(v_cfg.exigir_evidencia, false));
end;
$$;

grant execute on function public.dash_inicio(bigint) to authenticated;


-- ── 6) HISTORIAL MENSUAL ────────────────────────────────────────────
create or replace function public.dash_historial(p_anio int, p_mes int, p_colab bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_objetivo bigint := coalesce(p_colab, public.dash_colab());
  v_colab    public.asis_colaboradores;
  v_ini      date;
  v_fin      date;
  v_hoy      date := (now() at time zone 'America/Lima')::date;
  v_dias     jsonb;
  v_p int; v_t int; v_j int; v_ng int; v_lab int;
  v_horas numeric; v_meta numeric;
begin
  if not public.dash_sesion_vigente() or not public.puede_ver_colab(v_objetivo) then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_mes not between 1 and 12 or p_anio not between 2020 and extract(year from v_hoy)::int then
    return jsonb_build_object('ok', false, 'motivo', 'fecha');
  end if;

  select * into v_colab from public.asis_colaboradores where id = v_objetivo;
  if v_colab is null then return jsonb_build_object('ok', false, 'motivo', 'no_existe'); end if;

  v_ini := make_date(p_anio, p_mes, 1);
  if v_ini > date_trunc('month', v_hoy)::date then v_ini := date_trunc('month', v_hoy)::date; end if;
  v_fin := (v_ini + interval '1 month' - interval '1 day')::date;

  select jsonb_agg(jsonb_build_object(
           'd', extract(day from g.d)::int, 'fecha', g.d::date,
           'dow', extract(isodow from g.d)::int,
           'lab', public.asis_labora(v_colab, g.d::date),
           'estado', r.estado, 'marcado_at', r.marcado_at,
           'futuro', g.d::date > v_hoy) order by g.d)
    into v_dias
    from generate_series(v_ini, v_fin, interval '1 day') g(d)
    left join public.asis_registros r
      on r.colaborador_id = v_objetivo and r.fecha = g.d::date;

  select count(*) filter (where estado='P'), count(*) filter (where estado='T'),
         count(*) filter (where estado='J'), count(*) filter (where estado='NG')
    into v_p, v_t, v_j, v_ng
    from public.asis_registros
   where colaborador_id = v_objetivo and fecha between v_ini and v_fin;

  select count(*) into v_lab
    from generate_series(v_ini, least(v_fin, v_hoy), interval '1 day') g(d)
   where public.asis_labora(v_colab, g.d::date);

  select coalesce(v_colab.horas_previas,0) + coalesce(sum(horas),0)
    into v_horas from public.asis_registros
   where colaborador_id = v_objetivo and estado in ('P','T','J');

  v_meta := coalesce(v_colab.contrato_horas,0) +
    case when v_colab.tipo_vinculo='ambos'
         then coalesce(v_colab.contrato_horas_voluntariado,0) else 0 end;

  return jsonb_build_object(
    'ok', true, 'anio', extract(year from v_ini)::int, 'mes', extract(month from v_ini)::int,
    'hoy', v_hoy, 'dias', coalesce(v_dias,'[]'::jsonb),
    'totales', jsonb_build_object('P',v_p,'T',v_t,'J',v_j,'NG',v_ng,'laborables',v_lab),
    'horas', round(v_horas,1), 'meta', nullif(v_meta,0), 'vinculo', v_colab.tipo_vinculo);
end;
$$;

grant execute on function public.dash_historial(int, int, bigint) to authenticated;


-- ── 7) PERMISO DE EVIDENCIA AUTENTICADO ─────────────────────────────
create or replace function public.dash_evidencia_permiso(p_ext text default 'webp')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id    bigint := public.dash_colab();
  v_colab public.asis_colaboradores;
  v_cfg   public.asis_portal_config;
  v_hoy   date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_vent  text; v_ext text;
begin
  if not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;
  select * into v_colab from public.asis_colaboradores where id=v_id and activo;
  select * into v_cfg from public.asis_portal_config where id=1;
  if v_colab is null then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  if not public.asis_labora(v_colab,v_hoy) then return jsonb_build_object('ok',false,'motivo','no_labora'); end if;
  if exists(select 1 from public.asis_registros where colaborador_id=v_id and fecha=v_hoy) then
    return jsonb_build_object('ok',false,'motivo','ya_marcado');
  end if;
  v_vent := public.asis_ventana(v_colab,v_hoy,v_ahora,coalesce(v_cfg.tolerancia_min,15));
  if v_vent in ('antes','cerrada') then
    return jsonb_build_object('ok',false,'motivo','fuera_ventana','ventana',v_vent);
  end if;
  v_ext := case when lower(coalesce(p_ext,'')) in ('webp','jpg','jpeg') then lower(p_ext) else 'webp' end;
  return jsonb_build_object('ok',true,
    'ruta',to_char(v_hoy,'YYYY/MM')||'/'||v_id||'/'||to_char(v_hoy,'YYYY-MM-DD')||'.'||v_ext,
    'nombre',v_colab.nombre,'servidor_at',now());
end;
$$;

revoke all on function public.dash_evidencia_permiso(text) from public, anon;
grant execute on function public.dash_evidencia_permiso(text) to authenticated;


-- ── 8) MARCADO AUTENTICADO ──────────────────────────────────────────
alter table public.asis_registros drop constraint if exists asis_registros_origen_check;
alter table public.asis_registros add constraint asis_registros_origen_check
  check (origen in ('panel','portal','dashboard'));

create or replace function public.dash_marcar(
  p_disp text, p_foto text default null, p_foto_org text default null,
  p_lat numeric default null, p_lon numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id bigint := public.dash_colab();
  v_cfg public.asis_portal_config; v_colab public.asis_colaboradores;
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_reg public.asis_registros; v_vent text; v_estado text; v_prefijo text;
begin
  if not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  select * into v_cfg from public.asis_portal_config where id=1;
  select * into v_colab from public.asis_colaboradores where id=v_id and activo;
  if v_colab is null then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  if not public.asis_labora(v_colab,v_hoy) then return jsonb_build_object('ok',false,'motivo','no_labora'); end if;
  if coalesce(v_cfg.exigir_evidencia,false) and coalesce(btrim(p_foto),'')='' then
    return jsonb_build_object('ok',false,'motivo','falta_evidencia');
  end if;

  v_prefijo := to_char(v_hoy,'YYYY/MM')||'/'||v_id||'/'||to_char(v_hoy,'YYYY-MM-DD')||'.';
  if coalesce(btrim(p_foto),'')<>'' and btrim(p_foto) not in
       (v_prefijo||'webp', v_prefijo||'jpg', v_prefijo||'jpeg') then
    return jsonb_build_object('ok',false,'motivo','evidencia_invalida');
  end if;

  select * into v_reg from public.asis_registros where colaborador_id=v_id and fecha=v_hoy;
  if v_reg.id is not null then
    return jsonb_build_object('ok',false,'motivo','ya_marcado','estado',v_reg.estado,'marcado_at',v_reg.marcado_at);
  end if;

  v_vent := public.asis_ventana(v_colab,v_hoy,v_ahora,coalesce(v_cfg.tolerancia_min,15));
  if v_vent in ('antes','cerrada') then
    return jsonb_build_object('ok',false,'motivo','fuera_ventana','ventana',v_vent,
      'dia',public.asis_mi_dia(v_colab,coalesce(v_cfg.tolerancia_min,15)));
  end if;
  v_estado := case when v_vent='tardanza' then 'T' else 'P' end;

  insert into public.asis_registros
    (colaborador_id,fecha,estado,origen,dispositivo,marcado_por,horas,vinculo,
     evidencia_path,evidencia_origen,evidencia_lat,evidencia_lon,evidencia_at)
  values
    (v_id,v_hoy,v_estado,'dashboard',left(coalesce(p_disp,''),80),auth.uid(),
     public.asis_horas_dia(v_colab,v_hoy),public.asis_vinc_dia(v_colab,v_hoy),
     nullif(btrim(coalesce(p_foto,'')),''),
     case when p_foto_org in ('camara','archivo') then p_foto_org else null end,
     p_lat,p_lon,case when coalesce(btrim(p_foto),'')<>'' then now() else null end);

  return jsonb_build_object('ok',true,'estado',v_estado,'hora',v_ahora,
    'dia',public.asis_mi_dia(v_colab,coalesce(v_cfg.tolerancia_min,15)));
exception when unique_violation then
  return jsonb_build_object('ok',false,'motivo','ya_marcado');
end;
$$;

revoke all on function public.dash_marcar(text,text,text,numeric,numeric) from public, anon;
grant execute on function public.dash_marcar(text,text,text,numeric,numeric) to authenticated;


-- ── 9) AVISO DE CAMBIO DE HORARIO AUTENTICADO ───────────────────────
create or replace function public.dash_pedir_horario(p_texto text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id bigint := public.dash_colab(); v_colab public.asis_colaboradores;
  v_sol public.asis_solicitudes_horario; v_hoy date := (now() at time zone 'America/Lima')::date;
  v_previo text;
begin
  if not public.dash_sesion_vigente() or v_id is null then return jsonb_build_object('ok',false,'motivo','sesion'); end if;
  select * into v_colab from public.asis_colaboradores where id=v_id and activo;
  select * into v_sol from public.asis_solicitudes_horario
   where colaborador_id=v_id and estado='pendiente' limit 1;
  if v_sol.id is not null then
    return jsonb_build_object('ok',false,'motivo','ya_pendiente','texto',v_sol.horario_nuevo,'creado_at',v_sol.creado_at);
  end if;
  if length(coalesce(btrim(p_texto),''))<6 then return jsonb_build_object('ok',false,'motivo','corto'); end if;
  v_previo := coalesce(to_char(public.asis_hora_entrada(v_colab,v_hoy),'HH24:MI')||' a '||
                       to_char(public.asis_hora_salida(v_colab,v_hoy),'HH24:MI'),'sin horario cargado');
  insert into public.asis_solicitudes_horario(colaborador_id,horario_nuevo,horario_previo)
  values(v_id,left(btrim(p_texto),400),v_previo);
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.dash_pedir_horario(text) from public, anon;
grant execute on function public.dash_pedir_horario(text) to authenticated;


-- ── 10) POLÍTICAS DE LECTURA ─────────────────────────────────────────
drop policy if exists asis_perf_sel on public.asis_perfiles;
create policy asis_perf_sel on public.asis_perfiles for select using (
  public.asis_es_miembro() or
  (public.dash_sesion_vigente() and (id=auth.uid() or public.dash_nivel()='sistemas'))
);

drop policy if exists asis_areas_sel on public.asis_areas;
create policy asis_areas_sel on public.asis_areas for select using (
  public.asis_es_miembro() or
  (public.dash_sesion_vigente() and (public.dash_nivel()='sistemas' or id=public.dash_area()))
);

drop policy if exists asis_colaboradores_sel on public.asis_colaboradores;
create policy asis_colaboradores_sel on public.asis_colaboradores for select using (
  public.asis_es_miembro() or (public.dash_sesion_vigente() and public.puede_ver_colab(id))
);

drop policy if exists asis_registros_sel on public.asis_registros;
create policy asis_registros_sel on public.asis_registros for select using (
  public.asis_es_miembro() or (public.dash_sesion_vigente() and public.puede_ver_colab(colaborador_id))
);

drop policy if exists asis_excepciones_sel on public.asis_excepciones;
create policy asis_excepciones_sel on public.asis_excepciones for select using (
  public.asis_es_miembro() or
  (public.dash_sesion_vigente() and (ambito='empresa' or public.puede_ver_colab(colaborador_id)))
);

drop policy if exists asis_historial_contrato_sel on public.asis_historial_contrato;
create policy asis_historial_contrato_sel on public.asis_historial_contrato for select using (
  public.asis_es_miembro() or (public.dash_sesion_vigente() and public.puede_ver_colab(colaborador_id))
);

drop policy if exists asis_solhor_sel on public.asis_solicitudes_horario;
create policy asis_solhor_sel on public.asis_solicitudes_horario for select using (
  public.asis_es_miembro() or (public.dash_sesion_vigente() and public.puede_ver_colab(colaborador_id))
);

drop policy if exists "asis evidencias: ver miembros" on storage.objects;
create policy "asis evidencias: ver miembros"
  on storage.objects for select to authenticated using (
    bucket_id='asis-evidencias' and (
      public.asis_es_miembro() or
      (public.dash_sesion_vigente() and public.puede_ver_colab(
        case when split_part(name,'/',3) ~ '^[0-9]+$'
             then split_part(name,'/',3)::bigint else null end))
    )
  );

notify pgrst, 'reload schema';


-- ── COMPROBACIÓN ─────────────────────────────────────────────────────
-- Después de ejecutar, todas las filas deben decir OK.
select case when encontrado=esperado then 'OK' else '*** REVISAR ***' end estado,
       pieza,encontrado,esperado
from (
  select 'tabla dash_sesiones' pieza,
    (select count(*)::int from information_schema.tables where table_schema='public' and table_name='dash_sesiones') encontrado,1 esperado
  union all select 'RPC del dashboard',
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('dash_inicio','dash_historial','dash_marcar','dash_evidencia_permiso','dash_pedir_horario','dash_validar_pin')),6
  union all select 'orígenes inválidos',
    (select count(*)::int from public.asis_registros where origen not in ('panel','portal','dashboard')),0
  union all select 'DNI duplicados',
    (select count(*)::int from (select regexp_replace(dni,'[^0-9]','','g') d from public.asis_colaboradores
      where nullif(regexp_replace(coalesce(dni,''),'[^0-9]','','g'),'') is not null group by 1 having count(*)>1) x),0
) q;

commit;
