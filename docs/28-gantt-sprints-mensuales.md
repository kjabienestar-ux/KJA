# Gantt y sprints mensuales — Portal KJA

**Corte:** 22/09/2026 · **Horizonte:** hasta diciembre de 2026 · **Estado:** histórico documentado y propuesta futura.

El primer despliegue consta el **28/08/2026** en `docs/dashboard-base.md` y en el
commit `d189536`. Se muestra como antecedente y no se desplaza a septiembre.
Sprint 1 corresponde a septiembre; Sprint 2 a octubre; Sprint 3 a noviembre;
Sprint 4 a diciembre. Todos abarcan el mes calendario completo.

[Abrir el Gantt editable en Excel](../outputs/gantt-kja-20260922/KJA_Gantt_Sprints_Septiembre_Diciembre_2026.xlsx).

## Lectura y supuestos

- R: registro Git; D: despliegue declarado en una guía; L: documento local; P: propuesta futura.
- Se marcan únicamente fechas de evidencia histórica; los días entre commits no se interpretan como trabajo continuo. Las fechas Git usan el offset -05:00 registrado.
- Duración significa días marcados por tarea; no es esfuerzo, tiempo exclusivo ni duración total del proyecto.
- Los autores Git se conservan literalmente. Los responsables de propuestas son roles pendientes de asignación; no se atribuyen tareas a Dany o Yeiser por aparecer en la imagen de referencia.
- HU-G01–HU-G12 son agrupaciones propuestas para el cronograma, no historias aprobadas. Se mantienen referencias RF/RNF y se señala cuando falta formalizar un requisito.
- Propuestas de lunes a viernes. Se excluyen inicialmente 08/10, 08/12, 09/12 y 25/12 como fechas no laborables **por confirmar**; no se afirma un calendario laboral oficial. La hoja CALENDARIO permite modificarlas.
- El plan propone un frente principal secuencial de Sistemas. Fechas, disponibilidad de líderes, alcance y capacidad requieren confirmación antes de comprometer entregas.
- Las diez áreas se obtienen de `supabase/asistencia_schema.sql` y `supabase/asistencia_seed_colaboradores.sql`; no se certifica el catálogo remoto actual.
- Clínica y Reclutamiento se limitan a la operación laboral del portal. No se amplía el alcance a expedientes clínicos, datos de pacientes o expedientes de candidatos; Contabilidad no incorpora planillas o pagos.
- La validación de Marketing no autoriza publicaciones reales. Las tareas futuras no se presentan como ejecutadas.

## Objetivos y revisión mensual

| Sprint | Periodo | Objetivo | Revisión propuesta |
|---|---|---|---|
| Antecedente | 28–31/08/2026 | Conservar evidencia del despliegue inicial | No aplica retrospectiva inventada |
| Sprint 1 | 01–30/09/2026 | Consolidar portal, documentar y acordar prioridades | 30/09/2026 |
| Sprint 2 | 01–31/10/2026 | Revisar y actualizar las diez áreas | 30/10/2026 |
| Sprint 3 | 01–30/11/2026 | Implementar y verificar mejoras priorizadas | 30/11/2026 |
| Sprint 4 | 01–31/12/2026 | Validar por área, capacitar y cerrar el año | 31/12/2026 |

## Tareas y trazabilidad

### Antecedente

| ID | H.U. propuesta | Tarea | Inicio–fin | Días marcados | Naturaleza | Responsable / autor | Dependencia |
|---|---|---|---|---:|---|---|---|
| T-001 | HU-G01 | Acceso, permisos e integración inicial del dashboard | 2026-08-28 → 2026-08-28 | 1 | Registro Git | yeiserDev | — |
| T-002 | HU-G01 | Hito: despliegue inicial del portal documentado | 2026-08-28 → 2026-08-28 | 1 | Despliegue documentado | Por confirmar | — |
| T-003 | HU-G03 | Fotografía privada, avatar y mejora del ingreso | 2026-08-28 → 2026-08-28 | 1 | Registro Git | yeiserDev | — |

### Sprint 1

