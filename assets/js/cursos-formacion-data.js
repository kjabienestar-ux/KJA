/* Selección y lista de octubre proporcionadas por KJA.
 * Las fechas de los mockups no son programación confirmada.
 * Las rutas son grupos de exploración, distintos de las nueve áreas existentes.
 */
const KJA_FORMATION = {
    routes: [
        { id: 'clinica', title: 'Clínica y Empleabilidad', description: 'Especialízate en evaluación, diagnóstico e intervención clínica.', image: 'psicoterapia-tcc', icon: 'brain', tone: 'pink' },
        { id: 'infantil', title: 'Psicología Infantil', description: 'Fortalece tus competencias en desarrollo, evaluación e intervención infantil.', image: 'neuropsicologia', icon: 'child', tone: 'blue' },
        { id: 'herramientas', title: 'Diagnóstico y Herramientas', description: 'Explora instrumentos psicológicos para tu práctica profesional.', image: 'evaluacion-psicologica-clinica', icon: 'report', tone: 'purple' },
        { id: 'educativa-organizacional', title: 'Educativa y Organizacional', description: 'Desarrolla competencias para el ámbito educativo y organizacional.', image: 'psicologia-organizacional', icon: 'people', tone: 'teal' }
    ],
    courses: [
        { id: 'rrhh', title: 'Psicología Organizacional en Recursos Humanos', fullTitle: 'Psicología Organizacional en Recursos Humanos (selección, clima laboral, desarrollo de talento)', image: 'psicologia-organizacional', icon: 'people', tone: 'pink', featured: true, routes: ['educativa-organizacional'], topics: ['Selección de personal', 'Clima laboral', 'Desarrollo de talento'] },
        { id: 'neuropsicologia-tea-tdah', title: 'Pruebas Neuropsicológicas en Niños con TEA y TDAH', fullTitle: 'Pruebas Neuropsicológicas en Niños con TEA y TDAH / Trastornos del Neurodesarrollo', image: 'neuropsicologia', icon: 'report', tone: 'purple', featured: true, routes: ['clinica', 'infantil', 'herramientas'], topics: ['Evaluación neuropsicológica', 'Trastornos del neurodesarrollo', 'Interpretación de resultados'] },
        { id: 'tcc-infantil', title: 'Psicoterapia Cognitivo-Conductual en Niños y Adolescentes', fullTitle: 'Psicoterapia Cognitivo-Conductual en Niños y Adolescentes (TCC)', image: 'psicoterapia-tcc', icon: 'chat', tone: 'blue', featured: true, routes: ['clinica', 'infantil'], topics: ['Intervención en TCC', 'Contexto familiar', 'Niñez y adolescencia'] },
        { id: 'ados-adir', title: 'ADOS-2 y ADI-R: Evaluación y diagnóstico de autismo', image: 'tea-autismo', icon: 'report', routes: ['clinica', 'infantil', 'herramientas'], topics: ['Instrumentos especializados', 'Evaluación del TEA', 'Interpretación de resultados'] },
        { id: 'wisc-v', title: 'WISC-V: calificación, interpretación y aplicaciones clínicas', image: 'evaluacion-psicologica-clinica', icon: 'chart', routes: ['clinica', 'infantil', 'herramientas', 'educativa-organizacional'], topics: ['Evaluación cognitiva', 'Niños y adolescentes', 'Aplicaciones clínicas'] },
        { id: 'estimulacion-lenguaje', title: 'Estimulación Temprana y Terapia de Lenguaje', image: 'terapia-lenguaje', icon: 'chat', routes: ['infantil'], topics: ['Desarrollo infantil', 'Lenguaje y comunicación', 'Intervención temprana'] },
        { id: 'convivencia-escolar', title: 'Convivencia escolar y habilidades socioemocionales', fullTitle: 'Convivencia escolar y habilidades socioemocionales en la tutoría educativa', image: 'terapia-ocupacional-integracion-sensorial', icon: 'people', routes: ['infantil', 'educativa-organizacional'], topics: ['Habilidades socioemocionales', 'Convivencia escolar', 'Tutoría educativa'] }
    ],
    workshops: [
        { id: 'oct-01', image: 'psicoterapia-tcc', title: 'Técnicas y estrategias en la psicoterapia en niños y adolescentes' },
        { id: 'oct-02', image: 'evaluacion-psicologica-clinica', title: 'Cómo elaborar un informe clínico' },
        { id: 'oct-03', image: 'evaluacion-psicologica-clinica', title: 'Taller de pruebas psicológicas de ansiedad y depresión' },
        { id: 'oct-04', image: 'evaluacion-psicologica-clinica', title: 'Calificación e interpretación de resultados WISC-V' },
        { id: 'oct-05', image: 'tea-autismo', title: 'Pruebas psicológicas de TEA y TDAH' },
        { id: 'oct-06', image: 'psicoterapia-tcc', title: 'Elaboración de informe clínico (enfoque TCC)' },
        { id: 'oct-07', image: 'evaluacion-psicologica-clinica', title: 'Eest de MACI', sourceTitle: 'Eest de maci', note: 'Denominación por confirmar' },
        { id: 'oct-08', image: 'psicoterapia-tcc', title: 'Abordaje terapéutico de duelo y traumas en niños y adolescentes en el área clínica' },
        { id: 'oct-09', image: 'tea-autismo', title: 'Test de ADI-R' },
        { id: 'oct-10', image: 'evaluacion-psicologica-clinica', title: 'Test de EPQ-R' },
        { id: 'oct-11', image: 'neuropsicologia', title: 'DSM-5 en niños neuro diversos' },
        { id: 'oct-12', image: 'terapia-ocupacional-integracion-sensorial', title: 'Rol del psicólogo educativo' },
        { id: 'oct-13', image: 'psicoterapia-tcc', title: 'Cómo elaborar una escuela de padres en el área educativa' },
        { id: 'oct-14', image: 'terapia-ocupacional-integracion-sensorial', title: 'Plan de tutoría y orientación en instituciones educativas' },
        { id: 'oct-15', image: 'neuropsicologia', title: 'Cómo elaborar un informe conductual en niños neuro diversos' },
        { id: 'oct-16', image: 'evaluacion-psicologica-clinica', title: 'Test de WISC-V: calificación e interpretación de resultados' },
        { id: 'oct-17', image: 'neuropsicologia', title: 'Test de CUMANES' },
        { id: 'oct-18', image: 'terapia-lenguaje', title: 'Cómo elaborar sesiones de terapia de lenguaje en niños con la r', note: 'Consulta el alcance de este taller' },
        { id: 'oct-19', image: 'terapia-lenguaje', title: 'Cómo elaborar sesiones de terapia de lenguaje' },
        { id: 'oct-20', image: 'terapia-lenguaje', title: 'Cómo elaborar un cuaderno de estimulación de lenguaje' },
        { id: 'oct-21', image: 'terapia-lenguaje', title: 'Cómo elaborar un programa de intervención en terapia de lenguaje en niños de 3 a 6 años' },
        { id: 'oct-22', image: 'psicologia-organizacional', title: 'Pruebas de selección de personal' },
        { id: 'oct-23', image: 'salud-ocupacional-bienestar', title: 'Test de estrés laboral en las organizaciones' }
    ].map(workshop => ({ ...workshop, date: null, time: null, duration: null, modality: null, price: null }))
};
