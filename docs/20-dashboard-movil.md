# Adaptación móvil del dashboard

Los cambios se aplican mediante `assets/css/paginas/dashboard-mobile.css`, cargado al final de los estilos, y `assets/js/dashboard-mobile.js`. No requieren migración SQL ni cambian permisos o validaciones de asistencia.

## Cobertura

| Vista | Adaptación |
|---|---|
| Inicio y jornada | Espacio inferior para el acceso al chat, textos que pueden ocupar varias líneas y objetivos táctiles amplios. |
| Asistencia personal | Calendario contenido en siete columnas, leyenda flexible y solicitudes en ventanas desplazables. |
| Perfil | Una columna, campos y acciones de foto accesibles; ventana de recorte limitada al espacio visible. |
| Mi equipo | Identidad y acciones distribuidas en filas; datos adicionales visibles. |
| Marketing | Editor en una columna, navegación flexible, controles táctiles y campos sin ampliación automática en iOS. |
| Resumen administrativo | Selector nativo de sección según los permisos reales y módulos en una columna en teléfono. |
| Pasar lista | Filas de persona, turno y acciones adaptadas al ancho del teléfono. |
| Control diario | Filtros apilados, indicadores en dos columnas y tabla contenida. |
| Cierres y entregables | Requisitos por persona en dos columnas, asignación apilada y revisión de evidencias desplazable. |
| Mes completo | Libro con desplazamiento propio, identidad fija y celdas de 44 px. Los días mantienen su acción original. |
| Resumen mensual | Fichas en dos columnas; se muestran también las métricas que algunas reglas anteriores ocultaban. |
| Colaboradores y contratos | Filtros y formularios apilados, editor completo desplazable y botones que pueden distribuirse en varias filas. |
| Roles y equipos | Selector de persona y acción de asignar en filas separadas, respetando permisos. |
| Marcado propio y geocerca | Configuración apilada, acciones y campos dentro del ancho disponible. |
| Chat | Botón a 16 px más área segura inferior; pestañas con anchura libre. Se oculta temporalmente al abrir una ventana del dashboard para no tapar acciones. |

La navegación móvil reutiliza los botones de administración existentes. Solo ofrece secciones que no estén ocultas o deshabilitadas y vuelve a validar esa condición antes de ejecutar una acción. El enlace al panel anterior continúa disponible.

Las ventanas usan el alto visible reportado por `visualViewport` para responder a la apertura del teclado. Se mantiene el desplazamiento de formularios y acciones; las tablas extensas conservan su desplazamiento horizontal independiente. El diseño de escritorio sigue usando las reglas anteriores.

## Publicación y verificación

Publicar `dashboard.html` y los dos archivos nuevos. No hay un SQL adicional para esta adaptación.

Se verificaron sintaxis CSS, navegación con permisos cambiantes, activación de las acciones originales, ajuste al teclado y visibilidad del botón flotante durante ventanas. La suite completa pasó con 96 pruebas.

El navegador de la sesión no está disponible. Sigue pendiente la comprobación visual y táctil en iPhone/Android reales: 360–430 px, orientación horizontal, teclado abierto, menú lateral, carga de fotos, marcado, entrega/revisión de evidencias y edición de registros mensuales. Las pruebas de código no acreditan esa revisión ni un despliegue.
# Corrección del administrador móvil

La capa móvil v2 establece un flujo de documento para Gestión y alturas automáticas en su cabecera, navegación y secciones. Restablece el orden de capas del menú, que la regla general del ambiente igualaba con el fondo oscuro. Mientras el menú está abierto se oculta el chat flotante y se bloquea el desplazamiento de la página; al cerrarlo se recuperan. Las secciones siguen utilizando los permisos y acciones originales.

Validación: pruebas de navegación, permisos, viewport y apertura/cierre del menú. La comprobación visual en Safari móvil sigue pendiente; las pruebas automatizadas de lógica no verifican la distribución renderizada.