| ID | H.U. propuesta | Tarea | Inicio–fin | Días marcados | Naturaleza | Responsable / autor | Dependencia |
|---|---|---|---|---:|---|---|---|
| T-004 | HU-G02 | Marcado seguro, geocerca y mapa de oficina | 2026-09-01 → 2026-09-01 | 1 | Registro Git | yeiserDev | — |
| T-005 | HU-G01 | Acceso móvil y experiencia del panel administrativo | 2026-09-01 → 2026-09-02 | 2 | Registro Git | jhony-abz, yeiserDev | — |
| T-006 | HU-G03 | Solicitudes personales, fotos y días libres | 2026-09-03 → 2026-09-03 | 1 | Registro Git | yeiserDev | — |
| T-007 | HU-G04 | Cierre diario con evidencias y salida | 2026-09-07 → 2026-09-07 | 1 | Registro Git | yeiserDev | — |
| T-008 | HU-G04 | Corrección de evidencias y comprobante de Facebook | 2026-09-07 → 2026-09-07 | 1 | Registro Git | yeiserDev | — |
| T-009 | HU-G05 | Revisión, observaciones y notificaciones de evidencias | 2026-09-07 → 2026-09-09 | 3 | Registro Git | yeiserDev | — |
| T-010 | HU-G04 | Agenda Facebook independiente y vencimientos | 2026-09-10 → 2026-09-10 | 1 | Registro Git | yeiserDev | — |
| T-011 | HU-G05 | Gestión operativa y roles | 2026-09-11 → 2026-09-11 | 1 | Registro Git | yeiserDev | — |
| T-012 | HU-G07 | Activación técnica parcial de Marketing documentada | 2026-09-12 → 2026-09-12 | 1 | Despliegue documentado | Por confirmar | — |
| T-013 | HU-G06 | Integración de chat privado y ajustes móviles | 2026-09-13 → 2026-09-13 | 1 | Registro Git | yeiserDev | — |
| T-014 | HU-G07 | Integración del editor de publicaciones | 2026-09-13 → 2026-09-13 | 1 | Registro Git | yeiserDev | — |
| T-015 | HU-G08 | Ranking mensual beta y detalle de métricas | 2026-09-14 → 2026-09-14 | 1 | Registro Git | yeiserDev | — |
| T-016 | HU-G02 | Corrección de espera y verificación de ubicación | 2026-09-14 → 2026-09-14 | 1 | Registro Git | yeiserDev | — |
| T-017 | HU-G05 | Asignaciones con documentos, panel y retiro de archivos | 2026-09-14 → 2026-09-14 | 1 | Registro Git | yeiserDev | — |
| T-018 | HU-G06 | Chat con alertas, imágenes y sonido | 2026-09-14 → 2026-09-15 | 2 | Registro Git | JhonyVX, yeiserDev | — |
| T-019 | HU-G04 | Respeto de jornadas justificadas | 2026-09-15 → 2026-09-15 | 1 | Registro Git | yeiserDev | — |
| T-020 | HU-G04 | Preparación de comprobantes para WhatsApp | 2026-09-16 → 2026-09-16 | 1 | Registro Git | yeiserDev | — |
| T-021 | HU-G09 | Primera documentación de secuencias administrativas | 2026-09-16 → 2026-09-16 | 1 | Registro Git | yeiserDev | — |
| T-022 | HU-G08 | Reportes Facebook por áreas con Excel y PDF | 2026-09-17 → 2026-09-17 | 1 | Registro Git | yeiserDev | — |
| T-023 | HU-G08 | Estadísticas del panel y ajuste del periodo de salidas | 2026-09-18 → 2026-09-18 | 1 | Registro Git | yeiserDev | — |
| T-024 | HU-G04 | Exigir evidencia laboral antes de registrar salida | 2026-09-19 → 2026-09-19 | 1 | Registro Git | yeiserDev | — |
| T-025 | HU-G01 | Ajustes de tema, tarjetas y experiencia de equipo | 2026-09-19 → 2026-09-20 | 2 | Registro Git | yeiserDev | — |
| T-026 | HU-G06 | Comunicados emergentes y carrusel del dashboard | 2026-09-21 → 2026-09-21 | 1 | Registro Git | JhonyVX, yeiserDev | — |
| T-027 | HU-G04 | Excepción individual de cierre y RPE presencial | 2026-09-21 → 2026-09-21 | 1 | Registro Git | JhonyVX, yeiserDev | — |
| T-028 | HU-G09 | Actualización de RF/RNF, 22 secuencias y matriz | 2026-09-22 → 2026-09-22 | 1 | Documento local | Por confirmar | — |
| T-029 | HU-G09 | Revisar alcance, responsables y catálogo vigente de áreas | 2026-09-23 → 2026-09-24 | 2 | Propuesta | Dirección + Sistemas | — |
| T-030 | HU-G09 | Formalizar H.U. y casos de uso; vincular al catálogo RF/RNF | 2026-09-25 → 2026-09-28 | 2 | Propuesta | Sistemas + líderes | T-029 |
| T-031 | HU-G11 | Revisar despliegues pendientes y ejecutar pruebas críticas | 2026-09-29 → 2026-09-29 | 1 | Propuesta | Sistemas + QA | T-030 |
| T-032 | HU-G09 | Revisión y retrospectiva del Sprint 1; acordar octubre | 2026-09-30 → 2026-09-30 | 1 | Propuesta | Dirección + equipo | T-031 |

