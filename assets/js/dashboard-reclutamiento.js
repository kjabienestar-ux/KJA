(function () {
  'use strict';
  let client, root, selected, page = 0, total = 0, generation = 0, authVersion = 0, active = false;
  let items = [], search = '', filter = 'Pendiente', timer, busy = false;
  const states = ['Pendiente','En revisión','Entrevista','Aprobado','No seleccionado'];
  const $ = id => root?.querySelector(`#${id}`);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => new Date(value).toLocaleString('es-PE', { timeZone:'America/Lima', dateStyle:'medium', timeStyle:'short' });
  function interviewDate(value) {
    if (!value) return 'Por coordinar';
    const parsed = new Date(`${value}T12:00:00-05:00`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('es-PE', {timeZone:'America/Lima', day:'numeric', month:'short', year:'numeric'});
  }
  function renderRow(c) {
    const d=c.datos || {};
    const initials=String(d.nombres || '?').trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase();
    const coordination=c.estado==='Pendiente' || c.estado==='En revisión' ? 'Por confirmar con el postulante' : 'Consulta la coordinación en el expediente';
    return `<tr><td data-label="Postulante"><div class="ri-person"><span class="ri-avatar" aria-hidden="true">${esc(initials)}</span><div><strong>${esc(d.nombres)}</strong><span class="ri-meta">${esc(d.emailNotificacion || d.email || 'Sin correo registrado')}</span><small>DNI ${esc(d.dni)} · ${esc(c.codigo)}</small></div></div></td><td data-label="Perfil y disponibilidad"><strong>${esc(d.carrera || 'Sin especialidad registrada')}</strong><span class="ri-meta">${esc(d.nivel)}</span><small>${esc(d.modalidad)}<br>${esc(d.turno)}</small></td><td data-label="Entrevista solicitada"><strong class="ri-interview-date">${esc(interviewDate(d.entrevistaFecha))}<span>${esc(d.entrevistaHora || 'Hora por coordinar')}</span></strong><span class="ri-meta">${esc(d.entrevistaCanal)}</span><small>${esc(coordination)}</small></td><td data-label="Estado"><span class="ri-status" data-status="${esc(c.estado)}">${esc(c.estado)}</span><small>Recibida ${esc(date(c.created_at))}</small></td><td class="ri-row-action"><button type="button" class="ri-button ri-review-button" data-id="${esc(c.id)}" aria-label="Revisar expediente de ${esc(d.nombres)}">Revisar ${detailIcon('arrow')}</button></td></tr>`;
  }
  const api = () => window.KJARecruitmentAPI;
  const rpc = (name, args) => api().rpc(client,name,args);
  const detailIcon = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{
    refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 11-1l3 6M4 12l3 6a7 7 0 0 0 11-1"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
    external:'<path d="M14 3h7v7m0-7-11 11"/><path d="M10 3H4v17h17v-6"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>'
  }[name] || ''}</svg>`;
  const icon = detailIcon;
  const statusHelp = {
    'Pendiente':'La solicitud está pendiente de una primera revisión.',
    'En revisión':'El equipo está evaluando el perfil y el CV.',
    'Entrevista':'Coordina la fecha y el canal con el postulante.',
    'Aprobado':'La postulación fue aprobada. Comunica los siguientes pasos.',
    'No seleccionado':'La postulación no continuará. Coordina la respuesta con el postulante.'
  };
  function detailMessage(text, error = false) {
    const el = $('ri-detail-message');
    el.textContent = text; el.hidden = !text;
    el.classList.toggle('is-error', error);
    el.setAttribute('role', error ? 'alert' : 'status');
  }
  function syncReview() {
    if (!selected) return;
    const changed = $('ri-detail-status').value !== selected.estado || $('ri-detail-notes').value !== (selected.notas_revision || '');
    $('ri-save').disabled = busy || !changed;
    $('ri-save-state').textContent = changed ? 'Cambios sin guardar' : 'Sin cambios pendientes';
    $('ri-status-help').textContent = statusHelp[$('ri-detail-status').value] || '';
    detailMessage('');
  }
  function setMessage(text, error = false) {
    $('rec-inbox-message').textContent = text;
    $('rec-inbox-message').classList.toggle('is-error',error);
    $('rec-inbox-message').setAttribute('role',error ? 'alert' : 'status');
  }
  function mount() {
    root = document.getElementById('rec-inbox-root');
    if (!root || root.dataset.mounted) return;
    root.dataset.mounted = 'true';
    client = typeof db !== 'undefined' ? db : null;
    root.innerHTML = `
      <header class="ri-header"><div><h1>Solicitudes de reclutamiento</h1><p>Revisa los expedientes y coordina las entrevistas del próximo equipo KJA.</p></div><div class="ri-header-actions"><a href="reclutamiento.html" target="_blank" rel="noopener" class="ri-button">Ver convocatoria ${detailIcon('external')}</a><button type="button" class="ri-button primary" id="rec-inbox-refresh">${detailIcon('refresh')} Actualizar bandeja</button></div></header>
      <dl class="ri-counts"><div><dt>Solicitudes recibidas</dt><dd id="ri-total">—</dd></div><div><dt>Pendientes</dt><dd id="ri-pending">—</dd></div><div><dt>En proceso</dt><dd id="ri-review">—</dd></div><div><dt>Aprobadas</dt><dd id="ri-approved">—</dd></div></dl>
      <section class="ri-inbox" aria-labelledby="ri-inbox-title"><div class="ri-inbox-heading"><h2 id="ri-inbox-title">Bandeja de postulantes</h2><span>Revisión de expedientes</span></div><div class="ri-toolbar"><label>Estado<select id="rec-inbox-filter"><option value="">Todos los estados</option>${states.map(s=>`<option ${s===filter?'selected':''}>${s}</option>`).join('')}</select></label><label class="ri-search">Buscar postulante<span class="ri-search-field">${detailIcon('search')}<input type="search" id="rec-inbox-search" maxlength="100" placeholder="Nombre, documento, carrera o código"></span></label><button type="button" class="ri-button ri-reset" id="rec-inbox-reset">Limpiar filtros</button></div>
      <p id="rec-inbox-message" class="ri-message" role="status" aria-live="polite">Selecciona Reclutamiento para cargar las solicitudes.</p>
      <div class="ri-table-wrap"><table class="ri-table"><thead><tr><th scope="col">Postulante</th><th scope="col">Perfil y disponibilidad</th><th scope="col">Entrevista solicitada</th><th scope="col">Estado</th><th scope="col"><span class="ri-sr">Acciones</span></th></tr></thead><tbody id="rec-inbox-rows"></tbody></table></div>
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
          <aside class="ri-review-panel" id="ri-review-panel" aria-labelledby="ri-review-title">
            <h3 id="ri-review-title">Revisión interna</h3><p class="ri-section-description">Registra el avance de esta postulación.</p>
            <form id="ri-review-form">
              <label for="ri-detail-status">Estado de la postulación</label><select id="ri-detail-status" aria-describedby="ri-status-help">${states.map(s=>`<option>${s}</option>`).join('')}</select><p id="ri-status-help" class="ri-field-help"></p>
              <label for="ri-detail-notes">Notas del equipo <span class="ri-optional">Opcional</span></label><textarea id="ri-detail-notes" rows="6" maxlength="4000" placeholder="Ej. Experiencia relevante, puntos por consultar o acuerdos de la entrevista." aria-describedby="ri-notes-help"></textarea><p class="ri-field-help" id="ri-notes-help">Solo para el equipo de selección.</p>
            </form>
            <div class="ri-contact-action"><a id="ri-email" class="ri-button">${detailIcon('mail')}Redactar correo</a><p>Abre tu aplicación de correo. Guardar la revisión no envía mensajes al postulante.</p></div>
          </aside>
        </div>
        <footer class="ri-detail-footer"><div class="ri-save-feedback"><span id="ri-save-state">Sin cambios pendientes</span><p id="ri-detail-message" role="status" aria-live="polite" hidden></p></div><div class="ri-footer-buttons"><button type="button" class="ri-button" id="ri-close-bottom">Cerrar</button><button class="ri-button primary" id="ri-save" type="submit" form="ri-review-form" disabled>Guardar revisión</button></div></footer>
      </dialog>`;
    $('rec-inbox-refresh').onclick = () => refresh();
    $('rec-inbox-reset').onclick = () => { clearTimeout(timer); search=''; filter=''; page=0; $('rec-inbox-search').value=''; $('rec-inbox-filter').value=''; void load(); };
    $('rec-inbox-filter').onchange = e => { filter=e.target.value; page=0; void load(); };
    $('rec-inbox-search').oninput = e => { search=e.target.value; page=0; clearTimeout(timer); timer=setTimeout(()=>load(),300); };
    $('ri-prev').onclick=()=>{ if(page>0){ page--;void load(); } };
    $('ri-next').onclick=()=>{ if((page+1)*25<total){ page++;void load(); } };
    $('rec-inbox-rows').onclick=e=>{ const b=e.target.closest('[data-id]'); if(b)openDetail(b.dataset.id); };
    $('ri-review-form').onsubmit = saveReview;
    $('ri-detail-data').addEventListener('click', e => { if (e.target.closest('#ri-download')) void download(); });
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
    $('rec-inbox-detail').addEventListener('close',()=>{selected=null;});
  }
  function clear() {
    generation++; authVersion++; active=false;items=[];total=0;selected=null;
    $('rec-inbox-detail')?.close();
    root?.removeAttribute('aria-busy');
    if($('rec-inbox-refresh'))$('rec-inbox-refresh').disabled=false;
    if($('ri-detail-data'))$('ri-detail-data').innerHTML='';
    if($('ri-detail-title'))$('ri-detail-title').textContent='Expediente';
    if($('ri-detail-notes'))$('ri-detail-notes').value='';
    if($('ri-detail-message'))$('ri-detail-message').textContent='';
    $('ri-email')?.removeAttribute('href');
    if($('rec-inbox-rows'))$('rec-inbox-rows').innerHTML='';
    for(const id of ['ri-total','ri-pending','ri-review','ri-approved']) if($(id))$(id).textContent='—';
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
  async function load() {
    if(!active)return;
    const token=++generation;
    root.setAttribute('aria-busy','true');setMessage('Cargando solicitudes…');
    $('rec-inbox-refresh').disabled=true;
    $('rec-inbox-rows').innerHTML='<tr class="ri-loading"><td colspan="5"><span></span><span></span><span></span></td></tr>';items=[];
    try {
      const result=await rpc('rec_listar',{p_estado:filter,p_busqueda:search,p_pagina:page});
      if(token!==generation)return;
      items=result.items||[];total=result.total||0;
      if(page>0 && total<=page*25){page=0;return await load();}
      const counts=result.counts||{};
      for(const [id,key] of [['ri-total','total'],['ri-pending','pendientes'],['ri-review','revision'],['ri-approved','aprobados']])$(id).textContent=counts[key]??0;
      document.querySelectorAll('[data-rec-pending-count]').forEach(el=>{el.textContent=counts.pendientes||0;el.hidden=!counts.pendientes;});
      setMessage(total?`${total} solicitud${total===1?'':'es'} · Actualizado ${new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}`:'No hay solicitudes con estos filtros. Las nuevas postulaciones aparecerán aquí.');
      $('rec-inbox-rows').innerHTML=items.length ? items.map(renderRow).join('') : '<tr class="ri-empty"><td colspan="5"><strong>No hay solicitudes para mostrar</strong><p>Prueba otro estado o limpia la búsqueda para ver más postulantes.</p></td></tr>';
      $('ri-page-info').textContent=total?`${page*25+1}–${Math.min((page+1)*25,total)} de ${total}`:'';
      $('ri-prev').disabled=page===0;$('ri-next').disabled=(page+1)*25>=total;
    } catch(error) {
      if(token!==generation)return;
      if(error?.code==='42501')clear();
      $('rec-inbox-rows').innerHTML='';
      setMessage(api().message(error),true);
      $('ri-prev').disabled=true;$('ri-next').disabled=true;
    } finally { if(token===generation){root.removeAttribute('aria-busy');$('rec-inbox-refresh').disabled=false;} }
  }
  function openDetail(id) {
    if (busy) return;
    selected=items.find(c=>c.id===id);if(!selected)return;
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
    $('ri-detail-data').innerHTML = `
      <section class="ri-detail-section"><h3>Contacto</h3>${rows([
        ['DNI / Documento',esc(d.dni)],['Teléfono / WhatsApp',phoneHref ? `<a href="tel:${esc(phoneHref)}">${esc(phone)}</a>` : ''],
        ['Correo de contacto',email(d.email)],['Correo para notificaciones',email(d.emailNotificacion)]
      ])}</section>
      <section class="ri-detail-section"><h3>Perfil y disponibilidad</h3>${rows([['Modalidad',esc(d.modalidad)],['Turno',esc(d.turno)]])}</section>
      <section class="ri-detail-section ri-interview"><div class="ri-section-title">${detailIcon('calendar')}<h3>Entrevista solicitada</h3></div><p class="ri-interview-date">${esc(interviewDate || 'Fecha por definir')}<span>${esc(d.entrevistaHora || 'Hora por definir')}</span></p><p class="ri-interview-channel">${esc(d.entrevistaCanal || 'Canal por definir')}</p><p class="ri-field-help">Fecha propuesta por el postulante, sujeta a coordinación.</p></section>
      <section class="ri-detail-section"><h3>Currículum vitae</h3><div class="ri-cv-file"><span class="ri-file-icon">${detailIcon('file')}</span><div class="ri-file-info"><strong>${esc(d.cvName || 'CV adjunto')}</strong><span>${esc(size || 'Documento adjunto')}</span></div><button class="ri-button" type="button" id="ri-download">${detailIcon('download')}Descargar CV</button></div></section>
      <section class="ri-detail-section ri-candidate-notes"><h3>Sobre la postulación</h3><h4>Motivación</h4><p>${esc(d.motivacion || 'El postulante no añadió una motivación.')}</p><h4>Notas para la entrevista</h4><p>${esc(d.notasEntrevista || 'Sin indicaciones adicionales.')}</p></section>
      <details class="ri-record"><summary>Datos del registro</summary>${rows([['Código del expediente',esc(c.codigo)],['Requisitos de postulación',d.requisitosAceptados ? 'Aceptados por el postulante' : 'No aceptados']])}</details>`;
    $('ri-detail-status').value=c.estado;$('ri-detail-notes').value=c.notas_revision||'';$('ri-detail-message').textContent='';
    const recipient = d.emailNotificacion || d.email;
    if (recipient) { $('ri-email').href=`mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(`Postulación KJA · ${c.codigo}`)}`; $('ri-email').removeAttribute('aria-disabled'); }
    else { $('ri-email').removeAttribute('href'); $('ri-email').setAttribute('aria-disabled','true'); }
    syncReview();
    $('rec-inbox-detail').showModal();
    root.querySelector('.ri-detail-body').scrollTop = 0;
    $('ri-detail-title').focus();
  }
  async function saveReview(e) {
    e.preventDefault();if(!selected||busy)return;
    const sessionVersion=authVersion;
    busy=true;$('ri-save').disabled=true;$('ri-save').textContent='Guardando…';
    for (const id of ['ri-close','ri-close-bottom','ri-detail-status','ri-detail-notes']) $(id).disabled=true;
    $('ri-review-form').setAttribute('aria-busy','true');
    detailMessage('');
    try {
      const updated=await rpc('rec_actualizar',{p_id:selected.id,p_estado:$('ri-detail-status').value,p_notas:$('ri-detail-notes').value,p_revision:selected.revision});
      if(sessionVersion!==authVersion)return;
      selected=updated;
      $('ri-current-status').textContent=updated.estado;$('ri-current-status').dataset.status=updated.estado;
      $('ri-save-state').textContent='Todos los cambios guardados';
      detailMessage('Revisión guardada correctamente.');
      await load();
    } catch(error) { if(sessionVersion===authVersion)detailMessage(api().message(error),true); }
    finally {
      busy=false;$('ri-save').textContent='Guardar revisión';
      for (const id of ['ri-close','ri-close-bottom','ri-detail-status','ri-detail-notes']) $(id).disabled=false;
      $('ri-review-form').removeAttribute('aria-busy');
      $('ri-save').disabled=!selected || ($('ri-detail-status').value===selected.estado && $('ri-detail-notes').value===(selected.notas_revision||''));
    }
  }
  async function download() {
    if(!selected)return;
    const sessionVersion=authVersion;
    const button=$('ri-download'), label=button.innerHTML;button.disabled=true;button.textContent='Descargando…';
    try {
      const cv=await rpc('rec_descargar_cv',{p_id:selected.id});
      if(sessionVersion!==authVersion)return;
      const bytes=Uint8Array.from(atob(cv.base64.replace(/\s/g,'')),c=>c.charCodeAt(0));
      const url=URL.createObjectURL(new Blob([bytes],{type:cv.mime}));
      const a=document.createElement('a');a.href=url;a.download=cv.nombre;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
    } catch(error) {if(sessionVersion===authVersion)detailMessage(api().message(error),true);}
    finally {button.disabled=false;button.innerHTML=label;}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    mount();
    client?.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')clear();});
    const portalAdmin = typeof APP !== 'undefined' && APP.access?.acceso_panel && APP.access?.rol === 'direccion';
    const certificatesAdmin = typeof PERFIL !== 'undefined' && PERFIL.rol === 'admin';
    if(portalAdmin || certificatesAdmin)void refresh();
    window.addEventListener('focus',()=>{if(active && root.closest('.view')?.classList.contains('active'))void load();});
    setInterval(()=>{if(active && !document.hidden && !$('rec-inbox-detail')?.open && root.closest('.view')?.classList.contains('active'))void load();},60000);
  });
  window.kjaRecruitment={init:mount,refresh,openDetail,clear};
})();
