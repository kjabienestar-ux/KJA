# Seleccionar varios días libres

Aplicar `supabase/dashboard_95_seleccion_multiple_dias_libres.sql` después de la 94 y publicar el HTML, JavaScript y CSS actualizados.

El calendario permite marcar y desmarcar varias fechas futuras de martes a jueves, incluso en meses diferentes, hasta el saldo disponible. Con saldo de tres días se pueden enviar uno, dos o tres. El contador y el resumen muestran la selección completa.

Un solo envío crea una solicitud por fecha. Dirección puede aprobar, rechazar o proponer una alternativa para cada una con el flujo de la 94. No se solicita automáticamente el rango entre la primera y la última fecha.

La nueva RPC bloquea el saldo del colaborador y guarda el lote en una sola transacción. Si alguna fecha falla, se revierte todo el lote. Las pruebas locales cubren seleccionar tres, impedir una cuarta, desmarcar, reemplazar una fecha, saldo insuficiente, fechas repetidas y reversión de inserciones anteriores cuando falla una fecha posterior.
