/* KJA · Fase 6 — Roles visibles y liderazgo seguro por área. */
function rolesMessage(text,bad=false){
  const el=$('admin-roles-message');el.textContent=text||'';el.classList.toggle('show',!!text);el.classList.toggle('bad',!!text&&bad);
}
function roleDate(value){
  return value?new Intl.DateTimeFormat('es-PE',{day:'2-digit',month:'short',year:'numeric',timeZone:'America/Lima'}).format(new Date(value+'T12:00:00-05:00')):'Sin fecha de término';
}
function roleContractStatus(person){
  if(!person)return {kind:'vacant',label:'Liderazgo vacante',detail:'Designa a una persona con su cuenta activada.'};
  if(!person.activo||!person.cuenta_activa)return {kind:'warning',label:'Requiere reemplazo',detail:'La persona o su cuenta ya no está activa.'};
  if(person.contrato_fin_referencia&&person.contrato_fin_referencia<isoLima())return {kind:'warning',label:'Contrato vencido',detail:`Terminó el ${roleDate(person.contrato_fin_referencia)}.`};
  return {kind:'ready',label:'Liderazgo activo',detail:person.contrato_fin_referencia?`Contrato hasta ${roleDate(person.contrato_fin_referencia)}.`:'Cuenta activa sin fecha de término.'};
}

async function loadAdminRoles(){
  if(!(APP.identity.isSystem&&APP.access.rol==='direccion'&&APP.access.acceso_panel))return;
  const request=++APP.adminRolesRequest,button=$('admin-refresh');button.disabled=true;rolesMessage('');
  $('admin-role-map').innerHTML='<p class="admin-empty">Cargando la estructura del equipo…</p>';
  const {data,error}=await db.rpc('dash_admin_roles');
  if(request!==APP.adminRolesRequest)return;button.disabled=false;
  if(error||!data?.ok){
    APP.adminRoles=null;
    const missing=error&&(error.code==='PGRST202'||String(error.message||'').includes('dash_admin_roles'));
    rolesMessage(missing?'La fase 6 todavía no está instalada en Supabase. Ejecuta dashboard_09_roles_y_liderazgo.sql.':'No se pudo cargar la administración de roles. Actualiza e inténtalo nuevamente.',true);
    $('admin-role-map').innerHTML='<p class="admin-empty">La estructura de roles no está disponible.</p>';return;
  }
  APP.adminRoles=data;renderAdminRoles();
}

function renderAdminRoles(){
  const data=APP.adminRoles;if(!data)return;const summary=data.resumen||{};
  const kpis=[['ÁREAS ACTIVAS',summary.areas||0],['CON LÍDER',summary.con_lider||0],['SIN LÍDER',summary.sin_lider||0],['POR REVISAR',summary.lideres_por_revisar||0]];
  $('admin-roles-kpis').innerHTML=kpis.map(item=>`<article class="admin-list-kpi"><small>${item[0]}</small><b>${item[1]}</b></article>`).join('');
  const areas=data.areas||[];
  $('admin-role-map').innerHTML=areas.length?areas.map(area=>{
    const leader=area.lider,status=roleContractStatus(leader),people=area.personas||[],assignable=people.filter(person=>person.asignable);
    const waiting=people.filter(person=>person.activo&&!person.tiene_cuenta).length;
    const selected=leader&&assignable.some(person=>String(person.id)===String(leader.id))?String(leader.id):'';
    const options=assignable.map(person=>`<option value="${person.id}" ${String(person.id)===selected?'selected':''}>${esc(person.nombre)}</option>`).join('');
    return `<article class="admin-role-area ${status.kind}" data-role-area="${area.id}">
      <header class="admin-role-area-head"><span><small>ÁREA</small><h3>${esc(area.nombre)}</h3></span><span class="admin-role-area-count">${area.personas_activas||0} persona${Number(area.personas_activas)===1?'':'s'}</span></header>
      <div class="admin-role-seat">
        <span class="admin-role-seat-mark">${leader?initials(leader.nombre):'—'}</span>
        <span class="admin-role-seat-copy"><small>LÍDER TÉCNICO ACTUAL</small><b>${leader?esc(leader.nombre):'Sin líder asignado'}</b><em class="${status.kind}">${esc(status.label)} · ${esc(status.detail)}</em></span>
        ${leader?`<button type="button" data-role-remove="${area.id}">Quitar acceso</button>`:''}
      </div>
      <div class="admin-role-assignment">
        <label><span>Asignar o reemplazar</span><select data-role-select="${area.id}" ${assignable.length?'':'disabled'}><option value="">Selecciona una persona</option>${options}</select></label>
        <button class="admin-primary-action" type="button" data-role-save="${area.id}" ${assignable.length?'':'disabled'}>${leader?'Guardar reemplazo':'Asignar liderazgo'}</button>
      </div>
      <footer class="admin-role-area-foot"><span><i></i>${area.cuentas_activadas||0} cuentas activadas</span><span class="${waiting?'waiting':''}">${waiting?`${waiting} pendiente${waiting===1?'':'s'} de primer ingreso`:'Todo el equipo activo ya ingresó'}</span></footer>
    </article>`;
  }).join(''):'<p class="admin-empty">No hay áreas activas para administrar.</p>';
  renderRoleAudit();
}

