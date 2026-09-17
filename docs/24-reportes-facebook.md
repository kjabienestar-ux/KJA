# Reportes de Facebook

## Activación

1. Si ya se aplicó la migración 64, ejecutar `supabase/dashboard_65_reporte_facebook_hoy.sql`. Para instalaciones nuevas, aplicar 64 y después 65.
2. Publicar `dashboard.html` y los JS/CSS actualizados, incluidos `assets/js/facebook-report-excel-layout.js`, `assets/js/facebook-report-excel.js`, `assets/js/facebook-report-pdf.js` y `assets/js/vendor/`. Descargar un archivo nuevo; los anteriores no cambian.
3. Con una cuenta de Dirección, abrir Gestión de asistencia → Reportes Facebook.

Ambas migraciones contienen la función actualizada. La 65 permite actualizar instalaciones que ya ejecutaron la versión inicial de la 64. Solo cambian un RPC de lectura, sin modificar evidencias ni requerir cambios de Edge Functions. No se aplicaron al entorno remoto en esta sesión.

## Selección del corte

- Lunes 14/09/2026: jueves 10, viernes 11, sábado 12 y domingo 13.
- Jueves 17/09/2026: lunes 14, martes 15 y miércoles 16. Se puede consultar desde el miércoles 16, incluyendo lo registrado ese día.
- Se permite elegir una fecha de reporte hasta mañana; las fechas de actividad nunca pueden superar hoy en Lima. Por defecto se selecciona el corte más reciente disponible contando mañana.
- Al cambiar entre lunes y jueves se selecciona el corte más reciente de ese tipo. Para consultar uno anterior se cambia Fecha del reporte. Una fecha de otro día se ajusta al lunes o jueves anterior y el campo muestra la fecha efectiva.
- General del mes: desde el día 1 hasta fin de mes, o hasta hoy si es el mes actual.
- Personalizado: hasta 93 días, como máximo hasta hoy.

Si se incluye hoy o hay franjas pendientes, se indica **Provisional** en pantalla y Excel. Los «No» de franjas abiertas pueden cambiar. Los reportes se consultan manualmente; no se envían automáticamente.

## Tabla por área

Cada área tiene su propia tabla: una fila por colaborador y una columna por fecha. El filtro permite mostrar una sola área. Al pie se muestran los totales diarios Sí, No y Total evaluado.

- **Sí:** la última entrega de Facebook está completa y tiene al menos una imagen registrada. Incluye evidencias pendientes de revisión u observadas.
- **No:** no existe esa evidencia al consultar, incluso si aún queda plazo. No demuestra que la persona no haya compartido fuera del sistema.
- **No comparte ese día:** no tiene Facebook asignado en su agenda; no se atribuye al contrato porque el reporte no confirma ese motivo.
- **Sistema aún no activo / Aún no incorporado / Falta fecha de ingreso:** se muestra la causa concreta de exclusión.
- **Sin información:** falta el registro en el resultado. Ninguno de estos motivos suma al total evaluado.

No se muestran cantidades de capturas, revisiones ni identificadores en el reporte o Excel. Una entrega con muchas imágenes o un collage sigue contando como un solo Sí por persona/día. Los nombres y áreas se leen de la base, sin listas fijas.

## Alcance de los datos

Se usa la última versión de la entrega `comparticiones`, sin asignación. Una entrega anulada o sin imágenes no recupera versiones anteriores como evidencia. La agenda de Facebook es independiente de asistencia y días de trabajo. La habilitación actual de las cargas no invalida el histórico.

El comienzo del sistema se lee de `asis_cierre_config.obligatorio_desde` (valor inicial: 2026-09-07). Se usa el equipo activo, sus áreas y horarios actuales. Las bajas, cambios de agenda o de fechas de ingreso/activación pueden alterar resultados históricos; no es una instantánea inmutable de la plantilla pasada.

## Excel

