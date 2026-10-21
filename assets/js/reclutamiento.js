/**
 * RECLUTAMIENTO KJA — FLUJO DE AUTOMATIZACIÓN & TEST DISC
 * Sigue la línea de comportamiento y diseño de Terapia y Cursos KJA.
 * Slider horizontal, Custom Selects integrados y carga de CV a Dirección.
 */

(function () {
  'use strict';

  // Base de preguntas DISC (12 bloques situacionales validados)
  const DISC_BATTERY = [
    {
      id: 1,
      options: [
        { trait: 'D', word: 'Decidido y directo', desc: 'Toma la iniciativa y busca resultados rápidos' },
        { trait: 'I', word: 'Entusiasta y persuasivo', desc: 'Conecta con las personas y contagia energía' },
        { trait: 'S', word: 'Paciente y constante', desc: 'Prefiere un ritmo estable y apoya al equipo' },
        { trait: 'C', word: 'Detallista y preciso', desc: 'Se enfoca en la exactitud y los protocolos' }
      ]
    },
    {
      id: 2,
      options: [
        { trait: 'D', word: 'Competitivo', desc: 'Disfruta superar metas y resolver desafíos' },
        { trait: 'I', word: 'Sociable y cálido', desc: 'Genera confianza y un ambiente de agrado' },
        { trait: 'S', word: 'Tranquilo y empático', desc: 'Escucha con atención y evita el conflicto' },
        { trait: 'C', word: 'Analítico y riguroso', desc: 'Evalúa la información antes de actuar' }
      ]
    },
    {
      id: 3,
      options: [
        { trait: 'D', word: 'Firme ante la presión', desc: 'Mantiene el control y exige soluciones' },
        { trait: 'I', word: 'Expresivo y comunicativo', desc: 'Comparte ideas y motiva a los demás' },
        { trait: 'S', word: 'Leal y cooperativo', desc: 'Cumple sus acuerdos y apoya a sus pares' },
        { trait: 'C', word: 'Metódico y cuidadoso', desc: 'Sigue las pautas paso a paso con esmero' }
      ]
    },
    {
      id: 4,
      options: [
        { trait: 'D', word: 'Orientado a objetivos', desc: 'Prioriza concluir tareas y avanzar' },
        { trait: 'I', word: 'Optimista y espontáneo', desc: 'Ve oportunidades donde otros ven problemas' },
        { trait: 'S', word: 'Sereno y reflexivo', desc: 'Brinda estabilidad en momentos tensos' },
        { trait: 'C', word: 'Disciplinado y formal', desc: 'Respeta normas institucionales y calidad' }
      ]
    },
    {
      id: 5,
      options: [
        { trait: 'D', word: 'Enérgico y audaz', desc: 'Le atraen los proyectos ambiciosos' },
        { trait: 'I', word: 'Inspirador', desc: 'Facilidad para hablar en público o en grupo' },
        { trait: 'S', word: 'Comprensivo', desc: 'Comprende el sentir de pacientes y compañeros' },
        { trait: 'C', word: 'Objetivo y lógico', desc: 'Basa sus conclusiones en evidencias comprobables' }
      ]
    },
    {
      id: 6,
      options: [
        { trait: 'D', word: 'Exigente consigo mismo', desc: 'Busca la excelencia sin conformismos' },
        { trait: 'I', word: 'Empático y alegre', desc: 'Facilita la interacción en terapia o talleres' },
        { trait: 'S', word: 'Tolerante y confiable', desc: 'Sabe guardar la calma en situaciones difíciles' },
        { trait: 'C', word: 'Organizado y estructurado', desc: 'Documenta y clasifica su trabajo con orden' }
      ]
    },
    {
      id: 7,
      options: [
        { trait: 'D', word: 'Líder resolutivo', desc: 'Guía y toma el mando si surge un imprevisto' },
        { trait: 'I', word: 'Facilitador de vínculos', desc: 'Crea redes de apoyo y compañerismo' },
        { trait: 'S', word: 'Perseverante y sereno', desc: 'Acompaña procesos terapéuticos a mediano plazo' },
        { trait: 'C', word: 'Minucioso con reportes', desc: 'No pasa por alto detalles clínicos ni formatos' }
      ]
    },
    {
      id: 8,
      options: [
        { trait: 'D', word: 'Seguro de sus criterios', desc: 'Defiende su punto de vista con argumentos' },
        { trait: 'I', word: 'Dinámico y adaptable', desc: 'Capta rápido la atención de los demás' },
        { trait: 'S', word: 'Solidario y paciente', desc: 'Ayuda desinteresadamente a sus colegas' },
        { trait: 'C', word: 'Prudente y precavido', desc: 'Revisa dos veces antes de dar por cerrada una entrega' }
      ]
    },
    {
      id: 9,
      options: [
        { trait: 'D', word: 'Enfoque en resultados', desc: 'Valora el impacto práctico de cada intervención' },
        { trait: 'I', word: 'Carismático', desc: 'Inspira confianza inmediata a consultantes' },
        { trait: 'S', word: 'Buen oyente', desc: 'Prioriza entender antes de emitir juicio' },
        { trait: 'C', word: 'Apegado a la ética', desc: 'Cumple a cabalidad el código deontológico' }
      ]
    },
    {
      id: 10,
      options: [
        { trait: 'D', word: 'Proactivo ante retrasos', desc: 'Elimina trabas y busca la vía más eficaz' },
        { trait: 'I', word: 'Creativo y propositivo', desc: 'Aporta ideas frescas para talleres y campañas' },
        { trait: 'S', word: 'Constante y fiel', desc: 'Mantiene regularidad en asistencia y tareas' },
        { trait: 'C', word: 'Sistemático y pulcro', desc: 'Mantiene impecable sus entregables e informes' }
      ]
    },
    {
      id: 11,
      options: [
        { trait: 'D', word: 'Enfrenta discrepancias', desc: 'Aclara malentendidos sin rodeos' },
        { trait: 'I', word: 'Negociador y abierto', desc: 'Busca consensos donde todos ganen' },
        { trait: 'S', word: 'Apaciguador', desc: 'Desactiva tensiones y promueve la armonía' },
        { trait: 'C', word: 'Riguroso en diagnósticos', desc: 'Aplica criterios validados científicamente' }
      ]
    },
    {
      id: 12,
      options: [
        { trait: 'D', word: 'Visionario y tenaz', desc: 'Se proyecta a crecer profesionalmente' },
        { trait: 'I', word: 'Motivador de grupos', desc: 'Promueve el compromiso colectivo' },
        { trait: 'S', word: 'Respetuoso de ritmos', desc: 'Da tiempo a los consultantes para su proceso' },
        { trait: 'C', word: 'Perfeccionista constructivo', desc: 'Eleva el estándar de calidad de su área' }
      ]
    }
  ];

  // Estado del flujo
  const state = {
    submitting: false,
    submitted: false,
    submissionId: null,
    cvFile: null,
    currentStep: 1,
    activeDiscBlock: 1,
    candidate: {
      codigo: '',
      nombres: '',
      dni: '',
      telefono: '',
      email: '',
      carrera: 'Psicología Clínica',
      nivel: 'Estudiante (Ciclos 7 a 10)',
      modalidad: 'Presencial (Sede San Luis)',
      turno: 'Mañana (08:30 - 13:30)',
      cvName: '',
      cvSize: '',
      cvType: '',
      cvDataUrl: '',
      fechaEntrevista: '',
      horaEntrevista: '09:30 AM',
      canalEntrevista: 'Google Meet / Zoom (Online)',
      motivacion: '',
      fechaPostulacion: ''
    },
    discAnswers: {},
    discScores: { D: 10, I: 10, S: 10, C: 10 },
    discPercentages: { D: 25, I: 25, S: 25, C: 25 },
    perfilResultante: {}
  };

  document.addEventListener('DOMContentLoaded', () => {
    initValidation();
    initCheckboxes();
    initCustomSelects();
    initCvUpload();
    initCustomDatePicker();
    initTimeSlots();
    renderDiscCompact();
    for (let i = 1; i <= 4; i++) {
      const panel = document.getElementById(`rec-panel-${i}`);
      if (panel) { panel.inert = i !== 1; panel.setAttribute('aria-hidden', String(i !== 1)); }
    }

    // Inicializar altura adaptativa para eliminar espacios vacíos
    setTimeout(() => adjustViewportHeight(1), 50);
    setTimeout(() => adjustViewportHeight(1), 250);

    window.addEventListener('resize', () => adjustViewportHeight(state.currentStep));

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        adjustViewportHeight(state.currentStep);
      });
      for (let i = 1; i <= 4; i++) {
        const p = document.getElementById(`rec-panel-${i}`);
        if (p) ro.observe(p);
      }
    }
  });

  // Mensajes persistentes junto al campo y resumen del paso al continuar.
  const fieldErrors = new Map();
  const attemptedSteps = new Set();
  const stepFields = {
    1: ['chk-rec-fb', 'chk-rec-horario', 'chk-rec-entrevista'],
    2: ['rec-nombres', 'rec-dni', 'rec-telefono', 'rec-email', 'rec-cv-input'],
    3: ['rec-fecha-entrevista', 'rec-correo-notificacion', 'rec-telefono-notificacion']
  };
  const fieldLabels = {
    'chk-rec-fb': 'Comparticiones diarias', 'chk-rec-horario': 'Disponibilidad de horario',
    'chk-rec-entrevista': 'CV y entrevista', 'rec-nombres': 'Nombres y apellidos',
    'rec-dni': 'DNI', 'rec-telefono': 'Teléfono / WhatsApp', 'rec-email': 'Correo electrónico',
    'rec-cv-input': 'Currículum Vitae', 'rec-fecha-entrevista': 'Fecha de entrevista',
    'rec-correo-notificacion': 'Correo de notificación', 'rec-telefono-notificacion': 'Teléfono de contacto'
  };
  function fieldControl(id) {
    const target = id === 'rec-cv-input' ? 'rec-cv-dropzone' : id === 'rec-fecha-entrevista' ? 'kja-date-trigger' : id;
    return document.getElementById(target);
  }
  function fieldMessage(id) {
    const field = document.getElementById(id);
    const value = field?.value.trim() || '';
    if (id.startsWith('chk-')) return field?.checked ? '' : 'Confirma este requisito para continuar.';
    if (id === 'rec-cv-input') return state.cvFile ? '' : 'Adjunta tu CV en PDF, DOC o DOCX, de hasta 10 MB.';
    if (id === 'rec-fecha-entrevista') return value ? '' : 'Elige una fecha disponible para tu entrevista.';
    if (!value) return {
      'rec-nombres': 'Escribe tus nombres y apellidos.', 'rec-dni': 'Ingresa los 8 dígitos de tu DNI.',
      'rec-telefono': 'Ingresa tu número de teléfono o WhatsApp.', 'rec-email': 'Ingresa tu correo electrónico.',
      'rec-correo-notificacion': 'Ingresa el correo donde recibirás la respuesta.',
      'rec-telefono-notificacion': 'Ingresa un teléfono para coordinar tu entrevista.'
    }[id];
    if (id === 'rec-dni' && !/^\d{8}$/.test(value)) return 'El DNI debe tener exactamente 8 dígitos, sin letras ni espacios.';
    if (field?.type === 'email' && (field.validity.typeMismatch || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) return 'Revisa el correo. Usa el formato nombre@correo.com.';
    if (field?.type === 'tel' && !/^\+?[\d\s().-]+$/.test(value)) return 'Usa solo números; puedes incluir +, espacios, guiones o paréntesis.';
    if (field?.type === 'tel' && !/^\d{9,15}$/.test(value.replace(/\D/g, ''))) return 'Ingresa entre 9 y 15 dígitos. Puedes incluir el código de país, por ejemplo: +51 987 654 321.';
    return '';
  }
  function setFieldError(id, message) {
    const control = fieldControl(id);
    const note = document.getElementById(`${id}-error`);
    if (!control || !note) return;
    if (message) fieldErrors.set(id, message); else fieldErrors.delete(id);
    control.setAttribute('aria-invalid', String(Boolean(message)));
    control.closest('.rec-field, .rec-check-label')?.classList.toggle('rec-has-error', Boolean(message));
    if (note.textContent !== (message || '')) note.textContent = message || '';
    note.hidden = !message;
    const step = Number(control.closest('.rec-slide-panel')?.id.replace('rec-panel-', ''));
    updateValidationSummary(step);
    adjustViewportHeight(state.currentStep);
  }
  function focusField(id) {
    const control = fieldControl(id);
    control?.focus({ preventScroll: true });
    control?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }
  function updateValidationSummary(step) {
    const summary = document.getElementById(`rec-validation-${step}`);
    if (!summary) return;
    const errors = (stepFields[step] || []).filter(id => fieldErrors.has(id));
    summary.hidden = !attemptedSteps.has(step) || !errors.length;
    summary.replaceChildren();
    if (summary.hidden) return;
    const title = document.createElement('strong');
    title.textContent = errors.length === 1 ? 'Revisa este campo para continuar' : `Revisa estos ${errors.length} campos para continuar`;
    const list = document.createElement('ul');
    errors.forEach(id => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = fieldLabels[id];
      button.addEventListener('click', () => focusField(id));
      item.append(button); list.append(item);
    });
    summary.append(title, list);
  }
  function validateFields(step) {
    attemptedSteps.add(step);
    stepFields[step].forEach(id => setFieldError(id, fieldMessage(id)));
    const first = stepFields[step].find(id => fieldErrors.has(id));
    if (first) focusField(first);
    return !first;
  }
  function initValidation() {
    Object.entries(stepFields).forEach(([step, ids]) => {
      const panel = document.getElementById(`rec-panel-${step}`);
      if (!panel) return;
      const summary = document.createElement('div');
      summary.id = `rec-validation-${step}`;
      summary.className = 'rec-validation-summary';
      summary.setAttribute('role', 'status');
      summary.setAttribute('aria-atomic', 'true');
      summary.hidden = true;
      const heading = panel.querySelector('.rec-form-heading');
      if (heading) heading.after(summary); else panel.querySelector('.rec-flow-actions')?.before(summary);
      ids.forEach(id => {
        const field = document.getElementById(id);
        const control = fieldControl(id);
        if (!field || !control) return;
        const note = document.createElement('span');
        note.id = `${id}-error`;
        note.className = 'rec-field-error';
        note.setAttribute('aria-live', 'polite');
        note.hidden = true;
        if (id.startsWith('chk-')) control.parentElement.querySelector('span')?.append(note);
        else control.closest('.rec-field')?.append(note);
        control.setAttribute('aria-describedby', [control.getAttribute('aria-describedby'), note.id].filter(Boolean).join(' '));
        if (field.type !== 'file' && field.type !== 'hidden' && field.type !== 'checkbox') {
          field.addEventListener('blur', () => setFieldError(id, fieldMessage(id)));
          field.addEventListener('input', () => {
            if (fieldErrors.has(id) || attemptedSteps.has(Number(step))) setFieldError(id, fieldMessage(id));
          });
        } else if (field.type !== 'file') field.addEventListener('change', () => {
          if (fieldErrors.has(id) || attemptedSteps.has(Number(step))) setFieldError(id, fieldMessage(id));
        });
      });
    });
  }

  // =========================================================================
  // CONTROL DE VENTANAS HORIZONTALES (SLIDER CON ALTURA ADAPTATIVA)
  // =========================================================================
  function adjustViewportHeight(stepNumber) {
    const step = stepNumber || state.currentStep;
    const viewport = document.querySelector('.rec-slider-viewport');
    const activePanel = document.getElementById(`rec-panel-${step}`);

    if (viewport && activePanel) {
      const panelHeight = activePanel.offsetHeight;
      if (panelHeight > 0) {
        viewport.style.height = `${panelHeight + 8}px`;
      }
    }
  }

  window.switchRecStep = function (stepNumber) {
    if (stepNumber < 1 || stepNumber > 4) return;
    if (stepNumber === 4 && !state.submitted) return;
    if (state.submitting || (state.submitted && stepNumber !== 4)) return;
    state.currentStep = stepNumber;

    // Deslizar el riel horizontal
    const track = document.getElementById('rec-slider-track');
    if (track) {
      const offset = (stepNumber - 1) * 100;
      track.style.transform = `translateX(-${offset}%)`;
    }

    // Actualizar paneles activos
    for (let i = 1; i <= 4; i++) {
      const panel = document.getElementById(`rec-panel-${i}`);
      if (panel) {
        panel.classList.toggle('active', i === stepNumber);
        panel.inert = i !== stepNumber;
        panel.setAttribute('aria-hidden', String(i !== stepNumber));
      }
    }

    // Ajustar altura del viewport al tamaño exacto del panel (elimina espacios vacíos)
    adjustViewportHeight(stepNumber);
    setTimeout(() => adjustViewportHeight(stepNumber), 400);

    // Actualizar tabs estilo Terapia
    for (let i = 1; i <= 4; i++) {
      const tab = document.getElementById(`rec-tab-${i}`);
      if (tab) {
        tab.classList.toggle('active', i === stepNumber);
        tab.classList.toggle('completed', i < stepNumber);
        tab.setAttribute('aria-selected', String(i === stepNumber));
      }
    }

    // Scroll suave a la cabecera del slider (sin scroll vertical infinito)
    const tabsWrapper = document.getElementById('rec-tabs-wrapper');
    if (tabsWrapper) {
      tabsWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // =========================================================================
  // CUSTOM DROPDOWNS INTEGRADOS (ACOMODADOS DIRECTO EN EL INPUT)
  // =========================================================================
  function initCustomSelects() {
    const selects = document.querySelectorAll('.kja-custom-select');

    selects.forEach(selectEl => {
      const trigger = selectEl.querySelector('.kja-select-trigger');
      const label = selectEl.querySelector('.kja-select-value');
      const hiddenInput = selectEl.querySelector('input[type="hidden"]');
      const options = selectEl.querySelectorAll('.kja-select-option');

      if (!trigger || !hiddenInput) return;

      // Toggle apertura del menú anclado
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = selectEl.classList.contains('is-open');
        closeAllCustomSelects();
        if (!isOpen) {
          selectEl.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });

      // Selección de opción
      options.forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = opt.dataset.value || opt.textContent.trim();
          hiddenInput.value = val;
          if (label) label.textContent = val;

          options.forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');

          selectEl.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');

          // Disparar evento change en el input oculto
          hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
    });

    // Cerrar al hacer clic fuera
    document.addEventListener('click', () => {
      closeAllCustomSelects();
    });

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllCustomSelects();
      }
    });
  }

  function closeAllCustomSelects() {
    document.querySelectorAll('.kja-custom-select.is-open').forEach(el => {
      el.classList.remove('is-open');
      const trigger = el.querySelector('.kja-select-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  }

  // =========================================================================
  // MÓDULO DE ADJUNTAR CV / CURRÍCULUM VITAE
  // =========================================================================
  function initCvUpload() {
    const dropzone = document.getElementById('rec-cv-dropzone');
    const fileInput = document.getElementById('rec-cv-input');
    const emptyView = document.getElementById('rec-cv-empty');
    const loadedView = document.getElementById('rec-cv-loaded');
    const filenameEl = document.getElementById('rec-cv-filename');
    const filesizeEl = document.getElementById('rec-cv-filesize');

    if (!dropzone || !fileInput) return;

    // Clic en la zona activa el input file
    dropzone.addEventListener('click', (e) => {
      if (e.target.closest('.rec-cv-actions') || e.target.closest('button')) return;
      fileInput.click();
    });

    dropzone.addEventListener('keydown', (event) => {
      if (event.target === dropzone && ['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        fileInput.click();
      }
    });

    // Drag and Drop
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleCvFile(files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleCvFile(fileInput.files[0]);
      }
    });
  }

  function handleCvFile(file) {
    if (!file) return;

    // Validación de formato
    const validExtensions = ['.pdf', '.doc', '.docx'];
    const fileName = file.name.toLowerCase();
    const isValidFormat = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidFormat) {
      setFieldError('rec-cv-input', 'Este formato no está admitido. Elige un archivo PDF, DOC o DOCX.');
      document.getElementById('rec-cv-input').value = '';
      return;
    }

    // Validación de tamaño (máximo 10 MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setFieldError('rec-cv-input', 'El archivo supera los 10 MB. Comprime el documento o elige uno más pequeño.');
      document.getElementById('rec-cv-input').value = '';
      return;
    }

    if (!file.size) {
      setFieldError('rec-cv-input', 'El archivo está vacío. Elige un documento que contenga tu CV.');
      document.getElementById('rec-cv-input').value = '';
      return;
    }

    // Formatear peso
    const sizeKB = Math.round(file.size / 1024);
    const formattedSize = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

    state.candidate.cvName = file.name;
    state.candidate.cvSize = formattedSize;
    state.candidate.cvType = file.type || 'application/pdf';

    // El archivo permanece en memoria hasta el envío confirmado por el servidor.
    state.cvFile = file;
    setFieldError('rec-cv-input', '');

    // Actualizar vista previa
    const emptyView = document.getElementById('rec-cv-empty');
    const loadedView = document.getElementById('rec-cv-loaded');
    const filenameEl = document.getElementById('rec-cv-filename');
    const filesizeEl = document.getElementById('rec-cv-filesize');

    if (filenameEl) filenameEl.textContent = file.name;
    if (filesizeEl) filesizeEl.textContent = `${formattedSize} · Documento listo`;
    if (emptyView) emptyView.style.display = 'none';
    if (loadedView) loadedView.style.display = 'flex';

    adjustViewportHeight(state.currentStep);
  }

  window.removeCvFile = function (e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    state.candidate.cvName = '';
    state.candidate.cvSize = '';
    state.candidate.cvType = '';
    state.candidate.cvDataUrl = '';
    state.cvFile = null;
    setFieldError('rec-cv-input', fieldMessage('rec-cv-input'));

    const fileInput = document.getElementById('rec-cv-input');
    if (fileInput) fileInput.value = '';

    const emptyView = document.getElementById('rec-cv-empty');
    const loadedView = document.getElementById('rec-cv-loaded');
    if (emptyView) emptyView.style.display = 'flex';
    if (loadedView) loadedView.style.display = 'none';

    adjustViewportHeight(state.currentStep);
  };

  // =========================================================================
  // VALIDACIÓN DE PASO 1 (REQUISITOS DEL FLYER)
  // =========================================================================
  function initCheckboxes() {
    const chk1 = document.getElementById('chk-rec-fb');
    const chk2 = document.getElementById('chk-rec-horario');
    const chk3 = document.getElementById('chk-rec-entrevista') || document.getElementById('chk-rec-disc');
    const btnNext = document.getElementById('rec-btn-p1-next');

    const checkAll = () => {
      const valid = chk1 && chk2 && chk3 && chk1.checked && chk2.checked && chk3.checked;
      if (btnNext) btnNext.disabled = !valid;
    };

    [chk1, chk2, chk3].forEach(chk => {
      if (chk) chk.addEventListener('change', checkAll);
    });
  }

  window.validateStep1AndNext = function () {
    const chk1 = document.getElementById('chk-rec-fb');
    const chk2 = document.getElementById('chk-rec-horario');
    const chk3 = document.getElementById('chk-rec-entrevista') || document.getElementById('chk-rec-disc');

    if (!chk1?.checked || !chk2?.checked || !chk3?.checked) {
      validateFields(1);
      return;
    }
    window.switchRecStep(2);
  };

  // =========================================================================
  // VALIDACIÓN DE PASO 2 (DATOS PERSONALES & CV ADJUNTO)
  // =========================================================================
  window.validateStep2AndNext = function () {
    const nombres = document.getElementById('rec-nombres')?.value.trim();
    const dni = document.getElementById('rec-dni')?.value.trim();
    const telefono = document.getElementById('rec-telefono')?.value.trim();
    const email = document.getElementById('rec-email')?.value.trim();

    if (!validateFields(2)) return;

    // Asignar datos del postulante
    state.candidate.nombres = nombres;
    state.candidate.dni = dni;
    state.candidate.telefono = telefono;
    state.candidate.email = email;
    state.candidate.carrera = document.getElementById('rec-carrera')?.value || 'Psicología Clínica';
    state.candidate.nivel = document.getElementById('rec-nivel')?.value || 'Estudiante (Ciclos 7 a 10)';
    state.candidate.modalidad = document.getElementById('rec-modalidad-sel')?.value || 'Presencial (Sede San Luis)';
    state.candidate.turno = document.getElementById('rec-turno-sel')?.value || 'Mañana (08:30 - 13:30)';
    state.candidate.motivacion = document.getElementById('rec-motivacion')?.value || '';

    // Pre-llenar correo y teléfono de notificación en Paso 3 si no han sido ingresados
    const notifEmail = document.getElementById('rec-correo-notificacion');
    if (notifEmail && !notifEmail.value) {
      notifEmail.value = email;
    }
    const notifTel = document.getElementById('rec-telefono-notificacion');
    if (notifTel && !notifTel.value) {
      notifTel.value = telefono;
    }

    // Avanzar a Paso 3 (Agendar Entrevista)
    window.switchRecStep(3);
  };

  // =========================================================================
  // CALENDARIO CUSTOMIZADO KJA & TURNOS (100% INTEGRADO DENTRO DE LA TARJETA)
  // Evita que el calendario nativo del navegador se abra fuera de la pestaña
  // =========================================================================
  const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const WEEKDAY_NAMES = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
  ];
  const WEEKDAY_SHORT = [
    'Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'
  ];

  const calState = {
    viewYear: 2026,
    viewMonth: 9,
    selectedDate: null
  };

  function formatIsoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatFriendlyDate(d) {
    const dayName = WEEKDAY_NAMES[d.getDay()];
    const dayNum = d.getDate();
    const monthName = MONTH_NAMES[d.getMonth()];
    const year = d.getFullYear();
    return `${dayName}, ${dayNum} de ${monthName} de ${year}`;
  }

  function getTomorrowDate() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  function initCustomDatePicker() {
    const wrap = document.getElementById('kja-datepicker-wrap');
    const trigger = document.getElementById('kja-date-trigger');
    const popover = document.getElementById('kja-datepicker-popover');
    const btnPrevMonth = document.getElementById('kja-cal-prev-month');
    const btnNextMonth = document.getElementById('kja-cal-next-month');
    const btnTomorrow = document.getElementById('kja-cal-btn-tomorrow');
    const btnClose = document.getElementById('kja-cal-btn-close');

    if (!wrap || !trigger || !popover) return;

    // Fecha inicial: Mañana (o siguiente día hábil)
    const initialDate = getTomorrowDate();
    calState.selectedDate = new Date(initialDate);
    calState.viewYear = initialDate.getFullYear();
    calState.viewMonth = initialDate.getMonth();

    // Establecer fecha por defecto
    applySelectedDate(initialDate);

    // Renderizar pastillas de acceso rápido
    renderQuickDates();

    // Toggle popover calendario
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = wrap.classList.contains('is-open');
      closeAllCustomSelects();
      if (isOpen) {
        closeDatePicker();
      } else {
        openDatePicker();
      }
    });

    // Navegación de mes anterior / siguiente
    if (btnPrevMonth) {
      btnPrevMonth.addEventListener('click', (e) => {
        e.stopPropagation();
        calState.viewMonth--;
        if (calState.viewMonth < 0) {
          calState.viewMonth = 11;
          calState.viewYear--;
        }
        renderCalendarGrid();
      });
    }

    if (btnNextMonth) {
      btnNextMonth.addEventListener('click', (e) => {
        e.stopPropagation();
        calState.viewMonth++;
        if (calState.viewMonth > 11) {
          calState.viewMonth = 0;
          calState.viewYear++;
        }
        renderCalendarGrid();
      });
    }

    if (btnTomorrow) {
      btnTomorrow.addEventListener('click', (e) => {
        e.stopPropagation();
        const tomorrow = getTomorrowDate();
        calState.viewYear = tomorrow.getFullYear();
        calState.viewMonth = tomorrow.getMonth();
        applySelectedDate(tomorrow);
        closeDatePicker();
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDatePicker();
      });
    }

    // Cerrar al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#kja-datepicker-wrap')) {
        closeDatePicker();
      }
    });

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDatePicker();
      }
    });
  }

  function openDatePicker() {
    const wrap = document.getElementById('kja-datepicker-wrap');
    const trigger = document.getElementById('kja-date-trigger');
    if (!wrap) return;

    if (calState.selectedDate) {
      calState.viewYear = calState.selectedDate.getFullYear();
      calState.viewMonth = calState.selectedDate.getMonth();
    }
    renderCalendarGrid();
    wrap.classList.add('is-open');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
  }

  function closeDatePicker() {
    const wrap = document.getElementById('kja-datepicker-wrap');
    const trigger = document.getElementById('kja-date-trigger');
    if (wrap) wrap.classList.remove('is-open');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function applySelectedDate(dateObj) {
    calState.selectedDate = new Date(dateObj);

    const iso = formatIsoDate(dateObj);
    const friendly = formatFriendlyDate(dateObj);

    const hiddenInput = document.getElementById('rec-fecha-entrevista');
    const textEl = document.getElementById('kja-date-text');
    const badgeEl = document.getElementById('kja-date-badge');

    if (hiddenInput) {
      hiddenInput.value = iso;
      hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (textEl) textEl.textContent = friendly;

    // Badge contextual (Mañana / Próxima semana / Fecha elegida)
    const tomorrow = getTomorrowDate();
    if (badgeEl) {
      if (formatIsoDate(dateObj) === formatIsoDate(tomorrow)) {
        badgeEl.textContent = 'Mañana';
      } else {
        badgeEl.textContent = `${WEEKDAY_SHORT[dateObj.getDay()]} ${dateObj.getDate()}`;
      }
    }

    state.candidate.fechaEntrevista = friendly;

    // Actualizar estado activo en las pastillas de acceso rápido
    updateQuickPillsActiveState(iso);
  }

  function renderQuickDates() {
    const container = document.getElementById('kja-quick-dates');
    if (!container) return;

    // Generar las próximas 4 fechas hábiles a partir de mañana
    const dates = [];
    let cur = new Date();
    cur.setHours(0, 0, 0, 0);
    cur.setDate(cur.getDate() + 1);

    while (dates.length < 4) {
      if (cur.getDay() !== 0) {
        dates.push(new Date(cur));
      }
      cur.setDate(cur.getDate() + 1);
    }

    const tomorrow = getTomorrowDate();
    let html = '';

    dates.forEach((d, idx) => {
      const iso = formatIsoDate(d);
      const isTomorrow = formatIsoDate(d) === formatIsoDate(tomorrow);
      const label = isTomorrow
        ? `Mañana (${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()})`
        : `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;

      const isActive = calState.selectedDate && formatIsoDate(calState.selectedDate) === iso;

      html += `
        <button type="button"
          class="kja-quick-date-btn ${isActive ? 'active' : ''}"
          data-iso="${iso}"
          data-label="${label}">
          ${label}
        </button>
      `;
    });

    container.innerHTML = html;

    // Listeners para las pastillas rápidas
    container.querySelectorAll('.kja-quick-date-btn').forEach((btn, idx) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetDate = dates[idx];
        applySelectedDate(targetDate);
        closeDatePicker();
      });
    });
  }

  function updateQuickPillsActiveState(selectedIso) {
    const container = document.getElementById('kja-quick-dates');
    if (!container) return;
    container.querySelectorAll('.kja-quick-date-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.iso === selectedIso);
    });
  }

  function renderCalendarGrid() {
    const monthTitle = document.getElementById('kja-cal-month-title');
    const daysGrid = document.getElementById('kja-cal-days-grid');
    const btnPrev = document.getElementById('kja-cal-prev-month');

    if (!daysGrid || !monthTitle) return;

    const year = calState.viewYear;
    const month = calState.viewMonth;

    monthTitle.textContent = `${MONTH_NAMES[month]} ${year}`;

    // Deshabilitar botón prev si el mes ya pasó
    const now = new Date();
    const isCurrentOrPastMonth = year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth());
    if (btnPrev) btnPrev.disabled = isCurrentOrPastMonth;

    // Primer día del mes y número de días
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    // Offset para empezar la semana en Lunes (0: Lu, 1: Ma, ... 6: Do)
    let startDayOffset = (firstDay.getDay() + 6) % 7;

    let html = '';

    // Huecos vacíos previos al 1er día
    for (let i = 0; i < startDayOffset; i++) {
      html += `<div class="kja-cal-day empty" aria-hidden="true"></div>`;
    }

    const todayAtMidnight = new Date();
    todayAtMidnight.setHours(0, 0, 0, 0);

    for (let day = 1; day <= totalDays; day++) {
      const thisDate = new Date(year, month, day);
      thisDate.setHours(0, 0, 0, 0);

      const isPast = thisDate <= todayAtMidnight;
      const isSunday = thisDate.getDay() === 0;
      const isDisabled = isPast || isSunday;

      const isSelected = calState.selectedDate && formatIsoDate(thisDate) === formatIsoDate(calState.selectedDate);
      const isToday = formatIsoDate(thisDate) === formatIsoDate(todayAtMidnight);

      let classes = 'kja-cal-day';
      if (isSelected) classes += ' selected';
      if (isToday) classes += ' today';

      html += `
        <button type="button"
          class="${classes}"
          data-day="${day}"
          ${isDisabled ? 'disabled' : ''}
          aria-label="${day} de ${MONTH_NAMES[month]} de ${year}">
          ${day}
        </button>
      `;
    }

    daysGrid.innerHTML = html;

    // Listeners en cada día hábil
    daysGrid.querySelectorAll('.kja-cal-day:not(:disabled):not(.empty)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = Number(btn.dataset.day);
        const picked = new Date(year, month, d);
        applySelectedDate(picked);
        closeDatePicker();
      });
    });
  }

  function initTimeSlots() {
    const slotContainer = document.getElementById('rec-slot-container');
    if (!slotContainer) return;

    slotContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.rec-slot-btn');
      if (!btn) return;
      slotContainer.querySelectorAll('.rec-slot-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.candidate.horaEntrevista = btn.dataset.time;
    });
  }

  // =========================================================================
  // TEST DISC COMPACTO (CERO SCROLL MASIVO CON NAVEGADOR DE 12 BLOQUES)
  // =========================================================================
  function renderDiscCompact() {
    renderDiscPills();
    renderActiveDiscBlock();
  }

  function renderDiscPills() {
    const container = document.getElementById('rec-disc-pills-row');
    if (!container) return;

    let html = '';
    DISC_BATTERY.forEach((item, idx) => {
      const bNum = idx + 1;
      const isAns = state.discAnswers[bNum]?.mas && state.discAnswers[bNum]?.menos;
      const isActive = bNum === state.activeDiscBlock;

      html += `
        <button type="button"
          class="rec-disc-block-num ${isActive ? 'active' : ''} ${isAns ? 'completed' : ''}"
          onclick="window.selectDiscBlock(${bNum})"
          aria-label="Ir al bloque ${bNum}">
          ${bNum}
        </button>
      `;
    });

    container.innerHTML = html;
  }

  function renderActiveDiscBlock() {
    const block = DISC_BATTERY.find(b => b.id === state.activeDiscBlock);
    const container = document.getElementById('rec-disc-active-card');
    const titleEl = document.getElementById('rec-disc-current-title');
    const progressEl = document.getElementById('rec-disc-progress-counter');

    if (!block || !container) return;

    if (titleEl) {
      titleEl.textContent = `Bloque ${block.id} de ${DISC_BATTERY.length}`;
    }

    // Contador de progreso
    let completed = 0;
    for (let i = 1; i <= DISC_BATTERY.length; i++) {
      if (state.discAnswers[i]?.mas && state.discAnswers[i]?.menos) {
        completed++;
      }
    }
    if (progressEl) {
      progressEl.textContent = `${completed} de 12 bloques completados`;
    }

    const currentAns = state.discAnswers[block.id] || {};

    let html = `
      <div class="rec-disc-row" style="font-size:0.75rem;font-weight:800;color:#9ca3af;text-transform:uppercase;border-bottom:1.5px solid #f3f4f6;padding-bottom:6px;">
        <span>Rasgo Conductual</span>
        <span style="text-align:center;">MÁS (+)</span>
        <span style="text-align:center;">MENOS (-)</span>
      </div>
    `;

    block.options.forEach(opt => {
      const isMas = currentAns.mas === opt.trait;
      const isMenos = currentAns.menos === opt.trait;

      html += `
        <div class="rec-disc-row">
          <div class="rec-disc-desc">
            <strong>${opt.word}</strong>
            <small>${opt.desc}</small>
          </div>
          <label class="rec-choice-label">
            <input type="radio"
              name="disc_mas_${block.id}"
              value="${opt.trait}"
              data-qid="${block.id}"
              data-type="mas"
              ${isMas ? 'checked' : ''}>
          </label>
          <label class="rec-choice-label">
            <input type="radio"
              name="disc_menos_${block.id}"
              value="${opt.trait}"
              data-qid="${block.id}"
              data-type="menos"
              ${isMenos ? 'checked' : ''}>
          </label>
        </div>
      `;
    });

    // Botones de navegación previa / siguiente
    const isFirst = block.id === 1;
    const isLast = block.id === DISC_BATTERY.length;

    html += `
      <div class="rec-disc-inner-nav">
        <button type="button" class="rec-disc-nav-btn" onclick="window.prevDiscBlock()" ${isFirst ? 'disabled' : ''}>
          ← Bloque anterior
        </button>
        <button type="button" class="rec-disc-nav-btn" onclick="window.nextDiscBlock()" ${isLast ? 'disabled' : ''}>
          Siguiente bloque →
        </button>
      </div>
    `;

    container.innerHTML = html;

    // Listener para selección de opciones
    container.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const qid = Number(e.target.dataset.qid);
        const type = e.target.dataset.type;
        const trait = e.target.value;
        const oppositeType = type === 'mas' ? 'menos' : 'mas';

        if (!state.discAnswers[qid]) state.discAnswers[qid] = {};

        // Si la misma cualidad estaba seleccionada en el lado opuesto, desmarcar
        if (state.discAnswers[qid][oppositeType] === trait) {
          delete state.discAnswers[qid][oppositeType];
          const oppRadio = container.querySelector(`input[name="disc_${oppositeType}_${qid}"][value="${trait}"]`);
          if (oppRadio) oppRadio.checked = false;
        }

        state.discAnswers[qid][type] = trait;
        renderDiscPills();

        // Si ambos están contestados en este bloque y no es el último, avanzar suavemente tras breve pausa
        if (state.discAnswers[qid].mas && state.discAnswers[qid].menos) {
          if (qid < DISC_BATTERY.length) {
            setTimeout(() => {
              if (state.activeDiscBlock === qid) {
                window.selectDiscBlock(qid + 1);
              }
            }, 320);
          }
        }
      });
    });
  }

  window.selectDiscBlock = function (blockNum) {
    if (blockNum < 1 || blockNum > DISC_BATTERY.length) return;
    state.activeDiscBlock = blockNum;
    renderDiscCompact();
  };

  window.prevDiscBlock = function () {
    if (state.activeDiscBlock > 1) {
      window.selectDiscBlock(state.activeDiscBlock - 1);
    }
  };

  window.nextDiscBlock = function () {
    if (state.activeDiscBlock < DISC_BATTERY.length) {
      window.selectDiscBlock(state.activeDiscBlock + 1);
    }
  };

  // =========================================================================
  // VALIDACIÓN DE PASO 3: AGENDAMIENTO DE ENTREVISTA & CORREO DE NOTIFICACIÓN
  // =========================================================================
  window.validateStep3AndNext = async function () {
    if (state.submitting || state.submitted) return;
    // Tomar fecha de la cita (o fallback de fecha seleccionada)
    const fechaInput = document.getElementById('rec-fecha-entrevista')?.value;
    if (!state.candidate.fechaEntrevista && fechaInput) {
      state.candidate.fechaEntrevista = document.getElementById('kja-date-text')?.textContent || fechaInput;
    }

    if (!validateFields(3)) return;

    // Tomar hora seleccionada en las pastillas de horario
    const activeSlot = document.querySelector('.rec-slot-btn.active');
    if (activeSlot && activeSlot.dataset.time) {
      state.candidate.horaEntrevista = activeSlot.dataset.time;
    }

    // Tomar canal de la entrevista del selector institucional
    state.candidate.canalEntrevista = document.getElementById('rec-canal-entrevista')?.value || 'Google Meet / Zoom (Reunión Virtual)';

    // Validar correo de notificación de aprobación
    const notifEmail = document.getElementById('rec-correo-notificacion')?.value.trim();
    state.candidate.emailNotificacion = notifEmail;

    // Teléfono de contacto para coordinación
    const notifTel = document.getElementById('rec-telefono-notificacion')?.value.trim();
    state.candidate.telefonoNotificacion = notifTel || state.candidate.telefono;

    // Notas o requerimientos especiales
    state.candidate.notasEntrevista = document.getElementById('rec-notas-entrevista')?.value.trim() || '';

    for (const step of [1, 2]) {
      if (stepFields[step].some(id => fieldMessage(id))) {
        window.switchRecStep(step);
        validateFields(step);
        return;
      }
    }
    // Actualizar también los datos cuando se accedió directamente desde las pestañas.
    for (const key of ['nombres', 'dni', 'telefono', 'email', 'carrera', 'nivel', 'motivacion']) {
      state.candidate[key] = document.getElementById(`rec-${key}`)?.value.trim() || '';
    }
    state.candidate.modalidad = document.getElementById('rec-modalidad-sel')?.value || '';
    state.candidate.turno = document.getElementById('rec-turno-sel')?.value || '';

    const errorEl = document.getElementById('rec-submit-error');
    const button = document.getElementById('rec-btn-p3-next');
    const labels = button?.innerHTML;
    try {
      if (!state.cvFile || !state.candidate.nombres) throw new Error('Completa tus datos y adjunta el CV antes de enviar.');
      if (!['chk-rec-fb','chk-rec-horario','chk-rec-entrevista'].every(id => document.getElementById(id)?.checked)) throw new Error('Acepta los requisitos del primer paso antes de enviar.');
      const dateISO = document.getElementById('rec-fecha-entrevista')?.value;
      if (!dateISO) throw new Error('Selecciona una fecha para tu entrevista.');
      if (!state.submissionId) {
        try { state.submissionId = sessionStorage.getItem('kja-rec-pending-id'); } catch (_) {}
        state.submissionId ||= crypto.randomUUID();
        try { sessionStorage.setItem('kja-rec-pending-id', state.submissionId); } catch (_) {}
      }
      const c = state.candidate;
      const datos = {};
      for (const key of ['nombres','dni','telefono','email','emailNotificacion','telefonoNotificacion','carrera','nivel','modalidad','turno','motivacion','notasEntrevista','cvName']) datos[key] = c[key] || '';
      Object.assign(datos, { entrevistaFecha: dateISO, entrevistaHora: c.horaEntrevista, entrevistaCanal: c.canalEntrevista, requisitosAceptados: true });
      state.submitting = true;
      if (errorEl) errorEl.hidden = true;
      if (button) { button.disabled = true; button.textContent = 'Enviando solicitud y CV…'; }
      document.getElementById('rec-panel-3')?.setAttribute('aria-busy', 'true');
      if (document.getElementById('rec-panel-3')) document.getElementById('rec-panel-3').inert = true;
      const receipt = await window.KJARecruitmentAPI.submit(state.submissionId, datos, state.cvFile);
      if (!receipt?.codigo || !receipt?.created_at) throw new Error('El servidor no confirmó el registro. Reintenta el envío.');
      c.codigo = receipt.codigo;
      c.fechaPostulacion = new Date(receipt.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'medium', timeStyle: 'short' });
      state.submitted = true;
      try { sessionStorage.removeItem('kja-rec-pending-id'); } catch (_) {}
      renderFinalResults();
      state.submitting = false;
      window.switchRecStep(4);
      const heading = document.getElementById('rec-receipt-title');
      heading?.setAttribute('tabindex','-1');
      heading?.focus({ preventScroll: true });
    } catch (error) {
      if (errorEl) { errorEl.textContent = window.KJARecruitmentAPI?.message(error) || error.message; errorEl.hidden = false; errorEl.setAttribute('tabindex', '-1'); }
    } finally {
      state.submitting = false;
      if (button) { button.disabled = state.submitted; button.innerHTML = labels; }
      document.getElementById('rec-panel-3')?.removeAttribute('aria-busy');
      if (document.getElementById('rec-panel-3')) document.getElementById('rec-panel-3').inert = state.currentStep !== 3;
      adjustViewportHeight(state.currentStep);
      if (errorEl && !errorEl.hidden) {
        errorEl.focus({ preventScroll: true });
        errorEl.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
    }
  };

  function calculateDisc() {
    // Helper mantenido por compatibilidad
    return;
  }

  function renderFinalResults() {
    const c = state.candidate;

    // Nombre en encabezado
    const elNombre = document.getElementById('rec-res-nombre');
    if (elNombre) elNombre.textContent = c.nombres;

    // Código de postulación
    const elCodigo = document.getElementById('rec-res-codigo');
    if (elCodigo) elCodigo.textContent = c.codigo;

    // Tarjeta 1: Cita agendada
    const elCitaFecha = document.getElementById('rec-res-cita-fecha');
    if (elCitaFecha) elCitaFecha.textContent = c.fechaEntrevista || 'Por coordinar';

    const elCitaHora = document.getElementById('rec-res-cita-hora');
    if (elCitaHora) elCitaHora.textContent = c.horaEntrevista || '09:30 AM';

    const elCitaCanal = document.getElementById('rec-res-cita-canal');
    if (elCitaCanal) elCitaCanal.textContent = c.canalEntrevista || 'Virtual';

    // Correo registrado para notificación formal
    const elCorreoNotif = document.getElementById('rec-res-correo-notif');
    if (elCorreoNotif) elCorreoNotif.textContent = c.emailNotificacion || c.email;

    // Tarjeta 2: Resumen completo del expediente
    const elPostulanteFull = document.getElementById('rec-res-postulante-full');
    if (elPostulanteFull) elPostulanteFull.textContent = c.nombres;

    const elDni = document.getElementById('rec-res-dni');
    if (elDni) elDni.textContent = c.dni;

    const elContacto = document.getElementById('rec-res-contacto');
    if (elContacto) elContacto.textContent = `${c.telefonoNotificacion || c.telefono} · ${c.emailNotificacion || c.email}`;

    const elCarrera = document.getElementById('rec-res-carrera');
    if (elCarrera) elCarrera.textContent = `${c.carrera} (${c.nivel})`;

    const elMod = document.getElementById('rec-res-modalidad');
    if (elMod) elMod.textContent = c.modalidad;

    const elTurno = document.getElementById('rec-res-turno');
    if (elTurno) elTurno.textContent = c.turno;

    const elCvName = document.getElementById('rec-res-cv');
    if (elCvName) {
      elCvName.textContent = c.cvName ? `${c.cvName} (${c.cvSize})` : 'Currículum adjuntado';
    }

    const elFechaEnvio = document.getElementById('rec-res-fecha-envio');
    if (elFechaEnvio) elFechaEnvio.textContent = c.fechaPostulacion;

    const printButton = document.getElementById('rec-btn-print');
    if (printButton) printButton.onclick = () => window.print();

    // Botón oficial de WhatsApp a Dirección / Administración
    const waBtn = document.getElementById('rec-btn-whatsapp-confirm');
    if (waBtn) {
      const msg = `Hola, registré mi postulación en KJA.\nCódigo: ${c.codigo}\nPostulante: ${c.nombres}\nEntrevista solicitada: ${c.fechaEntrevista}, ${c.horaEntrevista}.\nQuisiera coordinar la confirmación de la entrevista.`;
      waBtn.href = `https://wa.me/51922996170?text=${encodeURIComponent(msg)}`;
    }

    adjustViewportHeight(4);
  }

  // Modales
  window.openFlyerModal = function () {
    const modal = document.getElementById('flyer-modal');
    if (modal) modal.style.display = 'flex';
  };

  window.closeFlyerModal = function () {
    const modal = document.getElementById('flyer-modal');
    if (modal) modal.style.display = 'none';
  };

  window.openVideoModal = function () {
    const modal = document.getElementById('video-modal');
    if (modal) modal.style.display = 'flex';
  };

  window.closeVideoModal = function () {
    const modal = document.getElementById('video-modal');
    if (modal) modal.style.display = 'none';
  };

  window.openPreviewModal = function (src, title, subtitle) {
    const modal = document.getElementById('preview-modal');
    const img = document.getElementById('preview-modal-img');
    const t = document.getElementById('preview-modal-title');
    const sub = document.getElementById('preview-modal-subtitle');
    if (img && src) img.src = src;
    if (t && title) t.textContent = title;
    if (sub && subtitle) sub.textContent = subtitle;
    if (modal) modal.style.display = 'flex';
  };

  window.closePreviewModal = function () {
    const modal = document.getElementById('preview-modal');
    if (modal) modal.style.display = 'none';
  };

  // Cierre de modales con Escape y clic fuera
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeFlyerModal();
      window.closeVideoModal();
      window.closePreviewModal();
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('therapy-modal')) {
      window.closeFlyerModal();
      window.closeVideoModal();
      window.closePreviewModal();
    }
  });

})();

// Keep the published light header readable over the application and employer sections.
(() => {
  const header = document.querySelector('.kja-page > header');
  if (!header) return;
  const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 60);
  window.addEventListener('scroll', updateHeader, { passive: true });
  window.addEventListener('pageshow', updateHeader);
  updateHeader();
})();