function renderRoleAudit(){
  const events=APP.adminRoles?.eventos||[],labels={asignar_lider:'Asignó un líder técnico',reemplazar_lider:'Reemplazó al líder técnico',retirar_lider:'Retiró el liderazgo'};
  $('admin-role-audit').innerHTML=events.length?events.map(event=>`<article><i class="${event.accion}"></i><span><b>${esc(labels[event.accion]||event.accion)}</b><small>${esc(event.area||'Área')} · ${esc(event.actor||'Administrador')}</small></span><span class="admin-role-audit-change">${event.lider_anterior?esc(event.lider_anterior)+' → ':''}${event.lider_nuevo?esc(event.lider_nuevo):'Sin líder'}</span><time>${new Date(event.created_at).toLocaleString('es-PE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'})}</time></article>`).join(''):'<p class="admin-empty">Las próximas asignaciones quedarán registradas aquí.</p>';
}

async function saveAreaLeader(areaId){
  const area=(APP.adminRoles?.areas||[]).find(item=>String(item.id)===String(areaId)),select=document.querySelector(`[data-role-select="${CSS.escape(String(areaId))}"]`);
  if(!area||!select?.value)return rolesMessage('Selecciona primero a la persona que liderará el área.',true);
  const next=(area.personas||[]).find(person=>String(person.id)===select.value);if(!next)return;
  const action=area.lider&&String(area.lider.id)!==String(next.id)?'reemplazar':'asignar';
  if(action==='reemplazar'&&!confirm(`¿Reemplazar a ${area.lider.nombre} por ${next.nombre} como líder técnico de ${area.nombre}?\n\nEl cambio será inmediato. No modifica contratos, PIN ni asistencias.`))return;
  if(action==='asignar'&&!area.lider&&!confirm(`¿Asignar a ${next.nombre} como líder técnico de ${area.nombre}?\n\nPodrá consultar el perfil y las asistencias de su área.`))return;
  rolesMessage('Guardando el liderazgo…');document.querySelectorAll('[data-role-save],[data-role-remove]').forEach(button=>button.disabled=true);
  const {data,error}=await db.rpc('dash_admin_asignar_lider',{p_area:Number(areaId),p_colab:Number(next.id)});
  if(error||!data?.ok){
    const messages={sin_permiso:'Solo un administrador de sistemas puede cambiar líderes.',persona_area:'La persona ya no está activa en esa área.',sin_cuenta:'La persona debe ingresar al dashboard al menos una vez antes de ser líder.',area:'El área ya no está activa.'};
    rolesMessage(messages[data?.motivo]||'No se pudo guardar el liderazgo. No se realizó ningún cambio.',true);renderAdminRoles();return;
  }
  await loadAdminRoles();toast(data.sin_cambios?'El liderazgo ya estaba asignado.':action==='reemplazar'?'Líder técnico reemplazado.':'Líder técnico asignado.');
}

async function removeAreaLeader(areaId){
  const area=(APP.adminRoles?.areas||[]).find(item=>String(item.id)===String(areaId));if(!area?.lider)return;
  if(!confirm(`¿Quitar a ${area.lider.nombre} como líder técnico de ${area.nombre}?\n\nEl área quedará sin líder hasta que asignes a otra persona. Su acceso personal y sus asistencias se conservarán.`))return;
  rolesMessage('Retirando el liderazgo…');document.querySelectorAll('[data-role-save],[data-role-remove]').forEach(button=>button.disabled=true);
  const {data,error}=await db.rpc('dash_admin_asignar_lider',{p_area:Number(areaId),p_colab:null});
  if(error||!data?.ok){rolesMessage('No se pudo retirar el liderazgo. El acceso actual se conserva.',true);renderAdminRoles();return;}
  await loadAdminRoles();toast('Liderazgo retirado; la cuenta personal se conserva.');
}

$('admin-role-map').onclick=event=>{
  const save=event.target.closest('[data-role-save]'),remove=event.target.closest('[data-role-remove]');
  if(save)return saveAreaLeader(save.dataset.roleSave);if(remove)return removeAreaLeader(remove.dataset.roleRemove);
};
