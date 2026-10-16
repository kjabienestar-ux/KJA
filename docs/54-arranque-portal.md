# Arranque del portal

## Activación

1. Ejecutar `supabase/dashboard_117_arranque_portal.sql` en Supabase. Es aditiva: no cambia usuarios, claves ni permisos. Reutiliza `dash_inicio` y valida el perfil activo de la sesión.
2. Desplegar `dash-entrar`: `npx supabase functions deploy dash-entrar --project-ref xadxmfgdxwplmhijagix --use-api`.
3. Publicar `dashboard.html`, `assets/js/dashboard.js` y `assets/js/dashboard-pausa-activa.js`.

## Cambios

- Administradores y sesiones recordadas reciben inicio y permisos en una llamada `dash_arranque`, en vez de dos solicitudes del navegador. Si falta la migración, se utiliza la ruta anterior; los errores de permisos no activan ese respaldo.
- El ingreso DNI/PIN conserva el arranque enviado por el servidor; no vuelve a pedirlo en el navegador. La limpieza de sesiones vencidas se ejecuta a la vez que la lectura de inicio, después de registrar la sesión actual.
- Chat, Marketing y Zoom se inicializan después de mostrar el portal; sus errores no bloquean el ingreso.
- Pausas no consulta datos personales sin un colaborador identificado.
- Las esperas de autenticación y datos iniciales están acotadas. No se deshabilita la validación de sesión ni se entra con permisos almacenados en el navegador.

## Validación

26 pruebas de arranque, autenticación, permisos y pausas aprobadas. La prueba de sesión recordada se adaptó al helper de timeout. La suite amplia `dashboard-close.test.mjs` mantiene 12 fallos anteriores al cambio, reproducidos con dashboard.html y dashboard.js del commit base. No se midieron tiempos de usuarios reales ni se desplegaron estos cambios en producción desde esta sesión.
