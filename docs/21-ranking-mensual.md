# Ranking mensual: fórmula de prueba

## Versión vigente: requisitos de cumplimiento (SQL 70)

Ejecutar las migraciones en orden hasta `dashboard_70_rpe_presencial.sql`. La RPC devuelve versión 4. Las secciones inferiores describen las fórmulas previas y ya no gobiernan la evaluación vigente.

| Criterio actual | Máximo | Requisito |
|---|---:|---|
| Entrada puntual | 25 | Registro P según la puntualidad ya configurada en el sistema |
| RPE | 25 | Solo jornadas virtuales: requisito completo, archivo y aprobación; carga dentro de inicio/fin laboral o carga administrativa auditada para esa fecha |
| Facebook | 30 | Comparticiones completas con archivo y aprobación para cada fecha de su agenda, incluso sin jornada laboral |
| Salida en horario | 20 | Salida registrada dentro de la ventana de anticipación/gracia del cierre configurada |

RPE significa el reporte que el usuario también llama ERP. Desde la fecha configurada por la migración 70, una jornada presencial no solicita RPE ni entra en su denominador. Si todo el periodo evaluable fue presencial, recibe crédito neutral; si hubo jornadas virtuales, solo ellas determinan los puntos RPE. La carga administrativa tiene una excepción explícita al horario de subida: su auditoría reconoce la fecha asignada, ya que actualmente no existe una hora reportada independiente para RPE. Facebook se valida por la evidencia vinculada a su fecha, no por consultar la red social ni por la hora de subida del archivo.

Cada criterio tiene su propio denominador desde el día 1: jornadas terminadas para entrada/salida, jornadas virtuales con RPE exigible y agenda independiente para Facebook. Se cuentan cumplimientos solamente desde el ingreso. No se multiplica otra vez por participación; el denominador ya produce la proporción. Un colaborador con días de Facebook pero sin jornada también puede aparecer. No se premian horas extra ni se evalúan reuniones en esta fórmula. Los criterios sin programación no reciben puntos ni redistribuyen su peso, salvo el crédito neutral de RPE cuando el periodo tuvo jornadas presenciales evaluables y ninguna virtual.

Solo fechas hasta ayer y ventanas ya cerradas. Se excluyen jornadas J/NG sin borrar por ello las obligaciones independientes de compartir. Las asignaciones obligatorias activas e incumplidas conservan el descuento de 3 puntos, tope 15; una entrega pendiente de revisión no produce esa penalización. Los pesos siguen siendo simulaciones locales. Se usan horarios y áreas actuales; no son instantáneas históricas ni premios oficiales.

La interfaz muestra cuatro estadísticas agregadas según el filtro, comparación de los diez primeros, líderes provisionales por área y barras por requisito con numerador/denominador. Incluye cargas administrativas, RPE fuera de horario, revisión de evidencias y Facebook sin jornada. Pruebas: `tests/ranking.test.mjs` y `tests/ranking-cumplimiento-sql-check.mjs` con PostgreSQL aislado; navegador/producción pendientes.

## Revisión 2: mes completo y explicación visual

Volver a ejecutar `dashboard_53_ranking_mensual.sql`: conserva la firma de la RPC y agrega `version: 2`. El cliente exige esta versión para evitar mostrar el cálculo anterior con la explicación nueva.

El rendimiento de cada criterio se multiplica por `días laborables evaluables desde el ingreso / días laborables evaluables desde el día 1 hasta el corte`. Se excluyen justificaciones y días no laborables de ambas bases. Un ingreso a mitad del período participa, pero un cumplimiento perfecto durante 5 de 10 días obtiene la mitad del puntaje de un cumplimiento perfecto durante los 10. El descuento de asignaciones se aplica después. No se crean faltas anteriores al ingreso. Al terminar el mes el corte incluye su último día; durante el mes llega solo hasta ayer.

Las evidencias ahora exigen un archivo vinculado a la última entrega para sumar como subidas; para puntuar deben además estar completas y aprobadas. Se muestran requeridas, subidas, sin subir, observadas y pendientes. Sin requisitos aplicables aparece «Sin evaluar», sin regalar puntos. Las gráficas generales usan escala fija 0–100, y el desglose muestra barras por criterio y el ajuste por participación. El detalle de la primera posición se abre inicialmente. Cambiar los pesos sigue siendo una simulación local.

Ejecutar `supabase/dashboard_53_ranking_mensual.sql` después de dashboard_51 y cargar el dashboard actualizado. Solo cuentas activas de Dirección consultan los datos; la RPC no expone correos, documentos ni datos privados de contratos. Es una evaluación provisional, no un registro de premios ni una decisión automática sobre trabajadores.

La sección ofrece mes, filtro de área, clasificación general, primera posición por área, empates y desglose. Dirección puede simular pesos distintos. Los cambios de pesos viven únicamente en esta página: no son una política guardada ni aprobada.

| Criterio | Puntos iniciales | Cálculo |
|---|---:|---|
| Asistencia | 25 | Días P o T / días laborables evaluados |
| Puntualidad | 15 | Días P / días laborables evaluados |
| Horas | 15 | Horas efectivas con salida, limitadas diariamente al horario / horas programadas |
| Cierres | 10 | Salidas registradas / jornadas con cierre obligatorio |
| Evidencias | 15 | Requisitos completos con última revisión aprobada / requisitos exigidos |
| Reuniones | 20 | Sin evaluar: falta identificar o crear un registro verificable |

Las asignaciones no aportan puntos por recibirlas o completarlas. Una asignación activa y obligatoria de un día terminado, dirigida a la persona o a su área actual, descuenta 3 puntos si no hay entrega completa o la última entrega está observada/anulada. Tope de descuento: 15. Las entregas pendientes de revisión no generan ese descuento. Las asignaciones canceladas u opcionales se excluyen.

Se cuentan días hasta ayer en Lima. Se excluyen días no laborables, justificados J y NG. No se puntúa una persona sin inicio contractual registrado o sin jornadas evaluables. La ausencia de un criterio no redistribuye su peso: se muestra «Sin evaluar». Por ello, sin reuniones la puntuación máxima inicial es 80/100; no debe compararse una persona con cobertura incompleta como si tuviera faltas. Las revisiones pendientes se muestran para que Dirección las resuelva antes de interpretar el orden.

Límites pendientes antes de otorgar premios oficiales: definir la política, su vigencia y persistencia; registrar reuniones; fijar elegibilidad mínima; tratar traslados/bajas; cerrar y guardar el resultado mensual con confirmación humana. Se usan horarios y áreas actuales, por lo que los meses pasados no son instantáneas históricas. El ranking incluye únicamente colaboradores y áreas actualmente activos. No se excluye por `contrato_fin_referencia`: esa fecha es informativa y no un fin laboral confirmado.

Pruebas: modelo de puntuación y SQL aislado con fixtures. La revisión visual y la ejecución en Supabase productivo siguen pendientes.
