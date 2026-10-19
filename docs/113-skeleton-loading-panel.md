# Skeleton loading del panel administrativo

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
