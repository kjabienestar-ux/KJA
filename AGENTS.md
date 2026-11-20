# KJA — instrucciones para agentes

Si existe `D:/Proyectos/administracion/AGENT-RULES.md` en este equipo, seguir sus reglas compartidas. Las reglas del proyecto también se conservan aquí para continuidad portable.

- Leer primero `docs/PROJECT_CONTEXT.md` y `PRODUCT.md`. Consultar solo las referencias de la tarea actual en `docs/tasks/README.md` y `docs/README.md` antes de implementar.
- Registrar rama, SHA y diferencias locales al empezar. Respetar la copia y rama autorizadas en la sesión; no alternar entre copias ni tocar cambios ajenos.
- Aplicación estática HTML/CSS/JavaScript con Supabase. Conservar entrada/salida, permisos, historial y activaciones. La hora oficial proviene del servidor en America/Lima; las evidencias son privadas con permisos temporales.
- En tareas documentales no aplicar migraciones ni desplegar funciones. Un commit no acredita publicación.
- Administración: diseño y validación visual solo de escritorio hasta autorización explícita posterior de Piero. No eliminar ni ampliar adaptaciones móviles existentes por iniciativa del agente.
- Al crear o modificar esqueletos de administración, leer `docs/140-esqueletos-neutros-con-contexto.md`: criterio vigente **Neutro con contexto**. Su aprobación documental no acredita adopción en las vistas. Consultar `docs/113-skeleton-loading-panel.md` para la implementación existente.
- Mantener contraste del texto y separación consistente entre componentes, conservando la estética del panel.
- Una tarea tiene ID estable, objetivo, estado, evidencia y siguiente acción. Estados: PENDIENTE, EN-CURSO, BLOQUEADO, HECHO o REVISAR. HECHO exige evidencia.
- Actualizar la ficha, el contexto vigente y el título del chat al cerrar un avance. Contexto por sustitución, máximo orientativo de 1.200 palabras; no guardar logs ni duplicar la narración técnica. Conservar decisiones y motivos en su documento de dominio.
- Nombrar chats `KJA | ESTADO | Tarea breve`. Mantener el ID en el relevo. Conservar enlaces antiguos mediante referencias de compatibilidad.
- Documentar con rutas relativas al repositorio; rutas de worktrees son inventario local, no dependencias portables. No guardar credenciales.