La descarga es un archivo `.xlsx` real, generado localmente en el navegador, sin servicios externos. Reemplaza el CSV que Excel podía abrir en una sola columna según su configuración regional. Respeta el filtro de área y crea solo dos pestañas: **Resumen** y **Detalle**. Se conservan período, actualización en hora de Lima, estado provisional y leyenda.

Resumen presenta indicadores de personas y registros persona/día, comparación por área y porcentaje de registro con barras. Sus cifras se vinculan por fórmulas al Detalle, que reúne a todos los equipos en bloques continuos. Incluye fechas numéricas con formato de fecha, nombres como texto seguro, filas alternadas, ajuste de texto, verde para Sí y rojo para No mediante formato condicional. Los totales usan COUNTIF y SUM con resultados almacenados y recálculo al abrir. Se ocultan cuadrícula y encabezados de filas/columnas, se agrega margen blanco y se elimina la división vertical de paneles sobre el título. El Detalle conserva cinco filas fijas al desplazarse. Incluye áreas de impresión delimitadas, encabezados repetidos y filtro por área en el Resumen.

Este cambio de etiquetas y exportación no requiere nuevas migraciones SQL.

## PDF completo y ranking

«Descargar PDF completo» descarga directamente un PDF A4 horizontal, sin diálogo de impresión. Contiene el Detalle de **todas** las áreas del período consultado, aunque la vista esté filtrada a una sola área. El botón y su ayuda indican este alcance. El Excel conserva su comportamiento anterior y respeta el filtro.

Las matrices muestran nombres, fechas, Sí/No y los motivos de exclusión, con totales diarios y colores. Para intervalos largos se distribuyen las fechas en bloques de hasta siete días, repitiendo nombres y encabezados. Cada página identifica el período, momento de consulta en Lima, estado provisional y número de página.

Al final se agrega un ranking por **total de Sí de cada área**, de mayor a menor. Cada Sí es una persona con evidencia en una fecha, no un número de capturas ni un conteo verificable de publicaciones externas. Los empates comparten puesto (1, 1, 3); se ordenan alfabéticamente dentro del empate. Áreas sin días evaluados aparecen al final con «Sin evaluación». No se ordena por porcentaje ni se ajusta por tamaño del área. La última fila suma personas y total de Sí.

La generación ocurre localmente con [jsPDF](https://github.com/parallax/jsPDF) y [AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable), versiones fijadas y licencias incluidas en `assets/js/vendor/`. Los archivos solo se cargan al solicitar un PDF. No se transmite información a terceros. Cambiar el período durante la carga cancela esa descarga; un error permite reintentar.

## Verificación

`node --test tests/facebook-report.test.mjs tests/facebook-pdf.test.mjs`: 21 pruebas. Además de cortes, matrices, filtros y permisos, verifican XLSX, fórmulas entre hojas, descarga PDF de todas las áreas, errores y consultas desactualizadas, ranking con empates, exclusiones y límites de las celdas en tablas largas. La revisión de PDF usó las bibliotecas reales: un corte ficticio de 3 páginas y un mensual ficticio de 37 páginas se renderizaron y validaron con PyMuPDF. Se inspeccionaron visualmente el corte completo y páginas representativas del mensual; se comprobaron automáticamente textos y límites de todas las páginas. Se corrigió un salto inicial que producía una página vacía en reportes grandes.

No se verificó visualmente el archivo en Excel: se intentó conectar el control de aplicaciones, pero su servicio nativo no estaba disponible. La herramienta de artefactos de hojas de cálculo tampoco estaba disponible; las comprobaciones cubren el código de exportación y su estructura, no la apariencia renderizada.

Pendiente: ejecutar el SQL en Supabase y contrastar con datos reales. No se realizó verificación visual en navegador; no había navegador conectado en la sesión. La prueba preexistente `tests/facebook-delete.test.mjs:63` falla también contra el código anterior, como se comprobó en la implementación inicial; ese código no se modificó.
