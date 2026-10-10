# Horas contractuales de días no laborables

Aplicar `supabase/dashboard_112_horas_dias_no_laborables.sql` después de las migraciones anteriores. Luego publicar `dashboard.html`, `assets/js/dashboard-admin-equipo.js`, `assets/css/paginas/dashboard-contracts.css` y `asistencia.html`.

La migración acredita las horas programadas de las fechas ya transcurridas que fueron feriado de empresa, permiso no laborable, día libre aprobado/asignado o justificación antigua sin horas. Solo cuenta fechas desde el inicio del contrato y no acredita días que originalmente no tenían jornada.

Si existe una marca `P`, `T` o `J` con horas positivas, se conservan esas horas y no se agrega un segundo crédito. En colaboradores mixtos, el crédito se asigna a prácticas o voluntariado según el vínculo configurado para ese día. Los días futuros se acreditan cuando llega la fecha.

La pantalla de Contratos muestra cuántas horas del acumulado provienen de días no laborables. El panel anterior consume el mismo resumen de Supabase para mantener el resultado alineado.

Validación local: `npm run test:contratos`.