### Sprint 2

| ID | H.U. propuesta | Tarea | Inicio–fin | Días marcados | Naturaleza | Responsable / autor | Dependencia |
|---|---|---|---|---:|---|---|---|
| T-033 | HU-G10 | Revisar y actualizar configuración del área: Salud ocupacional | 2026-10-01 → 2026-10-02 | 2 | Propuesta | Sistemas + responsable del área | T-032 |
| T-034 | HU-G10 | Revisar y actualizar configuración del área: Psicología organizacional | 2026-10-05 → 2026-10-06 | 2 | Propuesta | Sistemas + responsable del área | T-033 |
| T-035 | HU-G10 | Revisar y actualizar configuración del área: Recursos Humanos | 2026-10-07 → 2026-10-09 | 2 | Propuesta | Sistemas + responsable del área | T-034 |
| T-036 | HU-G10 | Revisar y actualizar configuración del área: Marketing | 2026-10-12 → 2026-10-13 | 2 | Propuesta | Sistemas + responsable del área | T-035 |
| T-037 | HU-G10 | Revisar y actualizar configuración del área: Ingeniería | 2026-10-14 → 2026-10-15 | 2 | Propuesta | Sistemas + responsable del área | T-036 |
| T-038 | HU-G10 | Revisar y actualizar configuración del área: Diseño gráfico | 2026-10-16 → 2026-10-19 | 2 | Propuesta | Sistemas + responsable del área | T-037 |
| T-039 | HU-G10 | Revisar y actualizar configuración del área: Clínica | 2026-10-20 → 2026-10-21 | 2 | Propuesta | Sistemas + responsable del área | T-038 |
| T-040 | HU-G10 | Revisar y actualizar configuración del área: Audiovisuales | 2026-10-22 → 2026-10-23 | 2 | Propuesta | Sistemas + responsable del área | T-039 |
| T-041 | HU-G10 | Revisar y actualizar configuración del área: Reclutamiento | 2026-10-26 → 2026-10-27 | 2 | Propuesta | Sistemas + responsable del área | T-040 |
| T-042 | HU-G10 | Revisar y actualizar configuración del área: Contabilidad | 2026-10-28 → 2026-10-29 | 2 | Propuesta | Sistemas + responsable del área | T-041 |
| T-043 | HU-G09 | Revisión y retrospectiva del Sprint 2; priorizar mejoras | 2026-10-30 → 2026-10-30 | 1 | Propuesta | Dirección + responsables | T-042 |

### Sprint 3

