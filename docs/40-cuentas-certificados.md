# Cuentas de certificados desde Administración

La opción aparece debajo de Gestión de asistencia para cuentas activas con
`asis_perfiles.rol = direccion`, `nivel = sistemas` y `acceso_panel = true`.
Los permisos también se comprueban en el servidor en cada operación.

## Activar

**Vinculación con colaboradores:** ejecutar después de la migración 100 el archivo
`supabase/dashboard_101_vincular_cuentas_certificados.sql`, volver a desplegar
`cert-cuentas` y publicar el dashboard y sus JS/CSS actualizados.

Al crear o editar, buscar por nombre, DNI o área y seleccionar el colaborador.
La búsqueda muestra resultados visibles, ignora tildes y admite varias palabras.
La selección se conserva al buscar otra persona, pero no se añade a resultados
que no coincidan. Cada resultado muestra nombre, DNI, área y si ya está vinculado.
Se completa el nombre y se muestran DNI y área; al crear se selecciona el rol
Colaborador. Completar correo, contraseña inicial (si es una cuenta nueva) y serie.
El nombre vinculado también se toma del directorio en el servidor. Las series
sugeridas excluyen las asignadas a perfiles activos y suspendidos; el servidor
vuelve a validar al guardar. La lista de sugerencias no audita numeración histórica
que pudiera proceder de perfiles eliminados antes de esta implementación.

El vínculo es `perfiles.colaborador_id`, único por colaborador. No cambia
`asis_perfiles`, el correo interno ni el PIN de asistencia. Si se proporciona un
correo de Auth ya existente, se reutiliza sin cambiar su contraseña, siempre que
no esté asociado a otra persona. Una persona puede conservar su acceso DNI/PIN y
un acceso por correo a certificados: ambos apuntan a la misma ficha laboral.
Se pueden vincular perfiles de certificados existentes desde Editar. No se
vinculan personas automáticamente por coincidencias de nombre o correo.

**Cambio vigente:** Administración utiliza **Cambiar contraseña** directamente,
sin correo. Si la migración 100 ya está instalada, solo vuelve a desplegar
`cert-cuentas` y publica el dashboard y sus JS/CSS actualizados. No requiere SQL nuevo.
Los pasos 3 y 4 siguientes son opcionales, únicamente para la recuperación antigua
por correo, que ya no aparece como acción del panel.

Para cambiarla, abre la tarjeta de la cuenta, pulsa **Cambiar contraseña**, escribe
la nueva clave dos veces (12–128 caracteres) y guarda. También puede cambiarse en
cuentas suspendidas; el acceso permanece suspendido. La clave afecta a todos los
módulos que compartan la misma cuenta Auth. No se registra la contraseña en la
bitácora ni se muestra la anterior.

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

El directorio muestra las cuentas activas por defecto. **Mostrar usuarios suspendidos**
incluye también las suspendidas y se combina con la búsqueda. La suspensión es
indefinida hasta pulsar **Reactivar**; no hay vencimiento ni reactivación automática.
La vista usa tres columnas en escritorio amplio, dos en pantallas intermedias y
una en móvil, con iniciales e iconos de certificados para identificar las tarjetas.

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
