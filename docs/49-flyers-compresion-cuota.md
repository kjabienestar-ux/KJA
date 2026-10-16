# Compresión y cuota de Publicaciones

14 de octubre de 2026.

Las nuevas cargas del portal convierten el flyer a WebP con calidad 0.86, conservando ancho y alto. Solo se sube esa versión si pesa menos que el archivo original; no se guardan ambas copias. El estado informa el peso guardado y el ahorro. El límite de entrada sigue siendo 5 MB. Las imágenes ya almacenadas no se modifican. La conversión tiene pérdida y debe revisarse la legibilidad de texto pequeño. La vista previa usa el mismo archivo que se sube.

Se restauró el tamaño anterior de la vista previa: la reducción solicitada era del peso, no del espacio visual. Estos cambios del frontend están en el workspace y requieren publicación para la web de producción.

La migración `marketing_04_limite_200_analisis.sql` fue aplicada en Supabase: 200 intentos de análisis nuevos por 24 horas móviles, compartidos por modelo entre el equipo. Se conservan las 5 solicitudes por minuto, el bloqueo transaccional y la reutilización de resultados guardados. Los límites de Google siguen aplicando independientemente. La carga de borradores conserva su protección existente de 30 por autor en 24 horas.

Validación: 33 pruebas aprobadas de editor, compresión y cuota SQL. Las pruebas de compresión verifican dimensiones, selección del archivo menor y liberación de memoria mediante dobles del canvas; no constituyen una evaluación visual de la calidad de un flyer real.
