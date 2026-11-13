-- Ejecutar antes de desplegar consulta-dni.
-- Cuenta intentos del portal; no incluye otros sistemas que usen el mismo token.
begin;
create table if not exists public.cert_dni_cuota (
  mes date primary key,
  usadas integer not null default 0 check (usadas >= 0),
  consumo_anterior integer check (consumo_anterior >= 0)
);
alter table public.cert_dni_cuota enable row level security;
revoke all on public.cert_dni_cuota from anon, authenticated;
insert into public.cert_dni_cuota(mes)
values(date_trunc('month', now() at time zone 'America/Lima')::date)
on conflict do nothing;

create or replace function public.cert_dni_consumo(p_incrementar boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_mes date := date_trunc('month', now() at time zone 'America/Lima')::date;
  v_fila public.cert_dni_cuota;
begin
  insert into public.cert_dni_cuota(mes,consumo_anterior)
  values(v_mes,0) on conflict do nothing;
  if p_incrementar then
    update public.cert_dni_cuota set usadas=usadas+1 where mes=v_mes;
  end if;
  select * into v_fila from public.cert_dni_cuota where mes=v_mes;
  return jsonb_build_object('limite',100,'registradas',v_fila.usadas,
    'usadas',v_fila.usadas+v_fila.consumo_anterior,
    'restantes',case when v_fila.consumo_anterior is null then null
      else greatest(0,100-v_fila.usadas-v_fila.consumo_anterior) end,
    'mes',v_mes,'estimado',true);
end; $$;
revoke all on function public.cert_dni_consumo(boolean) from public, anon, authenticated;
grant execute on function public.cert_dni_consumo(boolean) to service_role;
commit;

-- Para sincronizar el mes actual, sustituir N por el total usado que muestra
-- Decolecta EN ESE MOMENTO. Ejecutar aparte, con las consultas en pausa:
-- update public.cert_dni_cuota set consumo_anterior = N, usadas = 0
-- where mes = date_trunc('month', now() at time zone 'America/Lima')::date;
