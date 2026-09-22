# Matriz de requerimientos y trazabilidad — Portal KJA

**Versión:** 1.0 · **Fecha:** 22/09/2026 · **Estado:** propuesta para revisión.

Fuente normativa: [requerimientos](01-requerimientos-portal-asistencia.md).
Flujos: [Mermaid](20-diagramas-secuencia-administracion.md) y
[PlantUML](21-diagramas-secuencia-administracion-plantuml.md).

La matriz contiene **175 RF y 81 RNF**, sin renumerar la base previa.
Cada fila identifica requisito, prioridad, estado documental, fuente por módulo,
diagrama relacionado y caso de aceptación. El criterio AC reproduce el criterio
de la especificación para que la matriz pueda revisarse de forma independiente.

**Verificación de todos los casos: pendiente de ejecución y acta.** Esta revisión
comprueba consistencia documental y referencias locales. Código local no significa
desplegado; Base previa no significa revalidado. Los archivos de pruebas listados
son candidatos por módulo, no evidencia de que cubran o aprueben cada fila.

**N/A** en secuencia indica objetivo transversal, compatibilidad o función futura:
su verificación se realiza por inspección, auditoría o prueba específica. Una
secuencia relacionada aporta contexto; no demuestra que cada regla esté implementada.
HU, CU, sprint, responsable nominal y fecha comprometida quedan sin asignar hasta
la siguiente etapa de planificación y validación con el equipo.

## Fuentes por módulo

Los vínculos de cada fila apuntan a estos grupos. Las migraciones posteriores
pueden reemplazar funciones de las anteriores: leer la cadena y la versión 70
cuando aplique, sin volver a ejecutar todos los SQL indiscriminadamente.

### acceso

Fuente de implementación o documento de referencia: [supabase/functions/dash-entrar/index.ts](../supabase/functions/dash-entrar/index.ts), [supabase/dashboard_01_identidad_y_roles.sql](../supabase/dashboard_01_identidad_y_roles.sql), [assets/js/dashboard.js](../assets/js/dashboard.js).

Validación: inspección y pruebas de aceptación por preparar/ejecutar; no se acredita cobertura automática individual.

### personal

Fuente de implementación o documento de referencia: [assets/js/dashboard.js](../assets/js/dashboard.js), [supabase/dashboard_04_portal_asistencia.sql](../supabase/dashboard_04_portal_asistencia.sql), [supabase/dashboard_19_cierre_jornada.sql](../supabase/dashboard_19_cierre_jornada.sql).

Validación: inspección y pruebas de aceptación por preparar/ejecutar; no se acredita cobertura automática individual.

### marcado

Fuente de implementación o documento de referencia: [assets/js/dashboard.js](../assets/js/dashboard.js), [supabase/dashboard_12_marcado_blindado.sql](../supabase/dashboard_12_marcado_blindado.sql), [supabase/dashboard_13_modalidad_y_geocerca.sql](../supabase/dashboard_13_modalidad_y_geocerca.sql), [supabase/dashboard_42_entrada_y_salida_tardia.sql](../supabase/dashboard_42_entrada_y_salida_tardia.sql).

Pruebas locales relacionadas disponibles: [tests/geolocation.test.mjs](../tests/geolocation.test.mjs). No ejecutadas en esta revisión documental.

### permisos

Fuente de implementación o documento de referencia: [supabase/dashboard_01_identidad_y_roles.sql](../supabase/dashboard_01_identidad_y_roles.sql), [supabase/dashboard_03_cerrar_panel.sql](../supabase/dashboard_03_cerrar_panel.sql), [assets/js/dashboard.js](../assets/js/dashboard.js).

Validación: inspección y pruebas de aceptación por preparar/ejecutar; no se acredita cobertura automática individual.

### compatibilidad

Fuente de implementación o documento de referencia: [vercel.json](../vercel.json), [supabase/dashboard_13_modalidad_y_geocerca.sql](../supabase/dashboard_13_modalidad_y_geocerca.sql), [docs/07-regresion-cierre-transicion.md](../docs/07-regresion-cierre-transicion.md).

Validación: inspección y pruebas de aceptación por preparar/ejecutar; no se acredita cobertura automática individual.

### lista

Fuente de implementación o documento de referencia: [assets/js/dashboard.js](../assets/js/dashboard.js), [supabase/dashboard_05_admin_lista.sql](../supabase/dashboard_05_admin_lista.sql).

Validación: inspección y pruebas de aceptación por preparar/ejecutar; no se acredita cobertura automática individual.

### equipo

Fuente de implementación o documento de referencia: [assets/js/dashboard-admin-equipo.js](../assets/js/dashboard-admin-equipo.js), [supabase/dashboard_06_admin_equipo.sql](../supabase/dashboard_06_admin_equipo.sql), [supabase/dashboard_66_institucion_colaborador.sql](../supabase/dashboard_66_institucion_colaborador.sql).

Pruebas locales relacionadas disponibles: [tests/person-profile.test.mjs](../tests/person-profile.test.mjs). No ejecutadas en esta revisión documental.

### mes

Fuente de implementación o documento de referencia: [assets/js/dashboard-admin-mes.js](../assets/js/dashboard-admin-mes.js), [supabase/dashboard_07_admin_mes.sql](../supabase/dashboard_07_admin_mes.sql), [supabase/dashboard_69_alviery_cierre_mensual.sql](../supabase/dashboard_69_alviery_cierre_mensual.sql).

Pruebas locales relacionadas disponibles: [tests/alviery-month-sql-check.mjs](../tests/alviery-month-sql-check.mjs). No ejecutadas en esta revisión documental.

### configuracion

Fuente de implementación o documento de referencia: [assets/js/dashboard-admin-acceso.js](../assets/js/dashboard-admin-acceso.js), [supabase/dashboard_08_admin_marcado.sql](../supabase/dashboard_08_admin_marcado.sql), [supabase/dashboard_12_marcado_blindado.sql](../supabase/dashboard_12_marcado_blindado.sql), [supabase/dashboard_14_mapa_oficina_auditable.sql](../supabase/dashboard_14_mapa_oficina_auditable.sql).

Validación: inspección y pruebas de aceptación por preparar/ejecutar; no se acredita cobertura automática individual.

### roles

Fuente de implementación o documento de referencia: [assets/js/dashboard-admin-roles.js](../assets/js/dashboard-admin-roles.js), [supabase/dashboard_09_roles_y_liderazgo.sql](../supabase/dashboard_09_roles_y_liderazgo.sql), [supabase/dashboard_51_colideres_tecnicos.sql](../supabase/dashboard_51_colideres_tecnicos.sql).

Validación: inspección y pruebas de aceptación por preparar/ejecutar; no se acredita cobertura automática individual.

### solicitudes

Fuente de implementación o documento de referencia: [assets/js/dashboard.js](../assets/js/dashboard.js), [supabase/dashboard_10_fotos_perfil.sql](../supabase/dashboard_10_fotos_perfil.sql), [supabase/dashboard_11_solicitudes_personales.sql](../supabase/dashboard_11_solicitudes_personales.sql), [supabase/dashboard_18_dias_libres.sql](../supabase/dashboard_18_dias_libres.sql).

Validación: inspección y pruebas de aceptación por preparar/ejecutar; no se acredita cobertura automática individual.

### cierre

Fuente de implementación o documento de referencia: [assets/js/dashboard-close-model.js](../assets/js/dashboard-close-model.js), [assets/js/dashboard.js](../assets/js/dashboard.js), [supabase/dashboard_19_cierre_jornada.sql](../supabase/dashboard_19_cierre_jornada.sql), [supabase/dashboard_36_cierre_automatico_por_evidencia.sql](../supabase/dashboard_36_cierre_automatico_por_evidencia.sql), [supabase/dashboard_46_conservar_salida_con_pendientes.sql](../supabase/dashboard_46_conservar_salida_con_pendientes.sql), [supabase/dashboard_70_rpe_presencial.sql](../supabase/dashboard_70_rpe_presencial.sql).

Pruebas locales relacionadas disponibles: [tests/dashboard-close.test.mjs](../tests/dashboard-close.test.mjs), [tests/exit-work-order.test.mjs](../tests/exit-work-order.test.mjs). No ejecutadas en esta revisión documental.

### archivos

Fuente de implementación o documento de referencia: [supabase/functions/dash-entrega/index.ts](../supabase/functions/dash-entrega/index.ts), [supabase/dashboard_27_video_corto.sql](../supabase/dashboard_27_video_corto.sql), [supabase/dashboard_28_edicion_evidencias_jornada.sql](../supabase/dashboard_28_edicion_evidencias_jornada.sql), [supabase/dashboard_55_documentos_asignaciones.sql](../supabase/dashboard_55_documentos_asignaciones.sql).

Pruebas locales relacionadas disponibles: [tests/assignment-documents.test.mjs](../tests/assignment-documents.test.mjs). No ejecutadas en esta revisión documental.

### excepciones

Fuente de implementación o documento de referencia: [supabase/dashboard_61_jornadas_justificadas.sql](../supabase/dashboard_61_jornadas_justificadas.sql), [supabase/dashboard_68_alviery_asistencia_comparticiones.sql](../supabase/dashboard_68_alviery_asistencia_comparticiones.sql), [supabase/dashboard_69_alviery_cierre_mensual.sql](../supabase/dashboard_69_alviery_cierre_mensual.sql), [supabase/dashboard_70_rpe_presencial.sql](../supabase/dashboard_70_rpe_presencial.sql).

Pruebas locales relacionadas disponibles: [tests/rpe-presencial.test.mjs](../tests/rpe-presencial.test.mjs), [tests/attendance-sharing-only.test.mjs](../tests/attendance-sharing-only.test.mjs), [tests/justified-close.test.mjs](../tests/justified-close.test.mjs). No ejecutadas en esta revisión documental.

### facebook

Fuente de implementación o documento de referencia: [assets/js/facebook-receipt.js](../assets/js/facebook-receipt.js), [supabase/dashboard_48_separar_jornada_y_comparticiones.sql](../supabase/dashboard_48_separar_jornada_y_comparticiones.sql), [supabase/dashboard_49_vencimiento_comparticiones.sql](../supabase/dashboard_49_vencimiento_comparticiones.sql), [supabase/dashboard_62_compartir_comprobante.sql](../supabase/dashboard_62_compartir_comprobante.sql), [supabase/dashboard_63_eliminar_imagen_facebook.sql](../supabase/dashboard_63_eliminar_imagen_facebook.sql), [docs/23-eliminar-imagenes-facebook.md](../docs/23-eliminar-imagenes-facebook.md).

Pruebas locales relacionadas disponibles: [tests/facebook-receipt.test.mjs](../tests/facebook-receipt.test.mjs), [tests/facebook-delete.test.mjs](../tests/facebook-delete.test.mjs). No ejecutadas en esta revisión documental.

### asignaciones

Fuente de implementación o documento de referencia: [assets/js/dashboard-assignments.js](../assets/js/dashboard-assignments.js), [supabase/dashboard_24_sorteo_entregables.sql](../supabase/dashboard_24_sorteo_entregables.sql), [supabase/dashboard_56_calendario_asignaciones.sql](../supabase/dashboard_56_calendario_asignaciones.sql), [supabase/dashboard_58_eliminar_archivos_asignaciones.sql](../supabase/dashboard_58_eliminar_archivos_asignaciones.sql).

Pruebas locales relacionadas disponibles: [tests/assignment-panel.test.mjs](../tests/assignment-panel.test.mjs), [tests/assignment-delete.test.mjs](../tests/assignment-delete.test.mjs). No ejecutadas en esta revisión documental.

### supervision

