# Eliminar colaboradores dados de baja

Ejecutar `supabase/dashboard_99_eliminar_colaboradores_baja.sql` en Supabase y
recargar el dashboard. La instalación no elimina datos.

En Colaboradores, activar **Incluir bajas**. Las tarjetas inactivas muestran
**Eliminar definitivamente** para usuarios con permiso de edición. La confirmación
identifica a la persona y explica el borrado irreversible de su ficha y registros
asociados de asistencia, contratos, solicitudes, días libres y entregas.

El servidor exige sesión vigente, permiso de edición, estado inactivo y nombre
coincidente. Bloquea cuentas administrativas vinculadas y archivos con eliminación
pendiente. Revoca las sesiones del perfil personal y lo desactiva antes de borrar.
La cuenta Auth y los archivos de Storage se conservan; no se promete borrado físico
de esos archivos. Las relaciones existentes que usan SET NULL conservan sus filas
históricas sin el vínculo al colaborador. Los registros propios con CASCADE se borran.

Las referencias inesperadas revierten toda la operación, incluida la desactivación.
El directorio, sus contadores y el listado de áreas se actualizan al terminar.
Eliminar todas las personas no garantiza que se pueda eliminar su área: esta puede
seguir vinculada a asignaciones o historial de liderazgo.

Validación: `node --test tests/person-delete.test.mjs tests/person-profile.test.mjs`.
24 pruebas correctas. No se realizaron eliminaciones sobre la base de producción
ni una comprobación visual en navegador.
