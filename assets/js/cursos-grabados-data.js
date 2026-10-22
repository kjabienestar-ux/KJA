/* Cursos grabados de cursos.html: los 20 cursos gratuitos asíncronos de 1 sesión.
 * Fuente: carpeta de Drive "20 CURSOS GRATUITOS ASINCRONOS DE 1 SESIÓN (24 HORAS ACADEMICAS)".
 *
 * - destacado: true  → aparece entre las 3 tarjetas de la página (el resto se ve con la flecha).
 * - cover            → portada 800×450 en images/cursos/grabados/ (se puede reemplazar por la oficial con el mismo nombre).
 * - driveUrl         → enlace del VIDEO del curso (no de la carpeta):
 *                      https://drive.google.com/file/d/ID/view  o  https://drive.google.com/open?id=ID
 *                      El archivo debe estar compartido como "Cualquier persona con el enlace puede ver".
 *                      Mientras esté vacío, el curso se muestra como "Próximamente".
 *
 * Talleres usa su propia biblioteca en cursos-gratuitos-data.js.
 */
const FREE_COURSE_LIBRARY = {
    preview: false,
    courses: [
        { id: 'ados-adi-r', destacado: true, title: 'ADOS y ADI-R', description: 'Cómo se usan el ADOS y la ADI-R en la evaluación del espectro autista.', cover: 'images/cursos/grabados/ados-adi-r.webp', driveUrl: '' },
        { id: 'autoridad-convivencia-escolar', title: 'Autoridad y convivencia escolar', description: 'Herramientas para una autoridad positiva y una mejor convivencia en la escuela.', cover: 'images/cursos/grabados/autoridad-convivencia-escolar.webp', driveUrl: '' },
        { id: 'modificacion-conducta', title: 'Casos de modificación de conducta en niños y adolescentes', description: 'Análisis de casos y estrategias de modificación de conducta.', cover: 'images/cursos/grabados/modificacion-conducta.webp', driveUrl: '' },
        { id: 'peabody', title: 'Clase de Peabody', description: 'Uso del Test de Vocabulario en Imágenes Peabody en la evaluación del lenguaje.', cover: 'images/cursos/grabados/peabody.webp', driveUrl: '' },
        { id: 'entrevista-conductual-padres', title: 'Entrevista conductual a padres de familia', description: 'Cómo conducir una entrevista conductual con madres y padres.', cover: 'images/cursos/grabados/entrevista-conductual-padres.webp', driveUrl: '' },
        { id: 'estimulacion-psicomotriz', title: 'Estimulación psicomotriz', description: 'Actividades para favorecer el desarrollo psicomotor en la infancia.', cover: 'images/cursos/grabados/estimulacion-psicomotriz.webp', driveUrl: '' },
        { id: 'integracion-sensorial', title: 'Integración sensorial', description: 'Fundamentos de la integración sensorial y su aplicación en terapia.', cover: 'images/cursos/grabados/integracion-sensorial.webp', driveUrl: '' },
        { id: 'integracion-sensorial-tea-down', title: 'Integración sensorial en niños con TEA y Down', description: 'Estrategias sensoriales para niños con autismo y síndrome de Down.', cover: 'images/cursos/grabados/integracion-sensorial-tea-down.webp', driveUrl: '' },
        { id: 'intervencion-psicoterapia', title: 'Intervención en psicoterapia', description: 'Pautas para planificar y conducir la intervención psicoterapéutica.', cover: 'images/cursos/grabados/intervencion-psicoterapia.webp', driveUrl: '' },
        { id: 'estimulacion-temprana', destacado: true, title: 'Introducción a la estimulación temprana', description: 'Bases de la estimulación temprana en los primeros años de vida.', cover: 'images/cursos/grabados/estimulacion-temprana.webp', driveUrl: '' },
        { id: 'maestra-sombra', title: 'Maestra sombra', description: 'El rol de la maestra sombra en la inclusión escolar.', cover: 'images/cursos/grabados/maestra-sombra.webp', driveUrl: '' },
        { id: 'maestra-sombra-denver', title: 'Maestra sombra con enfoque Denver', description: 'Acompañamiento de la maestra sombra con el Modelo Denver.', cover: 'images/cursos/grabados/maestra-sombra-denver.webp', driveUrl: '' },
        { id: 'pautas-crianza', destacado: true, title: 'Pautas de crianza', description: 'Orientaciones para una crianza positiva y consistente.', cover: 'images/cursos/grabados/pautas-crianza.webp', driveUrl: '' },
        { id: 'terapia-ocupacional', title: 'Terapia ocupacional', description: 'Introducción a la terapia ocupacional y sus áreas de intervención.', cover: 'images/cursos/grabados/terapia-ocupacional.webp', driveUrl: '' },
        { id: 'praxias-lenguaje', title: 'Praxias de lenguaje', description: 'Ejercicios de praxias orofaciales para apoyar el habla.', cover: 'images/cursos/grabados/praxias-lenguaje.webp', driveUrl: '' },
        { id: 'orientacion-vocacional', title: 'Test de orientación vocacional', description: 'Uso de pruebas de orientación vocacional con adolescentes.', cover: 'images/cursos/grabados/orientacion-vocacional.webp', driveUrl: '' },
        { id: 'entrevista-neuropsicologica-infantil', title: 'Entrevista neuropsicológica infantil', description: 'Cómo realizar la entrevista en la evaluación neuropsicológica infantil.', cover: 'images/cursos/grabados/entrevista-neuropsicologica-infantil.webp', driveUrl: '' },
        { id: 'ansiedad-depresion', title: 'Diagnóstico en la ansiedad y depresión', description: 'Criterios y herramientas para el diagnóstico de ansiedad y depresión.', cover: 'images/cursos/grabados/ansiedad-depresion.webp', driveUrl: '' },
        { id: 'rabietas-berrinches', title: 'Intervención en rabietas y berrinches (TEA y TDAH)', description: 'Estrategias para manejar rabietas y berrinches en niños con TEA y TDAH.', cover: 'images/cursos/grabados/rabietas-berrinches.webp', driveUrl: '' },
        { id: 'entrevista-padres-tea', title: 'Entrevista a padres para indagar sobre el TEA', description: 'Preguntas clave para entrevistar a madres y padres ante la sospecha de autismo.', cover: 'images/cursos/grabados/entrevista-padres-tea.webp', driveUrl: '' }
    ]
};
