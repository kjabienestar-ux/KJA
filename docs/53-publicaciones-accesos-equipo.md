# Acceso por área y colaborador

Ejecutar completo `supabase/marketing_06_accesos_equipo.sql` en el SQL Editor de Supabase, después de marketing_05. Publicar los archivos estáticos del portal o recargar con Ctrl + F5 en desarrollo. No necesita un nuevo despliegue de la Edge Function para esta función: sigue consultando `marketing_permiso` en cada petición.

En Publicaciones, las cuentas activas con nivel `sistemas` (administración del dashboard) ven **Gestionar accesos**. Elegir un área, marcar las personas y guardar. La selección reemplaza los permisos de esa área; no afecta a las otras áreas. Seleccionar todos incluye los colaboradores actuales: las nuevas incorporaciones deben autorizarse expresamente. Los administradores conservan acceso. Los permisos individuales antiguos de publicación directa se conservan para quienes siguen seleccionados; al desmarcar se retiran.

El permiso nuevo permite preparar, analizar, guardar y administrar el historial propio. No concede publicación directa en Facebook. Los permisos se asocian al colaborador, incluso si todavía no tiene una cuenta vinculada. Al ingresar necesitará un perfil activo asociado a ese colaborador. Cambiar de área invalida el permiso otorgado para el área anterior; administración debe volver a autorizarlo. Un permiso manual antiguo de `marketing_accesos` mantiene su comportamiento mientras no sea revocado.

El colaborador ve Publicaciones en su navegación, un resumen en Inicio y su saludo, historial propio y actividad de siete días en Publicaciones. No hay meta obligatoria. Se cuenta cada publicación una vez, al guardar por primera vez un texto no vacío. Editar, borrar el texto, regenerarlo o eliminar del portal no suma ni resta el trabajo ya registrado. Los días se calculan en America/Lima. Los copies anteriores a esta migración siguen en el historial, pero no se les atribuye una fecha de producción ficticia.

La revocación se aplica en el servidor a la siguiente petición. Para actualizar el menú del colaborador, recargar su portal. El acceso de lectura al registro de permisos está restringido y las funciones de gestión comprueban al administrador mediante auth.uid(). La actividad no acepta un usuario destino: consulta solamente al usuario autenticado.

Verificación local: `node --test tests/marketing-team.test.mjs tests/marketing.test.mjs tests/marketing-layout.test.mjs`. Las pruebas de permisos y conteos ejecutan la migración en PostgreSQL embebido (PGlite), sin acceder a datos reales de Supabase.
