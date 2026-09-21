# Excepción de Alviery

Ejecutar `supabase/dashboard_68_alviery_asistencia_comparticiones.sql` en el editor SQL de Supabase después de la migración 67 y publicar los cambios de JavaScript.

La migración identifica al colaborador por el DNI del registro de horarios existente y aborta si no encuentra una coincidencia única. Solo para él, el resumen exige asistencia en sus días laborales y comparticiones según su agenda. No exige RPE, asignaciones ni salida. Las comparticiones vencidas siguen dejando el día incompleto.

Aplica también al cálculo del historial; no modifica marcaciones, horas ni archivos. El ranking conserva entrada y Facebook y excluye salida, RPE y penalizaciones por asignaciones para este colaborador.

Comprobar con `dash_cierre_resumen_colab(id, fecha)` un día con entrada y comparticiones completas (estado `completa`), otro con comparticiones pendientes y otro colaborador. La función interna solo se consulta desde SQL administrativo; sus permisos siguen restringidos.

Ejecutar también `supabase/dashboard_69_alviery_cierre_mensual.sql` después de la 68. Corrige la consulta independiente del calendario mensual, que seguía exigiendo salida para Alviery. Usa el mismo resumen diario para este colaborador y conserva las reglas del resto. Incluye una consulta de diagnóstico para el 8 y 9 de septiembre de 2026. Después, actualizar el mes en el panel para descartar los datos anteriores en memoria.

Las migraciones están preparadas localmente; no se ejecutaron contra la base remota.
