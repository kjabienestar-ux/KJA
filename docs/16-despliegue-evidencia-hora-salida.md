# Evidencia obligatoria de la hora de salida

**Migración:** `supabase/dashboard_26_evidencia_hora_salida.sql`

## Resultado

El cierre presenta tres evidencias generales con identidad visual propia:

- **Comparticiones de Facebook:** azul e ícono de Facebook.
- **RPE y evidencias del día:** ámbar mientras está pendiente y verde al completarse.
- **Evidencia de hora de salida:** una fotografía donde se vea claramente la hora.

La foto de salida aparece desde el inicio como un paso pendiente, pero solo se
habilita dentro de la misma ventana usada para marcar la salida. El servidor
exige exactamente una imagen válida y vuelve a comprobar su existencia antes
de registrar la salida. Las jornadas cerradas antes de instalar esta migración
no cambian.

## Despliegue

1. Ejecutar `supabase/dashboard_26_evidencia_hora_salida.sql` completo.
2. Confirmar:

   - `configuración de foto de salida`: 2/2
   - `requisito salida permitido`: 1/1
   - `RPC protegidas`: 4/4

3. Publicar `dashboard.html`, `assets/js/dashboard.js`,
   `assets/js/dashboard-admin-cierre.js` y
   `assets/css/paginas/dashboard.css`.
4. Hacer `Ctrl + F5`.

No se vuelve a desplegar `dash-entrega`: la Edge Function ya consulta la misma
RPC de permisos que esta migración amplía.

## Prueba mínima

1. Entrar con una jornada abierta y comprobar los tres requisitos.
2. Antes de la ventana de cierre, **Evidencia de hora de salida** debe indicar
   **Al finalizar** y no abrir el cargador.
3. Dentro de la ventana, adjuntar una foto. El selector debe admitir una sola.
4. Confirmar que el requisito cambie a verde y muestre **Completo**.
5. Confirmar que la salida siga bloqueada si Facebook o RPE continúan pendientes.
6. Completar todo y marcar la salida.
7. Abrir la revisión desde Dirección y comprobar la entrega **Evidencia de hora
   de salida**.
