# Seguimiento diario — piloto y publicación

Seguimiento diario reúne la consulta de Control diario y la revisión de Cierres y entregables. Se añade como tercera opción de Gestión de asistencia; las dos anteriores conservan sus accesos y comportamiento. El piloto no modifica reglas de jornada, asignaciones, permisos, horas ni registros históricos.

## Ejecución y configuración

1. Instalar las dependencias fijadas con `npm ci` y ejecutar `npm run dev` (puerto 3000).
2. Abrir `/dashboard#gestion/seguimiento` e iniciar sesión con una cuenta autorizada para el panel. Dirección conserva la revisión y el CSV; editor/visor reciben únicamente los datos que permite Cierres.
3. Publicar conjuntamente `dashboard.html`, `assets/js/dashboard.js`, `assets/js/dashboard-admin-cierre.js`, `assets/js/dashboard-admin-seguimiento.js` y `assets/css/paginas/dashboard-admin-seguimiento.css`, sobre el resto del portal vigente. Se conservan los estilos y scripts nuevos de Resumen y Asignaciones integrados en `master`.

Es una aplicación estática: no se añade compilación ni variables de entorno nuevas. Se reutiliza el cliente Supabase configurado en `dashboard.js` y el proyecto existente. El código nuevo no contiene datos ficticios ni necesita esperar al merge para consultar la base real. No se requiere una migración SQL ni un despliegue nuevo de funciones por este piloto.

El entorno debe tener operativos los contratos que ya consumen las vistas anteriores:

| Capacidad | Contrato existente |
|---|---|
| Lecturas del día | `dash_admin_cierres`, `dash_admin_control_diario`, `dash_supervision_impedimentos`, `dash_admin_revision_entregas` |
| Revisión de Dirección | `dash_admin_revisar_entrega` |
| Carga administrativa | Edge Function `dash-entrega`, `dash_admin_confirmar_entrega` y los contratos de salida del modal existente |
| Recuperación de salida | `dash_admin_regularizar_cierre` |
| Fotos | Lectura autorizada de `asis_colaboradores` y firma del bucket privado `perfil-fotos` mediante `hydrateProfilePhotos` |
| Archivos de entregas | Firma del bucket privado `asis-cierre-evidencias` |
| Mensajes y pausas | Módulos existentes `KJAChat` y `KJA_PAUSAS` |

No hacer públicos los buckets ni usar una clave de servicio en el navegador. Las fotos usan la firma y caché existentes; las evidencias se firman por 900 segundos. Si falta una foto o falla su permiso, se conservan las iniciales. La carga de fotos no sustituye el visor, la nota o el foco del caso abierto.

## Consulta y exportación

Fecha, área, nombre y bandeja filtran la consulta local. El panorama por áreas conserva el alcance del día. El botón «Descargar» abre un modal con Excel y CSV. El CSV descarga el conjunto diario autorizado completo, incluso cuando los filtros no muestran personas; permite elegir otra fecha dentro del modal sin mover la consulta del panel. Para otra fecha comprueba las cuatro fuentes autorizadas del día antes de generar el archivo. Se bloquea si los datos están incompletos o la cuenta no tiene permiso. No incluye fotos, rutas privadas ni enlaces firmados.

Los cuatro segmentos por área cuentan personas y son excluyentes, en este orden: Por revisar, Pendientes, Concluidas y Sin pendientes. Reutilizan `adminControlAreaBucket`; no cambian los estados de negocio.

## Validación del 29 de octubre de 2026

