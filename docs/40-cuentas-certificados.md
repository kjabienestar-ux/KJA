# Cuentas de certificados desde Administración

La opción aparece debajo de Gestión de asistencia para cuentas activas con
`asis_perfiles.rol = direccion`, `nivel = sistemas` y `acceso_panel = true`.
Los permisos también se comprueban en el servidor en cada operación.

## Activar

1. Aplicar `supabase/certificados_hardening_roles_y_consistencia.sql` si aún no
   está instalado. Después ejecutar `supabase/dashboard_100_cuentas_certificados.sql`.
2. Desplegar la función: `supabase functions deploy cert-cuentas --no-verify-jwt`.
   La función valida el token con `auth.getUser()` y exige la autorización del
   dashboard. La opción evita rechazos del gateway con claves de publicación nuevas.
3. Configurar el secreto `CERT_RECOVERY_URL` con la URL de producción de
   `recuperar-certificados.html`, por ejemplo
   `https://www.kjadmb.com/recuperar-certificados.html`.
4. Añadir esa URL a Authentication → URL Configuration → Redirect URLs y
   comprobar el proveedor SMTP de Supabase Auth. El envío depende de su configuración
   y sus límites. Publicar HTML, CSS y JS, incluida la página de recuperación.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` se usan solo como
variables del entorno de la Edge Function. No copiar la clave administrativa al
frontend. Referencia: https://supabase.com/docs/reference/javascript/auth-admin-createuser

## Operación

- Crear una cuenta con correo, nombre, rol, serie y contraseña inicial de al menos
  12 caracteres. El correo queda confirmado, igual que en el alta administrativa
  anterior. Entregar la contraseña por el canal habitual de la institución.
- Si el correo ya existe en Auth pero aún no tiene perfil de certificados, se
  vincula sin modificar su contraseña. Si ya tiene perfil, usar Editar.
- Editar nombre, rol y serie. Las series deben ser múltiplos de 1000, únicas incluso
  entre cuentas suspendidas. Una serie con certificados emitidos no se cambia.
- Suspender/reactivar solo el acceso a certificados. Se conservan su perfil, sus
  documentos y el acceso que tenga a otros módulos.
- Enviar recuperación por correo. La contraseña pertenece a la cuenta Auth, por
  lo que el cambio sirve también en otros módulos que compartan esa cuenta.

La gestión no permite retirar el último administrador activo ni cambiar el rol o
suspender el propio perfil de certificados. Los cambios se registran en la tabla
privada `cert_cuentas_eventos`; no registra contraseñas. No se eliminan usuarios.

La creación en Auth y el alta de perfil son dos operaciones. Si la segunda falla,
la cuenta Auth se conserva y el mensaje indica que se repita el alta con los datos
corregidos. No se anuncia éxito sin confirmación de ambas operaciones.

Las políticas restrictivas y los validadores de escritura bloquean a cuentas
suspendidas incluso si ya tenían abierta la sesión. Las RPC de certificados deben
estar en la versión de endurecimiento indicada en el primer paso.

## Verificación

Pruebas locales de permisos y suspensión: `node --test tests/cert-accounts.test.mjs`.
La activación en Supabase, el envío real de correo y la revisión visual con sesión
administrativa deben verificarse después del despliegue. No se crearon cuentas ni
se enviaron correos reales durante la implementación.
