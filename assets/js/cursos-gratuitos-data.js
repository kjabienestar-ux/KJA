/* Biblioteca grabada. Mientras no haya videos reales, conservar preview: true.
 * Para publicar: poner preview: false, completar los títulos reales y driveUrl
 * (https://drive.google.com/file/d/ID/view o https://drive.google.com/open?id=ID).
 * Los archivos deben permitir la reproducción a los visitantes de la web.
 * No se incluyen credenciales ni se da acceso a carpetas privadas desde el navegador.
 */
const FREE_COURSE_LIBRARY = {
    preview: true,
    courses: [
        { id: 'introduccion-autismo', title: 'Introducción al autismo', description: 'Un primer acercamiento al autismo y sus necesidades de apoyo.', cover: 'images/cursos/photos/tea-autismo.webp', driveUrl: '' },
        { id: 'lenguaje-infancia', title: 'Lenguaje en la primera infancia', description: 'Una introducción al desarrollo del lenguaje en la infancia.', cover: 'images/cursos/photos/terapia-lenguaje.webp', driveUrl: '' },
        { id: 'bienestar-emocional', title: 'Bienestar emocional', description: 'Un espacio para explorar el cuidado de la salud emocional.', cover: 'images/cursos/photos/psicoterapia-tcc.webp', driveUrl: '' }
    ]
};
