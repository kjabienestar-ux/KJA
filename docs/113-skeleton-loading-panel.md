# Skeleton loading del panel administrativo

## Criterio vigente y estado de adopción

Desde el 19/11/2026, el criterio elegido para las próximas conversiones es
[Neutro con contexto](140-esqueletos-neutros-con-contexto.md): contexto fijo
visible y datos pendientes en un único gris. Desde KJA-049, reflejo tipo ola y ausencia de avisos visuales de carga; estático al reducir movimiento.
La definición documental está registrada en [KJA-036](tasks/KJA-036.md).
Resumen operativo lo aplica localmente en escritorio mediante
[KJA-038](tasks/KJA-038.md), con aprobación visual de Piero. Seguimiento diario
lo incorpora en [KJA-040](tasks/KJA-040.md), pendiente de revisión. Pasar lista
lo adopta en [KJA-041](tasks/KJA-041.md), sobre filas operativas aprobadas y con
su esqueleto pendiente de revisión visual. Sin publicación.

Asignaciones adopta el mismo criterio en [KJA-044](tasks/KJA-044.md), pendiente de revisión visual. Por corrección de Piero, su primera carga cubre también el cuerpo del formulario y la cuadrícula del calendario, conservando encabezado/títulos. `dashboard-assignment-loading.js` coordina el lector de cierres/revisiones sin cambiar sus permisos ni su deduplicación. Usa `regions-context`, conserva el formulario real bajo una capa inerte y lo restaura al terminar; preserva borrador/datos válidos al actualizar y controla errores propios. El calendario usa una región independiente del mismo controlador. Los selectores neutrales y los ajustes están limitados a escritorio. Estas cuatro vistas comparten el gris y los tiempos; están en el PR #196, aún abierto.

La descripción de clonado de este documento corresponde al mecanismo **heredado de Control diario, Cierres y la carga móvil**. Su clonado
general de texto/controles, shimmer y colores derivados requieren adaptación
para cumplir el nuevo criterio. Conservar la API y el manejo de carga/errores
no implica conservar esa apariencia ni ocultar el contexto conocido.

### Resumen operativo: presentación por regiones

`withAdminSkeleton('overview', fetchFn)` selecciona `presentation: 'overview-context'`
solo a partir de 901 px. Usa el mismo controlador y tiempos, pero monta placeholders
en encabezado calculado, indicadores, contadores y listas; conserva títulos y
acciones independientes. No clona ni cubre toda la sección.

El relleno es `--kja-sk-base: #e7e7e7`, sin shimmer. Solicitudes puede seguir
cargando después de revelar los datos principales; `setOverviewRequestsPending`
mantiene únicamente esa región pendiente y bloquea su actualización duplicada.
Los datos válidos se conservan al actualizar dentro de la misma cuenta, rol y
fecha, también ante fallos. Cambiar de contexto retira los resultados anteriores.

La vista de revisión se ejecuta con `node scripts/preview-admin-overview.cjs` y
se abre en `http://localhost:3010/__overview`. Usa DOM, CSS y funciones reales
con datos ficticios; no carga sesiones ni realiza consultas a Supabase.

### Seguimiento diario y portal completo en localhost

El propio `KJASeguimiento.load()` usa `presentation: 'regions-context'` en
escritorio y conserva su render, permisos, fuentes y deduplicación. `onShow`
activa las formas y `onCleanup` revela los resultados; `contextLabel` nombra el
anuncio accesible. `handlesErrors` deja a la vista sus mensajes/reintento.
`DashboardSkeleton.cancel(contenedor)` limpia temporizador, presentación y
estado ocupado al reiniciar la sesión. Los tokens neutrales se comparten mediante
`.kja-context-view`, en las vistas optadas y a partir de 901 px.

### Pasar lista: filas y consultas dependientes

`loadAdminAttendance()` coordina en escritorio `dash_admin_lista` y
`dash_admin_cierres` con `presentation: 'regions-context'`, usando los mismos
180/300/200 ms del controlador. `withAdminSkeleton('lista', lector)` delega en
ese lector para evitar dos envolturas de carga. Llamadas simultáneas del mismo
contexto comparten trabajo. `onShow` representa valores/filas pendientes y
`onCleanup` revela el resultado completo o el error propio de la vista.

Calendario, búsqueda, etiquetas de indicadores y nombres de campos permanecen.
El área espera opciones verificadas; escrituras dependientes quedan bloqueadas.
El refresco conserva datos válidos y el foco. Si falla, identifica los datos
anteriores y mantiene bloqueadas las escrituras hasta recuperarlos; Reintentar
usa el mismo lector. La fecha/cuenta/rol invalidan la instantánea y las respuestas
tardías; abrir/cerrar una sesión limpia la presentación y sus anuncios.

`dashboard-pasar-lista.css` limita la apariencia a escritorio, reutiliza el único
gris común y neutraliza la regla heredada del avatar. La cantidad de filas se
ajusta al área visible y su altura desaparece al resolver, incluido el caso vacío.
La carga móvil sigue usando el mecanismo heredado. Pruebas específicas:
`tests/lista-context-skeleton.test.mjs` y `tests/lista-context-browser.mjs`.

Para probar la aplicación completa, desde la raíz autorizada ejecutar
`npx --yes serve@14.2.8 . -l tcp://127.0.0.1:3000` y abrir
`http://localhost:3000/dashboard`. Este servidor entrega el HTML, scripts y estilos
completos sin inyectar datos ficticios; usa el acceso y el backend normales del
portal. Entrar con una cuenta autorizada y navegar a Seguimiento diario. Las
fixtures se aplican únicamente dentro del navegador aislado de las pruebas.

