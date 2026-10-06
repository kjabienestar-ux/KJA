/* Gestión de áreas. Las autorizaciones y dependencias se validan en Supabase. */
let ADMIN_AREAS={editing:null,deleting:null,busy:false};
function adminAreasMessage(text){$('admin-areas-message').textContent=text||'';}
function renderAdminAreas(){
  const allowed=!!APP.adminTeam?.puede_editar;
  $('admin-manage-areas').hidden=!allowed;
  if(!allowed){$('admin-areas-panel').hidden=true;$('admin-manage-areas').setAttribute('aria-expanded','false');return;}
  $('admin-areas-list').innerHTML=(APP.adminTeam.areas||[]).map(area=>{
    const id=String(area.id),people=(APP.adminTeam.personas||[]).filter(p=>String(p.area_id)===id);
    if(ADMIN_AREAS.editing===id)return `<div class="admin-area-row"><form class="admin-area-form" data-area-form="${area.id}"><label for="admin-area-edit-name">Nombre del área<input id="admin-area-edit-name" name="nombre" value="${esc(area.nombre)}" required minlength="2" maxlength="60" autocomplete="off"></label><div class="admin-area-actions"><button class="area-save" type="submit">Guardar cambios</button><button type="button" data-area-action="cancel" data-area-id="${area.id}">Cancelar</button></div></form></div>`;
    if(ADMIN_AREAS.deleting===id&&people.length)return `<div class="admin-area-row"><div class="admin-area-confirm"><p role="status"><strong>No se puede eliminar ${esc(area.nombre)}.</strong> Tiene ${people.length} colaborador${people.length===1?'':'es'} asignado${people.length===1?'':'s'}, incluidas las bajas. Primero cambia su área desde la opción Editar de cada colaborador.</p><div class="admin-area-actions"><button type="button" data-area-action="people" data-area-id="${area.id}">Ver colaboradores del área</button><button type="button" data-area-action="cancel" data-area-id="${area.id}">Volver</button></div></div></div>`;
    if(ADMIN_AREAS.deleting===id)return `<div class="admin-area-row"><div class="admin-area-confirm"><p>¿Eliminar <strong>${esc(area.nombre)}</strong>? Esta acción no se puede deshacer.</p><div class="admin-area-actions"><button class="area-delete" type="button" data-area-action="confirm" data-area-id="${area.id}">Sí, eliminar área</button><button type="button" data-area-action="cancel" data-area-id="${area.id}">Cancelar</button></div></div></div>`;
    return `<div class="admin-area-row"><div class="admin-area-info"><b>${esc(area.nombre)}</b><small>${people.length} colaborador${people.length===1?'':'es'}${area.activo?'':' · Inactiva'}</small></div><div class="admin-area-actions"><button type="button" data-area-action="edit" data-area-id="${area.id}" aria-label="Editar ${esc(area.nombre)}">Editar</button><button class="area-delete" type="button" data-area-action="delete" data-area-id="${area.id}" aria-label="Eliminar ${esc(area.nombre)}">Eliminar</button></div></div>`;
  }).join('')||'<p>No hay áreas registradas.</p>';
  $('admin-areas-panel').querySelectorAll('button,input').forEach(el=>el.disabled=ADMIN_AREAS.busy);
  $('admin-areas-panel').setAttribute('aria-busy',String(ADMIN_AREAS.busy));
}
function focusAdminArea(id){
  const target=Array.from($('admin-areas-list').querySelectorAll('[data-area-action="edit"]')).find(el=>el.dataset.areaId===String(id));
  (target||$('admin-areas-close')).focus();
}
async function saveAdminArea(id,name){
  if(ADMIN_AREAS.busy||!APP.adminTeam?.puede_editar)return;
  const deleting=name===null;
  if(!deleting&&(name.length<2||name.length>60)){adminAreasMessage('Escribe un nombre de 2 a 60 caracteres.');return;}
  ADMIN_AREAS.busy=true;renderAdminAreas();adminAreasMessage(deleting?'Eliminando área…':'Guardando cambios…');
  try{
    const {data,error}=await db.rpc(deleting?'dash_admin_eliminar_area':'dash_admin_editar_area',deleting?{p_area:Number(id)}:{p_area:Number(id),p_nombre:name});
    if(error||!data?.ok){
      const messages={sin_permiso:'Tu rol no permite gestionar áreas.',nombre:'Escribe un nombre de 2 a 60 caracteres.',duplicada:'Ya existe un área con ese nombre.',no_existe:'Esta área ya no existe. Actualiza el directorio.',en_uso:'El área tiene colaboradores, asignaciones o historial asociado y no se puede eliminar.'};
      adminAreasMessage(error?.code==='PGRST202'?'Falta activar la gestión de áreas en Supabase: ejecuta dashboard_98_gestion_areas.sql.':messages[data?.motivo]||'No se pudo guardar. Inténtalo de nuevo.');
      return;
    }
    if(deleting)APP.adminTeam.areas=APP.adminTeam.areas.filter(a=>String(a.id)!==String(id));
    else{
      APP.adminTeam.areas=APP.adminTeam.areas.map(a=>String(a.id)===String(id)?{...a,...data.area}:a);
      APP.adminTeam.personas.forEach(p=>{if(String(p.area_id)===String(id))p.area=data.area.nombre;});
    }
    ADMIN_AREAS.editing=null;ADMIN_AREAS.deleting=null;
    fillAdminTeamFilters();renderAdminPeople();renderAdminContracts();
    adminAreasMessage(deleting?'Área eliminada.':'Nombre del área actualizado.');
  }catch(_error){adminAreasMessage('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.');}
  finally{
    ADMIN_AREAS.busy=false;renderAdminAreas();
    if(ADMIN_AREAS.editing){$('admin-area-edit-name').value=name;$('admin-area-edit-name').focus();}
    else if(ADMIN_AREAS.deleting)$('admin-areas-list').querySelector('[data-area-action="cancel"]')?.focus();
    else focusAdminArea(id);
  }
}
$('admin-manage-areas').addEventListener('click',()=>{
  if(ADMIN_AREAS.busy)return;
  const open=$('admin-areas-panel').hidden;
  $('admin-areas-panel').hidden=!open;$('admin-manage-areas').setAttribute('aria-expanded',String(open));
  if(open){ADMIN_AREAS.editing=null;ADMIN_AREAS.deleting=null;adminAreasMessage('');renderAdminAreas();$('admin-areas-close').focus();}
});
$('admin-areas-close').addEventListener('click',()=>{
  if(ADMIN_AREAS.busy)return;
  $('admin-areas-panel').hidden=true;$('admin-manage-areas').setAttribute('aria-expanded','false');$('admin-manage-areas').focus();
});
$('admin-areas-list').addEventListener('click',event=>{
  const button=event.target.closest('[data-area-action]');if(!button||ADMIN_AREAS.busy)return;
  const {areaAction:action,areaId:id}=button.dataset;
  if(action==='confirm'){saveAdminArea(id,null);return;}
  if(action==='people'){
    $('admin-people-search').value='';
    $('admin-people-area').value=id;
    $('admin-people-inactive').checked=true;
    ADMIN_AREAS.editing=null;ADMIN_AREAS.deleting=null;
    $('admin-areas-close').click();renderAdminPeople();
    $('admin-people-list').setAttribute('tabindex','-1');
    $('admin-people-list').focus();
    $('admin-people-list').scrollIntoView({block:'start'});
    return;
  }
  ADMIN_AREAS.editing=null;ADMIN_AREAS.deleting=null;adminAreasMessage('');
  if(action==='edit')ADMIN_AREAS.editing=id;
  if(action==='delete'){
    ADMIN_AREAS.deleting=id;
  }
  renderAdminAreas();
  if(action==='edit'){$('admin-area-edit-name').focus();$('admin-area-edit-name').select();}
  else if(action==='delete')$('admin-areas-list').querySelector('[data-area-action="cancel"]').focus();
  else focusAdminArea(id);
});
$('admin-areas-list').addEventListener('submit',event=>{
  const form=event.target.closest('[data-area-form]');if(!form)return;
  event.preventDefault();saveAdminArea(form.dataset.areaForm,form.elements.nombre.value.trim());
});
$('admin-areas-panel').addEventListener('keydown',event=>{
  if(event.key!=='Escape'||ADMIN_AREAS.busy)return;
  event.preventDefault();
  if(ADMIN_AREAS.editing||ADMIN_AREAS.deleting){const id=ADMIN_AREAS.editing||ADMIN_AREAS.deleting;ADMIN_AREAS.editing=null;ADMIN_AREAS.deleting=null;renderAdminAreas();adminAreasMessage('');focusAdminArea(id);}
  else $('admin-areas-close').click();
});
