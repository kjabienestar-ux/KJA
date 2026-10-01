# Calendario y evidencias por colaborador

Implementación local de consulta individual, compartida por administración y Mi equipo. Extiende la interfaz existente en modo de solo lectura.

## Acceso y consulta

- **Mes completo → Ver calendario y evidencias**, debajo del nombre: abre a esa persona y conserva el mes seleccionado.
- **Mi equipo → colaborador**: incorpora el mismo calendario en su ficha, inicialmente en el mes actual.

**Volver a Mes completo** cierra el detalle y lleva a la tabla, conservando los filtros. Cambiar la búsqueda, el área, el mes o actualizar el libro también cierra el detalle anterior.

El encabezado muestra nombre, área, DNI e ingreso. Las flechas y el selector permiten cambiar de mes entre enero de 2020 y el mes actual. **Mes actual** restablece el período. El resumen presenta incidencias, días con Facebook entregado, horas y totales P/T/J.

Seleccionar una fecha o una entrada de **Fechas para revisar** muestra estado, motivo, comparticiones, entrada, salida, modalidad, horas, notas y actividades aplicables. Se selecciona inicialmente la última incidencia disponible; en su defecto, hoy o la última fecha pasada. **Entregado no equivale a aprobado**; el estado de revisión se muestra cuando el endpoint lo proporciona.

## Estados y archivos

En fechas laborables dentro del contrato, reutiliza `KJAAttendanceCalendar.present`. Antes de colorear, aplica el horario de la persona (`lab`, calculado por el servidor con sus excepciones y feriados) y las fechas contractuales:

- Gris: sin jornada, antes del inicio o después del fin de referencia del contrato. No suma incidencias ni comparticiones al resumen laboral; permite consultar las entregas existentes. El fin es referencial y solo delimita esta vista: no cambia reglas ni registros en el servidor.
- Rojo: Facebook vencido sin completar o cierre incompleto. Facebook vencido tiene prioridad incluso en una jornada justificada.
- J / azul: jornada justificada, sin exigir entrada, RPE ni salida; las comparticiones siguen su propia condición.
- Verde: presente o compartido; ámbar: tardanza o comparticiones pendientes dentro del plazo.
- Futuro: fecha programada, sin incidencia y sin selección. La ausencia de datos de Facebook se informa como información no disponible.

**Ver archivos** permite recorrer evidencias, previsualizar imágenes y videos y abrir el archivo completo. Los archivos privados se solicitan a Storage mediante URL firmada de 15 minutos, bajo los permisos existentes. Calendario, detalle y archivo tienen mensajes de carga, errores y reintentos; una consulta fallida no confirma ausencia de evidencias.

## Dirección visual local

Hereda azul marino, blanco, tipografía Inter y colores semánticos del dashboard. Calendario y detalle forman dos columnas cuando el espacio disponible lo permite y se apilan en contenedores estrechos, incluido el panel de Mi equipo en escritorio. Usa bordes discretos, etiquetas de estado, selección con `aria-pressed` y foco visible. El acceso desde Mes completo enfoca el encabezado de la persona. Estas decisiones pertenecen a esta superficie de consulta y conservan la identidad visual global.

## Integración y publicación

El componente está en [dashboard-person-calendar.js](../assets/js/dashboard-person-calendar.js) y sus estilos en [dashboard-person-calendar.css](../assets/css/paginas/dashboard-person-calendar.css). Se integra desde `renderTeamPersonDetail` en [dashboard.js](../assets/js/dashboard.js) y el botón del nombre en [dashboard-admin-mes.js](../assets/js/dashboard-admin-mes.js).

Consulta `dash_historial(p_anio, p_mes, p_colab)` para el mes y `dash_equipo_dia_detalle(p_colaborador, p_fecha)` para el día. Requiere las migraciones existentes:

- [71: historial y comparticiones](../supabase/dashboard_71_historial_comparticiones.sql).
- [81: detalle diario del equipo](../supabase/dashboard_81_equipo_dia_detalle.sql).
- [82: justificación y cierre personal](../supabase/dashboard_82_justificacion_cierre_personal.sql).

- [83: fechas del contrato en el historial](../supabase/dashboard_83_calendario_contrato.sql).

La migración 83 conserva los controles de acceso del historial y añade únicamente metadatos contractuales. Es necesario publicar los cambios del frontend y comprobar que estas migraciones estén aplicadas en el entorno destino. La implementación utiliza los endpoints reales del proyecto; no se confirmó su funcionamiento con datos de producción.

## Verificación

La batería `npm run test:calendario` comprende 19 pruebas aprobadas. En este entorno Windows se ejecutó el equivalente con preservación de enlaces:

```powershell
node --preserve-symlinks --preserve-symlinks-main --test tests/person-calendar.test.mjs tests/person-calendar-contract-sql.test.mjs tests/team-day-detail.test.mjs tests/attendance-calendar.test.mjs tests/justified-personal-close.test.mjs
```

El navegador no estuvo disponible: quedan pendientes la revisión visual y la comprobación interactiva con sesión y datos reales después de publicar.
