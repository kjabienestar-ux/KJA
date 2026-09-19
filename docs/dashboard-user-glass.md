# Cristal en el portal del colaborador

La capa `assets/css/paginas/dashboard-user-glass.css` adapta la referencia Claude con liquid glass al inicio del colaborador. Conserva el fondo ambiental, la estructura funcional y los colores de estado. Se aplica con `#portal:not(.admin-wide)` para mantener el tema administrativo existente.

Fraunces, ya cargada por el portal, identifica el saludo, los títulos y las cifras principales; Inter conserva la lectura de controles y evidencias. Las superficies usan cristal blanco azulado con desenfoque de 18px, reducido a 10px en móvil. La barra lateral sigue la nueva referencia explícita: cristal blanco marfil, texto gris cálido, selección beige e iconos terracota. El foco sobre esa superficie usa #8b472f. Estos tonos se limitan al sidebar, incluido el menú móvil, y no cambian los colores semánticos del contenido.

Las curvas de 24px en paneles, 26px en la barra, 18px en superficies secundarias y 14px en controles reproducen intencionalmente el acabado de la referencia. Los títulos fluidos de 23–28px y el saludo de 28–38px son excepciones locales a la escala anterior documentada en DESIGN.md.

Incluye alternativas opacas sin soporte de blur, reducción de transparencia, colores forzados e impresión. Mantiene la navegación móvil y los estados de botones existentes.

Refinamientos solicitados: ambas columnas laterales usan mayor transparencia; las barras visuales de desplazamiento se ocultan conservando el scroll. El checklist mantiene Inter, tarjetas planas ámbar para pendientes y verdes para completadas, iconos coordinados y una línea vertical junto al indicador horizontal. La foto del sidebar conserva su imagen de fondo firmada y usa iniciales solo como alternativa; el soporte incluye un icono de auriculares y una flecha de acceso.

El portal bloquea la evidencia de salida y la confirmación mientras falten evidencias laborales o entregables activos, excluyendo Facebook y asignaciones canceladas. La salida se ordena al final. La prueba `tests/exit-work-order.test.mjs` verifica esa política; no modifica cierres anteriores ni sustituye la validación del servidor.

Verificación: 210 de 212 pruebas pasan; las dos incidencias pertenecen a expectativas del resumen administrativo. La comprobación visual en escritorio y móvil está pendiente porque no había navegador conectado en la sesión.