## Implementación existente

El panel usa `assets/js/dashboard-skeleton.js` como controlador único de espera.
Antes de iniciar cada consulta, el controlador clona la estructura visible de la
sección y conserva sus clases de diseño. Después neutraliza ids, enlaces y
controles, y convierte sus textos, iconos y medios en bloques skeleton. Así el
wireframe mantiene el mismo formato y las mismas proporciones que la vista real.
Las plantillas específicas solo completan las zonas de datos que inicialmente
están vacías, como tablas, directorios, gráficos y el libro mensual.
La función pública es:

```js
await DashboardSkeleton.withSkeleton(
  document.querySelector('#mi-contenedor'),
  'tabla',
  () => cargarDatos()
);
```

También está disponible el alias `withSkeleton(contenedor, plantilla, fetchFn)`.
En las vistas administrativas se usa `withAdminSkeleton(seccion, fetchFn)`, que
resuelve automáticamente el contenedor y la plantilla de la sección.

La función de carga debe devolver `true` al completar y `false` cuando el backend
responda con un error controlado. Los errores lanzados también se capturan. En
ambos casos se presenta un mensaje con el botón **Reintentar**.

## Comportamiento común

- Espera 180 ms antes de mostrar el wireframe para evitar parpadeos.
- Una vez visible, lo mantiene al menos 300 ms.
- Conserva la altura medida de la vista y oculta el contenido parcial sin
  retirarlo del flujo, evitando cambios bruscos de layout.
- Al completar, muestra el contenido con un `fade-in` de 200 ms.
- Expone `aria-busy` en el contenedor y un estado accesible mientras carga.
- El shimmer se desactiva con `prefers-reduced-motion: reduce`.
- Los colores derivan de `--surface-card`, `--surface-page`, `--text-muted` y
  `--line-soft`; también hay ajustes para los selectores de tema oscuro.

## Plantillas por sección

| Sección | Estructura simulada |
| --- | --- |
| Resumen operativo | Encabezado, métricas, gráfico, prioridades y módulos |
| Control diario | Filtros, métricas, gráfico de áreas y tabla operativa |
| Ranking mensual | Filtros, podio, gráfico y clasificación |
| Reportes Facebook | Filtros, KPI, gráficos y matriz de resultados |
| Pasar lista | Fecha/filtros, KPI y filas con avatar y estados |
| Mes completo | Filtros, KPI y libro mensual con celdas de calendario |
| Cierres y entregables | Filtros, métricas, tarjetas y filas de revisión |
| Asignaciones | Formulario, métricas y tarjetas de asignaciones |
| Colaboradores | Buscador, KPI y tarjetas de personas |
| Contratos | Filtros, KPI y tabla de seguimiento |
| Roles y equipos | KPI, tarjetas de áreas y auditoría |
| Marcado propio | KPI, configuración/geocerca y listado de accesos |
| Panel anterior | Mantiene el skeleton de la vista actual si la navegación tarda |

Para una vista nueva, añadir su generador a `layouts` en
`dashboard-skeleton.js`, registrar su id en `ADMIN_SECTION_CONTAINERS` y envolver
su promesa con `withAdminSkeleton`. Las plantillas genéricas `tabla`, `tarjetas`
y `lista_simple` cubren vistas que no necesitan un wireframe propio.


## Gestión del equipo, Reportes y Acceso — KJA-048

Las siete secciones de la segunda conversión usan `dashboard-admin-data-loading.js` y sus estilos compartidos. `withAdminSkeleton` delega en este adaptador; las llamadas directas a los lectores entran por la misma operación sin recursión ni duplicación. Se reutilizan tiempos y semántica de `DashboardSkeleton`, con máscaras por regiones mediante `setContextRegion`.

Cada registro define sus regiones, plantilla neutral, captura/restauración de datos y render. Facebook y Ranking registran adaptadores dentro de sus módulos para conservar su estado privado. Los períodos, cuenta, permisos y área forman la clave de contexto. Se conserva contenido válido al actualizar y se bloquean acciones dependientes; el error inicial no presenta ceros y el de actualización identifica datos anteriores. Reintentar crea una operación nueva. `reset()` se enlaza al reinicio de sesión y conserva la invalidación de los lectores.

La representación de Colaboradores ahora sigue sus filas verticales; Roles mantiene tarjetas de área y Mes su libro. Las tablas conservan sus nodos reales y su desplazamiento dentro del contenedor. Los estilos de estas conversiones se aplican únicamente desde 901 px. Evidencia y límites en [KJA-048](tasks/KJA-048.md).


## Reflejo y espera sin avisos — KJA-049

Por solicitud explícita de Piero, `dashboard-loading-motion.css` aplica al final de los estilos un reflejo blanco neutro a los placeholders de las once vistas convertidas de escritorio. Barrido de 1,65 s, compartido y recortado al bloque. Con reducir movimiento no se genera el pseudo-elemento. No se cambian 180/300/200 ms ni la conservación de datos válidos al actualizar.

Se retiran banners y textos visibles de espera del Resumen, Seguimiento, Pasar lista, calendario de Asignaciones, adaptador común, Facebook y Ranking. La carga continúa anunciándose fuera de la región ocupada a lectores de pantalla. Los errores reales, sus reintentos y los estados vacíos permanecen visibles. Los resultados de KJA-048 con animación ausente describen la versión anterior; la validación de movimiento se documenta en KJA-049.
