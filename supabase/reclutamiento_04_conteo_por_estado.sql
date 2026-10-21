-- OPCIONAL. No es necesaria para que la bandeja funcione.
-- Añade a rec_listar el conteo por cada estado (counts.por_estado) para que el filtro
-- muestre también los números de En revisión, Entrevista y No seleccionado.
-- Aplicar después de reclutamiento_01_solicitudes.sql. Misma firma y permisos;
-- no modifica postulaciones ni CV. Ejecutar completo en SQL Editor.
begin;

create or replace function public.rec_listar(p_estado text default '',p_busqueda text default '',p_pagina integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_items jsonb; v_total integer; v_counts jsonb;
begin
  if not public.rec_es_admin() then raise exception 'Acceso reservado a administración' using errcode='42501'; end if;
  if p_pagina<0 or length(p_busqueda)>100 then raise exception 'Filtro inválido'; end if;
  select jsonb_build_object('total',count(*),'pendientes',count(*) filter(where estado='Pendiente'),
    'revision',count(*) filter(where estado in ('En revisión','Entrevista')),'aprobados',count(*) filter(where estado='Aprobado'),
    'por_estado',jsonb_build_object('Pendiente',count(*) filter(where estado='Pendiente'),'En revisión',count(*) filter(where estado='En revisión'),
      'Entrevista',count(*) filter(where estado='Entrevista'),'Aprobado',count(*) filter(where estado='Aprobado'),'No seleccionado',count(*) filter(where estado='No seleccionado')))
    into v_counts from public.rec_postulaciones;
  select count(*) into v_total from public.rec_postulaciones
    where (coalesce(p_estado,'')='' or estado=p_estado)
    and (coalesce(p_busqueda,'')='' or position(lower(p_busqueda) in lower(codigo||' '||(datos->>'nombres')||' '||(datos->>'dni')||' '||(datos->>'carrera')))>0);
  select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_items from (
    select * from public.rec_postulaciones
    where (coalesce(p_estado,'')='' or estado=p_estado)
    and (coalesce(p_busqueda,'')='' or position(lower(p_busqueda) in lower(codigo||' '||(datos->>'nombres')||' '||(datos->>'dni')||' '||(datos->>'carrera')))>0)
    order by created_at desc,id limit 25 offset p_pagina*25
  ) t;
  return jsonb_build_object('items',v_items,'total',v_total,'counts',v_counts);
end;
$$;

revoke all on function public.rec_listar(text,text,integer) from public,anon;
grant execute on function public.rec_listar(text,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
