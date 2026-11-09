# KJA-032 — carga de evidencias y páginas de historial

El visor administrativo solicita una firma nueva de 900 segundos solo para el archivo seleccionado. Mantiene las pestañas de entrega y ofrece botones numerados para los adjuntos. Un archivo fallido no impide seleccionar los demás. No se conservan firmas entre selecciones. El aviso de archivo retirado depende de la confirmación autorizada del servidor de #175. Las descargas Office se solicitan solo al seleccionar ese documento.

La ficha de Colaboradores consulta el historial al abrir la pestaña Historial, no al abrir Resumen. El editor de contratos y el banco de días libres usan páginas de 12. Anterior/Siguiente recorren todas las filas; no se eliminan ni ocultan permanentemente registros. Las exportaciones PDF conservan el historial completo y lo solicitan expresamente al descargar.

## Base y seguridad

Preparado sobre 6cbdd5b de #176. Las definiciones remotas originales y la estructura se comprobaron por lectura el 09/11/2026. Los nuevos endpoints son `dash_admin_historial_colaborador_pagina` y `dash_admin_dias_libres_pagina`. No se reemplazan funciones actuales ni se modifican tablas o registros.

La migración generada por CLI está en `supabase/migrations/20261109150038_paginar_historiales_kja032.sql`. Crea ambas funciones en una transacción, con búsqueda de esquema vacía, relaciones calificadas y EXECUTE solo para authenticated. Conserva los controles de miembro administrativo/Dirección de las funciones originales y exige auth.uid() en cada llamada. SECURITY DEFINER conserva la lectura mediante RPC de tablas privadas; no se conceden permisos directos sobre las tablas ni se amplía el público autorizado.

El cursor guarda fecha exacta e ID textual, ordenados descendentemente; evita saltos por fechas iguales y desplazamientos cuando se insertan filas recientes entre páginas. Una inserción anterior al cursor puede aparecer en la continuación; no es una instantánea de auditoría. El botón Anterior vuelve a consultar la página. El límite está acotado a 1–50. El saldo se lee de asis_colaboradores, no se reconstruye a partir de los movimientos visibles. La alerta de meta contractual se evalúa sobre todo el historial, aunque el cambio esté fuera de página.

No se añaden índices sin necesidad acreditada: el máximo remoto observado fue de 24 cambios contractuales y cuatro movimientos por persona. No son hoy el consumo principal. El chat ya pagina a 50 mensajes y Roles limita el historial a 30 eventos en la base revisada.

## Activación y reversión

1. Revisar e integrar #176 primero; este lote depende de sus firmas y compatibilidad de archivo retirado.
2. Revisar el SQL y ensayos. Aplicar la migración mediante el flujo habitual solo en la fase de activación. Esta tarea no la ejecutó en producción.
3. Publicar HTML, los scripts y la hoja CSS de este lote. Si falta exclusivamente la RPC nueva (PGRST202), el cliente usa la función original y pagina su respuesta en memoria: mantiene compatibilidad, pero todavía no reduce el tráfico del historial. Un error de red o permisos no activa esa alternativa.
4. Probar una sesión administrativa real: Resumen no pide historial, Historial pide 12, Siguiente/Anterior funcionan, el banco mantiene saldo y el PDF conserva todo. Confirmar que otra cuenta/rol o cerrar la ficha descartan respuestas tardías. Ejecutar asesores tras activar; las funciones locales nuevas todavía no están incluidas en el análisis remoto.
5. Comparar solicitudes y bytes de un recorrido equivalente. Para revertir, volver al frontend anterior; las funciones originales siguen disponibles. No es necesario borrar datos ni retirar evidencias. Dejar las nuevas RPC instaladas sin clientes no cambia reglas de negocio.

## Evidencia local

- PGlite: recorrido de 137 registros por fuente con fechas repetidas, inserción entre páginas, separación por persona, denegación/anon, cursor inválido, límite, alerta histórica y saldo oficial; migración reejecutable.
- Cliente: navegación, error/reintento, compatibilidad exclusiva por RPC ausente, doble clic, cambio de cuenta, cierre y reapertura. La ficha nueva carga solo en Historial; PDF consulta el conjunto completo.
- Edge 1440×900 con HTML/CSS y funciones reales, datos ficticios y red interceptada: ambos historiales navegan y mantienen alerta/saldo; controles dentro del ancho. Galería: once escenarios, sin errores JS. Comparación de ocho imágenes: ocho solicitudes iniciales antes y una después; segunda selección añade una sola. Son archivos ficticios diminutos, no ahorro mensual acreditado.
- Scripts y resultados de navegador locales: output/kja-032/ensayo-paginacion.cjs, resultado-paginacion-browser.json, ensayo-galeria-demanda.cjs, resultado-galeria-demanda.json y comparar-galeria-demanda.cjs/comparacion-galeria-demanda.json.

Lectura de asesores de seguridad remotos: avisos preexistentes sobre search_path mutable, funciones SECURITY DEFINER, RLS sin políticas y protección de contraseñas. No se alteraron como parte de esta optimización. Tener tablas privadas con RLS sin políticas puede ser deliberado cuando solo se accede por RPC. No se interpreta el análisis remoto como validación de funciones aún no instaladas.

Fuentes oficiales: [funciones y permisos](https://supabase.com/docs/guides/database/functions), [paginación](https://supabase.com/docs/guides/database/pagination), [asesor de search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable). No hubo operaciones de borrado, cargas, cambios de saldo ni escrituras remotas de negocio.
