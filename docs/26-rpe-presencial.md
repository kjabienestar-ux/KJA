# RPE exento en jornadas presenciales

La migración `supabase/dashboard_70_rpe_presencial.sql` se ejecuta después de la
69. Debe aplicarse antes de publicar el frontend actualizado.

Al instalarse guarda, una sola vez, la fecha vigente de Lima en
`asis_cierre_config.rpe_presencial_exento_desde`. Desde esa fecha, una jornada
cuya modalidad efectiva sea presencial no muestra, solicita ni puntúa evidencia
RPE. La modalidad marcada en la asistencia prevalece sobre la elección diaria y
el horario semanal.

La excepción afecta solamente al RPE. La evidencia de salida, las
comparticiones de Facebook y los entregables asignados conservan sus reglas. Las
entregas RPE anteriores permanecen en sus tablas y en Storage para auditoría;
no aparecen como pendientes de revisión cuando la nueva política aplica.

En el ranking, los días presenciales no integran el denominador de RPE. Si el
periodo contiene días virtuales, solo esos días determinan sus puntos. Si todo
el periodo evaluable fue presencial, el criterio recibe crédito neutral y la
interfaz lo identifica como **Exento por presencial**.

## Despliegue

1. Respaldar o confirmar el respaldo reciente de Supabase.
2. Ejecutar completa la migración 70 en SQL Editor y comprobar que finalice sin
   errores.
3. Publicar `dashboard.html` y los módulos JavaScript actualizados. La Edge
   Function `dash-entrega` conserva las mismas RPC y no necesita redespliegue.
4. Probar una jornada virtual y otra presencial con colaboradores de prueba.

## Comprobaciones

- En presencial, el resumen devuelve `requiere_rpe=false`,
  `rpe_exento_presencial=true` y no contiene un requisito `rpe`.
- Una llamada directa de carga RPE devuelve
  `rpe_no_requerido_presencial`.
- En virtual, RPE continúa siendo obligatorio y bloquea la salida mientras esté
  pendiente.
- Los otros requisitos diarios aparecen y se validan igual que antes.
- El ranking mensual informa `rpe_exentos_presencial` y conserva la excepción
  especial de Alviery.

Para una reversión funcional, se puede mover
`rpe_presencial_exento_desde` a una fecha futura. No es necesario eliminar la
columna ni restaurar evidencias porque la migración no borra datos.