| ID | H.U. propuesta | Tarea | Inicio–fin | Días marcados | Naturaleza | Responsable / autor | Dependencia |
|---|---|---|---|---:|---|---|---|
| T-044 | HU-G11 | Auditar permisos, sesiones y aislamiento por rol | 2026-11-02 → 2026-11-04 | 3 | Propuesta | Sistemas + QA | T-043 |
| T-045 | HU-G11 | Mejorar estados de error, accesibilidad y uso móvil | 2026-11-05 → 2026-11-10 | 4 | Propuesta | Sistemas + Diseño gráfico | T-044 |
| T-046 | HU-G11 | Medir y optimizar carga, consultas e imágenes | 2026-11-11 → 2026-11-13 | 3 | Propuesta | Sistemas + QA | T-045 |
| T-047 | HU-G05 | Mejorar asignaciones, revisión y recuperación de archivos | 2026-11-16 → 2026-11-18 | 3 | Propuesta | Sistemas + líderes | T-046 |
| T-048 | HU-G08 | Conciliar reportes y ranking con casos de todas las áreas | 2026-11-19 → 2026-11-20 | 2 | Propuesta | Sistemas + Dirección | T-047 |
| T-049 | HU-G06 | Validar chat y notificaciones con cuentas de prueba | 2026-11-23 → 2026-11-24 | 2 | Propuesta | Sistemas + responsables | T-048 |
| T-050 | HU-G07 | Validar Marketing en entorno de ensayo autorizado | 2026-11-25 → 2026-11-27 | 3 | Propuesta | Sistemas + Marketing | T-049 |
| T-051 | HU-G09 | Revisión y retrospectiva del Sprint 3 | 2026-11-30 → 2026-11-30 | 1 | Propuesta | Dirección + equipo | T-050 |

### Sprint 4

| ID | H.U. propuesta | Tarea | Inicio–fin | Días marcados | Naturaleza | Responsable / autor | Dependencia |
|---|---|---|---|---:|---|---|---|
| T-052 | HU-G11 | Definir retención, respaldo y procedimiento de recuperación | 2026-12-01 → 2026-12-03 | 3 | Propuesta | Dirección + Sistemas | T-051 |
| T-053 | HU-G12 | Preparar capacitación y guías por rol | 2026-12-04 → 2026-12-07 | 2 | Propuesta | Sistemas + RR. HH. | T-052 |
| T-054 | HU-G12 | Aceptación con Salud ocupacional, Psicología y Clínica | 2026-12-10 → 2026-12-11 | 2 | Propuesta | QA + responsables de área | T-053 |
| T-055 | HU-G12 | Aceptación con RR. HH., Reclutamiento y Contabilidad | 2026-12-14 → 2026-12-15 | 2 | Propuesta | QA + responsables de área | T-054 |
| T-056 | HU-G12 | Aceptación con Marketing, Ingeniería, Diseño y Audiovisuales | 2026-12-16 → 2026-12-17 | 2 | Propuesta | QA + responsables de área | T-055 |
| T-057 | HU-G11 | Corregir hallazgos y ejecutar regresión integral | 2026-12-18 → 2026-12-23 | 4 | Propuesta | Sistemas + QA | T-056 |
| T-058 | HU-G09 | Actualizar documentación, matriz y manual de operación | 2026-12-24 → 2026-12-28 | 2 | Propuesta | Sistemas + responsables | T-057 |
| T-059 | HU-G12 | Revisar adopción y priorizar propuestas para enero | 2026-12-29 → 2026-12-30 | 2 | Propuesta | Dirección + responsables | T-058 |
| T-060 | HU-G09 | Revisión y retrospectiva del Sprint 4; cierre anual | 2026-12-31 → 2026-12-31 | 1 | Propuesta | Dirección + equipo | T-059 |

## Historias propuestas para agrupar el Gantt

| ID provisional | Historia |
|---|---|
| HU-G01 | Como colaborador, quiero acceder al portal y consultar mi asistencia. |
| HU-G02 | Como colaborador, quiero registrar mi jornada según modalidad y ubicación. |
| HU-G03 | Como colaborador, quiero gestionar mi perfil y mis solicitudes. |
| HU-G04 | Como colaborador, quiero entregar evidencias y conocer el cierre de mi jornada. |
| HU-G05 | Como responsable, quiero asignar trabajo y supervisar el cumplimiento. |
| HU-G06 | Como usuario, quiero comunicarme con mi equipo y consultar avisos. |
| HU-G07 | Como Marketing, quiero revisar y preparar publicaciones autorizadas. |
| HU-G08 | Como Dirección, quiero consultar reportes y métricas explicables. |
| HU-G09 | Como equipo, queremos requisitos y planificación trazables. |
| HU-G10 | Como responsable de área, quiero actualizar equipo, horarios y necesidades. |
| HU-G11 | Como usuario, quiero mejoras de calidad y flujos confiables. |
| HU-G12 | Como Dirección, quiero validar la adopción y priorizar el siguiente periodo. |

