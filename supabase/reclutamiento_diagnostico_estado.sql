-- Solo diagnóstico. Ejecutar en SQL Editor de xadxmfgdxwplmhijagix.
-- No devuelve datos de postulantes ni modifica el esquema.
select to_regclass('public.rec_postulaciones') as tabla,
       to_regprocedure('public.rec_consultar_estado(text)') as funcion;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='rec_postulaciones'
order by ordinal_position;

-- Comparar esta definición con reclutamiento_03_consulta_estado.sql.
-- La función correcta no contiene referencias a Zoom.
select pg_get_functiondef(p.oid) as definicion_instalada,
       pg_get_userbyid(p.proowner) as propietario,
       p.prosecdef as security_definer, p.proconfig
from pg_proc p
where p.oid=to_regprocedure('public.rec_consultar_estado(text)');

-- Permite localizar el error exacto sin consultar ningún DNI real.
do $$
declare v_estado text; v_mensaje text; v_contexto text;
begin
  perform public.rec_consultar_estado('00000000');
  raise notice 'Consulta de prueba sintética ejecutada sin error';
exception when others then
  get stacked diagnostics v_estado=returned_sqlstate,
                          v_mensaje=message_text,
                          v_contexto=pg_exception_context;
  raise notice 'SQLSTATE: %. Error: %. Contexto: %', v_estado, v_mensaje, v_contexto;
end;
$$;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename='rec_postulaciones';

select c.relname, c.relrowsecurity as rls,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('rec_postulaciones','rec_curriculos','rec_postulaciones_cv');

select r.rolname,
       case when to_regprocedure('public.rec_consultar_estado(text)') is not null
         then has_function_privilege(r.oid, to_regprocedure('public.rec_consultar_estado(text)'), 'EXECUTE')
       end as puede_ejecutar
from pg_roles r where r.rolname in ('anon','authenticated');
