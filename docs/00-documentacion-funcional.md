# Documentación funcional — Portal KJA

**Corte:** 22 de septiembre de 2026 · **Versión:** 1.0 · **Estado:** para revisión.

Esta entrega actualiza la especificación del portal y su trazabilidad a partir
del repositorio local, incluidas las políticas hasta la migración dashboard_70.

| Documento | Contenido |
|---|---|
| [Requerimientos](01-requerimientos-portal-asistencia.md) | 175 RF y 81 RNF, criterios de aceptación, actores, reglas, alcance y pendientes. |
| [Secuencias Mermaid](20-diagramas-secuencia-administracion.md) | 22 procesos, desde acceso y marcado hasta chat y publicaciones. |
| [Secuencias PlantUML](21-diagramas-secuencia-administracion-plantuml.md) | Los mismos 22 procesos en bloques editables de PlantUML. |
| [Matriz de requerimientos](27-matriz-requerimientos.md) | Una fila por requisito con prioridad, estado documental, fuentes, secuencias y caso de aceptación; incluye relación inversa. |
| [Gantt y sprints mensuales](28-gantt-sprints-mensuales.md) | Histórico desde el despliegue del 28/08/2026 y propuesta de septiembre a diciembre; Excel editable con 60 tareas. |

Se conservaron los identificadores anteriores. Se corrigieron las reglas de
marcado seguro, modalidad, contingencia y cierre, y se incorporaron solicitudes,
evidencias, asignaciones, supervisión, excepciones de RPE presencial e individual,
ranking, reportes Facebook, chat y Marketing.

La evidencia documental no confirma que las migraciones estén instaladas ni que
los servicios externos funcionen en producción. Los requisitos heredados no
revalidados se identifican como **Base previa**; las pruebas de aceptación y los
objetivos de calidad conservan su verificación pendiente. Los diagramas se entregan
como código editable; su renderizado visual no forma parte de la comprobación local.

El Gantt incorpora Sprint 1 septiembre, Sprint 2 octubre, Sprint 3 noviembre y
Sprint 4 diciembre, además del antecedente de agosto. Sus HU-G son agrupaciones
propuestas; la formalización de H.U. y diagramas de casos de uso sigue pendiente.
Certificados y web pública se incluyen solo como límites de integración, no como
módulos especificados en este catálogo.

Para actualizar la matriz después de editar la especificación:

```powershell
node docs/herramientas/generar-matriz.mjs
```

El generador conserva el vínculo por módulo; ante requisitos o secuencias nuevas
también deben actualizarse sus asociaciones y revisarse las diferencias.
