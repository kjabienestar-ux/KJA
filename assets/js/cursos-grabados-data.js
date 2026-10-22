/* Cursos grabados de cursos.html: los 20 cursos gratuitos asíncronos de 1 sesión.
 * Fuente: carpeta de Drive "20 CURSOS GRATUITOS ASINCRONOS DE 1 SESIÓN (24 HORAS ACADEMICAS)".
 *
 * - destacado: true  → aparece entre las 3 tarjetas de la página (el resto se ve con la flecha).
 * - cover            → portada 800×450 en images/cursos/grabados/ (se puede reemplazar por la oficial con el mismo nombre).
 * - driveUrl         → enlace del VIDEO del curso (no de la carpeta):
 *                      https://drive.google.com/file/d/ID/view  o  https://drive.google.com/open?id=ID
 *                      El archivo debe estar compartido como "Cualquier persona con el enlace puede ver".
 *                      Mientras esté vacío, el curso se muestra como "Próximamente".
 *                      Pendientes: 10 Estimulación temprana y 19 Rabietas y berrinches.
 *
 * Talleres usa su propia biblioteca en cursos-gratuitos-data.js.
 */
const FREE_COURSE_LIBRARY = {
    preview: false,
    courses: [
        { id: 'ados-adi-r', destacado: true, title: 'ADOS y ADI-R', description: 'Cómo se usan el ADOS y la ADI-R en la evaluación del espectro autista.', cover: 'images/cursos/grabados/ados-adi-r.webp', driveUrl: 'https://drive.google.com/file/d/1Unv0ZFjnTWoVEJunAT3lzeYIH6mN_gRB/view' },
        { id: 'autoridad-convivencia-escolar', title: 'Autoridad y convivencia escolar', description: 'Herramientas para una autoridad positiva y una mejor convivencia en la escuela.', cover: 'images/cursos/grabados/autoridad-convivencia-escolar.webp', driveUrl: 'https://drive.google.com/file/d/115M34LzwqBke2S28EbmYDpkGii84mPKO/view' },
        { id: 'modificacion-conducta', title: 'Casos de modificación de conducta en niños y adolescentes', description: 'Análisis de casos y estrategias de modificación de conducta.', cover: 'images/cursos/grabados/modificacion-conducta.webp', driveUrl: 'https://drive.google.com/file/d/1GDvXYezJmvsVvbec9cGU5wPFSFe1mDxJ/view' },
        { id: 'peabody', title: 'Clase de Peabody', description: 'Uso del Test de Vocabulario en Imágenes Peabody en la evaluación del lenguaje.', cover: 'images/cursos/grabados/peabody.webp', driveUrl: 'https://drive.google.com/file/d/1O_WL0NdE7SV3_mQ2Ug6LP-5pIF5LNiKB/view' },
        { id: 'entrevista-conductual-padres', title: 'Entrevista conductual a padres de familia', description: 'Cómo conducir una entrevista conductual con madres y padres.', cover: 'images/cursos/grabados/entrevista-conductual-padres.webp', driveUrl: 'https://drive.google.com/file/d/1ltFY8mYgyI9VbKBvL5op7wDamuh0MJYx/view' },
        { id: 'estimulacion-psicomotriz', destacado: true, title: 'Estimulación psicomotriz', description: 'Actividades para favorecer el desarrollo psicomotor en la infancia.', cover: 'images/cursos/grabados/estimulacion-psicomotriz.webp', driveUrl: 'https://drive.google.com/file/d/1q3ws_Rkv0XR286PcA8qBZRD6I3ePbzST/view' },
        { id: 'integracion-sensorial', title: 'Integración sensorial', description: 'Fundamentos de la integración sensorial y su aplicación en terapia.', cover: 'images/cursos/grabados/integracion-sensorial.webp', driveUrl: 'https://drive.google.com/file/d/1Uaf6FYPE5cJwUeVgEEZU8bCBe9HyyuSR/view' },
        { id: 'integracion-sensorial-tea-down', title: 'Integración sensorial en niños con TEA y Down', description: 'Estrategias sensoriales para niños con autismo y síndrome de Down.', cover: 'images/cursos/grabados/integracion-sensorial-tea-down.webp', driveUrl: 'https://drive.google.com/file/d/1mOXRZTkjNs-DepRRCL5gu1aW-2E3o4-n/view' },
        { id: 'intervencion-psicoterapia', title: 'Intervención en psicoterapia', description: 'Pautas para planificar y conducir la intervención psicoterapéutica.', cover: 'images/cursos/grabados/intervencion-psicoterapia.webp', driveUrl: 'https://drive.google.com/file/d/18oB501SBtpTK2zaaawtEuN_uWHU_7w98/view' },
        { id: 'estimulacion-temprana', title: 'Introducción a la estimulación temprana', description: 'Bases de la estimulación temprana en los primeros años de vida.', cover: 'images/cursos/grabados/estimulacion-temprana.webp', driveUrl: '' },
        { id: 'maestra-sombra', title: 'Maestra sombra', description: 'El rol de la maestra sombra en la inclusión escolar.', cover: 'images/cursos/grabados/maestra-sombra.webp', driveUrl: 'https://drive.google.com/file/d/1do-PkErUMqYnuZQe5LbtLEfbLR5lJh8x/view' },
        { id: 'maestra-sombra-denver', title: 'Maestra sombra con enfoque Denver', description: 'Acompañamiento de la maestra sombra con el Modelo Denver.', cover: 'images/cursos/grabados/maestra-sombra-denver.webp', driveUrl: 'https://drive.google.com/file/d/10qOhk0wz37o4Yp5M33d9lMI25tU_8KYy/view' },
        { id: 'pautas-crianza', title: 'Pautas de crianza', description: 'Orientaciones para una crianza positiva y consistente.', cover: 'images/cursos/grabados/pautas-crianza.webp', driveUrl: 'https://drive.google.com/file/d/1n3FikxJH41ax5EDa73EMxGhi-2UOoqIo/view' },
        { id: 'terapia-ocupacional', title: 'Terapia ocupacional', description: 'Introducción a la terapia ocupacional y sus áreas de intervención.', cover: 'images/cursos/grabados/terapia-ocupacional.webp', driveUrl: 'https://drive.google.com/file/d/1gWeIrWWNeUCr-_5NwqtMRQR6eWyXmuDd/view' },
        { id: 'praxias-lenguaje', destacado: true, title: 'Praxias de lenguaje', description: 'Ejercicios de praxias orofaciales para apoyar el habla.', cover: 'images/cursos/grabados/praxias-lenguaje.webp', driveUrl: 'https://drive.google.com/file/d/1ngBa_wSFMd_FdvUUwsSKecW78EUMAeJ_/view' },
        { id: 'orientacion-vocacional', title: 'Test de orientación vocacional', description: 'Uso de pruebas de orientación vocacional con adolescentes.', cover: 'images/cursos/grabados/orientacion-vocacional.webp', driveUrl: 'https://drive.google.com/file/d/1Tbvu-W3Pom36OMsgPNB8xXZamzVjOu1t/view' },
        { id: 'entrevista-neuropsicologica-infantil', title: 'Entrevista neuropsicológica infantil', description: 'Cómo realizar la entrevista en la evaluación neuropsicológica infantil.', cover: 'images/cursos/grabados/entrevista-neuropsicologica-infantil.webp', driveUrl: 'https://drive.google.com/file/d/1NsLijinq_IPLb7IlYPVUJqPr1W3G0g46/view' },
        { id: 'ansiedad-depresion', title: 'Diagnóstico en la ansiedad y depresión', description: 'Criterios y herramientas para el diagnóstico de ansiedad y depresión.', cover: 'images/cursos/grabados/ansiedad-depresion.webp', driveUrl: 'https://drive.google.com/file/d/1KMoBK8mC_3cjjRsrnEnS_cuUmc9jVzHw/view' },
        { id: 'rabietas-berrinches', title: 'Intervención en rabietas y berrinches (TEA y TDAH)', description: 'Estrategias para manejar rabietas y berrinches en niños con TEA y TDAH.', cover: 'images/cursos/grabados/rabietas-berrinches.webp', driveUrl: '' },
        { id: 'entrevista-padres-tea', title: 'Entrevista a padres para indagar sobre el TEA', description: 'Preguntas clave para entrevistar a madres y padres ante la sospecha de autismo.', cover: 'images/cursos/grabados/entrevista-padres-tea.webp', driveUrl: 'https://drive.google.com/file/d/19Afam7X6LIpQEbDxUzN6DsfZM9xksx3d/view' }
    ]
};
