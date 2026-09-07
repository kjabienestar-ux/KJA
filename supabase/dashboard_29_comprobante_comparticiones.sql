-- DASHBOARD 29 · COMPROBANTE DE COMPARTICIONES
-- Añade al resumen del cierre la hora oficial de la entrega activa de Facebook.
-- El nombre y el DNI enmascarado ya provienen de dash_inicio para la propia sesión.

begin;

do $$
begin
  if to_regprocedure('public.dash_cierre_resumen_colab_base_29(bigint,date)') is null then
    alter function public.dash_cierre_resumen_colab(bigint,date)
      rename to dash_cierre_resumen_colab_base_29;
  end if;
end $$;

revoke all on function public.dash_cierre_resumen_colab_base_29(bigint,date)
  from public,anon,authenticated;

create or replace function public.dash_cierre_resumen_colab(p_colab bigint,p_fecha date)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_data jsonb;
  v_registrado_at timestamptz;
  v_requisitos jsonb;
begin
  v_data:=public.dash_cierre_resumen_colab_base_29(p_colab,p_fecha);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;

  select max(e.completado_at)
    into v_registrado_at
    from public.asis_entregas_diarias e
   where e.colaborador_id=p_colab
     and e.fecha=p_fecha
     and e.requisito='comparticiones'
     and e.estado='completo';

  select coalesce(jsonb_agg(
           case when requisito->>'tipo'='comparticiones'
             then requisito||jsonb_build_object('registrado_at',v_registrado_at)
             else requisito end
           order by posicion
         ),'[]'::jsonb)
    into v_requisitos
    from jsonb_array_elements(coalesce(v_data->'requisitos','[]'::jsonb))
         with ordinality as fila(requisito,posicion);

  return jsonb_set(v_data,'{requisitos}',v_requisitos,true);
end $$;

revoke all on function public.dash_cierre_resumen_colab(bigint,date)
  from public,anon,authenticated;

notify pgrst,'reload schema';
commit;

select case when encontrado=esperado then 'OK' else 'REVISAR' end estado,
       pieza,encontrado,esperado
from (
  select 'resumen con hora de compartición'::text pieza,count(*)::int encontrado,1 esperado
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='dash_cierre_resumen_colab'
  union all
  select 'base preservada de dashboard 29',count(*)::int,1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='dash_cierre_resumen_colab_base_29'
) q;
