-- ============================================================================
-- KJA · Dashboard 18 — banco auditable de días libres
--
-- Dirección asigna o corrige el saldo. Cuando aprueba una solicitud de tipo
-- dia_libre, el servidor descuenta automáticamente los días laborables usados.
-- No recalcula solicitudes antiguas ni modifica asistencias existentes.
-- ============================================================================

begin;

alter table public.asis_colaboradores
  add column if not exists dias_libres_saldo integer not null default 0;

alter table public.asis_colaboradores
  drop constraint if exists asis_colaboradores_dias_libres_saldo_chk;
alter table public.asis_colaboradores
  add constraint asis_colaboradores_dias_libres_saldo_chk
  check (dias_libres_saldo between 0 and 365);

create table if not exists public.asis_dias_libres_movimientos (
  id                 bigint generated always as identity primary key,
  colaborador_id     bigint not null references public.asis_colaboradores(id) on delete cascade,
  cantidad           integer not null check (cantidad between -30 and 30 and cantidad <> 0),
  saldo_anterior     integer not null check (saldo_anterior between 0 and 365),
  saldo_resultante   integer not null check (saldo_resultante between 0 and 365),
  motivo             text not null check (length(btrim(motivo)) between 3 and 180),
  solicitud_id       bigint references public.asis_solicitudes_personales(id) on delete set null,
  creado_por         uuid references public.asis_perfiles(id),
  creado_at          timestamptz not null default now()
);

create index if not exists asis_dias_libres_mov_colab_idx
  on public.asis_dias_libres_movimientos(colaborador_id, creado_at desc);
create unique index if not exists asis_dias_libres_mov_solicitud_idx
  on public.asis_dias_libres_movimientos(solicitud_id)
  where solicitud_id is not null;

alter table public.asis_dias_libres_movimientos enable row level security;
revoke all on table public.asis_dias_libres_movimientos from public, anon, authenticated;
revoke all on sequence public.asis_dias_libres_movimientos_id_seq from public, anon, authenticated;

create or replace function public.dash_admin_saldos_dias_libres()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.asis_rol() is distinct from 'direccion'
    then jsonb_build_object('ok', false, 'motivo', 'sin_permiso')
    else jsonb_build_object(
      'ok', true,
      'saldos', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id,
          'saldo', c.dias_libres_saldo
        ) order by c.id)
        from public.asis_colaboradores c
      ), '[]'::jsonb)
    )
  end;
$$;

