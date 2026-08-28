# Fase 3 — Activación de Colaboradores y Contratos

**Fecha:** 26 de agosto de 2026
**Estado:** aplicada en Supabase y publicada el 28 de agosto de 2026

> Esta fase ya está activa en producción. Los pasos de activación se
> conservan como referencia operativa; no se debe repetir la migración sin una
> revisión previa del estado remoto.

## Qué incorpora

- Directorio de colaboradores integrado en `dashboard.html`.
- Alta, edición, baja lógica y reactivación.
- Estado de DNI, PIN y portal sin exposición de secretos.
- Creación de áreas.
- Horarios y modalidades por día.
- Prácticas, voluntariado y vínculos mixtos.
- Seguimiento contractual calculado por Supabase.
- Bitácora de horario, metas, fechas, identidad y estado.
- Vista de contratos con alertas y término estimado.

## Requisitos previos

- Migraciones de asistencia 1 a 14.
- `dashboard_01`, `dashboard_03`, `dashboard_04` y `dashboard_05` aplicadas.
- Las comprobaciones de la fase 2 deben seguir en `OK`.

No se debe volver a ejecutar `dashboard_03_cerrar_panel.sql`.

## Activación

1. Abrir el SQL Editor de Supabase.
2. Copiar y ejecutar todo `supabase/dashboard_06_admin_equipo.sql`.
3. Confirmar siete filas `OK`:

   - `dash_admin_crear_area`
   - `dash_admin_equipo`
   - `dash_admin_estado_colaborador`
   - `dash_admin_guardar_colaborador`
   - `dash_admin_historial_colaborador`
   - `dash_admin_horas_semana`
   - `dash_admin_resumen_contrato`

4. Recargar el dashboard con `Ctrl + F5`.
5. Ingresar como Dirección y abrir **Gestión → Colaboradores**.

No se necesita modificar secretos ni desplegar Edge Functions.

## Piloto mínimo

Usar una ficha de prueba o un colaborador cuyos datos puedan verificarse:

1. Comparar nombre, área, DNI, horario y contrato con el panel anterior.
2. Cambiar un horario indicando un motivo y comprobar el historial.
3. Corregir una meta de horas y verificar que la proyección se actualice.
4. Probar un vínculo mixto con al menos un día de voluntariado.
5. Crear un área temporal y asignarla a la ficha de prueba.
6. Dar de baja a la persona y comprobar que desaparece de Pasar lista.
7. Activar **Incluir bajas**, verificar que conserva sus datos y reactivarla.
8. Ingresar como `visor`: debe consultar, pero no ver acciones de escritura.
9. Confirmar que la persona continúa entrando con el mismo PIN si su DNI no
   cambió; si se corrigió el DNI, debe entrar con el nuevo DNI y el mismo PIN.
10. Verificar que certificados y usuarios del módulo de certificados no
    cambiaron.

## Retorno operativo

Durante el piloto se mantienen:

- `asistencia.html?modo=horarios`
- `asistencia.html?modo=contratos`

Ambas interfaces trabajan sobre las mismas tablas. Si aparece una diferencia,
usar temporalmente el panel anterior y registrar el caso antes de continuar.