## Evidencias y criterios de salida

- **T-001** · RF-001–RF-014, RF-049–RF-070. Consultar el commit y la guía de despliegue; no deducir la duración de desarrollo. Fuente: 3788de4 | 2026-08-28T09:57:29-05:00 | feat(dashboard): asegurar acceso y permisos por rol; d189536 | 2026-08-28T09:58:34-05:00 | feat(dashboard): publicar portal de asistencia.
- **T-002** · RF-062. La guía declara producción el 28/08/2026; no se vuelve a verificar el entorno remoto. Fuente: docs/dashboard-base.md, encabezado Estado; commit d189536.
- **T-003** · RF-127, RNF-024. Revisar archivos incorporados y separar mejora de código de medición de rendimiento. Fuente: 0f25307 | 2026-08-28T15:36:47-05:00 | feat(dashboard): habilitar fotos privadas de perfil; 24e8bb1 | 2026-08-28T15:36:58-05:00 | feat(dashboard): gestionar foto de cada integrante; fd0bfe6 | 2026-08-28T18:32:02-05:00 | perf(dashboard): acelerar ingreso de colaboradores.
- **T-004** · RF-025–RF-040, RF-126, RF-130–RF-131. Cambios registrados el 01/09; permisos y geocerca requieren su prueba de aceptación. Fuente: 952eb39 | 2026-09-01T11:23:57-05:00 | feat(dashboard): renovar asistencia y proteger el marcado; 6b8b602 | 2026-09-01T14:55:32-05:00 | feat(asistencia): agregar mapa administrable para la oficina; 6989792 | 2026-09-01T15:16:20-05:00 | feat(asistencia): mostrar ruta presencial en el marcado.
- **T-005** · RF-016–RF-024, RF-064–RF-070. Constancia de cambios en acceso y gestión del 01–02/09. Fuente: f7d42dc | 2026-09-01T14:28:02-05:00 | feat(login): mejorar acceso y agregar prototipo visual; 474f477 | 2026-09-01T23:33:20-05:00 | UI Enhancements: Rediseño del login móvil (bottom sheet), modal de asistencia compacto y nuevo toggle de día/noche; 11047df | 2026-09-02T14:10:32-05:00 | feat(dashboard): mejora la experiencia del panel administrativo.
- **T-006** · RF-127–RF-129. Verificar flujo personal y resolución administrativa en un entorno autorizado. Fuente: 02439f8 | 2026-09-03T13:16:03-05:00 | feat(database): habilitar solicitudes, fotos y dias libres; 6e3e60e | 2026-09-03T13:16:12-05:00 | feat(dashboard): integrar ambiente solicitudes fotos y descansos.
- **T-007** · RF-132–RF-139. Registro integrado el 07/09; esta fecha no representa el inicio de programación. Fuente: 4c25c26 | 2026-09-07T01:16:45-05:00 | feat(dashboard): completar cierre diario con evidencias.
- **T-008** · RF-137, RF-144–RF-147. Se registran corrección, comprobante y acceso a compartir por acción del usuario. Fuente: 9bb0c8c | 2026-09-07T10:18:33-05:00 | feat(dashboard): permitir corregir evidencias en jornada; e61a507 | 2026-09-07T11:04:16-05:00 | feat(dashboard): gestionar fotos de evidencias; a5aec29 | 2026-09-07T11:31:20-05:00 | feat(dashboard): mostrar comprobante de Facebook; 270d345 | 2026-09-07T11:57:46-05:00 | feat(dashboard): compartir evidencias por WhatsApp.
- **T-009** · RF-152–RF-156. Días observados: 07, 08 y 09/09; no implica dedicación exclusiva durante todo el intervalo. Fuente: 8b87a46 | 2026-09-07T17:43:23-05:00 | feat(dashboard): registrar observaciones de revision; 2752fbf | 2026-09-08T00:49:27-05:00 | feat(dashboard): integrar horarios y notificaciones de evidencias; 306e00e | 2026-09-09T13:25:09-05:00 | feat(dashboard): mejora cierres horarios y notificaciones.
- **T-010** · RF-144. Verificar obligación independiente de asistencia y conservación de salida. Fuente: 843ea64 | 2026-09-10T13:46:08-05:00 | fix: separar jornada de horario de comparticiones; 15244f2 | 2026-09-10T13:50:31-05:00 | fix: marcar comparticiones vencidas como incompletas.
- **T-011** · RF-114–RF-125, RF-155. Revisar roles y ámbito del área; el commit no acredita despliegue. Fuente: ad6304a | 2026-09-11T23:38:46-05:00 | feat(dashboard): mejora gestion operativa y roles.
- **T-012** · RF-170–RF-175. Guía registra OPTIONS 200 y POST sin sesión 401; no acredita extracción ni publicación real. Fuente: docs/18-publicaciones-marketing.md, Activación pendiente (12/09/2026).
- **T-013** · RF-165–RF-169. El código queda registrado el 13/09; no se presupone activación completa del chat. Fuente: cfdac3d | 2026-09-13T11:52:29-05:00 | feat(portal): integrar chat privado, publicaciones y mejoras moviles; a324b3e | 2026-09-13T12:40:53-05:00 | fix(chat): compactar vista movil y evitar teclado automatico.
- **T-014** · RF-170–RF-175. Constancia del frontend y función en Git; validación externa pendiente. Fuente: cfdac3d | 2026-09-13T11:52:29-05:00 | feat(portal): integrar chat privado, publicaciones y mejoras moviles.
- **T-015** · RF-157–RF-159. Revisar fórmula provisional y simulación local de pesos. Fuente: 9fa90d0 | 2026-09-14T06:27:40-05:00 | feat(dashboard): agregar ranking mensual beta y compactar contratos y roles; be8c48f | 2026-09-14T11:04:52-05:00 | feat(ranking): mejorar modal de detalle, navegacion historica y diseno responsive.
- **T-016** · RF-039, RF-130. Probar ubicación válida, denegada e imprecisa; registro de cambios del 14/09. Fuente: 49f9437 | 2026-09-14T08:40:46-05:00 | fix(asistencia): mejorar verificacion de ubicacion presencial; 7419211 | 2026-09-14T09:19:55-05:00 | feat(asistencia): admitir documentos en asignaciones y corregir espera de ubicacion.
- **T-017** · RF-138, RF-148–RF-153. Verificar documentos permitidos, canceladas y recuperación del borrado. Fuente: 7419211 | 2026-09-14T09:19:55-05:00 | feat(asistencia): admitir documentos en asignaciones y corregir espera de ubicacion; d736789 | 2026-09-14T11:40:13-05:00 | feat(asignaciones): agregar panel de seguimiento y buscador; 60fb768 | 2026-09-14T17:39:02-05:00 | feat(asignaciones): admitir documentos administrativos y eliminar evidencias; 8d65580 | 2026-09-14T21:15:23-05:00 | fix(asignaciones): excluir canceladas de pendientes y revision.
- **T-018** · RF-165–RF-169. Registros del 14 y 15/09; probar comunicación con dos cuentas autorizadas. Fuente: d192f69 | 2026-09-14T11:30:14-05:00 | feat(chat): agrega alertas en tiempo real y bloqueo del scroll móvil; 8c0bfdd | 2026-09-14T21:15:39-05:00 | feat(portal): mejorar pendientes, imagenes del chat y comunicado; cbec54a | 2026-09-15T13:12:27-05:00 | feat(chat): mejora el sonido de las notificaciones.
- **T-019** · RF-143. J conserva registros y Facebook solo aplica según agenda. Fuente: 1dd2ad5 | 2026-09-15T08:34:37-05:00 | fix: respetar jornadas justificadas en cierres y entregables.
- **T-020** · RF-147. Preparar comprobante sin envío automático a contactos. Fuente: 8d7ea4a | 2026-09-16T09:16:22-05:00 | feat: preparar comprobantes de comparticiones para WhatsApp.
- **T-021** · RNF-079. Conservar el commit documental como antecedente de la actualización posterior. Fuente: 2c13fe0 | 2026-09-16T09:16:33-05:00 | docs: agregar diagramas de secuencia de administracion.
- **T-022** · RF-160–RF-163. Registro el 17/09 en Lima; no equivale a aceptación con datos reales. Fuente: 1cb45a3 | 2026-09-17T00:32:38-05:00 | feat: agregar reportes de Facebook con Excel y PDF por areas; 271bb95 | 2026-09-17T00:37:08-05:00 | test: esperar solicitud al verificar progreso de eliminacion.
- **T-023** · RF-157–RF-159. Distinguir ranking de cumplimiento y ranking del PDF por total de Sí. Fuente: b254094 | 2026-09-18T23:12:35-05:00 | feat: renovar panel y ranking con estadisticas y corregir periodo de salidas.
- **T-024** · RF-134–RF-136. Verificar rechazo por requisitos pendientes y conservación de entrada. Fuente: ee7555f | 2026-09-19T09:31:00-05:00 | fix: require work evidence before user exit.
- **T-025** · RNF-038, RNF-041. Días con cambios: 19 y 20/09; pendiente evaluación completa de accesibilidad. Fuente: c31d0b9 | 2026-09-19T09:31:21-05:00 | feat: refine user dashboard glass theme and sidebar; accf585 | 2026-09-19T09:49:57-05:00 | style: compact mobile close cards and align statuses; dddf078 | 2026-09-20T00:18:21-05:00 | feat: refine dashboard theme and responsive team experience.
- **T-026** · Por vincular: comunicado/carrusel. Registrar posteriormente su RF y H.U. formal; no forzar una asociación inexistente. Fuente: c2de35f | 2026-09-21T10:08:25-05:00 | feat: agregar sistema de anuncio emergente con flyer de comparticiones y logica de gestion; 0d868e6 | 2026-09-21T10:58:31-05:00 | feat(dashboard): agregar carrusel de comunicados; 3fcf72e | 2026-09-21T11:13:55-05:00 | feat(dashboard): integrar carrusel de comunicados.
- **T-027** · RF-140–RF-143. Aplicar fecha efectiva de política; preservar RPE histórico y reglas de otras personas. Fuente: 5dfcf5a | 2026-09-21T10:44:12-05:00 | fix: ajustar cierre de Alviery y mejorar botones de pendientes; cd33b15 | 2026-09-21T15:23:06-05:00 | feat(dashboard): excluir RPE en jornadas presenciales.
- **T-028** · RNF-079. Existen 175 RF, 81 RNF y 22 secuencias; se verificó estructura, no aceptación funcional. Fuente: docs/01-requerimientos-portal-asistencia.md; docs/20-diagramas-secuencia-administracion.md; docs/27-matriz-requerimientos.md.
- **T-029** · RF-079–RF-089, RNF-079. Acta con áreas vigentes, dueño funcional por área y capacidad del equipo. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-030** · RNF-079. H.U. priorizadas con criterios; cada propuesta HU-G queda confirmada, corregida o descartada. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-031** · RNF-047, RNF-081. Inventario SQL/Edge/frontend y acta de acceso, geocerca, cierre, excepciones y reportes. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-032** · RNF-079. Backlog priorizado, pendientes visibles y capacidad confirmada para octubre. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-033** · RF-079–RF-090, RF-114–RF-125, RF-148–RF-155. Validar horarios/modalidad, evidencias y responsable de revisión. Entregar ficha actualizada, una prueba con el área y hasta tres mejoras priorizadas. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-034** · RF-079–RF-090, RF-114–RF-125, RF-148–RF-155. Validar responsables, equipo y reglas de seguimiento. Entregar ficha actualizada, una prueba con el área y hasta tres mejoras priorizadas. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-035** · RF-079–RF-090, RF-114–RF-125, RF-148–RF-155. Depurar altas/bajas, contratos, solicitudes y fichas. Entregar ficha actualizada, una prueba con el área y hasta tres mejoras priorizadas. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-036** · RF-079–RF-090, RF-114–RF-125, RF-148–RF-155. Revisar agenda Facebook y permisos de borradores/publicación. Entregar ficha actualizada, una prueba con el área y hasta tres mejoras priorizadas. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-037** · RF-079–RF-090, RF-114–RF-125, RF-148–RF-155. Revisar entregables documentales, asignaciones y revisión. Entregar ficha actualizada, una prueba con el área y hasta tres mejoras priorizadas. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-038** · RF-079–RF-090, RF-114–RF-125, RF-148–RF-155. Acordar formatos, versiones y revisión de archivos gráficos. Entregar ficha actualizada, una prueba con el área y hasta tres mejoras priorizadas. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-039** · RF-079–RF-090, RF-114–RF-125, RF-148–RF-155. Validar acceso mínimo y evidencias laborales sin datos de pacientes. Entregar ficha actualizada, una prueba con el área y hasta tres mejoras priorizadas. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-040** · RF-079–RF-090, RF-114–RF-125, RF-148–RF-155. Revisar video, límites de archivo y recuperación de cargas. Entregar ficha actualizada, una prueba con el área y hasta tres mejoras priorizadas. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-041** · RF-079–RF-090, RF-114–RF-125, RF-148–RF-155. Validar altas de colaboradores, solicitudes y revisión; sin incorporar expedientes de candidatos. Entregar ficha actualizada, una prueba con el área y hasta tres mejoras priorizadas. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-042** · RF-079–RF-090, RF-114–RF-125, RF-148–RF-155. Verificar ficha, contrato y reportes laborales; sin planillas ni pagos. Entregar ficha actualizada, una prueba con el área y hasta tres mejoras priorizadas. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-043** · RNF-079. Consolidar las diez áreas, cambios aceptados y propuestas elegidas para noviembre. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-044** · RNF-001–RNF-012, RNF-064. Acta de accesos propios/ajenos; corregir hallazgos críticos y revalidar. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-045** · RNF-035–RNF-042. Cerrar hallazgos priorizados de teclado, contraste, foco y pantallas pequeñas. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-046** · RNF-023–RNF-029. Medición p95 reproducible antes/después; optimizar consultas o archivos según evidencia. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-047** · RF-137–RF-139, RF-148–RF-154, RNF-070. Probar versiones, cancelación y reintentos de Storage con dos áreas piloto. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-048** · RF-140–RF-163, RNF-069, RNF-077. Resultados trazables para virtual, presencial, J, excepciones y Facebook sin jornada. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-049** · RF-165–RF-169, RNF-071, RNF-073. Probar privacidad, lectura, imágenes, reintento y cierre de sesión. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-050** · RF-170–RF-175, RNF-075–RNF-076. Probar borradores, cuota, revisión y resultado incierto; una publicación real requiere autorización aparte. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-051** · RNF-079. Demostración de mejoras, defectos pendientes y alcance de aceptación de diciembre. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-052** · RNF-015–RNF-017, RNF-030–RNF-034. Política ratificada y ensayo de recuperación con RPO/RTO medidos. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-053** · RNF-035, RNF-044. Guías breves de acceso, marcado, cierre, revisión y soporte. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-054** · RF-025–RF-045, RF-132–RF-143. Un acta por área con escenarios propios y pendientes. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-055** · RF-079–RF-099, RF-128–RF-129, RF-160–RF-164. Validar fichas, permisos, solicitudes y reportes según rol. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-056** · RF-137–RF-139, RF-144–RF-153, RF-170–RF-175. Validar agenda, archivos, revisión y flujos permitidos por área. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-057** · RNF-047, RNF-062, RNF-081. Cerrar fallos críticos; evidenciar compatibilidad y resultados por rol. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-058** · RNF-044, RNF-079. RF/RNF, H.U., CU, secuencias y matriz reflejan lo aceptado; registrar pendientes. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-059** · RNF-051, RNF-079. Indicadores de uso/errores y backlog siguiente sin compromisos no acordados. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.
- **T-060** · RNF-079. Acta de aceptación, pendientes, responsables y propuesta de Sprint 5 enero 2027. Fuente: Propuesta de planificación al 22/09/2026; fechas y responsables por confirmar.

## Actualización

El Excel contiene una pestaña por sprint, la tabla editable TAREAS y el CALENDARIO.
Las fórmulas actualizan fechas, texto, responsables y marcas de las filas existentes.
Agregar tareas o cambiarlas de mes requiere actualizar su fila en el sprint de
destino. El plan documental de este archivo es la línea base; tras editar Excel,
registrar los cambios aprobados en la documentación para evitar versiones divergentes.
