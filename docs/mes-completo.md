# Mes completo por tramos

## Interfaz
La matriz mensual presenta semanas de lunes a domingo y hasta ocho colaboradores por página. La búsqueda y el área filtran el conjunto mensual; los indicadores mantienen ese alcance. El CSV exporta todas las fechas de los colaboradores filtrados, independientemente de la página o tramo visible.

El diseño administrativo se valida en escritorio. Se conserva la base móvil preexistente; no se considera un rediseño móvil validado. El lienzo es uniforme y cálido, con controles alineados de 44 px y leyenda de estados, nota y evidencia.

## Detalle y permisos
`dashboard-admin-mes.js` solicita el modo `compact` del componente compartido `KJAMonthDayDetail`. Los demás consumidores conservan su presentación. El modal muestra una actividad a la vez, selección de archivo persistente y un visor privado. La gestión de jornada queda en un desplegable; conserva los permisos, RPC y reglas existentes.

Modalidad y estados conservan su guardado inmediato. El cambio de estado avisa que aplica al seleccionar, bloquea envíos duplicados y permite reintentar un error. El cierre recupera la celda por persona/fecha incluso después de renovar la tabla; usa el libro como respaldo si los filtros ocultan la celda original.

No cambia la fórmula de asistencia ni el cálculo de jornadas válidas. No requiere migraciones ni despliegues de funciones. Los archivos siguen siendo privados y usan los accesos temporales existentes.

## Verificación
- 52 pruebas adicionales de Seguimiento diario aprobadas.
- 65 pruebas específicas de carga, tramos, paginación, detalle, permisos, sesiones, foco y skeleton aprobadas.
- Revisión visual local de escritorio con datos ficticios: matriz, calendario individual, feriados, días libres, evidencia/selección, barra y estados vacíos.
- Cabeceras de días con contraste medido de 5,29:1; etiquetas de archivos superiores a 6:1.
- Simulación local de guardado con progreso, error, reintento y recuperación del foco. No equivale a escrituras verificadas con una sesión real.

Para la revisión operativa, abrir Gestión → Mes completo con una cuenta autorizada; comprobar filtros, tramos, CSV y navegación de archivos antes de realizar cualquier corrección de datos.
