# Salida y Facebook independientes

Aplicar `supabase/dashboard_80_salida_independiente_facebook.sql` después de las
migraciones anteriores, incluida la 79, y publicar `dashboard.html`,
`assets/js/dashboard.js` y `assets/js/dashboard-close-model.js` juntos.

La vista móvil ya no cuenta Facebook entre los requisitos que bloquean la
salida. La evidencia de salida puede abrirse aunque el estado general esté
incompleto por Facebook. El nuevo campo `salida_ventana_vencida` distingue el
vencimiento laboral del vencimiento de Facebook, también en turnos nocturnos.

Las RPC existentes conservan la validación del horario de salida, RPE y
entregables. Facebook conserva su horario individual: se puede cargar después
de registrar la salida si su franja sigue abierta; al vencer, el servidor
rechaza tanto nuevos permisos como confirmaciones. La migración no cambia
horarios, marcaciones ni evidencias históricas.

Verificación local:

```
node --test tests/exit-facebook-independent.test.mjs tests/attendance-sharing-only.test.mjs tests/cierre-null-sql.test.mjs
```

Verificación en el portal: con RPE y entregables completos, Facebook pendiente
y ventana de salida abierta, subir la foto de salida. Confirmar la hora
registrada y cargar Facebook dentro de su franja. Repetir con Facebook vencido:
debe permitir la salida dentro del horario laboral y rechazar Facebook.
