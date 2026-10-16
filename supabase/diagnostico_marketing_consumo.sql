-- Solo lectura. El contador local registra reservas, incluidas llamadas fallidas.
-- No es un saldo de facturación ni una consulta a la cuota de Google.
with configuracion as (
  select regexp_replace(pg_get_functiondef('public.marketing_iniciar_lectura(uuid,uuid,text)'::regprocedure),'\s','','g') definicion
), limite as (
  select case when position('>=200' in definicion)>0 then 200
              when position('>=20' in definicion)>0 then 20
              else null end as limite_24h from configuracion
), modelos as (
  select distinct modelo from public.marketing_lecturas where modelo is not null
  union select 'gemini-3.1-flash-lite'
)
select m.modelo,
       count(l.id) as reservas_totales,
       count(l.id) filter(where l.creado_at>now()-interval '24 hours') as usadas_24h,
       q.limite_24h,
       case when q.limite_24h is not null then greatest(0,q.limite_24h-count(l.id) filter(where l.creado_at>now()-interval '24 hours')) end as disponibles_24h
from modelos m cross join limite q
left join public.marketing_lecturas l on l.modelo=m.modelo
group by m.modelo,q.limite_24h
order by m.modelo;
