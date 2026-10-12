# Protección de la meta contractual

Cambiar fechas, vínculo u horario no recalcula ni escribe las metas principal o de voluntariado. El botón Simular horario actual solo muestra una hipótesis para todo el intervalo. No representa horas cumplidas ni reconstruye cambios de horario históricos.

La fecha de fin del documento, la meta acordada y las horas programadas son datos distintos. Una ampliación de la jornada puede adelantar el término, pero no aumenta la meta contractual.

## Publicación

1. Publicar dashboard.html y assets/js/dashboard-admin-equipo.js.
2. Aplicar supabase/dashboard_114_proteger_meta_contractual.sql después de dashboard_113. La migración es repetible, conserva las metas y el historial, y bloquea cambios de meta de clientes antiguos sin declaración explícita. Mantiene el guardado original como función interna sin permisos para clientes.
3. Ejecutar supabase/auditoria_metas_contractuales.sql (solo lectura). Revisar contra el contrato los cambios de meta coincidentes con cambios de fechas u horario. El formulario también señala estas coincidencias y muestra valores anteriores y nuevos. Un indicio no autoriza una reversión masiva.
4. Corregir cada meta confirmada escribiendo el valor contractual y un motivo en la ficha. No usar la simulación como meta. Los casos creados ya con una meta incorrecta pueden no tener un cambio histórico y requieren revisión documental.

## Caso reproducido

Del 18/05/2026 al 11/08/2026, lunes/martes/viernes/sábado de 08:00 a 14:00 suman 300 horas. Desde el 12/08 hasta el 13/11, incluyendo miércoles, suman 402 horas. Total programado: 702; meta acordada: 700. Aplicar cinco días a todo el periodo produce 774 (12 miércoles extra, 72 horas).

No se infiere la vigencia histórica a partir de created_at: la fecha de registro de una edición no demuestra cuándo comenzó el horario. Esta corrección elimina el uso del cálculo retrospectivo como meta; no modifica asistencias, créditos por días no laborables ni las reglas existentes de proyección. La reconstrucción histórica de jornadas requiere periodos de vigencia confirmados y es independiente de esta protección.

Validación: pruebas de simulación sin escritura, separación de periodos, fechas modificadas, contratos mixtos, bloqueo SQL de clientes antiguos, permisos, corrección explícita y repetición de la migración. La aplicación a la base de producción debe verificarse por separado.
