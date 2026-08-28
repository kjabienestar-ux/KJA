# Fase 4 — Activación de Mes completo y Resumen mensual

**Fecha:** 27 de agosto de 2026
**Estado:** aplicada en Supabase y publicada el 28 de agosto de 2026

> Esta fase ya está activa en producción. Los pasos de activación se
> conservan como referencia operativa; no se debe repetir la migración sin una
> revisión previa del estado remoto.

## Qué incorpora

- Libro mensual integrado en `dashboard.html`.
- Cálculo consolidado de horario, contrato, feriados y excepciones.
- Detalle y gestión de cada celda según el rol.
- Administración de feriados y días personales excepcionales.
- Resumen por persona y área.
- Indicadores globales de asistencia, puntualidad, pendientes y horas.
- Exportación CSV de detalle y resumen.
- Índices de apoyo para periodos con más personas y registros.

## Seguridad de la migración

Ejecutar `supabase/dashboard_07_admin_mes.sql`:

- no modifica ni elimina marcas existentes;
- no modifica colaboradores, PIN, sesiones o contratos;
- no toca tablas, usuarios ni políticas de certificados;
- crea dos índices y cinco RPC;
- solo escribe feriados o excepciones cuando un `editor` o `direccion` usa
  expresamente uno de esos controles.

No se debe volver a ejecutar `dashboard_03_cerrar_panel.sql`.

## Requisitos previos

- Migraciones de asistencia 1 a 14.
- `dashboard_01`, `dashboard_03`, `dashboard_04`, `dashboard_05` y
  `dashboard_06` aplicadas.
- Las comprobaciones de las fases 2 y 3 deben seguir en `OK`.

## Activación

1. Hacer o confirmar un respaldo reciente de Supabase.
2. Abrir el SQL Editor.
3. Copiar y ejecutar todo `supabase/dashboard_07_admin_mes.sql`.
4. Confirmar cinco filas `OK`:

   - `dash_admin_guardar_excepcion`
   - `dash_admin_guardar_feriado`
   - `dash_admin_mes`
   - `dash_admin_quitar_excepcion`
   - `dash_admin_quitar_feriado`

5. Publicar estos archivos en el mismo despliegue:

   - `dashboard.html`
   - `assets/css/paginas/dashboard.css`
   - `assets/js/dashboard.js`
   - `assets/js/dashboard-admin-equipo.js`
   - `assets/js/dashboard-admin-mes.js`

6. Recargar con `Ctrl + F5` e ingresar como Dirección.

No se necesita modificar `DASH_PIN_SECRET` ni desplegar `dash-entrar` o
`dash-evidencia`.

## Piloto mínimo

Usar primero un mes cerrado y conservar el panel anterior abierto para comparar:

1. Verificar el mismo número de personas y días en ambas grillas.
2. Comparar al menos cinco personas con horarios distintos.
3. Revisar un día antes del contrato, uno no laborable y un feriado.
4. Comparar `P`, `T`, `J`, `NG`, programados y porcentaje del resumen.
5. Filtrar por área y buscar por nombre.
6. Exportar ambos CSV y abrirlos en Excel.
7. Como `visor`, confirmar que se puede consultar pero no editar.
8. Como `editor`, crear un feriado de prueba, comprobar el mes y retirarlo.
9. Habilitar un día extra personal de prueba y luego restablecer su horario.
10. Corregir una marca sin evidencia y verificar Pasar lista.
11. Abrir una evidencia existente mediante su enlace privado temporal.
12. Confirmar que certificados, clientes y usuarios de certificados no
    cambiaron.

## Criterios de comparación

El porcentaje histórico se conserva así:

```text
(P + T) / (P + T + J) × 100
```

`NG` y las celdas pendientes no entran en ese denominador. Los días futuros
pueden aparecer como programados, pero no como pendientes a hoy.

## Retorno operativo

Durante el piloto se mantienen:

- `asistencia.html?modo=grilla`
- `asistencia.html?modo=resumen`

Si aparece una diferencia, usar temporalmente el panel anterior, anotar persona,
fecha y resultado esperado, y no retirar la fase 4 de la base: sus funciones son
aditivas y no interfieren con el panel anterior.
