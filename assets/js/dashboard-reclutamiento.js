(function () {
  'use strict';
  let client, root, selected, page = 0, total = 0, generation = 0, authVersion = 0, active = false;
  let items = [], search = '', filter = 'Pendiente', timer, busy = false, cvCache = null, cvPending = null;
  const states = ['Pendiente','En revisión','Entrevista','Aprobado','No seleccionado'];
  const stateKey = {'':'all','Pendiente':'pending','En revisión':'review','Entrevista':'interview','Aprobado':'approved','No seleccionado':'rejected'};
  const $ = id => root?.querySelector(`#${id}`);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => new Date(value).toLocaleString('es-PE', { timeZone:'America/Lima', dateStyle:'medium', timeStyle:'short' });
  function interviewDate(value) {
    if (!value) return 'Por coordinar';
    const parsed = new Date(`${value}T12:00:00-05:00`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('es-PE', {timeZone:'America/Lima', day:'numeric', month:'short', year:'numeric'});
  }
  const shortLabel = value => String(value || '').split(' (')[0];
  const actionLabel = {'Pendiente':'Revisar','En revisión':'Continuar','Entrevista':'Coordinar','Aprobado':'Ver expediente','No seleccionado':'Ver expediente'};
  function relativeTime(value) {
    const diff = (new Date(value).getTime() - Date.now()) / 1000;
    if (!Number.isFinite(diff)) return '';
    if (Math.abs(diff) < 60) return 'hace un momento';
    const format = new Intl.RelativeTimeFormat('es', { numeric:'auto', style:'short' });
    for (const [unit, seconds] of [['month',2592000],['week',604800],['day',86400],['hour',3600],['minute',60]]) if (Math.abs(diff) >= seconds) return format.format(Math.round(diff / seconds), unit);
  }
  function renderRow(c) {
    const d=c.datos || {};
    const initials=String(d.nombres || '?').trim().split(/\s+/).slice(0,2).map(n=>Array.from(n)[0]).join('').toLocaleUpperCase('es-PE');
    const avatar=Array.from(String(d.nombres || '')).reduce((sum,ch)=>sum+ch.codePointAt(0),0)%6;
    const profile=[d.carrera,d.nivel].filter(Boolean).join(' · ') || 'Sin especialidad registrada';
    const tags=[d.modalidad,d.turno].filter(Boolean).map(t=>`<span class="ri-tag" title="${esc(t)}">${esc(shortLabel(t))}</span>`).join('');
    const day=/^\d{4}-\d{2}-\d{2}$/.test(d.entrevistaFecha || '') ? new Date(`${d.entrevistaFecha}T12:00:00Z`) : null;
    const action=actionLabel[c.estado] || 'Revisar';
    const month=day ? day.toLocaleDateString('es-PE',{month:'short',timeZone:'UTC'}).replace('.','') : 'Fecha';
    return `<tr class="ri-row" data-id="${esc(c.id)}" data-state="${stateKey[c.estado] || 'all'}"><td><div class="ri-person"><span class="ri-avatar" data-avatar="${avatar}" aria-hidden="true">${esc(initials)}</span><div><strong>${esc(d.nombres)}</strong><span class="ri-meta" title="${esc(profile)}">${esc(profile)}</span>${tags ? `<div class="ri-tags">${tags}</div>` : ''}</div></div></td><td><div class="ri-when"><span class="ri-cal"${day ? '' : ' data-empty'} aria-hidden="true"><span>${esc(month)}</span><b>${day ? day.getUTCDate() : '—'}</b></span><div><span class="ri-sr">Entrevista solicitada: ${esc(interviewDate(d.entrevistaFecha))}</span><strong>${esc(d.entrevistaHora || (day ? 'Hora por coordinar' : 'Por coordinar'))}</strong><span class="ri-meta" title="${esc(d.entrevistaCanal)}">${esc(d.entrevistaCanal || 'Canal por definir')}</span></div></div></td><td><span class="ri-status" data-status="${esc(c.estado)}">${esc(c.estado)}</span><small class="ri-received" title="Recibida el ${esc(date(c.created_at))}">Recibida ${esc(relativeTime(c.created_at))}</small></td><td class="ri-row-action"><button type="button" class="ri-go" data-id="${esc(c.id)}" aria-label="${action.includes('expediente') ? action : `${action} expediente`} de ${esc(d.nombres)}"><span>${action}</span>${detailIcon('arrow')}</button></td></tr>`;
  }
  const skeletonRows = count => Array.from({length:count},()=>'<tr class="ri-skeleton" aria-hidden="true"><td><div class="ri-person"><span class="ri-sk ri-sk-avatar"></span><div><span class="ri-sk"></span><span class="ri-sk ri-sk-b"></span><span class="ri-sk ri-sk-c"></span></div></div></td><td><div class="ri-when"><span class="ri-sk ri-sk-cal"></span><div><span class="ri-sk ri-sk-b"></span><span class="ri-sk"></span></div></div></td><td><span class="ri-sk ri-sk-pill"></span><span class="ri-sk ri-sk-c"></span></td><td><span class="ri-sk ri-sk-go"></span></td></tr>').join('');
  const api = () => window.KJARecruitmentAPI;
  const rpc = (name, args) => api().rpc(client,name,args);
  const detailIcon = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{
    refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 11-1l3 6M4 12l3 6a7 7 0 0 0 11-1"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
    chevron:'<path d="m6 9 6 6 6-6"/>',
    back:'<path d="M19 12H5m5-5-5 5 5 5"/>',
    external:'<path d="M14 3h7v7m0-7-11 11"/><path d="M10 3H4v17h17v-6"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    check:'<path d="m5 12 5 5L20 7"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    inbox:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
    progress:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    chat:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>'
  }[name] || ''}</svg>`;
  const statusHelp = {
    'Pendiente':'La solicitud está pendiente de una primera revisión.',
    'En revisión':'El equipo está evaluando el perfil y el CV.',
    'Entrevista':'Coordina la fecha y el canal con el postulante.',
    'Aprobado':'La postulación fue aprobada. Comunica los siguientes pasos.',
    'No seleccionado':'La postulación no continuará. Coordina la respuesta con el postulante.'
  };
  // Desplegable propio (botón + listbox) con punto de color por estado; emite `change` en el contenedor.
  function selectMarkup(id, options, value, counts = false) {
    const current = options.find(o => o.value === value) || options[0];
    return `<div class="ri-select" id="${id}" data-value="${esc(current.value)}"><button type="button" class="ri-select-trigger" id="${id}-trigger" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="${id}-label ${id}-trigger" data-state="${stateKey[current.value]}"><span class="ri-select-dot" aria-hidden="true"></span><span class="ri-select-value">${esc(current.label)}</span>${detailIcon('chevron')}</button><ul class="ri-select-menu" role="listbox" tabindex="-1" aria-labelledby="${id}-label" hidden>${options.map((o,i)=>`<li role="option" id="${id}-option-${i}" data-value="${esc(o.value)}" data-state="${stateKey[o.value]}" aria-selected="${o.value===current.value}"><span class="ri-select-dot" aria-hidden="true"></span><span class="ri-option-text">${esc(o.label)}</span>${counts ? `<span class="ri-select-count" data-count-for="${esc(o.value)}" hidden></span>` : ''}<span class="ri-select-check">${detailIcon('check')}</span></li>`).join('')}</ul></div>`;
  }
  function setSelectValue(select, value) {
    const options = [...select.querySelectorAll('[role="option"]')], option = options.find(o => o.dataset.value === value);
    if (!option) return;
    select.dataset.value = value;
    options.forEach(o => o.setAttribute('aria-selected', String(o === option)));
    const trigger = select.querySelector('.ri-select-trigger');
    trigger.dataset.state = option.dataset.state;
    trigger.querySelector('.ri-select-value').textContent = option.querySelector('.ri-option-text').textContent;
  }
  function closeSelect(select, focus = false) {
    const menu = select.querySelector('[role="listbox"]');
    if (menu.hidden) return;
    menu.hidden = true; menu.removeAttribute('aria-activedescendant');
    select.querySelector('.ri-select-trigger').setAttribute('aria-expanded','false');
    if (focus) select.querySelector('.ri-select-trigger').focus();
  }
  function activateOption(select, option) {
    select.querySelectorAll('[role="option"]').forEach(o => o.classList.toggle('is-active', o === option));
    select.querySelector('[role="listbox"]').setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView?.({ block: 'nearest' });
  }
  function openSelect(select) {
    root.querySelectorAll('.ri-select').forEach(other => { if (other !== select) closeSelect(other); });
    const menu = select.querySelector('[role="listbox"]');
    menu.hidden = false;
    select.querySelector('.ri-select-trigger').setAttribute('aria-expanded','true');
    activateOption(select, menu.querySelector('[aria-selected="true"]') || menu.querySelector('[role="option"]'));
    menu.focus();
  }
  function chooseOption(select, option) {
    const changed = select.dataset.value !== option.dataset.value;
    setSelectValue(select, option.dataset.value);
    closeSelect(select, true);
    if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function wireSelect(select) {
    const trigger = select.querySelector('.ri-select-trigger'), menu = select.querySelector('[role="listbox"]');
    trigger.addEventListener('click', () => menu.hidden ? openSelect(select) : closeSelect(select, true));
    trigger.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openSelect(select); } });
    menu.addEventListener('click', e => { const option = e.target.closest('[role="option"]'); if (option) chooseOption(select, option); });
    menu.addEventListener('keydown', e => {
      const options = [...menu.querySelectorAll('[role="option"]')];
      const index = options.findIndex(o => o.classList.contains('is-active'));
      const move = i => { e.preventDefault(); activateOption(select, options[Math.max(0, Math.min(options.length - 1, i))]); };
      if (e.key === 'ArrowDown') move(index + 1);
      else if (e.key === 'ArrowUp') move(index - 1);
      else if (e.key === 'Home') move(0);
      else if (e.key === 'End') move(options.length - 1);
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[index]) chooseOption(select, options[index]); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSelect(select, true); }
      else if (e.key === 'Tab') closeSelect(select);
    });
    menu.addEventListener('focusout', e => { if (!select.contains(e.relatedTarget)) closeSelect(select); });
  }
  const statusValue = () => $('ri-detail-status').dataset.value;
  const setStatus = value => setSelectValue($('ri-detail-status'), value);
  const cvError = error => /CV no disponible/i.test(error?.message || '') ? 'Este expediente no tiene un CV guardado en el sistema. Pide al postulante que lo envíe de nuevo.' : api().message(error);
  const sectionTitle = (name, title) => `<div class="ri-section-title">${detailIcon(name)}<h3>${title}</h3></div>`;
  function detailMessage(text, error = false) {
    const el = $('ri-detail-message');
    el.textContent = text; el.hidden = !text;
    el.classList.toggle('is-error', error);
    el.setAttribute('role', error ? 'alert' : 'status');
  }
  function syncReview() {
    if (!selected) return;
    const changed = statusValue() !== selected.estado || $('ri-detail-notes').value !== (selected.notas_revision || '');
    $('ri-save').disabled = busy || !changed;
    $('ri-save-state').textContent = changed ? 'Cambios sin guardar' : 'Sin cambios pendientes';
    $('ri-status-help').textContent = statusHelp[statusValue()] || '';
    detailMessage('');
  }
  function setMessage(text, error = false) {
    $('rec-inbox-message').textContent = text;
    $('rec-inbox-message').classList.toggle('is-error',error);
    $('rec-inbox-message').setAttribute('role',error ? 'alert' : 'status');
  }
  function renderCounts(counts) {
    const byState = counts.por_estado && typeof counts.por_estado === 'object' ? counts.por_estado : null;
    const known = {'':counts.total, 'Pendiente':counts.pendientes, 'Aprobado':counts.aprobados};
    root.querySelectorAll('[data-count-for]').forEach(el => {
      const value = el.dataset.countFor === '' ? counts.total : byState ? byState[el.dataset.countFor] ?? 0 : known[el.dataset.countFor];
      el.textContent = value ?? '';
      el.hidden = value === undefined || value === null;
    });
  }
  function renderFunnel(counts) {
    const totalCount = Number(counts.total) || 0;
    const shares = { pendientes:+counts.pendientes || 0, revision:+counts.revision || 0, aprobados:+counts.aprobados || 0 };
    shares.resto = Math.max(totalCount - shares.pendientes - shares.revision - shares.aprobados, 0);
    const percent = key => totalCount ? Math.round(shares[key] / totalCount * 100) : 0;
    root.querySelectorAll('[data-share-for]').forEach(el => el.style.setProperty('--share', `${percent(el.dataset.shareFor)}%`));
    root.querySelectorAll('[data-share-label]').forEach(el => { el.textContent = totalCount ? `${percent(el.dataset.shareLabel)}%` : ''; });
  }
  function releaseCv() {
    cvPending = null;
    if (!cvCache) return;
    const url = cvCache.url; cvCache = null;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function fetchCv() {
    const id = selected.id, version = authVersion;
    if (cvCache?.id === id) return Promise.resolve(cvCache);
    if (cvPending?.id === id) return cvPending.promise;
    const promise = rpc('rec_descargar_cv',{p_id:id}).then(cv => {
      if (version !== authVersion || selected?.id !== id) return null;
      const bytes = Uint8Array.from(atob(cv.base64.replace(/\s/g,'')), c => c.charCodeAt(0));
      releaseCv();
      cvCache = { id, url: URL.createObjectURL(new Blob([bytes],{type:cv.mime || 'application/octet-stream'})), nombre: cv.nombre, mime: cv.mime || '' };
      return cvCache;
    }).finally(() => { if (cvPending?.promise === promise) cvPending = null; });
    cvPending = { id, promise };
    return promise;
  }
  function viewerState(mode, text = '', retry = false) {
    $('ri-viewer-loading').hidden = mode !== 'loading';
    $('ri-viewer-frame').hidden = mode !== 'frame';
    $('ri-viewer-empty').hidden = mode !== 'empty';
    $('ri-viewer-empty-text').textContent = text;
    $('ri-viewer-retry').hidden = !retry;
  }
  function hideCv() {
    const dialog = $('rec-inbox-detail');
    if (!dialog) return;
    dialog.classList.remove('is-previewing');
    $('ri-cv-viewer').hidden = true; $('ri-detail-data').hidden = false;
    $('ri-viewer-frame').removeAttribute('src'); viewerState('none');
    $('ri-viewer-open').removeAttribute('href'); $('ri-viewer-open').setAttribute('aria-disabled','true');
  }
  async function showCv() {
    if (!selected) return;
    const id = selected.id, d = selected.datos || {};
    $('rec-inbox-detail').classList.add('is-previewing');
    $('ri-detail-data').hidden = true; $('ri-cv-viewer').hidden = false;
    $('ri-viewer-name').textContent = d.cvName || 'CV adjunto';
    $('ri-viewer-frame').title = `Vista previa del CV de ${d.nombres || 'el postulante'}`;
    viewerState('loading');
    $('ri-viewer-back').focus();
    try {
      const cv = await fetchCv();
      if (!cv || selected?.id !== id || $('ri-cv-viewer').hidden) return;
      $('ri-viewer-open').href = cv.url; $('ri-viewer-open').removeAttribute('aria-disabled');
      if (/pdf/i.test(cv.mime) || /\.pdf$/i.test(cv.nombre || '')) { $('ri-viewer-frame').src = `${cv.url}#navpanes=0&view=FitH`; viewerState('frame'); }
      else viewerState('empty','Este formato no se puede previsualizar. Descarga el archivo para revisarlo.');
    } catch(error) { if (selected?.id === id && !$('ri-cv-viewer').hidden) viewerState('empty', cvError(error), !/CV no disponible/i.test(error?.message || '')); }
  }
  function mount() {
    root = document.getElementById('rec-inbox-root');
    if (!root || root.dataset.mounted) return;
    root.dataset.mounted = 'true';
    root.classList.add('is-first-load');
    client = typeof db !== 'undefined' ? db : null;
    root.innerHTML = `
      <header class="ri-header"><div><span class="ri-eyebrow">Dirección · Reclutamiento</span><h1>Solicitudes de reclutamiento</h1><p>Revisa los expedientes y coordina las entrevistas del próximo equipo KJA.</p></div><div class="ri-header-actions"><a href="reclutamiento.html" target="_blank" rel="noopener" class="ri-button">Ver convocatoria ${detailIcon('external')}</a><button type="button" class="ri-button primary" id="rec-inbox-refresh">${detailIcon('refresh')} Actualizar bandeja</button></div></header>
      <section class="ri-funnel" aria-label="Resumen del proceso"><div class="ri-funnel-total"><strong id="ri-total">—</strong><span>solicitudes recibidas</span></div><ol class="ri-funnel-stages">${[['pending','ri-pending','pendientes','Pendientes'],['review','ri-review','revision','En proceso'],['approved','ri-approved','aprobados','Aprobadas']].map(([state,id,key,label])=>`<li data-state="${state}"><span class="ri-stage-dot" aria-hidden="true"></span><strong id="${id}">—</strong><small data-share-label="${key}"></small><span>${label}</span></li>`).join('')}</ol><div class="ri-funnel-bar" aria-hidden="true">${[['pending','pendientes'],['review','revision'],['approved','aprobados'],['rejected','resto']].map(([state,key])=>`<span data-state="${state}" data-share-for="${key}"></span>`).join('')}</div></section>
      <section class="ri-inbox" aria-labelledby="ri-inbox-title"><div class="ri-inbox-heading"><h2 id="ri-inbox-title">Bandeja de postulantes</h2><span>Revisión de expedientes</span></div><div class="ri-toolbar"><div class="ri-field ri-filter-field"><span class="ri-field-label" id="rec-inbox-filter-label">Estado</span>${selectMarkup('rec-inbox-filter',[{value:'',label:'Todos los estados'},...states.map(s=>({value:s,label:s}))],filter,true)}</div><label class="ri-search">Buscar postulante<span class="ri-search-field">${detailIcon('search')}<input type="search" id="rec-inbox-search" maxlength="100" placeholder="Nombre, documento, carrera o código"></span></label><button type="button" class="ri-button ri-reset" id="rec-inbox-reset">Limpiar filtros</button></div>
      <p id="rec-inbox-message" class="ri-message" role="status" aria-live="polite">Cargando solicitudes…</p>
      <div class="ri-table-wrap"><table class="ri-table"><colgroup><col class="ri-col-person"><col class="ri-col-when"><col class="ri-col-status"><col class="ri-col-go"></colgroup><thead><tr><th scope="col">Postulante</th><th scope="col">Entrevista solicitada</th><th scope="col">Estado</th><th scope="col">Acción</th></tr></thead><tbody id="rec-inbox-rows">${skeletonRows(5)}</tbody></table></div>
      <footer class="ri-pagination"><span id="ri-page-info"></span><div><button class="ri-button" id="ri-prev" type="button" disabled>Anterior</button><button class="ri-button" id="ri-next" type="button" disabled>Siguiente</button></div></footer></section>
      <dialog class="ri-detail" id="rec-inbox-detail" aria-labelledby="ri-detail-title">
        <header class="ri-detail-head">
          <div class="ri-candidate-avatar" id="ri-initials" aria-hidden="true"></div>
          <div class="ri-candidate-heading"><h2 id="ri-detail-title" tabindex="-1">Expediente</h2><p id="ri-detail-subtitle"></p><div class="ri-candidate-meta"><span class="ri-status" id="ri-current-status"></span><span id="ri-received"></span></div></div>
          <button type="button" class="ri-close" id="ri-close" aria-label="Cerrar expediente">${detailIcon('close')}</button>
        </header>
        <nav class="ri-detail-nav" aria-label="Secciones del expediente"><button type="button" data-detail-section="ri-detail-data" aria-controls="ri-detail-data" aria-current="location">Datos del postulante</button><button type="button" data-detail-section="ri-review-panel" aria-controls="ri-review-panel">Revisión interna</button></nav>
        <div class="ri-detail-body">
          <div id="ri-detail-data"></div>
          <section class="ri-cv-viewer" id="ri-cv-viewer" aria-label="Vista previa del CV" hidden>
            <div class="ri-viewer-bar"><button type="button" class="ri-button ri-back" id="ri-viewer-back">${detailIcon('back')}Volver al expediente</button><span class="ri-viewer-name" id="ri-viewer-name"></span><div class="ri-viewer-actions"><a class="ri-button" id="ri-viewer-open" target="_blank" rel="noopener" aria-disabled="true">${detailIcon('external')}Abrir en pestaña</a><button type="button" class="ri-button" id="ri-viewer-download">${detailIcon('download')}Descargar</button></div></div>
            <div class="ri-viewer-stage"><div class="ri-viewer-loading" id="ri-viewer-loading" role="status" hidden><span></span><span></span><span></span><p>Cargando CV…</p></div><iframe id="ri-viewer-frame" title="Vista previa del CV" hidden></iframe><div class="ri-viewer-empty" id="ri-viewer-empty" hidden>${detailIcon('file')}<p id="ri-viewer-empty-text"></p><button type="button" class="ri-button" id="ri-viewer-retry" hidden>Reintentar</button></div></div>
          </section>
          <aside class="ri-review-panel" id="ri-review-panel" aria-labelledby="ri-review-title">
            <h3 id="ri-review-title">Revisión interna</h3><p class="ri-section-description">Registra el avance de esta postulación.</p>
            <form id="ri-review-form">
              <div class="ri-field ri-status-field"><span class="ri-field-label" id="ri-detail-status-label">Estado de la postulación</span>${selectMarkup('ri-detail-status',states.map(s=>({value:s,label:s})),states[0])}</div><p id="ri-status-help" class="ri-field-help"></p>
              <label for="ri-detail-notes">Notas del equipo <span class="ri-optional">Opcional</span></label><textarea id="ri-detail-notes" rows="6" maxlength="4000" placeholder="Ej. Experiencia relevante, puntos por consultar o acuerdos de la entrevista." aria-describedby="ri-notes-help"></textarea><p class="ri-field-help" id="ri-notes-help">Solo para el equipo de selección.</p>
            </form>
            <div class="ri-contact-action"><a id="ri-email" class="ri-button">${detailIcon('mail')}Redactar correo</a><p>Abre tu aplicación de correo. Guardar la revisión no envía mensajes al postulante.</p></div>
          </aside>
        </div>
        <footer class="ri-detail-footer"><div class="ri-save-feedback"><span id="ri-save-state">Sin cambios pendientes</span><p id="ri-detail-message" role="status" aria-live="polite" hidden></p></div><div class="ri-footer-buttons"><button type="button" class="ri-button" id="ri-close-bottom">Cerrar</button><button class="ri-button primary" id="ri-save" type="submit" form="ri-review-form" disabled>Guardar revisión</button></div></footer>
      </dialog>`;
    $('rec-inbox-refresh').onclick = () => refresh();
    root.querySelectorAll('.ri-select').forEach(wireSelect);
    $('ri-detail-status-trigger').setAttribute('aria-describedby','ri-status-help');
    $('rec-inbox-reset').onclick = () => { clearTimeout(timer); search=''; filter=''; page=0; $('rec-inbox-search').value=''; setSelectValue($('rec-inbox-filter'),''); void load(); };
    $('rec-inbox-filter').addEventListener('change', () => { filter=$('rec-inbox-filter').dataset.value; page=0; void load(); });
    $('rec-inbox-search').oninput = e => { search=e.target.value; page=0; clearTimeout(timer); timer=setTimeout(()=>load(),300); };
    $('ri-prev').onclick=()=>{ if(page>0){ page--;void load(); } };
    $('ri-next').onclick=()=>{ if((page+1)*25<total){ page++;void load(); } };
    $('rec-inbox-rows').onclick=e=>{ const b=e.target.closest('[data-id]'); if(b)openDetail(b.dataset.id); };
    $('ri-review-form').onsubmit = saveReview;
    $('ri-detail-data').addEventListener('click', e => {
      const button = e.target.closest('#ri-download');
      if (button) void download(button);
      if (e.target.closest('#ri-preview')) void showCv();
    });
    $('ri-viewer-back').onclick = () => { hideCv(); $('ri-preview')?.focus(); };
    $('ri-viewer-download').onclick = e => void download(e.currentTarget);
    $('ri-viewer-retry').onclick = () => void showCv();
    $('ri-detail-status').addEventListener('change', syncReview);
    $('ri-detail-notes').addEventListener('input', syncReview);
    const detailBody = root.querySelector('.ri-detail-body');
    root.querySelector('.ri-detail-nav').addEventListener('click', e => {
      const button = e.target.closest('[data-detail-section]');
      if (!button) return;
      const target = $(button.dataset.detailSection);
      detailBody.scrollTo({ top: detailBody.scrollTop + target.getBoundingClientRect().top - detailBody.getBoundingClientRect().top, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
    detailBody.addEventListener('scroll', () => {
      const review = $('ri-review-panel').getBoundingClientRect().top <= detailBody.getBoundingClientRect().top + 48;
      root.querySelectorAll('[data-detail-section]').forEach(button => {
        if ((button.dataset.detailSection === 'ri-review-panel') === review) button.setAttribute('aria-current','location');
        else button.removeAttribute('aria-current');
      });
    }, { passive: true });
    for (const id of ['ri-close','ri-close-bottom']) $(id).onclick = () => { if (!busy) $('rec-inbox-detail').close(); };
    $('rec-inbox-detail').addEventListener('cancel', e => { if (busy) e.preventDefault(); });
    $('rec-inbox-detail').addEventListener('close',()=>{if($('rec-inbox-detail').open)return;hideCv();releaseCv();selected=null;});
  }
  function clear() {
    generation++; authVersion++; active=false;items=[];total=0;selected=null;
    $('rec-inbox-detail')?.close();
    hideCv(); releaseCv();
    root?.removeAttribute('aria-busy'); root?.classList.remove('is-first-load');
    if($('rec-inbox-refresh'))$('rec-inbox-refresh').disabled=false;
    if($('ri-detail-data'))$('ri-detail-data').innerHTML='';
    if($('ri-detail-title'))$('ri-detail-title').textContent='Expediente';
    if($('ri-detail-notes'))$('ri-detail-notes').value='';
    if($('ri-detail-message'))$('ri-detail-message').textContent='';
    $('ri-email')?.removeAttribute('href');
    if($('rec-inbox-rows'))$('rec-inbox-rows').innerHTML='';
    for(const id of ['ri-total','ri-pending','ri-review','ri-approved']) if($(id))$(id).textContent='—';
    root?.querySelectorAll('[data-count-for]').forEach(el=>{el.textContent='';el.hidden=true;});
    if(root?.dataset.mounted)renderFunnel({});
    document.querySelectorAll('[data-rec-pending-count]').forEach(el=>{el.textContent='';el.hidden=true;});
  }
  async function refresh() {
    mount(); if(!root || !client)return;
    const token=++generation;
    try {
      const { data, error } = await client.auth.getUser();
      if(error || !data?.user)throw new Error('Inicia sesión con una cuenta administrativa para ver las solicitudes.');
      if(await rpc('rec_es_admin')!==true)throw new Error('Esta cuenta no tiene permiso para revisar postulaciones.');
      if(token!==generation)return;
      active=true; await load();
    } catch(error) {
      if(token!==generation)return;
      clear();setMessage(api().message(error),true);
    }
  }
  // quiet: refrescos automáticos y tras guardar; mantiene las filas visibles hasta tener datos nuevos.
  async function load(quiet = false) {
    if(!active)return;
    const token=++generation;
    root.setAttribute('aria-busy','true');
    $('rec-inbox-refresh').disabled=true;
    if(!quiet){setMessage('Cargando solicitudes…');$('rec-inbox-rows').innerHTML=skeletonRows(Math.min(Math.max(items.length,3),5));items=[];}
    try {
      const result=await rpc('rec_listar',{p_estado:filter,p_busqueda:search,p_pagina:page});
      if(token!==generation)return;
      items=result.items||[];total=result.total||0;
      if(page>0 && total<=page*25){page=0;return await load();}
      const counts=result.counts||{};
      for(const [id,key] of [['ri-total','total'],['ri-pending','pendientes'],['ri-review','revision'],['ri-approved','aprobados']])$(id).textContent=counts[key]??0;
      renderCounts(counts); renderFunnel(counts);
      root.classList.remove('is-first-load');
      document.querySelectorAll('[data-rec-pending-count]').forEach(el=>{el.textContent=counts.pendientes||0;el.hidden=!counts.pendientes;});
      setMessage(total?`${total} solicitud${total===1?'':'es'} · Actualizado ${new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}`:'No hay solicitudes con estos filtros. Las nuevas postulaciones aparecerán aquí.');
      $('rec-inbox-rows').innerHTML=items.length ? items.map(renderRow).join('') : '<tr class="ri-empty"><td colspan="4">'+detailIcon('inbox')+'<strong>No hay solicitudes para mostrar</strong><p>Prueba otro estado o limpia la búsqueda para ver más postulantes.</p></td></tr>';
      $('ri-page-info').textContent=total?`${page*25+1}–${Math.min((page+1)*25,total)} de ${total}`:'';
      $('ri-prev').disabled=page===0;$('ri-next').disabled=(page+1)*25>=total;
    } catch(error) {
      if(token!==generation)return;
      if(error?.code==='42501')clear();
      root.classList.remove('is-first-load');
      $('rec-inbox-rows').innerHTML='';
      setMessage(api().message(error),true);
      $('ri-prev').disabled=true;$('ri-next').disabled=true;
    } finally { if(token===generation){root.removeAttribute('aria-busy');$('rec-inbox-refresh').disabled=false;} }
  }
  function openDetail(id) {
    if (busy) return;
    const next=items.find(c=>c.id===id);if(!next)return;
    hideCv(); if (cvCache?.id !== id && cvPending?.id !== id) releaseCv();
    root.querySelectorAll('.ri-select').forEach(select => closeSelect(select));
    selected=next;
    const c=selected,d=c.datos;
    $('ri-detail-title').textContent=d.nombres;
    $('ri-initials').textContent = (d.nombres || '').trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('').toLocaleUpperCase('es-PE');
    $('ri-detail-subtitle').textContent = [d.carrera,d.nivel].filter(Boolean).join(' · ');
    $('ri-current-status').textContent = c.estado;
    $('ri-current-status').dataset.status = c.estado;
    $('ri-received').textContent = `Recibida el ${date(c.created_at)}`;
    const rows = values => `<dl class="ri-info-grid">${values.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${value || '<span class="ri-missing">No indicado</span>'}</dd></div>`).join('')}</dl>`;
    const email = value => value ? `<a href="mailto:${esc(encodeURIComponent(value))}">${esc(value)}</a>` : '';
    const phone = d.telefonoNotificacion || d.telefono;
    const phoneHref = String(phone || '').replace(/[^\d+]/g,'');
    const bytes = Number(d.cvBytes);
    const size = Number.isFinite(bytes) && bytes > 0 ? (bytes < 1048576 ? `${Math.ceil(bytes/1024)} KB` : `${(bytes/1048576).toFixed(1)} MB`) : '';
    const interviewDate = /^\d{4}-\d{2}-\d{2}$/.test(d.entrevistaFecha || '') ? new Date(`${d.entrevistaFecha}T12:00:00Z`).toLocaleDateString('es-PE',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}) : d.entrevistaFecha;
    const extension = (String(d.cvName || '').match(/\.([a-z0-9]{1,5})$/i)?.[1] || '').toUpperCase();
    const isPdf = extension === 'PDF';
    $('ri-detail-data').innerHTML = `
      <section class="ri-detail-section">${sectionTitle('user','Contacto')}${rows([
        ['DNI / Documento',esc(d.dni)],['Teléfono / WhatsApp',phoneHref ? `<a href="tel:${esc(phoneHref)}">${esc(phone)}</a>` : ''],
        ['Correo de contacto',email(d.email)],['Correo para notificaciones',email(d.emailNotificacion)]
      ])}</section>
      <section class="ri-detail-section">${sectionTitle('briefcase','Perfil y disponibilidad')}${rows([['Modalidad',esc(d.modalidad)],['Turno',esc(d.turno)]])}</section>
      <section class="ri-detail-section">${sectionTitle('calendar','Entrevista solicitada')}<div class="ri-interview"><p class="ri-interview-date">${esc(interviewDate || 'Fecha por definir')}<span>${esc(d.entrevistaHora || 'Hora por definir')}</span></p><p class="ri-interview-channel">${esc(d.entrevistaCanal || 'Canal por definir')}</p><p class="ri-field-help">Fecha propuesta por el postulante, sujeta a coordinación.</p></div></section>
      <section class="ri-detail-section">${sectionTitle('file','Currículum vitae')}<div class="ri-cv-file" data-type="${isPdf ? 'pdf' : 'doc'}"><span class="ri-file-icon">${detailIcon('file')}<b>${esc(extension || 'CV')}</b></span><div class="ri-file-info"><strong>${esc(d.cvName || 'CV adjunto')}</strong><span>${esc(size || 'Documento adjunto')}</span></div><div class="ri-cv-actions">${isPdf ? `<button class="ri-button primary" type="button" id="ri-preview">${detailIcon('eye')}Ver CV</button>` : ''}<button class="ri-button" type="button" id="ri-download">${detailIcon('download')}Descargar</button></div></div>${isPdf ? '' : '<p class="ri-field-help">La vista previa está disponible solo para archivos PDF.</p>'}</section>
      <section class="ri-detail-section ri-candidate-notes">${sectionTitle('chat','Sobre la postulación')}<h4>Motivación</h4><p>${esc(d.motivacion || 'El postulante no añadió una motivación.')}</p><h4>Notas para la entrevista</h4><p>${esc(d.notasEntrevista || 'Sin indicaciones adicionales.')}</p></section>
      <details class="ri-record"><summary>Datos del registro</summary>${rows([['Código del expediente',esc(c.codigo)],['Requisitos de postulación',d.requisitosAceptados ? 'Aceptados por el postulante' : 'No aceptados']])}</details>`;
    setStatus(c.estado);$('ri-detail-notes').value=c.notas_revision||'';$('ri-detail-message').textContent='';
    const recipient = d.emailNotificacion || d.email;
    if (recipient) { $('ri-email').href=`mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(`Postulación KJA · ${c.codigo}`)}`; $('ri-email').removeAttribute('aria-disabled'); }
    else { $('ri-email').removeAttribute('href'); $('ri-email').setAttribute('aria-disabled','true'); }
    syncReview();
    if (!$('rec-inbox-detail').open) $('rec-inbox-detail').showModal();
    root.querySelector('.ri-detail-body').scrollTop = 0;
    $('ri-detail-title').focus();
  }
  async function saveReview(e) {
    e.preventDefault();if(!selected||busy)return;
    const sessionVersion=authVersion;
    busy=true;$('ri-save').disabled=true;$('ri-save').textContent='Guardando…';
    for (const id of ['ri-close','ri-close-bottom','ri-detail-status-trigger','ri-detail-notes']) $(id).disabled=true;
    $('ri-review-form').setAttribute('aria-busy','true');
    detailMessage('');
    try {
      const updated=await rpc('rec_actualizar',{p_id:selected.id,p_estado:statusValue(),p_notas:$('ri-detail-notes').value,p_revision:selected.revision});
      if(sessionVersion!==authVersion)return;
      selected=updated;
      $('ri-current-status').textContent=updated.estado;$('ri-current-status').dataset.status=updated.estado;
      $('ri-save-state').textContent='Todos los cambios guardados';
      detailMessage('Revisión guardada correctamente.');
      await load(true);
    } catch(error) { if(sessionVersion===authVersion)detailMessage(api().message(error),true); }
    finally {
      busy=false;$('ri-save').textContent='Guardar revisión';
      for (const id of ['ri-close','ri-close-bottom','ri-detail-status-trigger','ri-detail-notes']) $(id).disabled=false;
      $('ri-review-form').removeAttribute('aria-busy');
      $('ri-save').disabled=!selected || (statusValue()===selected.estado && $('ri-detail-notes').value===(selected.notas_revision||''));
    }
  }
  async function download(button) {
    if(!selected)return;
    const sessionVersion=authVersion;
    const label=button.innerHTML;button.disabled=true;button.textContent='Descargando…';
    try {
      const cv=await fetchCv();
      if(!cv || sessionVersion!==authVersion)return;
      const a=document.createElement('a');a.href=cv.url;a.download=cv.nombre;a.click();
    } catch(error) {if(sessionVersion===authVersion)detailMessage(cvError(error),true);}
    finally {button.disabled=false;button.innerHTML=label;}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    mount();
    client?.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')clear();});
    const portalAdmin = typeof APP !== 'undefined' && APP.access?.acceso_panel && APP.access?.rol === 'direccion';
    const certificatesAdmin = typeof PERFIL !== 'undefined' && PERFIL.rol === 'admin';
    if(portalAdmin || certificatesAdmin)void refresh();
    window.addEventListener('focus',()=>{if(active && root.closest('.view')?.classList.contains('active'))void load(true);});
    setInterval(()=>{if(active && !document.hidden && !$('rec-inbox-detail')?.open && root.closest('.view')?.classList.contains('active'))void load(true);},60000);
  });
  window.kjaRecruitment={init:mount,refresh,openDetail,clear};
})();