Fuente de implementación o documento de referencia: [assets/js/dashboard-admin-cierre.js](../assets/js/dashboard-admin-cierre.js), [assets/js/dashboard-admin-control.js](../assets/js/dashboard-admin-control.js), [supabase/dashboard_21_revision_evidencias.sql](../supabase/dashboard_21_revision_evidencias.sql), [supabase/dashboard_25_impedimentos_cierre.sql](../supabase/dashboard_25_impedimentos_cierre.sql), [supabase/dashboard_34_notificaciones_revision.sql](../supabase/dashboard_34_notificaciones_revision.sql), [supabase/dashboard_37_carga_evidencias_direccion.sql](../supabase/dashboard_37_carga_evidencias_direccion.sql), [supabase/dashboard_70_rpe_presencial.sql](../supabase/dashboard_70_rpe_presencial.sql).

Pruebas locales relacionadas disponibles: [tests/dashboard-close.test.mjs](../tests/dashboard-close.test.mjs). No ejecutadas en esta revisión documental.

### ranking

Fuente de implementación o documento de referencia: [assets/js/dashboard-ranking.js](../assets/js/dashboard-ranking.js), [assets/js/ranking-model.js](../assets/js/ranking-model.js), [supabase/dashboard_70_rpe_presencial.sql](../supabase/dashboard_70_rpe_presencial.sql), [docs/21-ranking-mensual.md](../docs/21-ranking-mensual.md).

Pruebas locales relacionadas disponibles: [tests/ranking.test.mjs](../tests/ranking.test.mjs), [tests/ranking-cumplimiento-sql-check.mjs](../tests/ranking-cumplimiento-sql-check.mjs). No ejecutadas en esta revisión documental.

### reportes

Fuente de implementación o documento de referencia: [assets/js/dashboard-facebook-report.js](../assets/js/dashboard-facebook-report.js), [assets/js/facebook-report-model.js](../assets/js/facebook-report-model.js), [assets/js/facebook-report-excel.js](../assets/js/facebook-report-excel.js), [assets/js/facebook-report-pdf.js](../assets/js/facebook-report-pdf.js), [supabase/dashboard_65_reporte_facebook_hoy.sql](../supabase/dashboard_65_reporte_facebook_hoy.sql), [docs/24-reportes-facebook.md](../docs/24-reportes-facebook.md).

Pruebas locales relacionadas disponibles: [tests/facebook-report.test.mjs](../tests/facebook-report.test.mjs), [tests/facebook-pdf.test.mjs](../tests/facebook-pdf.test.mjs). No ejecutadas en esta revisión documental.

### chat

Fuente de implementación o documento de referencia: [assets/js/dashboard-chat.js](../assets/js/dashboard-chat.js), [assets/js/chat-images.js](../assets/js/chat-images.js), [supabase/chat_01_mensajes.sql](../supabase/chat_01_mensajes.sql), [supabase/chat_06_realtime_eventos.sql](../supabase/chat_06_realtime_eventos.sql), [supabase/chat_07_imagenes.sql](../supabase/chat_07_imagenes.sql), [docs/chat-imagenes.md](../docs/chat-imagenes.md).

Pruebas locales relacionadas disponibles: [tests/chat.test.mjs](../tests/chat.test.mjs), [tests/chat-images.test.mjs](../tests/chat-images.test.mjs). No ejecutadas en esta revisión documental.

### marketing

Fuente de implementación o documento de referencia: [assets/js/dashboard-marketing.js](../assets/js/dashboard-marketing.js), [assets/js/marketing-model.js](../assets/js/marketing-model.js), [supabase/functions/marketing-publicaciones/index.ts](../supabase/functions/marketing-publicaciones/index.ts), [supabase/marketing_02_gemini_cache.sql](../supabase/marketing_02_gemini_cache.sql), [docs/18-publicaciones-marketing.md](../docs/18-publicaciones-marketing.md).

Pruebas locales relacionadas disponibles: [tests/marketing.test.mjs](../tests/marketing.test.mjs), [tests/marketing-gemini.test.mjs](../tests/marketing-gemini.test.mjs). No ejecutadas en esta revisión documental.

### calidad

Fuente de implementación o documento de referencia: [docs/01-requerimientos-portal-asistencia.md](../docs/01-requerimientos-portal-asistencia.md), [docs/07-regresion-cierre-transicion.md](../docs/07-regresion-cierre-transicion.md), [package.json](../package.json).

Validación: inspección y pruebas de aceptación por preparar/ejecutar; no se acredita cobertura automática individual.

## Requerimientos funcionales