Base integrada: `origin/master` `252759f23ab450ea29b9557a7128a480e3154b9f` (PR #160 y #161). El único conflicto al recuperar el trabajo local estaba en las referencias CSS/JS de `dashboard.html`; se conservaron ambos módulos y se incrementaron las versiones de recursos modificados.

- `npm run test:seguimiento`: 52/52 pruebas de Seguimiento y adaptadores relacionados. Incluye filtros, CSV completo, permisos por rol, resultados tardíos, estados parciales, revisión sin avance automático, fechas de carga/recuperación y fotos privadas.
- `npm test`: 352 pruebas, 336 aprobadas y 16 fallidas. La copia limpia del mismo `master` tiene 333 pruebas, 317 aprobadas y las mismas 16 fallidas; no aparecen fallos nuevos. Los 19 casos añadidos pertenecen a Seguimiento.
- Comparación adicional de Resumen, Asignaciones, calendario, skeleton y flujos relacionados: los mismos diez fallos en ambas bases (cuatro de Resumen, cinco del arnés de horas de Asignaciones y uno de skeleton). Son pendientes heredados; no se ocultan ni se modifican sus expectativas para aprobar este piloto.
- `node tests/seguimiento-diario.visual.mjs`: listado y revisión en 1920, 1440, 1280 y 390 px; sin errores JS ni desbordamientos. Los datos de esta prueba son ficticios y viven exclusivamente en `tests/`.
- Recursos de `dashboard.html`: 135 referencias locales presentes; todos los scripts clásicos analizados sin errores de sintaxis. Dependencias locales restauradas al lockfile (`jsdom` 26.0.0 y PGlite 0.5.8).
- Sesión real de Dirección, solo lectura: 39 personas; los mismos indicadores que Control (37 por atender, 1 por revisar, 0 concluidas, 39 en total), 25 jornadas programadas y 0 horas válidas al consultar. Cierres carga las mismas 39 personas. Las dos vistas resuelven 11 fotos en Todo el equipo; una foto visible y una evidencia del visor comprobadas cargadas, consola sin errores. El área Ingeniería limita la lista a sus seis personas. CSV con BOM idéntico con búsqueda vacía y con búsqueda sin resultados. Estas cifras son evidencia de ese momento, no valores esperados permanentes.

No se aprobaron evidencias, subieron archivos, recuperaron salidas ni enviaron mensajes en la base real durante la validación. Esas escrituras están comprobadas en pruebas aisladas y requieren una prueba operativa con datos de ensayo antes de dar por terminado el piloto. Un merge o PR no acredita despliegue ni sustituye esa comprobación.

## Publicación y retorno

Crear el PR contra `master` solo con los archivos del piloto, sus pruebas, `package.json` y esta guía. Excluir capturas, PDF, `output/`, `tmp/`, herramientas personales y SQL de regularizaciones individuales. La rama puede integrarse sin conflictos con la base indicada; si `master` avanza, actualizar y repetir la comprobación. Las reglas consultadas en GitHub el 29/10 requieren un PR con una aprobación; no se modificó esa configuración. Los checks de un futuro PR y el despliegue se evalúan al abrirlo; no se deducen de las pruebas locales.

Después de publicar, comprobar caché de recursos, acceso con los roles autorizados, misma fecha en las tres vistas, fotos y un archivo privado. Durante la prueba se puede volver a Control o Cierres. Para retirar el piloto, revertir conjuntamente sus archivos frontend; no borrar registros ni evidencias. Las dos opciones originales solo se eliminan tras validación y decisión posterior explícita del usuario.

## Exportación de marcaciones a Excel (KJA-039)
En Seguimiento diario, abrir «Descargar» y elegir «Marcaciones en Excel». Dirección elige un día, semana (lunes a domingo, limitada a hoy) o fechas exactas hasta 93 días. Usa los filtros actuales de área y nombre, sin limitarse a la bandeja seleccionada. El bloque permanente de exportación se sustituye por el modal marfil/terracota aprobado por Piero. La otra opción, «Registro diario en CSV», mantiene su alcance del día completo autorizado.

El archivo XLSX contiene nombres, áreas, marcas reales en Lima y estado del servidor: P normal, T tardanza, J justificado. No recalcula tolerancias. Separa no programado, sin información y ausencia de entrada. Hoy se identifica como provisional. Una salida pendiente no se considera jornada completa. Todo el rango ocupa una única hoja con columnas consecutivas y totales del período. Las fechas incluyen debajo las iniciales LU/MA/MI/JU/VI/SA/DO. El amarillo señala tardanza y/o salida requerida sin registrar, distinguidas por texto; se respeta la excepción de salida no requerida y hoy sigue provisional. Las lecturas usan los RPC autorizados existentes; si falla un día o cambia la sesión/filtros, se cancela la descarga completa. No requiere SQL ni Edge Functions. Publicar conjuntamente los JS, HTML y CSS modificados.
El pulido posterior retira paneles inmovilizados, centra las tablas, separa Área/Colaborador y añade filas vacías alrededor de la leyenda y entre áreas. La leyenda usa los mismos rellenos de estado que las marcas. Cinco pruebas del exportador aprobadas.
Corrección visual vigente: «Colaborador / Área» vuelve a una sola columna, con nombre en negrita y área gris debajo mediante texto enriquecido; esa columna se alinea a la izquierda como la captura aprobada por Piero. El resto permanece centrado.

El área y la fecha principal conservan sus selectores cálidos. En el modal, los botones «Un día», «Una semana» y «Fechas exactas» sincronizan el select interno del período. Se reutiliza el calendario compartido con opciones de confirmación y presentación incrustada exclusivas de este flujo; sus usos anteriores conservan el comportamiento habitual.
El calendario del modal permanece visible desde que se elige Excel o CSV, sin disparador desplegable. La selección inicial queda pendiente; cambiar de modo reinicia el borrador sin cambiar el mes visible. Aplicar confirma las fechas y habilita Descargar, manteniendo el calendario abierto; elegir nuevas fechas vuelve a dejar la selección pendiente. Limpiar reinicia la selección y Escape cierra el modal. Semana resalta lunes–domingo y limita el final a hoy. Hasta permanece como valor interno. Cerrar Descargas cancela la generación pendiente y restaura el foco al botón; salir del módulo o cerrar sesión descarta resultados tardíos. El refresco automático se suspende mientras el modal está abierto. Estados reales: preparación/progreso, archivo listo, vacío, error con reintento y validación de fechas. Los permisos de Dirección y la verificación de contexto se conservan. No requiere cambios de Supabase.

El modal de descargas se dimensiona por su contenido, sin scroll interno ni recorte. Cabecera sin «Configurar descarga», calendario compacto con números de 12 px y resumen breve de alcance; los nombres o búsquedas largos conservan su valor completo al pasar el cursor. Se mantienen a la vista Aplicar, Limpiar y las acciones del pie. El ensayo de escritorio comprueba también el contenido vertical y la posición de todos los botones, incluidos meses de seis filas y validaciones.
