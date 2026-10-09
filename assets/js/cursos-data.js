/* Áreas de formación. Títulos proporcionados por KJA.
 * Clasificación inicial: cursos de evaluación/enfoques y talleres de elaboración/práctica.
 * Clasificación inicial acordada con KJA para esta versión. */
const COURSE_DATA = {
    'tea-autismo': {
        title: 'TEA / Autismo',
        image: 'images/cursos/news/tea-autismo.webp',
        catalogImage: 'images/cursos/photos/tea-autismo.webp',

        catalogFocus: '100% center',
        catalogSummary: 'Explora ADOS-2 y ADI-R, informes psicopedagógicos y terapia de lenguaje en niños con TEA. Formación sobre sesiones ocupacionales, intervención psicoeducativa y orientación a padres.',
        description: 'Cursos y talleres sobre ADOS-2 y ADI-R, informes psicopedagógicos en autismo, terapia de lenguaje en niños con TEA y dificultades en sesiones ocupacionales y psicoeducación para padres.',
        programs: [
            { title: 'Dificultades en sesión ocupacional y psicoeducación en padres con dificultades en TEA', type: 'workshop', image: 'images/cursos/terapia-integracion-sensorial.webp' },
            { title: 'Cómo elaborar un informe psicopedagógico en autismo', type: 'workshop', image: 'images/cursos/evaluaciones-psicologicas-ninos.webp' },
            { title: 'Test de ADI-R en niños con autismo', type: 'course', image: 'images/cursos/ados2-adir.webp' },
            { title: 'Test de ADOS-2', type: 'course', image: 'images/cursos/ados2-adir.webp' },
            { title: 'Cómo elaborar un cuaderno de terapia de lenguaje en niños con TEA', type: 'workshop', image: 'images/cursos/terapia-habla-lenguaje.webp' }
        ]
    },
    'terapia-ocupacional-integracion-sensorial': {
        title: 'Terapia Ocupacional e Integración Sensorial',
        image: 'images/cursos/news/terapia-ocupacional-integracion-sensorial.webp',
        catalogImage: 'images/cursos/photos/terapia-ocupacional-integracion-sensorial.webp',

        catalogFocus: '80% center',
        catalogSummary: 'Explora intervención ocupacional, integración sensorial y estimulación temprana en niños neurodivergentes. Cursos y talleres sobre sesiones, cuadernos de trabajo e intervención con enfoque ABA.',
        description: 'Cursos y talleres sobre intervención en terapia ocupacional, integración sensorial y estimulación temprana en niños neurodivergentes. Incluye elaboración de sesiones y cuadernos de trabajo e intervención con enfoque ABA.',
        programs: [
            { title: 'Programa de intervención de terapia ocupacional', type: 'course', image: 'images/cursos/terapia-integracion-sensorial.webp' },
            { title: 'Elaboración de sesiones para estimulación e integración sensorial en niños de 2 años', type: 'workshop', image: 'images/cursos/terapia-integracion-sensorial.webp' },
            { title: 'Pasos para abordar una terapia de integración sensorial en niños neurodivergentes', type: 'course', image: 'images/cursos/terapia-integracion-sensorial.webp' },
            { title: 'Intervención en la terapia ocupacional e integración sensorial con el enfoque ABA', type: 'course', image: 'images/cursos/terapia-integracion-sensorial.webp' },
            { title: 'Elaboración de sesiones de estimulación temprana en niños neurodivergentes', type: 'workshop', image: 'images/cursos/terapia-integracion-sensorial.webp' },
            { title: 'Cómo elaborar un cuaderno de terapia de estimulación temprana e integración sensorial', type: 'workshop', image: 'images/cursos/terapia-integracion-sensorial.webp' }
        ]
    },
    'terapia-lenguaje': {
        title: 'Terapia de Lenguaje',
        image: 'images/cursos/news/terapia-lenguaje.webp',
        catalogImage: 'images/cursos/photos/terapia-lenguaje.webp',

        catalogFocus: '100% center',
        description: 'Cursos y talleres sobre sesiones y cuadernos de estimulación del lenguaje, intervención mediante el juego y terapia de lenguaje y conductual. Incluye sesiones para niños de 3 a 6 años con dificultades en el lenguaje.',
        catalogSummary: 'Explora estimulación del lenguaje, intervención mediante el juego y terapia conductual. Cursos y talleres sobre sesiones y cuadernos para niños de tres a seis años.',
        programs: [
            { title: 'Trastorno de Terapia de Lenguaje', type: 'course', image: 'images/cursos/terapia-habla-lenguaje.webp' },
            { title: 'Cómo elaborar sesiones de un cuaderno de estimulación de lenguaje', type: 'workshop', image: 'images/cursos/terapia-habla-lenguaje.webp' },
            { title: 'Taller de intervención en la terapia de lenguaje mediante la terapia del juego', type: 'workshop', image: 'images/cursos/terapia-habla-lenguaje.webp' },
            { title: 'Elaboración de sesiones en la terapia de lenguaje en niños de 3 a 6 años con dificultades en el lenguaje', type: 'workshop', image: 'images/cursos/terapia-habla-lenguaje.webp' },
            { title: 'Cómo elaborar un cuaderno de terapia de lenguaje y conductual', type: 'workshop', image: 'images/cursos/terapia-habla-lenguaje.webp' }
        ]
    },
    'psicoterapia-tcc': {
        title: 'Psicoterapia y Terapia Cognitivo-Conductual',
        image: 'images/cursos/news/psicoterapia-tcc.webp',
        catalogImage: 'images/cursos/photos/psicoterapia-tcc.webp',

        catalogFocus: '75% center',
        description: 'Cursos y talleres sobre psicoterapia en niños, adolescentes y adultos, TCC integrativa y terapia de esquemas. Incluye sesiones y cuadernos de psicoterapia, técnicas lúdicas para el manejo emocional infantil e intervención conductual mediante el juego.',
        catalogSummary: 'Explora psicoterapia en niños, adolescentes y adultos, TCC integrativa y terapia de esquemas. Formación sobre sesiones, cuadernos y técnicas lúdicas para el manejo emocional infantil.',
        programs: [
            { title: 'Psicología clínica y salud mental en adolescentes enfocado en TCC', type: 'course', image: 'images/cursos/news/psicoterapia-tcc.webp' },
            { title: 'Elaboración de sesiones de psicoterapia en niños y adolescentes', type: 'workshop', image: 'images/cursos/news/psicoterapia-tcc.webp' },
            { title: 'Psicoterapia cognitivo-conductual integrativa (TCC integrativa)', type: 'course', image: 'images/cursos/news/psicoterapia-tcc.webp' },
            { title: 'Terapia cognitivo-conductual y terapia de esquemas', type: 'course', image: 'images/cursos/news/psicoterapia-tcc.webp' },
            { title: 'Técnicas lúdicas en TCC para el manejo emocional infantil', type: 'workshop', image: 'images/cursos/news/psicoterapia-tcc.webp' },
            { title: 'Intervención terapéutica en TCC en niños y adolescentes', type: 'course', image: 'images/cursos/news/psicoterapia-tcc.webp' },
            { title: 'Elaboración de un cuaderno de psicoterapia en niños y adolescentes', type: 'workshop', image: 'images/cursos/news/psicoterapia-tcc.webp' },
            { title: 'Intervención en la terapia de esquemas en niños y adolescentes (TCC)', type: 'course', image: 'images/cursos/news/psicoterapia-tcc.webp' },
            { title: 'Intervención en la terapia de juego en niños neurodiversos en el área conductual', type: 'workshop', image: 'images/cursos/news/psicoterapia-tcc.webp' },
            { title: 'Técnicas psicoterapéuticas en adolescentes y adultos', type: 'course', image: 'images/cursos/news/psicoterapia-tcc.webp' }
        ]
    },
    'neuropsicologia': {
        title: 'Neuropsicología',
        image: 'images/cursos/news/neuropsicologia.webp',
        catalogImage: 'images/cursos/photos/neuropsicologia.webp',

        catalogFocus: '100% center',
        description: 'Cursos y talleres sobre casos conductuales en niños neurodivergentes y elaboración de informes clínicos y neuropsicológicos. Incluye WISC-V, test de Bender y test de Machover en el ámbito emocional.',
        catalogSummary: 'Explora casos conductuales en niños neurodivergentes y elaboración de informes clínicos y neuropsicológicos. Cursos y talleres sobre WISC-V, Bender y Machover en evaluación emocional.',
        programs: [
            { title: 'Cómo abordar casos conductuales en niños neurodivergentes en el área neuropsicológica', type: 'course', image: 'images/cursos/neuropsicologia-infantil.webp' },
            { title: 'Cómo elaborar un cuaderno de informe neuropsicológico en niños neurodiversos', type: 'workshop', image: 'images/cursos/neuropsicologia-infantil.webp' },
            { title: 'Cómo elaborar un informe clínico y neuropsicológico en niños neurodiversos', type: 'workshop', image: 'images/cursos/neuropsicologia-infantil.webp' },
            { title: 'El test de Bender', type: 'course', image: 'images/cursos/evaluaciones-psicologicas-ninos.webp' },
            { title: 'WISC-V: innovaciones, alcances y desafíos del WISC-V', type: 'course', image: 'images/cursos/wisc-v.webp' },
            { title: 'Test de Machover en el ámbito emocional', type: 'course', image: 'images/cursos/evaluaciones-psicologicas-ninos.webp' }
        ]
    },
    'adultos-mayores-psicooncologia': {
        title: 'Adultos Mayores y Psicooncología',
        image: 'images/cursos/news/adultos-mayores-psicooncologia.webp',
        catalogImage: 'images/cursos/photos/adultos-mayores-psicooncologia.webp',

        catalogFocus: '65% center',
        description: 'Cursos y talleres sobre psicología clínica, salud mental y abordaje cognitivo en adultos mayores. Incluye psicooncología, programas de intervención en adultos mayores e intervención terapéutica en pacientes oncológicos.',
        catalogSummary: 'Explora psicología clínica, salud mental y abordaje cognitivo en adultos mayores. Cursos y talleres sobre psicooncología, programas de intervención y acompañamiento terapéutico a pacientes oncológicos.',
        programs: [
            { title: 'Psicología clínica y salud mental en adultos mayores', type: 'course', image: 'images/cursos/news/adultos-mayores-psicooncologia.webp' },
            { title: 'Cómo abordar el área cognitiva en pacientes adultos mayores', type: 'course', image: 'images/cursos/news/adultos-mayores-psicooncologia.webp' },
            { title: 'Programa de intervención de psicooncología en adultos mayores', type: 'workshop', image: 'images/cursos/news/adultos-mayores-psicooncologia.webp' },
            { title: 'Psicooncología', type: 'course', image: 'images/cursos/news/adultos-mayores-psicooncologia.webp' },
            { title: 'Intervención terapéutica en pacientes oncológicos', type: 'course', image: 'images/cursos/news/adultos-mayores-psicooncologia.webp' }
        ]
    },
    'evaluacion-psicologica-clinica': {
        title: 'Evaluación Psicológica Clínica',
        image: 'images/cursos/news/evaluacion-psicologica-clinica.webp',
        catalogImage: 'images/cursos/photos/evaluacion-psicologica-clinica.webp',

        catalogFocus: '70% center',
        description: 'Cursos y talleres sobre calificación, procesamiento de resultados y elaboración del informe psicológico, así como pruebas de ansiedad y depresión.',
        catalogSummary: 'Explora calificación y procesamiento de resultados de pruebas psicológicas. Aprende sobre informes psicológicos y pruebas de ansiedad y depresión con formación en evaluación psicológica clínica.',
        programs: [
            { title: 'Calificación de procesos de resultados e informe psicológico', type: 'workshop', image: 'images/cursos/evaluaciones-psicologicas-ninos.webp' },
            { title: 'Pruebas de ansiedad y depresión', type: 'course', image: 'images/cursos/evaluaciones-psicologicas-ninos.webp' }
        ]
    },
    'psicologia-organizacional': {
        title: 'Psicología Organizacional y Selección de Personal',
        image: 'images/cursos/news/psicologia-organizacional.webp',
        catalogImage: 'images/cursos/photos/psicologia-organizacional.webp',

        catalogFocus: '85% center',
        description: 'Cursos y talleres sobre entrevistas por competencias, perfiles de puesto, pruebas de selección de personal y elaboración de informes psicolaborales. Incluye bienestar psicológico del personal.',
        catalogSummary: 'Explora entrevistas por competencias, perfiles de puesto y pruebas de selección de personal. Cursos y talleres sobre informes psicolaborales y bienestar psicológico del personal.',
        programs: [
            { title: 'Psicología organizacional, entrevista por competencias y perfiles de puesto', type: 'course', image: 'images/cursos/reclutamiento-seleccion.webp' },
            { title: 'Cómo elaborar un informe psicolaboral en selección de personal', type: 'workshop', image: 'images/cursos/reclutamiento-seleccion.webp' },
            { title: 'Prueba de selección del personal', type: 'course', image: 'images/cursos/reclutamiento-seleccion.webp' },
            { title: 'Pruebas de selección de personal', type: 'course', image: 'images/cursos/reclutamiento-seleccion.webp' },
            { title: 'Bienestar psicológico del personal', type: 'workshop', image: 'images/cursos/reclutamiento-seleccion.webp' }
        ]
    },
    'salud-ocupacional-bienestar': {
        title: 'Salud Ocupacional y Bienestar',
        image: 'images/cursos/news/salud-ocupacional-bienestar.webp',
        catalogImage: 'images/cursos/photos/salud-ocupacional-bienestar.webp',

        catalogFocus: '90% center',
        description: 'Cursos y talleres sobre pruebas psicológicas en salud ocupacional y bienestar psicológico en el ámbito de la salud.',
        catalogSummary: 'Explora pruebas psicológicas en salud ocupacional y bienestar psicológico en el ámbito de la salud. Revisa los cursos y talleres de evaluación y bienestar disponibles.',
        programs: [
            { title: 'Pruebas psicológicas en salud ocupacional', type: 'course', image: 'images/cursos/news/salud-ocupacional-bienestar.webp' },
            { title: 'Bienestar psicológico en la salud', type: 'workshop', image: 'images/cursos/news/salud-ocupacional-bienestar.webp' },
            { title: 'Pruebas de salud ocupacional', type: 'course', image: 'images/cursos/news/salud-ocupacional-bienestar.webp' }
        ]
    }
};
