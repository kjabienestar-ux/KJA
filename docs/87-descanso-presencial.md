# Descanso del 5 de octubre de 2026

Beneficia a colaboradores activos con entrada registrada (`P` o `T`, con hora de entrada y modalidad marcada `presencial`) el viernes **2 de octubre de 2026**. No basta tener un horario presencial asignado. La excepción solo corresponde al lunes **5 de octubre de 2026**.

El panel muestra «¡Hoy es tu día libre!» y la felicitación, con únicamente las comparticiones de Facebook. No exige entrada, RPE, asignaciones ni salida. Facebook conserva su programación, ventana de carga, evidencias y revisión, incluso cuando su agenda hereda los días laborales. Si no tiene Facebook programado, no se crea una obligación nueva.

La columna izquierda conserva la figura y muestra «¡Felicidades! Hoy es tu día de descanso». Los botones ocultos respetan `hidden` aunque los estilos de presentación definan `display`; abrir y confirmar la salida también rechazan el descanso aun con permisos de interfaz desactualizados. Las fechas y horas de Facebook se presentan como horas locales de Lima.

El servidor considera la fecha no laborable para los beneficiarios. La tabla `asis_descansos_presenciales` conserva persona, fecha de descanso, fecha de asistencia y momento de asignación; no se modifican marcaciones ni evidencias existentes y no se descuenta el banco de días libres.

## Activación

1. Ejecutar completo `supabase/dashboard_87_descanso_presencial.sql` en el editor SQL de Supabase después de la migración 86. La última consulta devuelve la cantidad de nuevos beneficiarios. Puede reejecutarse sin duplicarlos.
2. Publicar `dashboard.html`, `assets/js/dashboard.js`, `assets/js/dashboard-close-model.js` y `assets/css/paginas/dashboard-pending.css`.
3. Recargar el panel. Para revisar beneficiarios desde el editor SQL:

```sql
select c.id, c.nombre, d.fecha, d.fecha_presencial
from public.asis_descansos_presenciales d
join public.asis_colaboradores c on c.id=d.colaborador_id
where d.fecha=date '2026-10-05'
order by c.nombre;
```

La asignación inicial se basa en la modalidad registrada al ejecutar la migración. Aplicar también `dashboard_89_descanso_modalidad_corregida.sql` para incorporar automáticamente las entradas corregidas después a presencial y reparar las ya corregidas. Una corrección posterior en sentido contrario requiere revisar y retirar explícitamente el beneficio; no se elimina automáticamente.

## Validación local

`node --test tests/presencial-day-off.test.mjs tests/attendance-sharing-only.test.mjs tests/justified-personal-close.test.mjs`

Incluye SQL en PostgreSQL aislado, selección de beneficiarios, idempotencia, conservación de Facebook, aislamiento por fecha/persona y presentación de escritorio/móvil. No se ejecutó la migración en una base remota desde esta sesión. No hubo navegador conectado para validación visual.
