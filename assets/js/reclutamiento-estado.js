(function () {
  'use strict';
  const dialog = document.getElementById('rec-status-dialog');
  if (!dialog) return;
  const form = document.getElementById('rec-status-form');
  const input = document.getElementById('rec-status-dni');
  const button = form.querySelector('button');
  const error = document.getElementById('rec-status-error');
  const feedback = document.getElementById('rec-status-feedback');
  const result = document.getElementById('rec-status-result');
  const loading = document.getElementById('rec-status-loading');
  const waitMessage = document.getElementById('rec-status-wait-message');
  let waitTimer;
  const stopWaiting = () => {
    clearTimeout(waitTimer);
    waitTimer = undefined;
    loading.hidden = true;
  };
  const companion = dialog.querySelector('[data-companion-state]');
  const companionMessage = document.getElementById('rec-mascot-message');
  const companionState = (state, message) => {
    companion.dataset.companionState = state;
    companionMessage.textContent = message;
  };
  let requestVersion = 0;
  let opener;
  const reset = () => {
    requestVersion++;
    stopWaiting();
    form.reset();
    input.readOnly = false;
    input.removeAttribute('aria-invalid');
    button.disabled = false;
    button.textContent = 'Consultar estado';
    form.removeAttribute('aria-busy');
    error.textContent = '';
    feedback.textContent = '';
    result.hidden = true;
    delete dialog.dataset.view;
    delete result.dataset.status;
    companionState('idle', 'Vamos paso a paso.');
    companion.style.removeProperty('--rec-eye-x');
    result.querySelectorAll('strong,dd,#rec-status-description').forEach(node => { node.textContent = ''; });
  };
  const open = trigger => {
    if (dialog.open) return;
    opener = trigger;
    reset();
    dialog.showModal();
    document.documentElement.classList.add('rec-status-open');
    dialog.scrollTop = 0;
    input.focus();
  };
  document.querySelectorAll('[data-rec-status-open]').forEach(trigger => {
    trigger.addEventListener('click', () => open(trigger));
  });
  dialog.querySelector('.rec-status-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    reset();
    document.documentElement.classList.remove('rec-status-open');
    if (window.location.hash === '#estado-postulacion') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    opener?.focus({ preventScroll: true });
  });
  const descriptions = {
    'Pendiente': 'Recibimos tu postulación. Está pendiente de revisión por nuestro equipo.',
    'En revisión': 'Nuestro equipo está revisando tu postulación.',
    'Entrevista': 'Tu postulación está en la etapa de entrevista. Revisa los canales de contacto que registraste para coordinar con el equipo.',
    'Aprobado': 'Tu postulación fue aprobada. El equipo coordinará contigo los siguientes pasos mediante los canales que registraste.',
    'No seleccionado': 'Tu postulación no fue seleccionada en este proceso. Gracias por tu interés en formar parte de KJA.'
  };
  const date = value => {
    const parsed = new Date(value);
    return value && !Number.isNaN(parsed.getTime())
      ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'America/Lima' }).format(parsed)
      : 'No disponible';
  };
  const followUp = {
    'Pendiente': ['pending', '¿Qué sigue?', 'Nuestro equipo debe revisar tu postulación. Puedes volver a consultar aquí para conocer cualquier cambio.'],
    'En revisión': ['review', 'Tu postulación está siendo evaluada', 'Por ahora, mantente atento a los canales de contacto que registraste. El estado se actualizará cuando haya novedades.'],
    'Entrevista': ['interview', 'Revisa la coordinación de tu entrevista', 'Consulta el correo y teléfono que registraste para conocer los detalles. Este estado no confirma una fecha ni una reserva.'],
    'Aprobado': ['approved', 'Prepárate para los siguientes pasos', 'El equipo coordinará contigo a través de los canales de contacto que registraste.'],
    'No seleccionado': ['closed', 'Esta postulación ha finalizado', 'Gracias por tu interés en KJA. Puedes revisar la convocatoria para conocer las oportunidades disponibles.']
  };
  const clearResult = () => {
    result.hidden = true;
    delete dialog.dataset.view;
    delete result.dataset.status;
  };
  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    error.textContent = '';
    feedback.textContent = '';
    clearResult();
    companionState('typing', 'Cuando quieras, consultamos.');
    companion.style.setProperty('--rec-eye-x', `${Math.min(input.value.length, 8) * .5 - 2}px`);
  });
  input.addEventListener('focus', () => {
    if (!button.disabled && result.hidden && !error.textContent && !feedback.textContent) companionState('typing', 'Te ayudo a encontrar tu respuesta.');
  });
  input.addEventListener('blur', () => {
    if (companion.dataset.companionState === 'typing') companionState('idle', 'Cuando quieras, consultamos.');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled || !dialog.open) return;
    clearResult();
    error.textContent = '';
    feedback.textContent = '';
    const dni = input.value.trim();
    if (!/^[0-9]{8}$/.test(dni)) {
      input.setAttribute('aria-invalid', 'true');
      error.textContent = 'Ingresa los 8 dígitos de tu DNI, sin espacios ni letras.';
      companionState('attention', 'Revisemos esos 8 dígitos.');
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    button.disabled = true;
    input.readOnly = true;
    form.setAttribute('aria-busy', 'true');
    button.textContent = 'Consultando…';
    feedback.textContent = '';
    companionState('searching', 'Buscando tu postulación…');
    const version = ++requestVersion;
    loading.hidden = false;
    waitMessage.textContent = 'Espera un momento, estamos buscando tu estado.';
    waitTimer = setTimeout(() => {
      if (version !== requestVersion || !dialog.open) return;
      waitMessage.textContent = 'Está tardando un poco más de lo habitual. Puedes esperar o cerrar esta ventana y volver a intentarlo.';
    }, 12000);
    try {
      const data = await window.KJARecruitmentAPI.status(dni);
      if (version !== requestVersion || !dialog.open) return;
      if (data === null) {
        companionState('attention', 'Revisemos el número juntos.');
        feedback.textContent = 'No encontramos una postulación con ese DNI. Verifica el número o vuelve a consultar después de enviar tu postulación.';
        return;
      }
      if (!data || !Object.hasOwn(descriptions, data.estado)) throw new Error('No pudimos obtener un estado válido. Vuelve a intentarlo más tarde.');
      document.getElementById('rec-status-label').textContent = data.estado;
      document.getElementById('rec-status-description').textContent = descriptions[data.estado];
      document.getElementById('rec-status-created').textContent = date(data.created_at);
      document.getElementById('rec-status-updated').textContent = date(data.updated_at);
      const [theme, title, next] = followUp[data.estado];
      result.dataset.status = theme;
      document.getElementById('rec-status-next-title').textContent = title;
      document.getElementById('rec-status-next-description').textContent = next;
      dialog.dataset.view = 'result';
      result.hidden = false;
      companionState('ready', 'Tu consulta está lista.');
      feedback.textContent = 'Consulta completada.';
      result.focus();
    } catch (err) {
      if (version !== requestVersion || !dialog.open) return;
      companionState('attention', 'Podemos intentarlo otra vez.');
      feedback.textContent = '';
      error.textContent = ['PGRST202', 'PGRST205', '42P01', '42883'].includes(err?.code)
        ? 'La consulta de estado aún no está habilitada. Vuelve a intentarlo más tarde o comunícate con KJA.'
        : err?.name === 'AbortError' ? 'La consulta tardó demasiado. Vuelve a intentarlo.'
        : window.KJARecruitmentAPI.message(err);
    } finally {
      if (version !== requestVersion) return;
      stopWaiting();
      button.disabled = false;
      input.readOnly = false;
      form.removeAttribute('aria-busy');
      button.textContent = 'Consultar estado';
    }
  });
  if (window.location.hash === '#estado-postulacion') open(document.querySelector('[data-rec-status-open]'));
})();
