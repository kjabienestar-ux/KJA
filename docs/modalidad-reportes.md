# Modalidad presencial mostrada como virtual en reportes

La lista administrativa (`dash_admin_lista`, migración 05) y el libro mensual
(`dash_admin_mes`, migración 07) calculaban la modalidad a partir del horario
semanal. No consultaban la modalidad guardada en la entrada ni la elección diaria.
El comprobante personal sí prioriza `asis_registros.modalidad_marcada`.

Esto permite reproducir la discrepancia: horario virtual + entrada presencial
produce un comprobante presencial y una lista virtual. Las capturas son
compatibles con este defecto; falta consultar el registro de producción para
confirmar los valores del caso concreto.

## Corrección

Ejecutar `supabase/dashboard_72_modalidad_reportes.sql` después de las migraciones
70 y 71. Usa `asis_modalidad_efectiva` en ambos reportes: primero la modalidad
guardada al marcar, luego la elección diaria y finalmente el horario aplicable.
Se conservan los controles de acceso, filtros, orden, horas, estados y totales.
No se reescriben marcaciones ni se modifica la evidencia.

Actualizar la lista y volver a generar las exportaciones después de aplicar.
No basta con publicar los archivos HTML/JavaScript: esta corrección es SQL.

## Elección diaria confirmada

Aplicar después `supabase/dashboard_73_modalidad_dia_marcada.sql`. Al guardar una
entrada con modalidad, sincroniza `asis_modalidades_diarias` para el mismo
colaborador y fecha dentro de la misma transacción. Funciona tanto de virtual
a presencial como de presencial a virtual y conserva el horario semanal y las
horas programadas. No reescribe registros históricos al instalarse; la migración
72 ya prioriza su modalidad marcada al consultarlos.

El usuario elige la modalidad antes de confirmar. El marcado presencial mantiene
las comprobaciones de ubicación y ambos modos mantienen evidencia y ventana
horaria. Una vez registrada la entrada, la modalidad continúa bloqueada para
evitar cambios posteriores del propio usuario sobre una asistencia confirmada.

## Comprobación de solo lectura del caso reportado

En el SQL Editor autorizado de Supabase:

```sql
select c.id, c.nombre, r.fecha, r.estado, r.marcado_at,
       r.modalidad_marcada,
       public.asis_modalidad_base(c,r.fecha) as modalidad_horario,
       public.asis_modalidad_dia(c,r.fecha) as modalidad_del_dia,
       public.asis_modalidad_efectiva(c.id,r.fecha) as modalidad_reporte,
       r.distancia_oficina_m, r.ubicacion_precision_m
from public.asis_colaboradores c
join public.asis_registros r on r.colaborador_id=c.id
where r.fecha=date '2026-09-23'
  and c.nombre ilike '%Jenny%Gutierrez%';
```

Si hay nombres coincidentes, comprobar el ID antes de concluir. Una modalidad
guardada como `presencial` debe aparecer igual en el reporte tras la migración.
