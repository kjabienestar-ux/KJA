# Regresión final y cierre de transición

**Fecha:** 27 de agosto de 2026
**Estado:** lista de verificación; no autoriza por sí sola retirar rutas

## Objetivo

Confirmar que `dashboard.html` cubre la operación administrativa y personal sin
regresiones antes de retirar `asistencia.html`. El retiro requiere evidencia de
pruebas, un periodo estable y aprobación expresa de Dirección.

## Matriz mínima

| Perfil | Acceso esperado | Escritura esperada |
|---|---|---|
| Colaborador con DNI + PIN | Inicio, Mi asistencia, Mi perfil y marcado propio | Solo su marca y aviso de horario |
| Líder | Lo personal y su equipo según alcance | Sin edición administrativa salvo otro rol autorizado |
| Visor administrativo | Todos los módulos de consulta excepto Marcado propio | Ninguna escritura administrativa |
| Editor | Lista, mes, colaboradores y contratos | Estados, fichas, feriados y excepciones; no acceso/PIN global |
| Dirección | Todo el dashboard | Todas las operaciones documentadas |

## Pruebas por módulo

### Acceso personal

- DNI y PIN correctos crean o reutilizan la cuenta técnica.
- Cinco intentos incorrectos bloquean durante 15 minutos.
- Una sesión personal vence a las ocho horas.
- Reiniciar PIN revoca una sesión abierta.
- Una cuenta sin PIN recibe la ruta de activación correcta.

### Inicio y marcado

- El horario y la modalidad corresponden al día en Lima.
- La tolerancia clasifica correctamente `P` y `T`.
- Un día no laborable no permite marcar.
- La evidencia obligatoria impide registrar sin imagen.
- Fallar la subida no crea una marca incompleta.
- Solo existe una marca por persona y fecha.

### Pasar lista y Mes completo

- Conteos coinciden para una fecha y un mes cerrado.
- Feriados y excepciones conservan su prioridad.
- Una marca con evidencia abre mediante URL temporal.
- Quitar una marca con evidencia coordina primero el objeto privado.
- El visor consulta sin botones efectivos de escritura.

### Colaboradores y contratos

- Alta, edición, baja lógica y reactivación conservan identidad interna.
- Corregir DNI no cambia el PIN.
- Horario, vínculo y metas producen la misma proyección que el panel anterior.
- Los cambios relevantes aparecen en historial.

### Marcado propio

- Solo Dirección ve e invoca el módulo.
- El QR apunta a `/dashboard` sin clave, DNI ni PIN.
- Cerrar `/marcar` no afecta un ingreso existente por dashboard.
- Regenerar la activación no cambia ningún PIN.
- Reinicios y configuraciones quedan en la bitácora privada.

### Certificados

- Totales de certificados, clientes y usuarios coinciden antes y después.
- Emisión, consulta, descarga y verificación QR continúan funcionando.
- Ninguna migración `dashboard_05` a `dashboard_08` modifica tablas de
  certificados.

## Compatibilidad

Probar al menos las dos últimas versiones estables disponibles de Chrome, Edge,
Firefox y Safari, más un teléfono Android y un iPhone si están disponibles.
Verificar anchos de 360 px, tableta y escritorio.

## Periodo estable

Recomendación inicial: mantener `asistencia.html` como contingencia durante al
menos dos semanas de operación real sin incidentes críticos. Registrar:

- errores de acceso y marcado;
- diferencias de conteos;
- fallas de evidencia;
- acciones administrativas incorrectas;
- tiempo y método de recuperación.

## Condiciones para retirar `asistencia.html`

Solo retirar cuando se cumplan todas:

1. Migraciones 05 a 08 aplicadas y verificadas.
2. Matriz de roles aprobada.
3. Comparaciones sin diferencias no explicadas.
4. Certificados sin regresiones.
5. Periodo estable terminado.
6. Respaldo y retorno ensayados.
7. Dirección aprueba expresamente el retiro.

`marcar.html` tiene un criterio distinto: conserva el alta inicial del PIN. No
debe retirarse hasta que el dashboard incluya un reemplazo seguro para crear el
primer PIN o deje de existir esa necesidad operativa.