create or replace function public.dash_admin_dias_libres(p_colab bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_persona jsonb;
  v_movimientos jsonb;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;

  select jsonb_build_object(
    'id', c.id,
    'nombre', c.nombre,
    'area', a.nombre,
    'saldo', c.dias_libres_saldo
  ) into v_persona
  from public.asis_colaboradores c
  join public.asis_areas a on a.id = c.area_id
  where c.id = p_colab;

  if v_persona is null then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;

  select jsonb_agg(jsonb_build_object(
    'id', m.id,
    'cantidad', m.cantidad,
    'saldo_anterior', m.saldo_anterior,
    'saldo_resultante', m.saldo_resultante,
    'motivo', m.motivo,
    'solicitud_id', m.solicitud_id,
    'creado_at', m.creado_at,
    'actor', coalesce(p.nombre, 'Dirección')
  ) order by m.creado_at desc)
  into v_movimientos
  from public.asis_dias_libres_movimientos m
  left join public.asis_perfiles p on p.id = m.creado_por
  where m.colaborador_id = p_colab;

  return jsonb_build_object(
    'ok', true,
    'persona', v_persona,
    'movimientos', coalesce(v_movimientos, '[]'::jsonb)
  );
end;
$$;

create or replace function public.dash_admin_ajustar_dias_libres(
  p_colab bigint,
  p_cantidad integer,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anterior integer;
  v_nuevo integer;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_cantidad is null or p_cantidad = 0 or abs(p_cantidad) > 30 then
    return jsonb_build_object('ok', false, 'motivo', 'cantidad');
  end if;
  if length(v_motivo) not between 3 and 180 then
    return jsonb_build_object('ok', false, 'motivo', 'detalle');
  end if;

  select dias_libres_saldo into v_anterior
  from public.asis_colaboradores
  where id = p_colab
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;

  v_nuevo := v_anterior + p_cantidad;
  if v_nuevo < 0 then
    return jsonb_build_object('ok', false, 'motivo', 'saldo_insuficiente', 'saldo', v_anterior);
  end if;
  if v_nuevo > 365 then
    return jsonb_build_object('ok', false, 'motivo', 'saldo_maximo');
  end if;

  update public.asis_colaboradores
  set dias_libres_saldo = v_nuevo
  where id = p_colab;

  insert into public.asis_dias_libres_movimientos(
    colaborador_id, cantidad, saldo_anterior, saldo_resultante, motivo, creado_por
  ) values(
    p_colab, p_cantidad, v_anterior, v_nuevo, v_motivo, auth.uid()
  );

  return jsonb_build_object('ok', true, 'saldo', v_nuevo);
end;
$$;

create or replace function public.dash_mis_dias_libres()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id bigint := public.dash_colab();
  v_saldo integer;
begin
  if not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;
  select dias_libres_saldo into v_saldo
  from public.asis_colaboradores
  where id = v_id and activo;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;
  return jsonb_build_object('ok', true, 'saldo', v_saldo);
end;
$$;

create or replace function public.asis_descontar_dia_libre_aprobado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colab public.asis_colaboradores;
  v_dias integer;
  v_anterior integer;
begin
  if new.tipo <> 'dia_libre'
     or new.estado <> 'aprobada'
     or old.estado = 'aprobada' then
    return new;
  end if;

  select * into v_colab
  from public.asis_colaboradores
  where id = new.colaborador_id
  for update;

  select count(*)::integer into v_dias
  from generate_series(new.fecha_inicio, new.fecha_fin, interval '1 day') fecha
  where public.asis_labora(v_colab, fecha::date);

  if v_dias <= 0 then
    raise exception using message = 'dia_libre_sin_dias_laborables';
  end if;

  v_anterior := v_colab.dias_libres_saldo;
  if v_anterior < v_dias then
    raise exception using message = 'saldo_dias_libres_insuficiente';
  end if;

  update public.asis_colaboradores
  set dias_libres_saldo = v_anterior - v_dias
  where id = new.colaborador_id;

  insert into public.asis_dias_libres_movimientos(
    colaborador_id, cantidad, saldo_anterior, saldo_resultante,
    motivo, solicitud_id, creado_por
  ) values(
    new.colaborador_id, -v_dias, v_anterior, v_anterior - v_dias,
    left('Uso aprobado: ' || new.detalle, 180), new.id, auth.uid()
  );

  return new;
end;
$$;

drop trigger if exists asis_sol_descontar_dia_libre on public.asis_solicitudes_personales;
create trigger asis_sol_descontar_dia_libre
before update of estado on public.asis_solicitudes_personales
for each row execute function public.asis_descontar_dia_libre_aprobado();

revoke all on function public.dash_admin_saldos_dias_libres() from public, anon, authenticated;
revoke all on function public.dash_admin_dias_libres(bigint) from public, anon, authenticated;
revoke all on function public.dash_admin_ajustar_dias_libres(bigint, integer, text) from public, anon, authenticated;
revoke all on function public.dash_mis_dias_libres() from public, anon, authenticated;
revoke all on function public.asis_descontar_dia_libre_aprobado() from public, anon, authenticated;

grant execute on function public.dash_admin_saldos_dias_libres() to authenticated;
grant execute on function public.dash_admin_dias_libres(bigint) to authenticated;
grant execute on function public.dash_admin_ajustar_dias_libres(bigint, integer, text) to authenticated;
grant execute on function public.dash_mis_dias_libres() to authenticated;

notify pgrst, 'reload schema';

commit;

select case when count(*) = 1 then 'OK' else 'REVISAR' end estado,
       'banco de días libres' pieza
from information_schema.columns
where table_schema = 'public'
  and table_name = 'asis_colaboradores'
  and column_name = 'dias_libres_saldo';
