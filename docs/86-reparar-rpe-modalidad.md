# Reparar RPE después de corregir modalidad

El diagnóstico del 02/10/2026 devuelve modalidad presencial y exención true, pero el resumen todavía incluye RPE y no expone requiere_rpe. Esto confirma que la respuesta instalada no aplica la política de exención; no demuestra qué migración se omitió o se sobrescribió.

Ejecutar completo supabase/dashboard_86_reparar_rpe_modalidad.sql después de la migración 85. La reparación conserva el resumen instalado y aplica la exención al resultado, recalculando los pendientes y el estado. Es reejecutable y no altera registros, horas, archivos ni la fecha de inicio de la política.

Actualizar el mes y abrir de nuevo el día. No es necesario volver a cambiar la modalidad ya guardada. El diagnóstico debe devolver requiere_rpe=false y requisitos sin rpe. La salida y los otros pendientes conservan sus reglas.

La fecha de edición no limita el cambio: corregir una jornada pasada consulta su modalidad efectiva actual. Se mantiene la vigencia histórica de la política presencial desde 22/09/2026 en el proyecto diagnosticado.

Validación: node --test tests/rpe-mode-repair.test.mjs tests/rpe-presencial.test.mjs tests/admin-mode.test.mjs
