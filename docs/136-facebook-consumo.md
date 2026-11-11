# KJA-032 — galería de Facebook bajo demanda

Al abrir el comprobante, la galería consulta y muestra solo la captura seleccionada. Anterior/Siguiente permiten recorrer todas las capturas; cada selección solicita una firma nueva con la vigencia original de 900 segundos. La lista de archivos y sus cantidades permanece completa. Un error de archivo conserva la navegación y permite reintentar. No se guardan URLs entre aperturas.

Preparar comprobante conserva su comportamiento: guarda la cantidad mediante la RPC existente y genera la imagen completa con todas las capturas en orden. En ese momento pide un lote nuevo de firmas para todas las rutas distintas; vuelve a mapear la lista original para conservar orden y referencias. Si falta autorización o el resultado de algún archivo, falla la preparación completa: no genera un comprobante recortado. No se elimina ni sobrescribe ninguna evidencia.

El generador admite un resolver opcional para preparar archivos en el momento de uso. Los consumidores anteriores que ya entregan URLs siguen siendo compatibles. El cierre aborta las descargas del collage y descarta resultados tardíos; el cambio de cuenta/rol invalida las operaciones. La preparación tiene protección contra envíos duplicados y comprueba vigencia antes de guardar la cantidad. La descripción editable, la descarga, la copia y el envío nativo iniciado por el usuario conservan sus controles.

## Alcance y activación

Frontend solamente: dashboard.html, dashboard.js, facebook-receipt.js y facebook-gallery-demand.css. No hay migración, cambio de políticas, configuración de Supabase ni escrituras remotas hechas por el agente. Las únicas escrituras de cantidad del ensayo fueron contra un servicio ficticio local.

Base b474d26 (incluye #178, #179 y #180). Publicar mediante PR revisado y luego validar con cuenta real: abrir galería, avanzar y regresar, preparar comprobante, comprobar todas las capturas, cerrar durante preparación y reintentar. No probar el envío real a terceros sin instrucción del usuario.

Para revertir, restaurar estos cuatro archivos al merge anterior. Los registros, archivos y RPC permanecen intactos.

## Evidencia

29/29 pruebas relacionadas: galería, cantidad, permisos parciales, cierre/cambio de cuenta, orden completo, doble preparación, descarga/copia y lecturas personales. Suite ampliada de cierres y Facebook: 93/104 tanto en base b474d26 como con el cambio, mismos once fallos previos. Se actualizó un chequeo estático que exigía el texto «toca para ampliar» al nuevo control accesible; las pruebas funcionales comprueban navegación y selección. No se atribuyen esos once fallos a esta mejora ni se declaran aprobados.

Navegador acoplado con HTML/CSS y funciones reales, datos y Storage locales ficticios: ocho capturas, una firma al abrir y otra al avanzar, una sola imagen montada. Preparar comprobante solicitó un lote y descargó las ocho capturas en el orden original; estado «Comprobante listo» y descarga habilitada. Escritorio 1440×900 y móvil390×844 sin desbordamiento horizontal de galería; capturas inspeccionadas. Sin sesión real de colaborador ni descarga final acreditada. No se abrieron WhatsApp ni ventanas de envío.

Evidencia local en output/kja-032/: facebook-demanda-tests.tap, facebook-demand-base.tap, facebook-demand-broad.tap, facebook-demand-comparison.json, facebook-demanda-browser.json y servidor-facebook-demanda.cjs. Los archivos de prueba no contienen datos reales ni enlaces privados.

El beneficio depende del recorrido: consultar solo una captura evita preparar y descargar las demás. Si el usuario recorre todas o genera el comprobante completo, esas imágenes siguen siendo necesarias. No se midió ahorro mensual ni se acredita una solución al pico de salida de la 1 p. m. Esta mejora no reduce el Storage ocupado.

Referencia API: [firmas por lote](https://supabase.com/docs/reference/javascript/storage-from-createsignedurls). Cada archivo debe seguir autorizado por las políticas existentes.
