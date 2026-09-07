# Fase 4 — Sorteo y rotación de entregables

**Migración:** `supabase/dashboard_24_sorteo_entregables.sql`

## Resultado

Dirección puede elegir **Sorteo dentro de un área** al crear una asignación de
PPT, GPT, inducción u otro entregable. El flujo tiene dos pasos:

1. Previsualizar a las personas seleccionadas.
2. Confirmar exactamente esa selección.

La rotación prioriza a quienes recibieron menos asignaciones del mismo tipo en
los 30 días anteriores. Entre personas con la misma carga aplica un orden
mezclado pero estable para la fecha, área y tipo; refrescar la página no cambia
arbitrariamente el resultado.

Solo participan colaboradores activos, programados para trabajar ese día y sin
otra asignación activa del mismo tipo. Cada resultado se guarda como una
asignación individual con el usuario de Dirección que la creó.

## Despliegue

1. Ejecutar `supabase/dashboard_24_sorteo_entregables.sql` completo.
2. Confirmar:

   - `RPC de sorteo justo`: 2/2

3. Publicar `dashboard.html`, `assets/js/dashboard-admin-cierre.js` y
   `assets/css/paginas/dashboard.css`.
4. Hacer `Ctrl + F5` e ingresar como Dirección.

No se vuelve a desplegar `dash-entrega` ni se repiten migraciones anteriores.

## Prueba mínima

1. Abrir **Administración → Cierres y entregables**.
2. Elegir una fecha actual o futura y seleccionar **Sorteo dentro de un área**.
3. Elegir área, cantidad, tipo y título.
4. Pulsar **Previsualizar sorteo** y revisar nombres y carga reciente.
5. Pulsar **Confirmar asignaciones**.
6. Verificar que cada persona aparezca en las asignaciones del día y que su
   portal muestre el entregable antes de permitir la salida.
7. Entrar como editor o visor: la opción de sorteo no debe aparecer y una
   llamada directa a las RPC debe responder `sin_permiso`.
