# Descanso tras corregir la modalidad

La migración 87 concedía el beneficio a las asistencias que ya eran presenciales al ejecutarla. Cambiar la modalidad posteriormente no actualizaba esa lista.

Ejecutar `supabase/dashboard_89_descanso_modalidad_corregida.sql` después de la 88 y pulsar **Actualizar** en Mes completo. Repara las entradas presenciales ya corregidas del 2 de octubre de 2026 y concede automáticamente el descanso del 5 cuando se registren o corrijan entradas válidas de esa fecha. Exige colaborador activo, estado P/T y hora de entrada.

No depende del nombre del trabajador, no duplica descansos y no sobrescribe premios manuales. Conserva marcas y evidencias. Los beneficios ya concedidos no se revocan automáticamente al cambiar posteriormente a virtual; esto mantiene la política de conservación de la migración 87.

No se aplicó en una base remota desde esta sesión. Validación local: `node --test tests/day-off-modality-correction.test.mjs`.
