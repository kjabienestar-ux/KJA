# Fase 3 — Control diario de Dirección

**Migración:** `supabase/dashboard_23_control_diario.sql`

## Qué incorpora

La nueva sección **Administración → Control diario** reúne en una sola lectura:

- personas programadas y todavía sin entrada;
- requisitos de evidencia pendientes;
- evidencias pendientes de revisión u observadas;
- entradas que aún no tienen salida;
- jornadas incompletas;
- horas válidas ya acreditadas.

La vista permite buscar, filtrar por área o situación, abrir el cierre operativo
de una persona y exportar exactamente las filas visibles a CSV.

## Permisos y datos

La RPC está reservada a Dirección. No devuelve nombres de archivos, rutas de
Storage ni enlaces firmados. Tampoco crea o modifica marcas, entregas,
revisiones, salidas u horas. Los líderes continúan usando **Mi equipo** con el
alcance de solo lectura definido en la migración 22.

## Despliegue

1. Ejecutar completo `supabase/dashboard_23_control_diario.sql` en Supabase SQL
   Editor.
2. Confirmar:

   - `RPC control diario Dirección`: 1/1

3. Publicar:

   - `dashboard.html`
   - `assets/js/dashboard.js`
   - `assets/js/dashboard-admin-control.js`
   - `assets/css/paginas/dashboard.css`

4. Hacer `Ctrl + F5` e ingresar como Dirección.

No es necesario desplegar nuevamente `dash-entrega` ni repetir migraciones
anteriores.

## Prueba mínima

1. Elegir una fecha con datos en **Control diario**.
2. Filtrar sucesivamente por sin entrada, evidencias, sin salida e incompletas.
3. Cambiar de área y comprobar que los indicadores se actualicen.
4. Abrir **Ver cierre** y confirmar que lleva a la fecha y área correctas.
5. Exportar CSV y comprobar que contiene solamente las filas filtradas.
6. Ingresar como editor o visor y confirmar que la pestaña no aparece; una
   llamada directa a la RPC debe responder `sin_permiso`.
