# Retiro de evidencia de entrada con advertencia

En Administración → Mes completo → día, Dirección encuentra **Retirar y advertir** debajo de la evidencia de entrada. La decisión es manual: el sistema no determina si una imagen es falsa.

El formulario exige un motivo de 5 a 400 caracteres y muestra el alcance del aviso antes de **Retirar y enviar advertencia**. Cancelar no modifica datos. El botón se bloquea durante el envío.

La confirmación permanece dentro de la actividad Entrada y reutiliza el estilo existente; el motivo se escribe en un textarea accesible por teclado, con foco visible al abrirlo y ante un motivo inválido, mientras que **Cancelar** devuelve el foco a **Retirar y advertir**.

El colaborador recibe en el centro de notificaciones del portal un mensaje de Dirección:

> Dirección retiró tu evidencia de entrada del DD/MM/YYYY por considerarla falsa. Motivo: [motivo escrito]. Si vuelves a presentar evidencia falsa, se te notificará mediante una carta de advertencia.

No se envía correo, no se genera una carta y no se aplica una sanción automática. La advertencia queda registrada junto con el actor, la fecha, el motivo y la ruta privada de la imagen. La foto se desvincula del registro visible y permanece en Storage como respaldo de auditoría. Se conservan la entrada, salida, estado de asistencia, horas y metas contractuales.

La RPC retira la referencia y crea la notificación en una transacción: si falla una parte, no se guarda ninguna. Los reintentos no duplican la advertencia. Verifica el rol Dirección, la sesión, el registro y la ruta vigente. La consulta diaria muestra «Evidencia retirada · advertencia enviada», sin exponer la ruta archivada.

## Activación

1. Ejecutar `supabase/dashboard_116_advertencia_evidencia_entrada.sql` después de la 115. Requiere el centro de notificaciones existente (41/50).
2. Publicar `dashboard.html`, `assets/js/dashboard-month-day-detail.js` y `assets/css/paginas/dashboard-month-day-detail.css`.

Esta función llama directamente a la RPC autenticada; no requiere modificar ni desplegar una Edge Function.

## Validación

29 pruebas locales aprobadas por el agente principal:

```powershell
node --test tests/entry-warning-sql.test.mjs tests/month-day-detail.test.mjs tests/month-evidence-session.test.mjs
```

Incluyen permisos, motivo obligatorio, archivo ajeno, transacción ante error de notificación, idempotencia, auditoría privada, conservación de asistencia y confirmación/cancelación en interfaz simulada. No se enviaron avisos reales ni se ejecutó esta migración en producción. Validación visual en navegador pendiente.

La revisión independiente detectó un único hallazgo P2 sobre `actionGroup`, ya corregido al restablecer la actividad Entrada antes de enviar o cancelar. Se añadió una prueba con cuerpos de actividad independientes. La revisión independiente confirmó que ese hallazgo quedó resuelto; esta confirmación no incluye validación visual ni un envío real.
