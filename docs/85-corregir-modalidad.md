# Corregir modalidad de una asistencia

En Mes completo, abrir la celda del colaborador y pulsar Virtual o Presencial bajo Modalidad. Se guarda automáticamente para esa fecha y se vuelve a consultar el mes, los pendientes y las evidencias.

Antes de usarlo, ejecutar supabase/dashboard_85_corregir_modalidad.sql en el editor SQL del proyecto Supabase, con las migraciones anteriores instaladas. Recargar dashboard.html después de actualizar los archivos estáticos.

El servidor exige una sesión vigente y asis_puede_editar(). Solo corrige registros existentes de hoy o fechas anteriores. Conserva estado, autor de la entrada, horas, origen, evidencias y horario semanal. La modalidad diaria identifica al editor actual y asis_correcciones_modalidad conserva cada cambio (anterior, nueva, autor y fecha).

La corrección cambia los requisitos que dependan de modalidad según las reglas vigentes. No completa automáticamente las evidencias o salidas faltantes. Si falta la migración, el selector informa el error y conserva el valor anterior.

Pruebas: node --test tests/admin-mode.test.mjs tests/team-day-detail.test.mjs