| ID | Requerimiento | Prioridad | Estado documental | Fuente | Secuencia | Caso de aceptación pendiente |
|---|---|---|---|---|---|---|
| RF-001 | El colaborador debe ingresar con su DNI de 8 dígitos y PIN de 4 dígitos. | Must | Base previa | [acceso](#acceso) | DS-012 | **AC-RF-001:** Un DNI y PIN válidos permiten abrir el portal; una combinación inválida no entrega sesión. |
| RF-002 | El sistema debe aceptar únicamente colaboradores activos. | Must | Base previa | [acceso](#acceso) | DS-012 | **AC-RF-002:** Una ficha inactiva no puede iniciar sesión. |
| RF-003 | El DNI debe ser único después de normalizar caracteres no numéricos. | Must | Base previa | [acceso](#acceso) | DS-012 | **AC-RF-003:** La base rechaza dos colaboradores con el mismo DNI normalizado. |
| RF-004 | El sistema debe validar el PIN usando la huella y sal existentes, sin recuperar el PIN en texto plano. | Must | Base previa | [acceso](#acceso) | DS-012 | **AC-RF-004:** La validación ocurre en SQL y el navegador nunca recibe sal ni huella. |
| RF-005 | Después de cinco PIN incorrectos, el acceso debe bloquearse durante 15 minutos. | Must | Base previa | [acceso](#acceso) | DS-012 | **AC-RF-005:** El sexto intento dentro del bloqueo responde indicando el tiempo de espera. |
| RF-006 | En el primer ingreso válido se debe crear automáticamente una cuenta técnica de Supabase Auth. | Must | Base previa | [acceso](#acceso) | DS-012 | **AC-RF-006:** El colaborador entra sin que Dirección cree correo o contraseña manualmente. |
| RF-007 | La cuenta técnica debe vincularse con una sola ficha de colaborador. | Must | Base previa | [acceso](#acceso) | DS-012 | **AC-RF-007:** `asis_perfiles.colaborador_id` identifica de manera única al colaborador. |
| RF-008 | La contraseña técnica debe derivarse en el servidor usando `DASH_PIN_SECRET` y no debe mostrarse ni almacenarse en el cliente. | Must | Base previa | [acceso](#acceso) | DS-012 | **AC-RF-008:** No existe contraseña técnica en HTML, JavaScript, tablas de negocio ni respuestas HTTP. |
| RF-009 | La sesión personal debe tener una vigencia máxima de ocho horas. | Must | Base previa | [acceso](#acceso) | DS-012 | **AC-RF-009:** Cumplidas ocho horas, las funciones y políticas dejan de entregar datos. |
| RF-010 | El portal debe mostrar el tiempo restante de la sesión. | Should | Base previa | [acceso](#acceso) | DS-012 | **AC-RF-010:** La cabecera presenta horas y minutos restantes. |
| RF-011 | El usuario debe poder cerrar su sesión manualmente. | Must | Base previa | [acceso](#acceso) | DS-012 | **AC-RF-011:** Cerrar sesión elimina la sesión local y regresa al acceso. |
| RF-012 | Dirección debe ingresar con el correo y contraseña que ya utiliza en el panel administrativo. | Must | Base previa | [acceso](#acceso) | DS-012 | **AC-RF-012:** La pestaña Dirección autentica con Supabase Auth. |
| RF-013 | Una persona vinculada a una cuenta administrativa no debe recibir una segunda identidad personal. | Must | Base previa | [acceso](#acceso) | DS-012 | **AC-RF-013:** El acceso DNI + PIN responde que debe utilizar su cuenta de Dirección. |
| RF-014 | Un colaborador sin PIN debe recibir una instrucción para completar el alta mediante el flujo vigente. | Should | Base previa | [acceso](#acceso) | DS-012 | **AC-RF-014:** El portal informa que debe crear el PIN desde el enlace de marcado. |
| RF-015 | El sistema debe permitir recuperación o activación de acceso por correo. | Could | Planificado | [calidad](#calidad) | N/A | **AC-RF-015:** El colaborador puede verificar su correo y recuperar el acceso sin intervención manual. |
| RF-016 | El inicio debe saludar al usuario y mostrar la fecha actual en la zona horaria de Lima. | Should | Base previa | [personal](#personal) | DS-014 | **AC-RF-016:** Nombre, saludo y fecha corresponden a la sesión y al día vigente. |
| RF-017 | El inicio debe mostrar hora de entrada, hora de salida, modalidad y tolerancia. | Must | Base previa | [personal](#personal) | DS-014 | **AC-RF-017:** La jornada usa el horario configurado para el día de la semana. |
| RF-018 | El inicio debe mostrar si la asistencia está pendiente, presente, tardía, justificada o no gestionada. | Must | Base previa | [personal](#personal) | DS-014 | **AC-RF-018:** El estado coincide con el registro vigente de `asis_registros`. |
| RF-019 | El sistema debe representar visualmente el avance de la hora actual dentro de la jornada. | Should | Base previa | [personal](#personal) | DS-014 | **AC-RF-019:** La línea de jornada posiciona “Ahora” entre entrada y salida. |
| RF-020 | El usuario debe visualizar sus horas acumuladas y su meta contractual. | Must | Base previa | [personal](#personal) | DS-014 | **AC-RF-020:** El total considera horas previas y registros válidos. |
| RF-021 | El usuario debe visualizar el indicador de asistencia mensual calculado por el servidor. | Should | Código local | [personal](#personal) | DS-014 | **AC-RF-021:** El indicador coincide con la respuesta vigente; su fórmula se distingue del porcentaje administrativo RF-099 y del ranking RF-157. |
| RF-022 | El inicio debe mostrar un resumen de la semana vigente. | Should | Base previa | [personal](#personal) | DS-014 | **AC-RF-022:** Se presentan siete días con estado y resaltado del día actual. |
| RF-023 | El dashboard debe mostrar un calendario lateral y la agenda de la jornada en escritorio. | Should | Base previa | [personal](#personal) | DS-014 | **AC-RF-023:** La columna derecha contiene perfil, calendario, entrada, asistencia y salida. |
| RF-024 | El dashboard debe actualizarse cuando un registro sea cambiado desde el panel administrativo. | Should | Parcial | [personal](#personal) | DS-014 | **AC-RF-024:** Actualmente requiere recargar la página; se acepta cuando actualice al recuperar foco o mediante tiempo real. |
| RF-025 | El colaborador debe poder marcar asistencia desde su dashboard personal. | Must | Base previa | [marcado](#marcado) | DS-013 | **AC-RF-025:** El botón se habilita cuando corresponde y crea un registro válido. |
| RF-026 | La marcación debe utilizar la fecha y hora del servidor en `America/Lima`. | Must | Base previa | [marcado](#marcado) | DS-013 | **AC-RF-026:** Cambiar el reloj del dispositivo no cambia la hora registrada. |
| RF-027 | La marcación debe habilitarse solo en un día laborable. | Must | Base previa | [marcado](#marcado) | DS-013 | **AC-RF-027:** Un día no laborable responde `no_labora` y no crea registro. |
| RF-028 | La entrada debe respetar la ventana vigente del protocolo de marcado seguro. | Must | Código local | [marcado](#marcado) | DS-013 | **AC-RF-028:** Antes de la apertura o después del cierre aplicable el servidor rechaza; se consideran las ampliaciones autorizadas de entrada tardía. |
| RF-029 | El sistema debe clasificar como presente una marca dentro de la tolerancia. | Must | Base previa | [marcado](#marcado) | DS-013 | **AC-RF-029:** Desde la entrada hasta el límite se registra estado `P`. |
| RF-030 | El sistema debe clasificar como tardanza una marca posterior a la tolerancia y anterior al cierre. | Must | Base previa | [marcado](#marcado) | DS-013 | **AC-RF-030:** Dentro de ese tramo se registra estado `T`. |
| RF-031 | Solo debe existir una marca por colaborador y fecha. | Must | Base previa | [marcado](#marcado) | DS-013 | **AC-RF-031:** Un segundo intento responde `ya_marcado`; la base conserva una sola fila. |
| RF-032 | Una marca realizada desde el portal personal debe registrar el origen `dashboard`. | Must | Base previa | [marcado](#marcado) | DS-013 | **AC-RF-032:** La fila creada contiene `origen = 'dashboard'`. |
| RF-033 | El protocolo vigente debe exigir evidencia de entrada verificada. | Must | Código local | [marcado](#marcado) | DS-013 | **AC-RF-033:** Una llamada directa sin archivo autorizado y verificado no crea la marca; no basta ocultar el botón. |
| RF-034 | El usuario debe poder tomar una foto o elegir una imagen existente. | Should | Base previa | [marcado](#marcado) | DS-013 | **AC-RF-034:** Ambas opciones generan una vista previa antes de registrar. |
| RF-035 | La imagen debe comprimirse antes de la subida. | Should | Base previa | [marcado](#marcado) | DS-013 | **AC-RF-035:** El navegador reduce dimensiones y calidad antes de enviar. |
| RF-036 | La evidencia debe llevar una marca con nombre, fecha, hora del servidor y KJA. | Should | Base previa | [marcado](#marcado) | DS-013 | **AC-RF-036:** El archivo almacenado contiene el sello visible. |
| RF-037 | La evidencia debe almacenarse en la ruta autorizada por el servidor. | Must | Código local | [marcado](#marcado) | DS-013 | **AC-RF-037:** La ruta pertenece al usuario, fecha y permiso emitido; el cliente no impone una ruta histórica fija ni otra extensión. |
| RF-038 | La carga debe utilizar un permiso temporal limitado a una ruta y una confirmación validada por servidor. | Must | Código local | [marcado](#marcado) | DS-013 | **AC-RF-038:** Una ruta ajena o sin permiso no se confirma; no se atribuye a toda URL firmada una propiedad universal de un solo uso. |
| RF-039 | El marcado presencial debe exigir ubicación y precisión válidas dentro de la geocerca; el virtual sigue su protocolo sin GPS obligatorio. | Could | Código local | [marcado](#marcado) | DS-013 | **AC-RF-039:** Denegar ubicación impide el marcado presencial; SQL revalida coordenadas y distancia. |
| RF-040 | Después de marcar, el dashboard debe actualizar estado, calendario, horas y porcentaje. | Must | Base previa | [marcado](#marcado) | DS-013 | **AC-RF-040:** La interfaz refleja el nuevo registro sin volver a iniciar sesión. |
| RF-041 | El usuario debe consultar su historial en un calendario mensual. | Must | Base previa | [personal](#personal) | DS-014 | **AC-RF-041:** Cada día representa su estado, condición laborable y si es futuro. |
| RF-042 | El usuario debe navegar a meses anteriores y no más allá del mes actual. | Should | Base previa | [personal](#personal) | DS-014 | **AC-RF-042:** El control de mes futuro permanece deshabilitado. |
| RF-043 | El historial debe diferenciar presente, tardanza, justificación, no gestión y día no laborable. | Must | Base previa | [personal](#personal) | DS-014 | **AC-RF-043:** Leyenda, color y etiqueta corresponden al estado almacenado. |
| RF-044 | El historial debe resumir presentes, tardanzas, justificaciones, no gestiones y horas. | Must | Base previa | [personal](#personal) | DS-014 | **AC-RF-044:** Los totales mensuales coinciden con `asis_registros`. |
| RF-045 | El usuario debe consultar su perfil laboral sin editar directamente identidad, contrato ni horario. | Must | Código local | [personal](#personal) | DS-014 | **AC-RF-045:** Los datos laborales son de consulta; la fotografía personal y las solicitudes usan flujos separados RF-127 y RF-128. |
| RF-046 | El usuario debe disponer de un canal para comunicar datos incorrectos. | Should | Base previa | [personal](#personal) | DS-014 | **AC-RF-046:** “Informar un cambio” abre el canal de contacto de Dirección. |
| RF-047 | El usuario debe poder solicitar un cambio de horario desde el portal. | Should | Parcial | [configuracion](#configuracion) | DS-010 | **AC-RF-047:** La RPC y la tabla existen; falta incorporar el formulario a la interfaz. |
| RF-048 | Solo debe existir una solicitud de horario pendiente por colaborador. | Should | Base previa | [configuracion](#configuracion) | DS-010 | **AC-RF-048:** Una segunda solicitud no crea otro pendiente. |
| RF-049 | Un miembro solo debe consultar sus propios datos. | Must | Base previa | [permisos](#permisos) | DS-001 | **AC-RF-049:** RLS impide leer fichas o registros de otras personas. |
| RF-050 | Un líder debe consultar únicamente colaboradores de su área. | Must | Base previa | [permisos](#permisos) | DS-001 | **AC-RF-050:** Personas de otras áreas no aparecen ni son accesibles por llamada directa. |
| RF-051 | Sistemas debe poder consultar todas las áreas desde el dashboard. | Must | Base previa | [permisos](#permisos) | DS-001 | **AC-RF-051:** El nivel `sistemas` supera la restricción de área para lectura. |
| RF-052 | El dashboard debe separar nivel de consulta y permiso administrativo. | Must | Base previa | [permisos](#permisos) | DS-001 | **AC-RF-052:** `nivel` controla visibilidad; `rol/acceso_panel` controla edición del panel. |
| RF-053 | Las cuentas técnicas creadas por DNI + PIN no deben obtener acceso al panel administrativo. | Must | Base previa | [permisos](#permisos) | DS-001 | **AC-RF-053:** Nacen con `acceso_panel = false`. |
| RF-054 | Líderes y Sistemas deben visualizar un resumen del equipo autorizado. | Should | Base previa | [permisos](#permisos) | DS-001 | **AC-RF-054:** Se muestran personas visibles, registrados, tardanzas y pendientes. |
| RF-055 | El resumen de equipo debe mostrar persona, área, hora y estado de asistencia del día. | Should | Base previa | [permisos](#permisos) | DS-001 | **AC-RF-055:** Cada fila contiene los datos permitidos por RLS. |
| RF-056 | El líder sin permiso administrativo de edición debe consultar asistencia y evidencias de su área sin modificarlas. | Must | Código local | [permisos](#permisos) | DS-001 | **AC-RF-056:** El nivel líder por sí solo no habilita correcciones ni aprobación de entregas. |
| RF-057 | Dirección debe administrar colaboradores, horarios, contratos, estados y marcas desde `asistencia.html`. | Must | Base previa | [permisos](#permisos) | DS-001 | **AC-RF-057:** El panel existente conserva sus operaciones y permisos. |
| RF-058 | La ruta anterior debe conservar el alta de PIN y la transición permitida sin eludir el protocolo actual. | Must | Código local | [compatibilidad](#compatibilidad) | N/A | **AC-RF-058:** No se promete marcado anónimo como contingencia: el protocolo de modalidad/geocerca rechaza el marcado anterior. |
| RF-059 | El dashboard y el panel administrativo deben utilizar la misma fuente de asistencia. | Must | Código local | [compatibilidad](#compatibilidad) | N/A | **AC-RF-059:** Las operaciones autorizadas consultan asis_registros; las rutas antiguas no obtienen permiso por compartir tablas. |
| RF-060 | El panel debe distinguir el origen panel, portal o dashboard. | Should | Base previa | [compatibilidad](#compatibilidad) | N/A | **AC-RF-060:** La interfaz administrativa etiqueta `origen = 'dashboard'` como automarcación. |
| RF-061 | Los cambios del dashboard no deben alterar certificados, clientes o perfiles del módulo de certificados. | Must | Base previa | [compatibilidad](#compatibilidad) | N/A | **AC-RF-061:** Las migraciones del dashboard solo operan sobre `asis_*`, `dash_*` y Storage de evidencias. |
| RF-062 | El portal debe disponer de la ruta /dashboard además de dashboard.html. | Should | Código local | [compatibilidad](#compatibilidad) | N/A | **AC-RF-062:** vercel.json declara la ruta; su disponibilidad HTTPS se verifica al desplegar. |
| RF-063 | La integración futura con certificados debe realizarse mediante un puente de identidad independiente. | Could | Planificado | [calidad](#calidad) | N/A | **AC-RF-063:** El módulo se integra sin mezclar `perfiles` con `asis_perfiles`. |
| RF-064 | El dashboard debe mostrar una zona de Gestión de asistencia únicamente a cuentas con `acceso_panel = true`. | Must | Base previa | [permisos](#permisos) | DS-001 | **AC-RF-064:** Un colaborador técnico no visualiza la navegación y una apertura directa es rechazada. |
| RF-065 | El Centro de gestión debe resumir colaboradores activos, registrados, tardanzas y personas sin registro del día. | Should | Base previa | [permisos](#permisos) | DS-001 | **AC-RF-065:** Los indicadores se calculan desde `asis_colaboradores` y `asis_registros` del día en Lima. |
| RF-066 | El Centro de gestión debe mostrar el estado reciente del equipo y las solicitudes de horario pendientes. | Should | Base previa | [permisos](#permisos) | DS-001 | **AC-RF-066:** La vista presenta persona, área, hora, origen, estado y solicitudes vigentes. |
| RF-067 | El administrador debe acceder a las herramientas nativas de gestión según su rol. | Must | Código local | [permisos](#permisos) | DS-001 | **AC-RF-067:** Lista, mes, colaboradores, contratos y marcado propio se abren en el dashboard; los enlaces anteriores solo cumplen una función de transición. |
| RF-068 | `asistencia.html` debe aceptar navegación profunda mediante un parámetro `modo` validado. | Should | Base previa | [permisos](#permisos) | DS-001 | **AC-RF-068:** Solo los modos permitidos cambian la vista inicial; valores desconocidos llevan a Inicio. |
| RF-069 | `asistencia.html` debe comprobar explícitamente `activo = true` y `acceso_panel = true` antes de cargar datos. | Must | Base previa | [permisos](#permisos) | DS-001 | **AC-RF-069:** Una cuenta personal autenticada no entra al panel aunque conozca la URL. |
| RF-070 | La gestión nativa debe reutilizar las reglas centrales de asistencia, contrato, evidencia y permisos. | Must | Código local | [permisos](#permisos) | DS-001 | **AC-RF-070:** No se considera terminado el retiro del panel antiguo sin regresión y decisión documentada. |
| RF-071 | El Centro de gestión debe cargar la lista administrativa para una fecha seleccionada aplicando días laborables, contrato y excepciones en el servidor. | Must | Base previa | [lista](#lista) | DS-002 | **AC-RF-071:** La RPC `dash_admin_lista` solo devuelve colaboradores que laboran en la fecha y cuyo contrato ya inició. |
| RF-072 | El administrador debe buscar colaboradores y filtrar la lista por área sin recargar la página. | Should | Base previa | [lista](#lista) | DS-002 | **AC-RF-072:** La lista se filtra por nombre y área conservando los datos de la fecha cargada. |
| RF-073 | La lista debe mostrar horario, modalidad, horas, estado y hora registrada de cada colaborador. | Must | Base previa | [lista](#lista) | DS-002 | **AC-RF-073:** Cada fila presenta la jornada y el registro congelado correspondiente. |
| RF-074 | `editor` y `direccion` deben crear o corregir estados `P`, `T`, `J` y `NG` desde el dashboard. | Must | Base previa | [lista](#lista) | DS-002 | **AC-RF-074:** La RPC valida el rol y calcula la hora coherente con el estado usando Lima y la tolerancia vigente. |
| RF-075 | Un usuario `visor` debe consultar la lista sin poder modificar estados ni borrar evidencias. | Must | Base previa | [lista](#lista) | DS-002 | **AC-RF-075:** Los controles aparecen deshabilitados y Supabase rechaza escrituras y borrados directos. |
| RF-076 | Corregir una marca debe conservar su nota y evidencia existentes. | Must | Base previa | [lista](#lista) | DS-002 | **AC-RF-076:** El `upsert` actualiza estado, actor, hora, origen, horas y vínculo sin sobrescribir nota ni evidencia. |
| RF-077 | El personal administrativo debe abrir una evidencia mediante un enlace privado temporal. | Should | Base previa | [lista](#lista) | DS-002 | **AC-RF-077:** Storage crea una URL firmada con vigencia de una hora para el objeto solicitado. |
| RF-078 | Quitar una marca con evidencia debe eliminar primero la imagen y después el registro, previa confirmación. | Must | Base previa | [lista](#lista) | DS-002 | **AC-RF-078:** Si Storage falla, la marca se conserva; el registro solo se elimina después de confirmar el borrado de la foto. |
| RF-079 | El dashboard debe ofrecer directorios nativos de Colaboradores y Contratos a las cuentas con acceso al panel. | Must | Base previa | [equipo](#equipo) | DS-009 | **AC-RF-079:** Ambas secciones se abren dentro de Gestión y conservan enlaces al panel anterior. |
| RF-080 | La ficha administrativa debe mostrar si el colaborador tiene DNI, PIN y una cuenta técnica creada, sin exponer la huella del PIN. | Must | Base previa | [equipo](#equipo) | DS-009 | **AC-RF-080:** La RPC devuelve únicamente indicadores booleanos y nunca consulta la sal o huella hacia el cliente. |
| RF-081 | `editor` y `direccion` deben crear y editar colaboradores desde el dashboard. | Must | Base previa | [equipo](#equipo) | DS-009 | **AC-RF-081:** La RPC valida y guarda identidad, área, vínculo, horario y contrato en una sola transacción. |
| RF-082 | Todo DNI administrativo no vacío debe normalizarse a ocho dígitos y ser único. | Must | Base previa | [equipo](#equipo) | DS-009 | **AC-RF-082:** La función rechaza formatos inválidos y duplicados antes de escribir; el índice normalizado permanece como segunda barrera. |
| RF-083 | Dar de baja a un colaborador debe conservar sus marcas, horas, contrato e historial. | Must | Base previa | [equipo](#equipo) | DS-009 | **AC-RF-083:** La operación cambia `activo`, revoca sesiones personales y no elimina ninguna fila de asistencia. |
| RF-084 | El personal con permiso de edición debe crear áreas y asignarlas en la ficha. | Should | Base previa | [equipo](#equipo) | DS-009 | **AC-RF-084:** El nombre se valida y no permite duplicados sin distinguir mayúsculas. |
| RF-085 | El horario semanal debe admitir modalidad, entrada, salida y vínculo por día, rechazando salidas anteriores o iguales a la entrada. | Must | Base previa | [equipo](#equipo) | DS-009 | **AC-RF-085:** El servidor normaliza los siete días y deriva `dias_laborables` del horario válido. |
| RF-086 | La ficha debe gestionar inicio, fin de referencia, meta, horas previas, contrato pendiente y meta de voluntariado. | Must | Base previa | [equipo](#equipo) | DS-009 | **AC-RF-086:** Los campos se guardan juntos y el dato de voluntariado solo aplica a vínculos mixtos. |
| RF-087 | El seguimiento contractual debe calcularse en el servidor. | Must | Base previa | [equipo](#equipo) | DS-009 | **AC-RF-087:** La RPC entrega horas cumplidas, faltantes, horas semanales, alertas, cumplimiento y término estimado. |
| RF-088 | Los cambios de horario, metas, fechas, identidad y estado deben quedar en una bitácora con actor y motivo. | Must | Base previa | [equipo](#equipo) | DS-009 | **AC-RF-088:** La actualización y sus entradas de historial se confirman o revierten dentro de la misma transacción. |
| RF-089 | Un `visor` debe consultar colaboradores, contratos e historial sin poder crear, editar, dar de baja o crear áreas. | Must | Base previa | [equipo](#equipo) | DS-009 | **AC-RF-089:** La interfaz oculta acciones y todas las RPC de escritura vuelven a validar el rol. |
| RF-090 | Corregir el DNI no debe crear otra identidad ni alterar el PIN o el historial del colaborador. | Must | Base previa | [equipo](#equipo) | DS-009 | **AC-RF-090:** La cuenta técnica está vinculada al ID interno; el DNI funciona como identificador de entrada y puede corregirse de forma segura. |
| RF-091 | El dashboard debe ofrecer una grilla mensual nativa sin abandonar el Centro de gestión. | Must | Base previa | [mes](#mes) | DS-003 | **AC-RF-091:** La sección Mes completo presenta todos los días y personas del periodo con cabecera y nombre fijos. |
| RF-092 | La consulta mensual debe resolver horario, inicio de contrato, feriado y excepción personal en el servidor. | Must | Base previa | [mes](#mes) | DS-003 | **AC-RF-092:** `dash_admin_mes` entrega por celda si labora, motivo, modalidad, marca y metadatos aplicando la prioridad vigente. |
| RF-093 | La grilla debe distinguir `P`, `T`, `J`, `NG`, día pendiente, no laborable, feriado, preinicio, evidencia y excepción. | Must | Base previa | [mes](#mes) | DS-003 | **AC-RF-093:** Cada condición tiene texto accesible y representación visual; las marcas reales no se ocultan aunque el día no sea laborable. |
| RF-094 | El administrador debe navegar por mes, buscar por nombre, filtrar por área e incluir bajas. | Should | Base previa | [mes](#mes) | DS-003 | **AC-RF-094:** Los filtros se aplican sin recargar y las bajas solo se consultan al solicitarlas. |
| RF-095 | `editor` y `direccion` deben gestionar feriados y excepciones personales desde la grilla. | Must | Base previa | [mes](#mes) | DS-003 | **AC-RF-095:** Las RPC vuelven a validar el rol y no eliminan marcas al cambiar la condición del día. |
| RF-096 | La grilla debe permitir crear, corregir o quitar una marca reutilizando las operaciones seguras de la fase 2. | Must | Base previa | [mes](#mes) | DS-003 | **AC-RF-096:** Se usan `dash_admin_guardar_estado` y `dash_admin_quitar_estado`, incluida la coordinación con evidencia privada. |
| RF-097 | Un `visor` debe consultar el mes, detalles y exportaciones sin modificar marcas, feriados o excepciones. | Must | Base previa | [mes](#mes) | DS-003 | **AC-RF-097:** La interfaz oculta acciones y Supabase rechaza llamadas de escritura sin `asis_puede_editar()`. |
| RF-098 | El resumen mensual debe mostrar conteos por persona de `P`, `T`, `J`, `NG`, programados, pendientes, horas y porcentaje de asistencia. | Must | Base previa | [mes](#mes) | DS-003 | **AC-RF-098:** Los indicadores llegan calculados en la misma respuesta consolidada del mes. |
| RF-099 | El porcentaje administrativo debe distinguirse del cierre de jornada y del ranking. | Must | Código local | [mes](#mes) | DS-003 | **AC-RF-099:** La base histórica de dash_admin_mes usa (P + T) / (P + T + J); NG y ausencia de marca no entran en esa fórmula. El cierre se consulta por separado. |
| RF-100 | Mes completo y Resumen deben exportarse en CSV compatible con Excel. | Should | Base previa | [mes](#mes) | DS-003 | **AC-RF-100:** El archivo usa UTF-8 con BOM, separador punto y coma y respeta los filtros visibles. |
| RF-101 | El panel anterior debe permanecer disponible como contingencia durante el piloto de la fase 4. | Must | Base previa | [mes](#mes) | DS-003 | **AC-RF-101:** Ambas vistas conservan un enlace directo a su equivalente en `asistencia.html`. |
| RF-102 | El dashboard debe integrar Marcado propio como módulo nativo exclusivo de Dirección. | Must | Base previa | [configuracion](#configuracion) | DS-010 | **AC-RF-102:** La navegación y la RPC rechazan a `editor`, `visor` y cuentas sin acceso al panel. |
| RF-103 | El módulo debe distinguir el Portal KJA de uso diario y el enlace anterior utilizado para crear el PIN. | Must | Base previa | [configuracion](#configuracion) | DS-010 | **AC-RF-103:** La interfaz presenta ambas rutas como pasos diferentes y genera el QR únicamente para el portal oficial. |
| RF-104 | Dirección debe copiar la ruta del portal, copiar la activación y descargar un QR del dashboard. | Should | Base previa | [configuracion](#configuracion) | DS-010 | **AC-RF-104:** Las acciones no incluyen credenciales personales ni escriben información en Supabase. |
| RF-105 | Dirección debe configurar la tolerancia y las reglas vigentes sin desactivar la evidencia obligatoria del protocolo seguro. | Must | Código local | [configuracion](#configuracion) | DS-010 | **AC-RF-105:** La tolerancia válida se comprueba en servidor; la configuración no permite una marca sin evidencia requerida. |
| RF-106 | Dirección debe habilitar o cerrar el enlace anterior sin afectar el dashboard, los PIN ni las asistencias. | Must | Base previa | [configuracion](#configuracion) | DS-010 | **AC-RF-106:** `activo` conserva su semántica histórica sobre `/marcar`; el portal autenticado continúa separado. |
| RF-107 | Regenerar el enlace anterior debe exigir confirmación y no modificar PIN, sesiones, colaboradores o marcas. | Must | Base previa | [configuracion](#configuracion) | DS-010 | **AC-RF-107:** Solo cambia `asis_portal_config.clave` y registra el evento sin guardar la clave en la bitácora. |
| RF-108 | El módulo debe mostrar personas activas, PIN configurados, pendientes, bloqueos, DNI y estado del primer ingreso. | Must | Base previa | [configuracion](#configuracion) | DS-010 | **AC-RF-108:** Una RPC consolidada consulta claves sin devolver sal ni huella. |
| RF-109 | Reiniciar un PIN debe eliminar únicamente su huella y cerrar las sesiones personales vigentes. | Must | Base previa | [configuracion](#configuracion) | DS-010 | **AC-RF-109:** La cuenta técnica y el historial permanecen; la persona debe crear nuevamente su PIN. |
| RF-110 | Si existen personas sin PIN, cerrar la activación anterior debe mostrar una advertencia explícita. | Must | Base previa | [configuracion](#configuracion) | DS-010 | **AC-RF-110:** Dirección debe confirmar conociendo cuántas personas quedarían pendientes de activación. |
| RF-111 | Los avisos de horario deben abrir la ficha del colaborador y permitir cerrarlos como atendidos o descartados. | Should | Base previa | [configuracion](#configuracion) | DS-010 | **AC-RF-111:** La resolución vuelve a validar Dirección y conserva actor, fecha y resultado. |
| RF-112 | Los cambios de configuración, regeneraciones, reinicios de PIN y resoluciones de horario deben quedar auditados. | Must | Base previa | [configuracion](#configuracion) | DS-010 | **AC-RF-112:** `asis_admin_eventos` permanece privada y registra únicamente metadatos operativos. |
| RF-113 | El panel anterior no debe retirarse automáticamente al instalar la fase 5. | Must | Base previa | [configuracion](#configuracion) | DS-010 | **AC-RF-113:** El retiro queda sujeto a regresión completa, periodo estable y aprobación expresa de Dirección. |
| RF-114 | El portal debe diferenciar Colaborador, Líder, Co-líder y Sistemas, además de los permisos administrativos. | Must | Código local | [roles](#roles) | DS-001, DS-011 | **AC-RF-114:** Las etiquetas y menús corresponden a la identidad y no conceden facultades adicionales. |
| RF-115 | Una cuenta sin colaborador vinculado debe ocultar Inicio, Mi asistencia y Mi perfil. | Must | Base previa | [roles](#roles) | DS-001, DS-011 | **AC-RF-115:** Un administrador exclusivamente administrativo entra directamente a Gestión. |
| RF-116 | Un administrador de sistemas vinculado a un colaborador debe conservar su espacio personal y visualizar Administración como grupo separado. | Should | Base previa | [roles](#roles) | DS-001, DS-011 | **AC-RF-116:** Las opciones personales solo aparecen si `colaborador_id` existe. |
| RF-117 | Mi equipo debe mostrarse solamente al líder técnico y limitarse a su área. | Must | Base previa | [roles](#roles) | DS-001, DS-011 | **AC-RF-117:** Sistemas usa Gestión y no recibe una opción redundante de Mi equipo; RLS mantiene el alcance del líder. |
| RF-118 | Solo un administrador de sistemas con permiso Dirección debe administrar líderes. | Must | Base previa | [roles](#roles) | DS-001, DS-011 | **AC-RF-118:** La interfaz oculta el módulo y las RPC devuelven `sin_permiso` ante cualquier otra combinación. |
| RF-119 | Cada área debe admitir como máximo un líder técnico y dos co-líderes. | Must | Código local | [roles](#roles) | DS-011 | **AC-RF-119:** Las RPC rechazan asignaciones que excedan los límites y conservan las existentes al fallar. |
| RF-120 | El administrador debe asignar, reemplazar o retirar al líder de un área desde el dashboard. | Must | Base previa | [roles](#roles) | DS-011 | **AC-RF-120:** El mapa de áreas realiza el cambio en una única RPC y vuelve a cargar el estado confirmado. |
| RF-121 | Solo puede designarse líder a una persona activa, perteneciente al área y con cuenta personal activada. | Must | Base previa | [roles](#roles) | DS-011 | **AC-RF-121:** El servidor rechaza personas de otra área, bajas o sin primer ingreso. |
| RF-122 | Retirar el liderazgo debe conservar la cuenta personal, el PIN, las sesiones permitidas, el contrato y la asistencia histórica. | Must | Base previa | [roles](#roles) | DS-011 | **AC-RF-122:** Únicamente `nivel` cambia de `lider` a `miembro`. |
| RF-123 | Un contrato vencido o una cuenta inactiva debe señalar que el liderazgo requiere revisión, sin reemplazarlo automáticamente. | Should | Base previa | [roles](#roles) | DS-011 | **AC-RF-123:** El mapa muestra la alerta y Dirección decide quién asumirá el área. |
| RF-124 | Toda asignación, reemplazo o retiro de liderazgo debe registrar actor, área, persona anterior, persona nueva y fecha. | Must | Base previa | [roles](#roles) | DS-011 | **AC-RF-124:** La bitácora privada `asis_roles_eventos` conserva la trazabilidad. |
| RF-125 | El líder técnico debe abrir el perfil laboral y la asistencia mensual de las personas de su área sin capacidad de edición. | Must | Base previa | [roles](#roles) | DS-011, DS-014 | **AC-RF-125:** Mi equipo consulta `dash_historial` por persona; la RPC y RLS rechazan integrantes de otras áreas. |
| RF-126 | El sistema debe permitir al colaborador seleccionar modalidad diaria antes de marcar y conservar la modalidad registrada. | Must | Código local | [marcado](#marcado) | DS-013 | **AC-RF-126:** Después de marcar no se cambia la modalidad de esa asistencia; la modalidad marcada prevalece sobre elección diaria y horario. |
| RF-127 | El sistema debe cargar, consultar y quitar la fotografía personal mediante almacenamiento privado. | Should | Código local | [solicitudes](#solicitudes) | DS-014 | **AC-RF-127:** La operación aplica solo al perfil autorizado y no modifica los datos laborales. |
| RF-128 | El sistema debe crear solicitudes personales con tipo, fechas, detalle y evidencia cuando corresponda. | Must | Código local | [solicitudes](#solicitudes) | DS-015 | **AC-RF-128:** Una solicitud válida aparece en el historial propio; datos o fechas inválidos se rechazan. |
| RF-129 | El sistema debe permitir a Dirección aprobar o rechazar solicitudes personales y consultar días libres. | Must | Código local | [solicitudes](#solicitudes) | DS-015 | **AC-RF-129:** La decisión guarda respuesta y actor; el colaborador consulta su estado sin aprobar su propia solicitud. |
| RF-130 | El sistema debe configurar y auditar el punto de oficina y validar la geocerca presencial en servidor. | Must | Código local | [marcado](#marcado) | DS-013, DS-010 | **AC-RF-130:** Fuera del radio o con ubicación inválida se rechaza; cambiar el punto deja valores anteriores y nuevos en auditoría. |
| RF-131 | El sistema debe rechazar protocolos antiguos de marcación y explicar cómo actualizar el portal. | Must | Código local | [marcado](#marcado) | DS-013 | **AC-RF-131:** Una petición con protocolo no admitido no inserta asistencia aunque tenga sesión válida. |
| RF-132 | El sistema debe mostrar los requisitos aplicables y el estado del cierre diario. | Must | Código local | [cierre](#cierre) | DS-004, DS-006 | **AC-RF-132:** Se distinguen asistencia, salida, RPE, comparticiones y asignaciones sin presentar un requisito exento como pendiente. |
| RF-133 | El sistema debe conservar la entrada de una jornada incompleta y aplicar el cierre obligatorio desde su fecha de activación. | Must | Código local | [cierre](#cierre) | DS-004, DS-006 | **AC-RF-133:** No se borra la entrada por falta de salida ni se invalida retroactivamente un registro anterior a la activación. |
| RF-134 | El sistema debe registrar salida en su ventana autorizada, con entrada previa y requisitos laborales completos. | Must | Código local | [cierre](#cierre) | DS-004, DS-006 | **AC-RF-134:** Sin entrada, fuera de ventana, con salida duplicada o requisitos laborales pendientes se devuelve un motivo; Facebook se evalúa por su agenda independiente. |
| RF-135 | El sistema debe registrar evidencia de salida y permitir cierre automático cuando se cumplen sus condiciones. | Must | Código local | [cierre](#cierre) | DS-004, DS-006 | **AC-RF-135:** La evidencia conserva hora acreditada y origen; si faltan requisitos se conserva lo registrado sin simular un cierre completo. |
| RF-136 | El sistema debe confirmar evidencias solo después de verificar los archivos cargados y su requisito. | Must | Código local | [cierre](#cierre) | DS-004, DS-006 | **AC-RF-136:** Una carga fallida, ruta ajena, MIME incorrecto o archivo no verificado no completa el requisito. |
| RF-137 | El sistema debe permitir corregir una entrega dentro de las reglas y reiniciar su revisión cuando corresponda. | Must | Código local | [archivos](#archivos) | DS-004, DS-005, DS-006 | **AC-RF-137:** La nueva versión se convierte en vigente; la revisión anterior no aprueba automáticamente contenido cambiado. |
| RF-138 | El sistema debe aceptar documentos PDF, Word y PowerPoint en asignaciones según extensiones y límites autorizados. | Must | Código local | [archivos](#archivos) | DS-004, DS-005, DS-006 | **AC-RF-138:** Un documento autorizado de menos de 10 MB conserva extensión y MIME; se rechaza donde solo corresponde imagen. |
| RF-139 | El sistema debe permitir video opcional en RPE exigible y asignaciones, sin sustituir evidencia principal. | Should | Código local | [archivos](#archivos) | DS-004, DS-005, DS-006 | **AC-RF-139:** Solo MP4/WebM de hasta 30 segundos y 8 MB conforme al flujo; no reemplaza capturas Facebook ni foto de salida. |
| RF-140 | El sistema debe eximir del RPE a jornadas presenciales desde la fecha de política configurada. | Must | Código local | [excepciones](#excepciones) | DS-004, DS-006, DS-017 | **AC-RF-140:** El resumen informa requiere_rpe=false y rpe_exento_presencial=true; carga y revisión directa rechazan rpe_no_requerido_presencial cuando corresponde. |
| RF-141 | El sistema debe conservar las evidencias RPE históricas al aplicar la exención presencial. | Must | Código local | [excepciones](#excepciones) | DS-004, DS-006, DS-017 | **AC-RF-141:** No se borran archivos; las entregas exentas dejan de figurar como pendientes y no bloquean salida. |
| RF-142 | El sistema debe aplicar la excepción individual de Alviery a cierre, historial, calendario mensual y ranking. | Must | Código local | [excepciones](#excepciones) | DS-004, DS-006, DS-017 | **AC-RF-142:** Exige asistencia en días laborales y Facebook según agenda; no exige salida, RPE ni asignaciones. Otra persona conserva sus reglas. |
| RF-143 | El sistema debe tratar jornadas justificadas sin exigir evidencias laborales ordinarias. | Must | Código local | [excepciones](#excepciones) | DS-004, DS-006, DS-017 | **AC-RF-143:** Se conserva la marca J y sus archivos; solo se exige Facebook si corresponde a su agenda. |
| RF-144 | El sistema debe evaluar Facebook con agenda y vencimiento independientes de la jornada. | Must | Código local | [facebook](#facebook) | DS-016, DS-017 | **AC-RF-144:** Puede existir obligación de compartir en un día sin trabajo; lo vencido queda pendiente según política sin borrar una salida ya registrada. |
| RF-145 | El sistema debe aceptar evidencia de Facebook desde una imagen y hasta el máximo autorizado de 50 imágenes. | Must | Código local | [facebook](#facebook) | DS-016 | **AC-RF-145:** Una imagen válida permite registrar la entrega; un collage no se interpreta como varias publicaciones verificadas. |
| RF-146 | El sistema debe eliminar una imagen guardada de Facebook mediante confirmación y limpieza recuperable. | Must | Código local | [facebook](#facebook) | DS-016 | **AC-RF-146:** Con imágenes restantes se reinicia revisión; al eliminar la última se anula la entrega y vuelve a pendiente; un fallo de Storage deja limpieza pendiente. |
| RF-147 | El sistema debe generar y compartir un comprobante de Facebook mediante acción explícita del usuario. | Should | Código local | [facebook](#facebook) | DS-016 | **AC-RF-147:** Se obtiene el comprobante autorizado y se ofrece compartir o descargar; no se envía automáticamente un mensaje de WhatsApp. |
| RF-148 | El sistema debe crear asignaciones directas por persona o área con fecha, contenido y obligatoriedad. | Must | Código local | [asignaciones](#asignaciones) | DS-007 | **AC-RF-148:** El servidor valida destino y programación; una asignación opcional no bloquea como obligatoria. |
| RF-149 | El sistema debe previsualizar y confirmar sorteos equilibrados de asignaciones. | Must | Código local | [asignaciones](#asignaciones) | DS-007 | **AC-RF-149:** Dirección revisa elegibles y carga de 30 días; confirmar revalida los parámetros y evita crear fuera del alcance. |
| RF-150 | El sistema debe consultar asignaciones en lista y calendario con su estado vigente. | Must | Código local | [asignaciones](#asignaciones) | DS-007 | **AC-RF-150:** Fecha, destinatario y estado coinciden con el servidor; una asignación cancelada no aparece como obligación activa. |
| RF-151 | El sistema debe retirar asignaciones anulando sus entregas y limpiando archivos exclusivos con reintento. | Must | Código local | [asignaciones](#asignaciones) | DS-008 | **AC-RF-151:** La anulación persiste aunque Storage falle; las rutas compartidas no se eliminan indiscriminadamente. |
| RF-152 | El sistema debe permitir a Dirección aprobar u observar entregas con una nota cuando se observa. | Must | Código local | [supervision](#supervision) | DS-005 | **AC-RF-152:** Una observación exige al menos tres caracteres; el líder consulta sin resolver; las canceladas y RPE exentos se excluyen de revisión aplicable. |
| RF-153 | El sistema debe permitir carga administrativa auditada de evidencias faltantes para una fecha y persona. | Must | Código local | [supervision](#supervision) | DS-006 | **AC-RF-153:** Dirección revalida requisito y archivos; J solo admite Facebook y presencial exento rechaza RPE; la salida se regulariza solo si corresponde. |
| RF-154 | El sistema debe registrar impedimentos asociados a fecha y requisito sin justificar automáticamente la ausencia de evidencia. | Must | Código local | [supervision](#supervision) | DS-022 | **AC-RF-154:** El detalle exige al menos diez caracteres; informar no completa ni habilita salida y la entrega resuelve el impedimento. |
| RF-155 | El sistema debe ofrecer control diario a Dirección y supervisión del área a líderes y co-líderes autorizados. | Must | Código local | [supervision](#supervision) | DS-022, DS-005 | **AC-RF-155:** El tablero muestra pendientes, entregas e impedimentos dentro del ámbito permitido; una llamada ajena se rechaza. |
| RF-156 | El sistema debe consultar, marcar leídas y retirar notificaciones internas de revisión. | Should | Código local | [supervision](#supervision) | DS-022, DS-005 | **AC-RF-156:** Las acciones solo afectan notificaciones propias y no cambian el resultado de revisión ni envían mensajes externos. |
| RF-157 | El sistema debe consultar ranking mensual provisional para Dirección con desglose por criterio y área. | Should | Código local | [ranking](#ranking) | DS-018 | **AC-RF-157:** La fórmula vigente muestra entrada 25, RPE 25, Facebook 30 y salida 20; solo ventanas cerradas hasta ayer, con denominadores independientes. |
| RF-158 | El sistema debe aplicar aprobación de evidencia y excepciones al cálculo del ranking. | Must | Código local | [ranking](#ranking) | DS-018, DS-017 | **AC-RF-158:** Presencial exento se excluye del denominador RPE; periodo solo presencial recibe crédito neutral. J/NG y excepción individual conservan su tratamiento específico. |
| RF-159 | El sistema debe descontar asignaciones obligatorias activas incumplidas y permitir simulación local de pesos. | Should | Código local | [ranking](#ranking) | DS-018 | **AC-RF-159:** Descuento de 3 por incumplimiento con tope 15; pendientes de revisión no penalizan. Cambiar pesos no guarda una política oficial. |
| RF-160 | El sistema debe consultar reportes Facebook por corte lunes/jueves, mes o rango personalizado. | Must | Código local | [reportes](#reportes) | DS-019 | **AC-RF-160:** Rango personalizado máximo 93 días; actividad hasta hoy en Lima y corte hasta mañana; fecha efectiva y provisionalidad visibles. |
| RF-161 | El sistema debe clasificar cada persona y fecha del reporte por evidencia registrada o causa de exclusión. | Must | Código local | [reportes](#reportes) | DS-019 | **AC-RF-161:** Sí exige última entrega completa con imagen incluso pendiente u observada; No no prueba ausencia de publicación externa. Exclusiones no suman al total evaluado. |
| RF-162 | El sistema debe exportar reporte Facebook a XLSX real respetando el filtro de área. | Must | Código local | [reportes](#reportes) | DS-019 | **AC-RF-162:** Incluye Resumen y Detalle, fechas, leyenda y provisionalidad; totales corresponden al periodo consultado. |
| RF-163 | El sistema debe descargar PDF completo de todas las áreas con ranking por total de Sí. | Must | Código local | [reportes](#reportes) | DS-019 | **AC-RF-163:** Ignora el filtro de área de pantalla de forma anunciada, repite nombres por bloques de fechas y comparte puesto en empates 1,1,3. |
| RF-164 | El sistema debe registrar la institución del colaborador y mostrarla en la ficha correspondiente. | Must | Código local | [equipo](#equipo) | DS-009 | **AC-RF-164:** La edición autorizada conserva el dato y la consulta de perfil respeta los permisos existentes. |
| RF-165 | El sistema debe consultar contactos y conversaciones privadas con filtros Equipo, Dirección y Mis chats. | Must | Código local | [chat](#chat) | DS-020 | **AC-RF-165:** Solo cuentas activas permitidas aparecen; las ventanas conservan historial por interlocutor. |
| RF-166 | El sistema debe enviar texto y recuperar historial, lectura y actualizaciones de conversaciones. | Must | Código local | [chat](#chat) | DS-020 | **AC-RF-166:** Solo participantes leen; el identificador del cliente permite reintentar sin duplicar mensajes. |
| RF-167 | El sistema debe enviar una imagen privada por mensaje con texto opcional y vista previa. | Must | Código local | [chat](#chat) | DS-020 | **AC-RF-167:** JPG/PNG/WebP original hasta 20 MB; el resultado JPEG debe ser como máximo 300 KiB; una ruta ajena o inválida se rechaza. |
| RF-168 | El sistema debe abrir desde Cierres el chat del colaborador para Dirección. | Should | Código local | [chat](#chat) | DS-020 | **AC-RF-168:** Se resuelve la cuenta por identificador; falta de cuenta, baja o cuenta propia da aviso. Abrir no envía mensajes. |
| RF-169 | El sistema debe actualizar presencia y limpiar vistas del chat al cerrar o vencer la sesión. | Should | Código local | [chat](#chat) | DS-020 | **AC-RF-169:** Respuestas tardías no repueblan conversaciones privadas después del cierre de sesión. |
| RF-170 | El sistema debe restringir preparación y publicación a los permisos específicos de Marketing. | Must | Código local | [marketing](#marketing) | DS-021 | **AC-RF-170:** Una cuenta preparadora guarda borradores propios pero no publica; se revalida propiedad y permiso en cada operación. |
| RF-171 | El sistema debe preparar copy desde texto manual o lectura explícita de un flyer. | Must | Código local | [marketing](#marketing) | DS-021 | **AC-RF-171:** Subir imagen no llama a Gemini; sin configuración o cuota se mantiene el modo manual y se omiten datos no confirmados. |
| RF-172 | El sistema debe guardar borradores y reutilizar la extracción ya persistida. | Should | Código local | [marketing](#marketing) | DS-021 | **AC-RF-172:** Abrir o editar no consume otra lectura; se recuperan los últimos 30 registros propios según el flujo. |
| RF-173 | El sistema debe revisar el copy y el enlace de WhatsApp antes de publicar. | Should | Código local | [marketing](#marketing) | DS-021 | **AC-RF-173:** Cambiar contenido invalida revisión; guardar para después no publica y el enlace incluye teléfono internacional y texto codificado. |
| RF-174 | El sistema debe publicar el borrador revisado en la página de Facebook configurada. | Must | Código local | [marketing](#marketing) | DS-021 | **AC-RF-174:** El servidor reclama el borrador una sola vez y comprueba permisos; solo confirma publicación cuando tiene resultado válido del proveedor. |
| RF-175 | El sistema debe mantener un resultado incierto de publicación pendiente de comprobación sin reintento automático. | Must | Código local | [marketing](#marketing) | DS-021 | **AC-RF-175:** Timeout ambiguo deja verificar/publicando; se comprueba el resultado externo antes de habilitar otro envío. |

## Requerimientos no funcionales

| ID | Requerimiento | Prioridad | Estado documental | Fuente | Secuencia | Caso de aceptación pendiente |
|---|---|---|---|---|---|---|
| RNF-001 | Todas las operaciones privadas deben ejecutarse sobre HTTPS. | Por ratificar | Objetivo; cumplimiento por verificar | [acceso](#acceso) | DS-012, DS-013 | **AC-RNF-001:** Producción no sirve formularios, tokens ni evidencias mediante HTTP. |
| RNF-002 | La autorización debe aplicarse en la base mediante RLS y funciones, no solo ocultando elementos de interfaz. | Por ratificar | Objetivo; cumplimiento por verificar | [acceso](#acceso) | DS-012, DS-013 | **AC-RNF-002:** Una llamada directa con otro `colaborador_id` devuelve cero filas o `sin_permiso`. |
| RNF-003 | `SUPABASE_SERVICE_ROLE_KEY` debe existir únicamente en Edge Functions. | Por ratificar | Objetivo; cumplimiento por verificar | [acceso](#acceso) | DS-012, DS-013 | **AC-RNF-003:** No aparece en HTML, JavaScript público, repositorio ni respuestas. |
| RNF-004 | `DASH_PIN_SECRET` debe administrarse como secreto y no versionarse. | Por ratificar | Objetivo; cumplimiento por verificar | [acceso](#acceso) | DS-012, DS-013 | **AC-RNF-004:** El valor solo existe en Secrets de Supabase. |
| RNF-005 | La rotación de `DASH_PIN_SECRET` requiere un procedimiento de actualización de cuentas técnicas. | Por ratificar | Objetivo; cumplimiento por verificar | [acceso](#acceso) | DS-012, DS-013 | **AC-RNF-005:** No se cambia el secreto directamente en producción sin plan de migración. |
| RNF-006 | Los PIN deben persistirse únicamente con sal y huella, sin almacenarse en texto plano. | Por ratificar | Objetivo; cumplimiento por verificar | [acceso](#acceso) | DS-012, DS-013 | **AC-RNF-006:** Tablas, logs y respuestas no contienen el PIN original; su envío al endpoint de autenticación ocurre exclusivamente mediante HTTPS. |
| RNF-007 | Las evidencias deben permanecer en un bucket privado. | Por ratificar | Objetivo; cumplimiento por verificar | [acceso](#acceso) | DS-012, DS-013 | **AC-RNF-007:** No se puede descargar una foto mediante URL pública permanente. |
| RNF-008 | Las URL deben expirar y los permisos deben limitar ruta, finalidad y usuario. | Por ratificar | Objetivo; cumplimiento por verificar | [acceso](#acceso) | DS-012, DS-013 | **AC-RNF-008:** Una URL de lectura puede reutilizarse hasta caducar; una confirmación de carga verifica su permiso y archivo. |
| RNF-009 | Los mensajes de acceso no deben revelar si un DNI existe antes de validar credenciales. | Por ratificar | Objetivo; cumplimiento por verificar | [acceso](#acceso) | DS-012, DS-013 | **AC-RNF-009:** DNI inexistente y PIN incorrecto producen un mensaje equivalente. |
| RNF-010 | El portal debe prevenir fuerza bruta de PIN. | Por ratificar | Objetivo; cumplimiento por verificar | [acceso](#acceso) | DS-012, DS-013 | **AC-RNF-010:** Se verifica el bloqueo de cinco intentos y 15 minutos. |
| RNF-011 | El cierre y vencimiento deben invalidar el acceso a datos privados. | Por ratificar | Objetivo; cumplimiento por verificar | [acceso](#acceso) | DS-012, DS-013 | **AC-RNF-011:** Una sesión vencida no puede invocar RPC aunque conserve la pestaña. |
| RNF-012 | CORS de producción debe limitarse a dominios autorizados cuando se cierre la etapa piloto. | Por ratificar | Objetivo; cumplimiento por verificar | [acceso](#acceso) | DS-012, DS-013 | **AC-RNF-012:** Objetivo pendiente: reemplazar `*` por dominios KJA y entornos aprobados. |
| RNF-013 | La interfaz debe mostrar únicamente los datos personales necesarios para la tarea. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-013:** El DNI se presenta enmascarado dentro del perfil. |
| RNF-014 | La ubicación debe solicitarse con consentimiento del navegador. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-014:** Denegar ubicación no entrega coordenadas falsas. |
| RNF-015 | KJA debe definir y comunicar finalidad, acceso y conservación de fotografías y ubicación. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-015:** Existe una política aprobada antes del despliegue general. |
| RNF-016 | Debe definirse un plazo de retención y eliminación de evidencias. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-016:** Requisito pendiente: política automática o procedimiento documentado. |
| RNF-017 | Los logs no deben contener PIN, tokens, secretos ni imágenes completas. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-017:** Revisión de logs de Edge Functions confirma ausencia de secretos. |
| RNF-018 | DNI, relación de perfil y asistencia diaria deben protegerse con restricciones únicas. | Por ratificar | Objetivo; cumplimiento por verificar | [marcado](#marcado) | DS-013 | **AC-RNF-018:** La base rechaza duplicados en los tres casos. |
| RNF-019 | Las decisiones de fecha, hora y ventana deben calcularse en el servidor con `America/Lima`. | Por ratificar | Objetivo; cumplimiento por verificar | [marcado](#marcado) | DS-013 | **AC-RNF-019:** Relojes de cliente alterados no cambian el resultado. |
| RNF-020 | Las migraciones deben ser aditivas, reejecutables cuando corresponda y transaccionales. | Por ratificar | Objetivo; cumplimiento por verificar | [marcado](#marcado) | DS-013 | **AC-RNF-020:** Un error revierte la ejecución sin dejar una migración parcialmente aplicada. |
| RNF-021 | Una falla al subir evidencia no debe crear una marca que incumpla la configuración obligatoria. | Por ratificar | Objetivo; cumplimiento por verificar | [marcado](#marcado) | DS-013 | **AC-RNF-021:** Con evidencia obligatoria y subida fallida no aparece asistencia. |
| RNF-022 | Los sistemas de asistencia y certificados deben conservar tablas y permisos separados. | Por ratificar | Objetivo; cumplimiento por verificar | [marcado](#marcado) | DS-013 | **AC-RNF-022:** Ninguna migración del dashboard modifica tablas del módulo de certificados. |
| RNF-023 | El dashboard debe mostrar el contenido principal en un máximo objetivo de 3 segundos en conexión 4G estable. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-023:** Medición p95 del piloto, sin contar la primera carga en frío de proveedores externos. |
| RNF-024 | El inicio de sesión debe responder en un máximo objetivo de 2 segundos p95, salvo arranque en frío. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-024:** Métricas de `dash-entrar` durante el piloto. |
| RNF-025 | Una marcación sin evidencia debe responder en un máximo objetivo de 2 segundos p95. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-025:** Medición desde confirmación hasta respuesta del servidor. |
| RNF-026 | Una marcación con evidencia debe completarse en un máximo objetivo de 8 segundos en conexión 4G estable. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-026:** Medición incluyendo compresión y subida. |
| RNF-027 | Las imágenes deben reducirse a un tamaño objetivo aproximado de 180 KB cuando sea técnicamente posible. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-027:** La mayoría de evidencias del piloto permanece cerca o debajo del objetivo. |
| RNF-028 | El sistema debe soportar inicialmente 500 colaboradores activos y 50 marcaciones concurrentes sin rediseño. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-028:** Objetivo inicial sujeto a prueba de carga antes de escalar. |
| RNF-029 | Consultas frecuentes deben contar con índices por DNI, perfil, colaborador, fecha y sesión. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-029:** El plan de consulta no realiza barridos completos innecesarios en tablas crecientes. |
| RNF-030 | El objetivo inicial de disponibilidad mensual debe ser 99.5%, condicionado por Supabase, hosting y conectividad. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-030:** Se registran incidentes y minutos de indisponibilidad. |
| RNF-031 | La contingencia debe conservar acceso administrativo autorizado sin prometer marcado antiguo incompatible. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-031:** Ante caída del frontend se ensaya el panel compatible; una caída de Supabase afecta también esa alternativa. |
| RNF-032 | Debe existir respaldo de base de datos acorde al plan contratado. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-032:** Dirección conoce frecuencia, retención y procedimiento de restauración de Supabase. |
| RNF-033 | Objetivo inicial de pérdida máxima de datos (RPO): 24 horas. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-033:** El esquema de respaldo permite recuperar al menos el último respaldo diario. |
| RNF-034 | Objetivo inicial de recuperación (RTO): 4 horas para incidentes controlables por KJA. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-034:** Existe un procedimiento ensayado de restauración y republicación. |
| RNF-035 | La interfaz debe estar en español claro y utilizar términos conocidos por el equipo. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-035:** Controles y errores describen la acción o solución sin jerga técnica. |
| RNF-036 | Marcar asistencia debe requerir como máximo tres acciones después de iniciar sesión. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-036:** Inicio → marcar → confirmar; evidencia añade solo selección/captura. |
| RNF-037 | Toda operación debe mostrar estado de carga, éxito o error accionable. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-037:** Ningún botón crítico queda sin respuesta visible. |
| RNF-038 | El diseño debe adaptarse desde 360 px hasta pantallas de escritorio. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-038:** No existe desplazamiento horizontal involuntario en anchos objetivo. |
| RNF-039 | Deben soportarse las dos últimas versiones estables de Chrome, Edge, Firefox y Safari. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-039:** Prueba manual de acceso, calendario, sesión y marcación. |
| RNF-040 | La interfaz debe cumplir el objetivo de accesibilidad WCAG 2.1 AA en los flujos críticos. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-040:** Pendiente de auditoría: teclado completo, foco visible, nombres accesibles, contraste y estados sin depender solo de color; no se declara conformidad certificada. |
| RNF-041 | Las animaciones deben respetar `prefers-reduced-motion`. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-041:** Con reducción activa, transiciones y animaciones no interfieren. |
| RNF-042 | Cámara, archivos y geolocalización deben degradar de forma comprensible si el dispositivo no los soporta. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-042:** El usuario recibe una alternativa o mensaje claro. |
| RNF-043 | El frontend debe mantener separación entre estructura, estilos y comportamiento. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-043:** HTML, CSS y JavaScript permanecen en archivos diferenciados. |
| RNF-044 | Las migraciones y Edge Functions deben documentar requisitos y orden de despliegue. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-044:** Un responsable puede reproducir el despliegue usando `docs/dashboard-base.md`. |
| RNF-045 | Los archivos estáticos deben utilizar versión de caché al cambiar CSS o JavaScript. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-045:** La publicación referencia una versión nueva y evita servir recursos antiguos. |
| RNF-046 | Debe existir un entorno de prueba separado antes de cambios de alto riesgo. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-046:** Planificado: proyecto o rama de Supabase para migraciones y pruebas destructivas. |
| RNF-047 | Cada despliegue debe contar con una lista mínima de pruebas de regresión. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-047:** Se validan acceso, permisos, marcado, evidencia, historial, panel anterior y certificados. |
| RNF-048 | Los cambios no deben sobrescribir modificaciones ajenas o datos de producción sin respaldo. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-048:** Se revisan diferencias y alcance antes de migrar o publicar. |
| RNF-049 | Cada asistencia debe conservar fecha, hora, origen, dispositivo y actor cuando corresponda. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-049:** La fila permite diferenciar panel, portal y dashboard. |
| RNF-050 | Las funciones deben devolver motivos de error estables para soporte. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-050:** Casos como sesión, bloqueo, ventana, evidencia y duplicado son distinguibles. |
| RNF-051 | Deben revisarse logs de Edge Functions y errores de base durante el piloto. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-051:** Existe una rutina de revisión y registro de incidentes. |
| RNF-052 | Las acciones administrativas sensibles deben conservar trazabilidad de actor, fecha, motivo y cambio. | Por ratificar | Objetivo; cumplimiento por verificar | [supervision](#supervision) | DS-002, DS-005, DS-009, DS-010, DS-011 | **AC-RNF-052:** Hay bitácoras locales de administración, ficha, roles y revisión; queda por auditar cobertura de cada mutación y política de retención. |
| RNF-053 | La carga de un mes debe resolverse con una sola RPC y sin consultas por persona o por día desde el navegador. | Por ratificar | Objetivo; cumplimiento por verificar | [mes](#mes) | DS-003, DS-019 | **AC-RNF-053:** La traza de red muestra una llamada `dash_admin_mes` por periodo y condición de bajas. |
| RNF-054 | La respuesta mensual debe soportar inicialmente 500 personas por 31 días sin cambiar el contrato de la API. | Por ratificar | Objetivo; cumplimiento por verificar | [mes](#mes) | DS-003, DS-019 | **AC-RNF-054:** La consulta produce hasta 15 500 celdas en una respuesta consolidada y usa índices de fecha, ámbito, persona y área. |
| RNF-055 | La grilla ancha debe usar desplazamiento horizontal intencional, nombre fijo y cabecera fija, sin expandir el documento completo. | Por ratificar | Objetivo; cumplimiento por verificar | [mes](#mes) | DS-003, DS-019 | **AC-RNF-055:** En escritorio y móvil el desplazamiento queda dentro del libro mensual. |
| RNF-056 | Las exportaciones deben generarse localmente y no crear tablas, archivos públicos ni copias persistentes en Supabase. | Por ratificar | Objetivo; cumplimiento por verificar | [mes](#mes) | DS-003, DS-019 | **AC-RNF-056:** La descarga se construye como `Blob` en el navegador y no produce escrituras de red. |
| RNF-057 | El centro de acceso debe consolidar datos sensibles mediante RPC exclusiva de Dirección. | Por ratificar | Objetivo; cumplimiento por verificar | [configuracion](#configuracion) | DS-010 | **AC-RNF-057:** dash_admin_marcado entrega configuración y directorio; la geocerca puede requerir una RPC adicional. Toda llamada revalida permisos. |
| RNF-058 | La bitácora administrativa debe permanecer inaccesible mediante consultas directas del navegador. | Por ratificar | Objetivo; cumplimiento por verificar | [configuracion](#configuracion) | DS-010 | **AC-RNF-058:** La tabla tiene RLS, no posee políticas públicas y no concede privilegios a `authenticated`. |
| RNF-059 | Ninguna respuesta debe exponer PIN, sal, huella ni contraseña técnica. | Por ratificar | Objetivo; cumplimiento por verificar | [configuracion](#configuracion) | DS-010 | **AC-RNF-059:** La RPC entrega únicamente estados booleanos, fechas y contadores de intentos. |
| RNF-060 | Regenerar un enlace o reiniciar un PIN debe ser una acción explícita, confirmada y recuperable mediante el flujo de activación. | Por ratificar | Objetivo; cumplimiento por verificar | [configuracion](#configuracion) | DS-010 | **AC-RNF-060:** No existe ejecución automática durante migración, carga o actualización de pantalla. |
| RNF-061 | El QR oficial debe codificar solo una URL pública del dashboard. | Por ratificar | Objetivo; cumplimiento por verificar | [configuracion](#configuracion) | DS-010 | **AC-RNF-061:** Inspeccionar el QR no revela clave de activación, DNI, PIN ni identificador personal. |
| RNF-062 | El retiro del panel anterior requiere una matriz de regresión aprobada y un periodo estable documentado. | Por ratificar | Objetivo; cumplimiento por verificar | [compatibilidad](#compatibilidad) | N/A | **AC-RNF-062:** Existe evidencia de pruebas por rol, módulo, navegador y contingencia antes de retirar rutas. |
| RNF-063 | Los cambios de liderazgo deben ser atómicos. | Por ratificar | Objetivo; cumplimiento por verificar | [roles](#roles) | DS-001, DS-011 | **AC-RNF-063:** Una falla revierte tanto el retiro anterior como la nueva asignación. |
| RNF-064 | La autorización de roles debe validarse en Supabase y no depender de menús ocultos. | Por ratificar | Objetivo; cumplimiento por verificar | [roles](#roles) | DS-001, DS-011 | **AC-RNF-064:** Una llamada directa sin nivel `sistemas`, rol `direccion` y `acceso_panel` activo devuelve `sin_permiso`. |
| RNF-065 | La instalación de la fase de roles no debe modificar asignaciones existentes. | Por ratificar | Objetivo; cumplimiento por verificar | [roles](#roles) | DS-001, DS-011 | **AC-RNF-065:** Ejecutar la migración solo crea tabla, índice y RPC; ningún `nivel` cambia hasta una acción confirmada. |
| RNF-066 | La bitácora de liderazgo debe ser privada. | Por ratificar | Objetivo; cumplimiento por verificar | [roles](#roles) | DS-001, DS-011 | **AC-RNF-066:** RLS está activa y `authenticated` no posee acceso directo a la tabla. |
| RNF-067 | Promover o retirar un líder no debe modificar PIN, asistencia, contrato ni certificados. | Por ratificar | Objetivo; cumplimiento por verificar | [roles](#roles) | DS-001, DS-011 | **AC-RNF-067:** Las funciones de escritura solo actualizan `asis_perfiles.nivel` e insertan un evento. |
| RNF-068 | La navegación debe fallar de forma segura ante una vista no autorizada. | Por ratificar | Objetivo; cumplimiento por verificar | [roles](#roles) | DS-001, DS-011 | **AC-RNF-068:** Las aperturas programáticas se rechazan además de mantener oculto el botón. |
| RNF-069 | Los resúmenes de cierre, historial y ranking deben aplicar las mismas excepciones vigentes. | Por ratificar | Objetivo; cumplimiento por verificar | [excepciones](#excepciones) | DS-004, DS-017, DS-018 | **AC-RNF-069:** Comparar virtual, presencial antes/después de la fecha de exención, J y excepción individual; diferencias de métricas se explican sin exigir RPE exento. |
| RNF-070 | La eliminación entre PostgreSQL y Storage debe ser recuperable. | Por ratificar | Objetivo; cumplimiento por verificar | [archivos](#archivos) | DS-008, DS-016 | **AC-RNF-070:** Simular fallo de Storage: permanece cola privada, la anulación no se revierte silenciosamente y un reintento limpia sin afectar rutas ajenas. |
| RNF-071 | Los reintentos de chat y publicación deben evitar efectos duplicados. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | DS-020, DS-021 | **AC-RNF-071:** Dos solicitudes del mismo identificador de chat generan un mensaje; dos reclamos del mismo borrador no inician dos publicaciones. Resultado incierto no se reenvía automáticamente. |
| RNF-072 | Los archivos deben validarse por ruta autorizada, MIME, extensión y tamaño según módulo. | Por ratificar | Objetivo; cumplimiento por verificar | [archivos](#archivos) | DS-004, DS-006, DS-013, DS-020, DS-021 | **AC-RNF-072:** Probar archivo válido y tipo/tamaño rechazado en entrada, RPE, asignación, video, chat y Marketing; no se utiliza un límite global incorrecto. |
| RNF-073 | Las imágenes de chat deben recodificarse sin metadatos y reducir su peso. | Por ratificar | Objetivo; cumplimiento por verificar | [chat](#chat) | DS-020 | **AC-RNF-073:** JPEG de lado mayor máximo 1600 px, objetivo 150 KiB y techo 300 KiB; transparencia sobre blanco, sin conservar animación ni original. |
| RNF-074 | Las respuestas asíncronas desactualizadas no deben reemplazar el estado vigente. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | DS-019, DS-020 | **AC-RNF-074:** Cambiar periodo, conversación o sesión durante una petición no mezcla datos ni descarga un reporte del periodo anterior. |
| RNF-075 | La cuota de lectura de flyers debe reservarse de forma atómica y reutilizar resultados. | Por ratificar | Objetivo; cumplimiento por verificar | [marketing](#marketing) | DS-021 | **AC-RNF-075:** Máximo interno 20 intentos/24 h y 5/minuto por modelo; solicitudes concurrentes de un borrador no duplican lectura, 429 no reintenta automáticamente. No es garantía de cuota del proveedor. |
| RNF-076 | Los secretos de Gemini y Facebook deben permanecer en el servidor. | Por ratificar | Objetivo; cumplimiento por verificar | [marketing](#marketing) | DS-021 | **AC-RNF-076:** Tráfico al cliente y archivos públicos no contienen claves ni tokens de página; los errores no reproducen credenciales o mensajes sensibles del proveedor. |
| RNF-077 | Las exportaciones deben preservar integridad, alcance y texto seguro. | Por ratificar | Objetivo; cumplimiento por verificar | [reportes](#reportes) | DS-019 | **AC-RNF-077:** XLSX y PDF corresponden a la misma consulta; el primero respeta filtro y el segundo informa todas las áreas. Nombres no se interpretan como fórmulas y no se transmiten a un generador externo. |
| RNF-078 | Las políticas de cierre deben tener fecha efectiva y conservar datos históricos. | Por ratificar | Objetivo; cumplimiento por verificar | [excepciones](#excepciones) | DS-004, DS-017, DS-018 | **AC-RNF-078:** Reaplicar la migración 70 no mueve una fecha ya guardada; la exención no borra RPE. Documentar uso de áreas y horarios actuales en reportes, sin llamarlos instantáneas históricas. |
| RNF-079 | La documentación debe mantener trazabilidad e identificadores estables. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-079:** Todo RF/RNF tiene fila única en matriz, fuente y criterio; solo los flujos aplicables llevan secuencia. Cambios no renumeran requisitos previos. |
| RNF-080 | Las dependencias cartográficas deben fallar de forma comprensible sin sustituir la autorización del servidor. | Por ratificar | Objetivo; cumplimiento por verificar | [marcado](#marcado) | DS-013 | **AC-RNF-080:** Si no carga el mapa, no se inventan coordenadas ni se omite geocerca; los datos válidos y la validación siguen independientes de las teselas. |
| RNF-081 | El despliegue debe coordinar versiones de SQL, Edge Functions y frontend. | Por ratificar | Objetivo; cumplimiento por verificar | [calidad](#calidad) | N/A | **AC-RNF-081:** Comprobar orden de dependencias y contrato de rutas/extensiones antes de publicar; un fallo de versión explica actualización necesaria sin ampliar permisos. |

## Relación inversa: secuencia → requerimientos

| Secuencia | Requerimientos relacionados |
|---|---|
| DS-001 | RF-049, RF-050, RF-051, RF-052, RF-053, RF-054, RF-055, RF-056, RF-057, RF-064, RF-065, RF-066, RF-067, RF-068, RF-069, RF-070, RF-114, RF-115, RF-116, RF-117, RF-118, RNF-063, RNF-064, RNF-065, RNF-066, RNF-067, RNF-068 |
| DS-002 | RF-071, RF-072, RF-073, RF-074, RF-075, RF-076, RF-077, RF-078, RNF-052 |
| DS-003 | RF-091, RF-092, RF-093, RF-094, RF-095, RF-096, RF-097, RF-098, RF-099, RF-100, RF-101, RNF-053, RNF-054, RNF-055, RNF-056 |
| DS-004 | RF-132, RF-133, RF-134, RF-135, RF-136, RF-137, RF-138, RF-139, RF-140, RF-141, RF-142, RF-143, RNF-069, RNF-072, RNF-078 |
| DS-005 | RF-137, RF-138, RF-139, RF-152, RF-155, RF-156, RNF-052 |
| DS-006 | RF-132, RF-133, RF-134, RF-135, RF-136, RF-137, RF-138, RF-139, RF-140, RF-141, RF-142, RF-143, RF-153, RNF-072 |
| DS-007 | RF-148, RF-149, RF-150 |
| DS-008 | RF-151, RNF-070 |
| DS-009 | RF-079, RF-080, RF-081, RF-082, RF-083, RF-084, RF-085, RF-086, RF-087, RF-088, RF-089, RF-090, RF-164, RNF-052 |
| DS-010 | RF-047, RF-048, RF-102, RF-103, RF-104, RF-105, RF-106, RF-107, RF-108, RF-109, RF-110, RF-111, RF-112, RF-113, RF-130, RNF-052, RNF-057, RNF-058, RNF-059, RNF-060, RNF-061 |
| DS-011 | RF-114, RF-115, RF-116, RF-117, RF-118, RF-119, RF-120, RF-121, RF-122, RF-123, RF-124, RF-125, RNF-052, RNF-063, RNF-064, RNF-065, RNF-066, RNF-067, RNF-068 |
| DS-012 | RF-001, RF-002, RF-003, RF-004, RF-005, RF-006, RF-007, RF-008, RF-009, RF-010, RF-011, RF-012, RF-013, RF-014, RNF-001, RNF-002, RNF-003, RNF-004, RNF-005, RNF-006, RNF-007, RNF-008, RNF-009, RNF-010, RNF-011, RNF-012 |
| DS-013 | RF-025, RF-026, RF-027, RF-028, RF-029, RF-030, RF-031, RF-032, RF-033, RF-034, RF-035, RF-036, RF-037, RF-038, RF-039, RF-040, RF-126, RF-130, RF-131, RNF-001, RNF-002, RNF-003, RNF-004, RNF-005, RNF-006, RNF-007, RNF-008, RNF-009, RNF-010, RNF-011, RNF-012, RNF-018, RNF-019, RNF-020, RNF-021, RNF-022, RNF-072, RNF-080 |
| DS-014 | RF-016, RF-017, RF-018, RF-019, RF-020, RF-021, RF-022, RF-023, RF-024, RF-041, RF-042, RF-043, RF-044, RF-045, RF-046, RF-125, RF-127 |
| DS-015 | RF-128, RF-129 |
| DS-016 | RF-144, RF-145, RF-146, RF-147, RNF-070 |
| DS-017 | RF-140, RF-141, RF-142, RF-143, RF-144, RF-158, RNF-069, RNF-078 |
| DS-018 | RF-157, RF-158, RF-159, RNF-069, RNF-078 |
| DS-019 | RF-160, RF-161, RF-162, RF-163, RNF-053, RNF-054, RNF-055, RNF-056, RNF-074, RNF-077 |
| DS-020 | RF-165, RF-166, RF-167, RF-168, RF-169, RNF-071, RNF-072, RNF-073, RNF-074 |
| DS-021 | RF-170, RF-171, RF-172, RF-173, RF-174, RF-175, RNF-071, RNF-072, RNF-075, RNF-076 |
| DS-022 | RF-154, RF-155, RF-156 |

## Registro de validación por completar

Usar una fila por ejecución; conservar fallos y reejecuciones para auditoría.

| Caso AC-RF/AC-RNF | Entorno y versión | Ejecutor | Fecha | Resultado esperado | Resultado real | Evidencia o incidencia |
|---|---|---|---|---|---|---|
| Por asignar | Por registrar | Por asignar | Pendiente | Criterio de la fila | No ejecutado | Pendiente |

Para RNF de rendimiento medir p95 con carga y red descritas; para seguridad
probar llamadas directas con cuentas propias, ajenas y no autorizadas; para
respaldo y recuperación adjuntar un ensayo; para accesibilidad y compatibilidad
registrar dispositivos y navegadores. Un archivo de pruebas existente no sustituye
estos resultados.

## Mantenimiento

Editar primero la especificación y actualizar asociaciones del generador si se
amplía el alcance. Ejecutar desde la raíz:

```powershell
node docs/herramientas/generar-matriz.mjs
```

El generador valida IDs únicos y consecutivos, criterios no vacíos, fuentes
existentes, diagramas referenciados, participantes, cierre de ramas y equivalencia
de mensajes entre Mermaid y PlantUML. Es una comprobación estructural; no sustituye
un parser completo ni renderiza UML o verifica el sistema y su despliegue.
Revisa las diferencias antes de aceptar una nueva versión.
