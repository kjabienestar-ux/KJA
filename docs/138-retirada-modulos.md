# Retirada de chat, notificaciones y pausas del servidor — KJA-035

## Decisiones y conservación

Se retiran chat y bandeja para todos los roles, incluidos contactos desde revisión y envíos administrativos. Las observaciones, asignaciones y estados siguen en sus secciones. Marketing/WhatsApp, comunicados y avisos operativos no pertenecen al chat retirado.

Pausas conserva guías y duraciones de 20/10 minutos; permite repetir, cancelar y cerrar el modal. No valida entrada, horario o cupos. Guarda solo `{version,type,start,end}` en `kja-pausa-local-v1:<cuenta>`; usa el reloj del dispositivo. Se sincroniza entre pestañas del mismo navegador con eventos de almacenamiento. Logout borra la pausa de la cuenta; no hay historial ni sincronización entre dispositivos. Al bloquearse el almacenamiento funciona en memoria e informa la pérdida al recargar. Los intervalos solo existen con el diálogo visible; se recalcula al volver. No representa cumplimiento laboral.

## Inventario remoto de lectura, 10/11/2026

Fuente exacta: `supabase/retirement/kja035-inventory.json`, sin conversaciones, adjuntos, datos de usuarios ni credenciales.

| Elemento | Acción |
|---|---|
| 46 funciones exclusivas `chat_*`, notificaciones y pausas | Eliminar con RESTRICT y control previo de definiciones |
| 11 tablas de datos históricos | Conservar filas, RLS y referencias; revocar acceso PUBLIC/anon/authenticated |
| 4 secuencias exclusivas | Revocar acceso de los clientes; conservar valores |
| 4 triggers de notificaciones/eventos | Retirar; conservar los triggers de auditoría y negocio |
| 10 políticas exclusivas | Retirar, incluidas las dos del directorio de fotos del chat |
| 3 tablas de `supabase_realtime` | Retirar `asis_notificaciones`, `chat_eventos`, `chat_grupo_eventos` |
| Buckets `chat-imagenes` y `chat-archivos` | Conservar privados y con sus archivos; retirar políticas de acceso cliente |
| Fotos de perfil y administrativas | Conservar buckets y comprobar acceso por funciones/políticas independientes |

Tablas conservadas: `asis_notificaciones`, `asis_pausas_activas`, `chat_grupo_miembros`, `chat_grupos`, `chat_sesiones`, `chat_mensajes`, `chat_direccion_contactos`, `chat_eventos`, `chat_grupo_eventos`, `chat_reacciones`, `chat_grupo_mensajes`. Las secuencias son las de ID de notificaciones, grupos, mensajes de grupo y mensajes individuales.

Los triggers retirados son `asis_entrega_revision_notificar`, `asis_asignacion_notificar`, `chat_mensajes_emitir_evento` y `chat_grupo_mensajes_evento`. La extensión pg_cron no estaba instalada; no se encontró una Edge Function exclusiva entre las nueve desplegadas. No se elimina ninguna función desplegada. No aparecieron funciones ajenas que consumieran los nombres de estos módulos en el barrido de cuerpos SQL.

La comprobación adicional de fotos confirmó permisos independientes: `admin foto propia` usa `dash_puede_editar_foto_admin(bucket_id,name)` y `perfil fotos: lectura autorizada` usa los controles del directorio laboral. Ambos se conservan. El rol service_role y los propietarios retienen su acceso administrativo a los datos archivados.

No modificar ni volver a aplicar las migraciones históricas para esta retirada. Sus datos y motivos siguen siendo evidencia; las guías anteriores están archivadas con enlaces de compatibilidad.

## Despliegue y punto de revisión

1. Integrar y publicar primero el frontend. Cambian las URLs de todos los recursos modificados para invalidar sus cachés. Comprobar contenido servido, consola, marcado, cierre, revisión, asignaciones, historial y fotos. Una preview no acredita producción.
2. Presentar a Piero, mediante grill-me, el inventario, `supabase/migrations/20261110183808_retirar_chat_notificaciones_pausas_kja035.sql`, `supabase/retirement/kja035-rollback.sql` y las pruebas. **La aplicación remota requiere esta revisión acordada.** No aplicar automáticamente al fusionar el frontend.
3. Antes del corte, repetir el inventario de metadatos y contrastarlo con el guardado. Si cambia un objeto o aparece una dependencia compartida, detener el corte y resolverlo con Piero. Guardar conteos por tabla y bucket sin descargar contenido privado.
4. Tras aprobación, aplicar fuera del pico. La transacción usa lock_timeout de 3 segundos y statement_timeout de 30 segundos. Un cambio en las funciones o una dependencia RESTRICT aborta todo; no resolver con CASCADE.
5. Verificar que desaparecieron las 46 funciones y cuatro triggers exclusivos, que las tres publicaciones dejaron de incluir esas tablas y que los clientes no tienen permisos de tablas/secuencias ni políticas de adjuntos. Comparar conteos con la referencia del corte y probar fotos con permisos reales. Comprobar que crear asignaciones y revisar entregas conserva resultado y auditoría sin producir notificaciones.

Los enlaces firmados emitidos antes del corte pueden funcionar hasta su vencimiento; retirar políticas impide emitir permisos nuevos y no revoca automáticamente los anteriores. Las pestañas antiguas conservan su JavaScript hasta recargarse y pueden seguir solicitando endpoints retirados. El frontend nuevo usa el aviso de actualización existente; no se añade otro sondeo ni se cierran sesiones globalmente. Registrar adopción y errores antiguos antes de declarar cero tráfico global.

## Reversión

Si el frontend falla antes del corte SQL, revertir solo su commit y verificar el contenido servido. Si ya se retiró el backend, restaurarlo primero con `kja035-rollback.sql`, comprobar funciones, permisos, políticas, triggers y publicación; luego volver al frontend anterior. El script conserva las definiciones y permisos del inventario, sin modificar filas. Requiere comprobar que no existan cambios posteriores incompatibles; es una reversión del corte concreto, no un script idempotente universal.

La prueba local carga las 46 definiciones sobre tablas sintéticas y verifica retiro/restauración de metadatos, conservación de filas, auditoría ajena y aislamiento de Realtime. No sustituye la comprobación de autorizaciones reales en Supabase.

## Evidencia y límites

Pruebas nuevas: `tests/pausas-local.test.mjs` y `tests/retirement-sql.test.mjs`. La suite principal se compara con `06b937a`; los fallos anteriores se registran sin omitirlos. Ensayos de navegador y resultados locales en `output/kja-035/`; los scripts de ensayo bloquean servicios externos y usan identidades ficticias.

Ejecutar `npm run test:retirada`. Para navegador, preparar una extracción de `06b937a` en `output/kja-035/base` y ejecutar `npm run test:retirada:browser` con Playwright disponible. Si se reutiliza el runtime instalado, `KJA_PLAYWRIGHT_MODULE` admite su ruta local al paquete; no es una dependencia de rutas absolutas del repositorio. `--quick` omite únicamente la espera de cinco minutos. El ensayo completo contrasta escritorio antiguo/nuevo y móvil personal, comprueba recarga y funcionamiento sin Internet, exige ausencia de llamadas retiradas y guarda capturas. No conecta con Supabase real.

Medir consultas, bytes y tiempos por recorridos iguales; separar reducción de código/consultas de CPU y latencia remotas. La conservación histórica no libera Storage. Comprobar después una franja pico comparable, sin pruebas de carga contra producción. El estado de publicación, SQL y medición vive en [KJA-035](tasks/KJA-035.md).
