# Contador de consultas DNI

El formulario muestra el saldo estimado de las 100 consultas mensuales compartidas por el portal. El contador se guarda en Supabase, no en el navegador. Leer el saldo no llama a Decolecta ni suma una consulta.

## Activación

1. Ejecutar `supabase/certificados_cuota_dni.sql` en el SQL Editor del proyecto.
2. Desplegar la función con `supabase functions deploy consulta-dni --project-ref xadxmfgdxwplmhijagix` o actualizar su código desde el dashboard de Supabase.
3. Publicar `admin.html` junto con los otros cambios pendientes.

La función mantiene el secreto existente `DECOLECTA_TOKEN`. No copiarlo al HTML.

## Consumo anterior

El primer mes muestra «Falta sincronizar el saldo» porque las consultas anteriores no estaban registradas. Con las consultas del portal en pausa, revisar el total usado en el panel de Decolecta y ejecutar el ejemplo al final del SQL, sustituyendo `N` por ese total. El contador empieza desde ese valor y suma los nuevos intentos.

Los meses siguientes comienzan automáticamente con 100 disponibles, usando el mes calendario de Lima. Verificar que ese periodo coincida con la renovación del plan de Decolecta.

El saldo es aproximado: registra cada intento enviado desde este portal, incluidos errores; no conoce cómo los factura Decolecta ni las llamadas realizadas desde otros sistemas. No se interpreta un error de autenticación como cuota agotada. Un HTTP 429 indica un límite, que puede ser temporal. El contador no bloquea por sí mismo la escritura manual del nombre ni la emisión.

## Verificación

Se comprobaron la migración SQL con PostgreSQL embebido, permisos, incrementos compartidos, saldo desconocido, saldo cero y creación de un nuevo periodo. También se verificaron sintaxis del HTML y estados del indicador. Falta verificar el saldo contra la cuenta real después de desplegar.
