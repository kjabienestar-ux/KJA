/*
 * Representantes de cada área (pestaña "Representantes" de nosotros.html).
 *
 * Cómo agregar, quitar o cambiar a alguien:
 *   - Cada persona es un bloque { ... } de la lista. El orden de la lista es el
 *     orden del carrusel: la primera persona aparece al centro al abrir la pestaña.
 *   - area:        nombre del área; se muestra en la etiqueta de la ficha. El número de
 *                  áreas del encabezado ("9 áreas") se cuenta solo.
 *   - resumen:     qué hace el área en KJA (una o dos líneas, va en la ficha como
 *                  "Sobre el área").
 *   - icono:       dibujo del área. Opciones: salud, personas, reclutamiento,
 *                  marketing, ingenieria, diseno, clinica, audiovisual, contabilidad.
 *                  Si se omite, se usa una estrella.
 *   - imagen:      ilustración del área (cuadrada, .webp, en images/nosotros/representantes/areas/).
 *                  Se ve dentro del círculo cuando la persona no tiene foto.
 *   - nombre:      nombre completo. Las iniciales del avatar salen solas
 *                  (primer nombre + primer apellido).
 *   - descripcion: una o dos líneas sobre lo que hace la persona en su área.
 *   - color:       color del área (avatar sin foto, etiqueta, línea y brillo).
 *                  Usa tonos medios: las iniciales van en blanco encima.
 *   - foto:        null mientras no haya foto. Para poner una, guarda la imagen
 *                  CUADRADA en formato .webp (unos 400 × 400 px basta) dentro de
 *                  images/nosotros/representantes/ y escribe su ruta, por ejemplo:
 *                  foto: 'images/nosotros/representantes/angel-tito.webp'
 *
 * Después de editar este archivo, sube su versión (?v=) en nosotros.html para
 * que los navegadores no sigan usando la copia anterior.
 */
window.KJA_REPRESENTANTES = [
    {
        area: 'Salud ocupacional',
        resumen: 'Previene riesgos laborales y promueve hábitos saludables para que todo el equipo trabaje seguro y en bienestar.',
        icono: 'salud',
        imagen: 'images/nosotros/representantes/areas/salud-ocupacional.webp',
        nombre: 'Ángel Raúl Tito Policarpo',
        descripcion: 'Promueve espacios de trabajo seguros y acciones preventivas para cuidar el bienestar del equipo.',
        color: '#2e9d6a',
        foto: null
    },
    {
        area: 'Recursos Humanos',
        resumen: 'Gestiona el talento, el clima laboral y el desarrollo de cada colaborador, desde su ingreso hasta su crecimiento en KJA.',
        icono: 'personas',
        imagen: 'images/nosotros/representantes/areas/recursos-humanos.webp',
        nombre: 'Erika del Socorro Moreno Quilcate',
        descripcion: 'Acompaña al talento, la cultura interna y el desarrollo humano de quienes forman parte de KJA.',
        color: '#3b82f6',
        foto: null
    },
    {
        area: 'Reclutamiento',
        resumen: 'Convoca, evalúa e integra a practicantes y profesionales que comparten nuestra vocación de servicio.',
        icono: 'reclutamiento',
        imagen: 'images/nosotros/representantes/areas/reclutamiento.webp',
        nombre: 'Jade Alina Cabrera Pérez',
        descripcion: 'Conecta nuevos talentos con oportunidades de aprendizaje, crecimiento y aporte a la comunidad.',
        color: '#8b5cf6',
        foto: null
    },
    {
        area: 'Marketing',
        resumen: 'Da a conocer los servicios de KJA y acerca la salud mental a la comunidad con campañas y contenido en redes.',
        icono: 'marketing',
        imagen: 'images/nosotros/representantes/areas/marketing.webp',
        nombre: 'Jheferson Junior Quispe',
        descripcion: 'Impulsa contenidos y campañas que acercan los servicios y valores de KJA a más personas.',
        color: '#e0478e',
        foto: null
    },
    {
        area: 'Ingeniería',
        resumen: 'Desarrolla y mantiene las plataformas digitales de KJA, como esta web y el portal del equipo.',
        icono: 'ingenieria',
        imagen: 'images/nosotros/representantes/areas/ingenieria.webp',
        nombre: 'Yeiser Jamber Ávila Medina',
        descripcion: 'Orienta las soluciones tecnológicas y la mejora continua de los procesos digitales del centro.',
        color: '#2b4c8c',
        foto: null
    },
    {
        area: 'Diseño gráfico',
        resumen: 'Crea la identidad visual de KJA: publicaciones, piezas y materiales que comunican con claridad y calidez.',
        icono: 'diseno',
        imagen: 'images/nosotros/representantes/areas/diseno-grafico.webp',
        nombre: 'Jian Phol Damian Gregorio',
        descripcion: 'Convierte ideas y mensajes en piezas visuales claras, cercanas y coherentes con nuestra identidad.',
        color: '#ea580c',
        foto: null
    },
    {
        area: 'Clínica',
        resumen: 'Brinda atención psicológica a niños, adolescentes, adultos, parejas y familias con un enfoque humano y profesional.',
        icono: 'clinica',
        imagen: 'images/nosotros/representantes/areas/clinica.webp',
        nombre: 'Daniela Lupa Gonzales',
        descripcion: 'Articula una atención psicológica cercana, organizada y centrada en las necesidades de cada persona.',
        color: '#e5534b',
        foto: null
    },
    {
        area: 'Audiovisuales',
        resumen: 'Produce los videos, fotografías y contenidos que muestran el trabajo y el día a día de KJA.',
        icono: 'audiovisual',
        imagen: 'images/nosotros/representantes/areas/audiovisuales.webp',
        nombre: 'Diego Franco Landeo Ramón',
        descripcion: 'Da vida a historias y recursos audiovisuales que comunican el trabajo y propósito de KJA.',
        color: '#1a8fd1',
        foto: null
    },
    {
        area: 'Contabilidad',
        resumen: 'Lleva las finanzas, los pagos y los registros contables para que la organización funcione con orden y transparencia.',
        icono: 'contabilidad',
        imagen: 'images/nosotros/representantes/areas/contabilidad.webp',
        nombre: 'Merly Stefany Medina Rodas',
        descripcion: 'Contribuye al orden administrativo y al seguimiento responsable de los recursos de la organización.',
        color: '#64748b',
        foto: null
    }
];
