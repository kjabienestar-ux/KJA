# Gestión de áreas en Colaboradores

El filtro de áreas usa un menú visual con búsqueda (ignora tildes), indicador de
selección y navegación con flechas, Enter y Escape. Conserva el select original
como fuente del filtro y sincroniza los cambios del directorio. El menú utiliza
la capa superior del navegador para evitar recortes dentro del panel desplazable.

El botón **Gestionar áreas**, junto al filtro del directorio, abre un panel con
los nombres, el total de colaboradores (incluidas las bajas), edición y eliminación.
Solo aparece para quienes reciben `puede_editar` desde `dash_admin_equipo`.

## Activación

Ejecutar `supabase/dashboard_98_gestion_areas.sql` completo en el SQL Editor de
Supabase. Requiere la fase 06 del dashboard. Es idempotente y no modifica datos
al instalarse. Después, actualizar `dashboard.html` y sus archivos CSS/JS.

La migración añade `dash_admin_editar_area` y `dash_admin_eliminar_area`, disponibles
para usuarios autenticados y protegidas por `asis_puede_editar()` en el servidor.
Los nombres deben tener entre 2 y 60 caracteres y no duplicar otro nombre sin
distinguir mayúsculas. El cambio conserva el ID del área y sus relaciones.

La eliminación es definitiva y requiere confirmación. Se rechaza si existe
cualquier referencia al área, incluso colaboradores dados de baja, asignaciones
o eventos históricos. Se revisan también las relaciones con borrado en cascada
o puesta a NULL para conservarlas intactas.

## Interfaz y comprobación

Extensión de la identidad del directorio: superficie cálida, título Fraunces,
texto Inter, botones verdes para guardar y rojo para eliminar. Filas con divisores,
formularios en el mismo lugar, controles de 44 px, foco visible y mensajes de estado.
En pantallas pequeñas, las acciones y los campos pasan a una segunda línea.
Escape cancela la edición o cierra el panel y devuelve el foco al control anterior.
Si el área tiene colaboradores, el bloqueo aparece en su propia fila, con un
acceso para verlos. Este acceso filtra el directorio e incluye las bajas para
poder reasignar a todas las personas vinculadas.

`node --test tests/admin-areas.test.mjs` comprueba permisos, nombres, borrado con
relaciones RESTRICT/CASCADE/SET NULL, instalación repetible y recuperación de
errores del cliente. Pruebas realizadas en PostgreSQL local con PGlite y entorno
JS aislado; no acreditan conexión con Supabase de producción. La revisión visual
en escritorio y móvil está pendiente porque no había navegador conectado.
