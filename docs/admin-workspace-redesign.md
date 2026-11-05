# Remodelación de Administración — KJA-029 a KJA-031

Entrega de escritorio sobre `master`, preparada en `codex/remodelacion-admin`. El trabajo no requiere migraciones ni despliegue de funciones. Los cambios recientes de contraseña administrativa y retirada del comunicado de `master` se conservan.

## Comportamiento final

- **Acceso y marcado** sustituye el nombre Marcado propio. Equipo, Enlaces y Reglas separan consulta y configuración; el directorio muestra seis personas por página y las reglas se organizan en dos columnas. El círculo azul de geocerca conserva 1000 m: el estilo de iconos deja de reducir el SVG de Leaflet.
- **Controles y tablas** conservan los campos originales, eventos, validaciones y valores exactos. El selector horario permite cualquier minuto, cancelar y vaciar; el calendario existente se reutiliza para programar jornadas.
- **Contratos** presenta filas compactas dentro de grupos desplegables por área; no hay barra adicional de pestañas ni carrusel. Se mantienen búsqueda, filtros, alertas, horas, institución, documentos y edición autorizada.
- **Roles y equipos** resume las tarjetas y mantiene responsables, alertas y acciones; los detalles contractuales están en Gestionar. El historial permite búsqueda, períodos, orden y páginas de seis sobre los eventos recibidos. La interfaz declara el límite vigente de treinta eventos que entrega la RPC.
- **Mes completo** mantiene el selector de mes y ambas flechas dentro de su borde, con ancho acotado y columna central flexible.
- **Sidebar** muestra once destinos en cuatro familias estáticas: Operación diaria, Gestión del equipo, Reportes y resultados y Configuración de asistencia. Control diario y Cierres y entregables salen únicamente del sidebar; sus vistas y accesos internos se conservan. El permiso de cada pestaña sigue gobernando la visibilidad.

## Validación

**Resultado: 100/100 pruebas seleccionadas aprobadas sobre la base `a9a7d3e`.** La selección de pruebas del PR cubre acceso y paginación, controles visuales, agrupación de contratos, historial y fechas de Lima, sidebar estático/permisos, protección de metas, calendario mensual, fichas, búsqueda de áreas, cambio de contraseña y retirada del comunicado. También se comprueba sintaxis de los scripts modificados y espacios de Git.

Las inspecciones visuales anteriores se realizaron en Edge con datos ficticios a 1440, 1280 y 1366 px. Las capturas seleccionadas y resultados están en [Acceso y controles](../output/kja-029/) y [Contratos, Roles y sidebar](../output/kja-030/).

Las comprobaciones locales no acreditan escrituras operativas, QR/teselas conectados, otros navegadores ni publicación. El historial anterior a los treinta eventos recibidos no se recupera mediante estos filtros. No se modifica el diseño móvil, las RPC, las reglas de activación, las horas registradas, los contratos ni los permisos.

La suite amplia histórica mantiene fallos de expectativas antiguas documentados en las fichas. En particular, `date-picker.test.mjs` conserva un fallo previo de límites en el selector independiente, cuyo archivo no se modificó. No se presenta la suite completa como aprobada.

## Revisión manual

1. Entrar como Dirección/Sistemas y comprobar familias estáticas, estado activo y ausencia de los dos accesos retirados. Con permisos menores, comprobar destinos ocultos.
2. Abrir Acceso: cambiar pestañas y página, buscar/filtrar PIN, enfocar el buscador de oficina y comprobar círculo/alternativa de coordenadas. No guardar configuración real para una revisión visual.
3. Abrir una ficha y programar jornada hasta el paso de revisión: modalidad, hora con minutos no múltiplos de quince, fechas y estado deshabilitado. Cancelar la operación de prueba.
4. Revisar Contratos por áreas, tarjetas resumidas de Roles y navegación/filtros del historial. Cancelar cualquier confirmación de cambio de liderazgo.
5. Recorrer los meses y verificar que ambas flechas permanecen dentro del control.

Continuidad detallada: [KJA-029](tasks/KJA-029.md), [KJA-030](tasks/KJA-030.md) y [KJA-031](tasks/KJA-031.md).
