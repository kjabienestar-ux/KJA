(function () {
  'use strict';
  let client, root, selected, page = 0, total = 0, generation = 0, authVersion = 0, active = false;
  let items = [], search = '', filter = 'Pendiente', timer, busy = false;
  const states = ['Pendiente','En revisión','Entrevista','Aprobado','No seleccionado'];
  const $ = id => root?.querySelector(`#${id}`);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => new Date(value).toLocaleString('es-PE', { timeZone:'America/Lima', dateStyle:'medium', timeStyle:'short' });
  const api = () => window.KJARecruitmentAPI;
  const rpc = (name, args) => api().rpc(client,name,args);
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
      <header class="ri-header"><div><h1>Solicitudes de reclutamiento</h1><p>Revisa los expedientes y coordina las entrevistas del próximo equipo KJA.</p></div><div class="ri-header-actions"><a href="reclutamiento.html" target="_blank" rel="noopener" class="ri-button">Ver convocatoria</a><button type="button" class="ri-button primary" id="rec-inbox-refresh">Actualizar bandeja</button></div></header>
      <dl class="ri-counts"><div><dt>Solicitudes recibidas</dt><dd id="ri-total">—</dd></div><div><dt>Pendientes</dt><dd id="ri-pending">—</dd></div><div><dt>En proceso</dt><dd id="ri-review">—</dd></div><div><dt>Aprobadas</dt><dd id="ri-approved">—</dd></div></dl>
      <div class="ri-toolbar"><label>Estado<select id="rec-inbox-filter"><option value="">Todos los estados</option>${states.map(s=>`<option ${s===filter?'selected':''}>${s}</option>`).join('')}</select></label><label class="ri-search">Buscar postulante<input type="search" id="rec-inbox-search" maxlength="100" placeholder="Nombre, documento, carrera o código"></label></div>
      <p id="rec-inbox-message" class="ri-message" role="status" aria-live="polite">Selecciona Reclutamiento para cargar las solicitudes.</p>
      <div class="ri-table-wrap"><table class="ri-table"><thead><tr><th scope="col">Postulante</th><th scope="col">Perfil y disponibilidad</th><th scope="col">Entrevista solicitada</th><th scope="col">Estado</th><th scope="col"><span class="ri-sr">Acciones</span></th></tr></thead><tbody id="rec-inbox-rows"></tbody></table></div>
      <footer class="ri-pagination"><span id="ri-page-info"></span><div><button class="ri-button" id="ri-prev" type="button" disabled>Anterior</button><button class="ri-button" id="ri-next" type="button" disabled>Siguiente</button></div></footer>
      <dialog class="ri-detail" id="rec-inbox-detail" aria-labelledby="ri-detail-title"><form method="dialog" class="ri-detail-head"><h2 id="ri-detail-title">Expediente</h2><button class="ri-button" aria-label="Cerrar expediente">Cerrar</button></form><div id="ri-detail-data"></div><form id="ri-review-form"><label>Estado del expediente<select id="ri-detail-status">${states.map(s=>`<option>${s}</option>`).join('')}</select></label><label>Notas internas<textarea id="ri-detail-notes" rows="3" maxlength="4000" placeholder="Observaciones para el equipo de selección"></textarea></label><p class="ri-message">Cambiar el estado no envía correos automáticamente. Coordina la respuesta con el postulante.</p><p class="ri-message" id="ri-detail-message" role="status"></p><div class="ri-detail-actions"><button class="ri-button" type="button" id="ri-download">Descargar CV</button><a id="ri-email" class="ri-button">Preparar correo</a><button class="ri-button primary" id="ri-save" type="submit">Guardar revisión</button></div></form></dialog>`;
    $('rec-inbox-refresh').onclick = () => refresh();
    $('rec-inbox-filter').onchange = e => { filter=e.target.value; page=0; void load(); };
    $('rec-inbox-search').oninput = e => { search=e.target.value; page=0; clearTimeout(timer); timer=setTimeout(()=>load(),300); };
    $('ri-prev').onclick=()=>{ if(page>0){ page--;void load(); } };
    $('ri-next').onclick=()=>{ if((page+1)*25<total){ page++;void load(); } };
    $('rec-inbox-rows').onclick=e=>{ const b=e.target.closest('[data-id]'); if(b)openDetail(b.dataset.id); };
    $('ri-review-form').onsubmit = saveReview;
    $('ri-download').onclick = download;
    $('rec-inbox-detail').addEventListener('close',()=>{selected=null;});
  }
  function clear() {
    generation++; authVersion++; active=false;items=[];total=0;selected=null;
    $('rec-inbox-detail')?.close();
    root?.removeAttribute('aria-busy');
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
    $('rec-inbox-rows').innerHTML='';items=[];
    try {
      const result=await rpc('rec_listar',{p_estado:filter,p_busqueda:search,p_pagina:page});
      if(token!==generation)return;
      items=result.items||[];total=result.total||0;
      if(page>0 && total<=page*25){page=0;return await load();}
      const counts=result.counts||{};
      for(const [id,key] of [['ri-total','total'],['ri-pending','pendientes'],['ri-review','revision'],['ri-approved','aprobados']])$(id).textContent=counts[key]??0;
      document.querySelectorAll('[data-rec-pending-count]').forEach(el=>{el.textContent=counts.pendientes||0;el.hidden=!counts.pendientes;});
      setMessage(total?`${total} solicitud${total===1?'':'es'} · Actualizado ${new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}`:'No hay solicitudes con estos filtros. Las nuevas postulaciones aparecerán aquí.');
      $('rec-inbox-rows').innerHTML=items.map(c=>{const d=c.datos;return `<tr><td><strong>${esc(d.nombres)}</strong><span>${esc(d.dni)} · ${esc(d.emailNotificacion)}</span><small>Recibida ${esc(date(c.created_at))}</small></td><td><strong>${esc(d.carrera)}</strong><span>${esc(d.nivel)}</span><small>${esc(d.modalidad)} · ${esc(d.turno)}</small></td><td><strong>${esc(d.entrevistaFecha)} · ${esc(d.entrevistaHora)}</strong><span>${esc(d.entrevistaCanal)}</span><small>Pendiente de coordinación</small></td><td><span class="ri-status" data-status="${esc(c.estado)}">${esc(c.estado)}</span></td><td><button type="button" class="ri-button" data-id="${esc(c.id)}" aria-label="Revisar expediente de ${esc(d.nombres)}">Revisar</button></td></tr>`;}).join('');
      $('ri-page-info').textContent=total?`${page*25+1}–${Math.min((page+1)*25,total)} de ${total}`:'';
      $('ri-prev').disabled=page===0;$('ri-next').disabled=(page+1)*25>=total;
    } catch(error) {
      if(token!==generation)return;
      if(error?.code==='42501')clear();
      setMessage(api().message(error),true);
      $('ri-prev').disabled=true;$('ri-next').disabled=true;
    } finally { if(token===generation)root.removeAttribute('aria-busy'); }
  }
  function openDetail(id) {
    selected=items.find(c=>c.id===id);if(!selected)return;
    const c=selected,d=c.datos;
    $('ri-detail-title').textContent=d.nombres;
    const rows=[['Código',c.codigo],['Recibida',date(c.created_at)],['Documento',d.dni],['Correo de contacto',d.email],['Correo de notificación',d.emailNotificacion],['Teléfono',d.telefonoNotificacion||d.telefono],['Especialidad',`${d.carrera} · ${d.nivel}`],['Modalidad',d.modalidad],['Turno',d.turno],['Entrevista solicitada',`${d.entrevistaFecha} · ${d.entrevistaHora} · ${d.entrevistaCanal}`],['Motivación',d.motivacion||'Sin comentarios'],['Notas para la entrevista',d.notasEntrevista||'Sin comentarios'],['CV',`${d.cvName} · ${(d.cvBytes/1024/1024).toFixed(2)} MB`],['Requisitos',d.requisitosAceptados?'Aceptados por el postulante':'No aceptados']];
    $('ri-detail-data').innerHTML=`<dl>${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
    $('ri-detail-status').value=c.estado;$('ri-detail-notes').value=c.notas_revision||'';$('ri-detail-message').textContent='';
    $('ri-email').href=`mailto:${encodeURIComponent(d.emailNotificacion)}?subject=${encodeURIComponent(`Postulación KJA · ${c.codigo}`)}`;
    $('rec-inbox-detail').showModal();
  }
  async function saveReview(e) {
    e.preventDefault();if(!selected||busy)return;
    const sessionVersion=authVersion;
    busy=true;$('ri-save').disabled=true;
    try {
      const updated=await rpc('rec_actualizar',{p_id:selected.id,p_estado:$('ri-detail-status').value,p_notas:$('ri-detail-notes').value,p_revision:selected.revision});
      if(sessionVersion!==authVersion)return;
      selected=updated;$('ri-detail-message').textContent='Revisión guardada. No se ha enviado ningún correo.';
      await load();
    } catch(error) { if(sessionVersion===authVersion)$('ri-detail-message').textContent=api().message(error); }
    finally {busy=false;$('ri-save').disabled=false;}
  }
  async function download() {
    if(!selected)return;
    const sessionVersion=authVersion;
    const button=$('ri-download');button.disabled=true;
    try {
      const cv=await rpc('rec_descargar_cv',{p_id:selected.id});
      if(sessionVersion!==authVersion)return;
      const bytes=Uint8Array.from(atob(cv.base64.replace(/\s/g,'')),c=>c.charCodeAt(0));
      const url=URL.createObjectURL(new Blob([bytes],{type:cv.mime}));
      const a=document.createElement('a');a.href=url;a.download=cv.nombre;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
    } catch(error) {if(sessionVersion===authVersion)$('ri-detail-message').textContent=api().message(error);}
    finally {button.disabled=false;}
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
