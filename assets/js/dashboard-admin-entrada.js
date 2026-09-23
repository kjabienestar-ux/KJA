/* Registro de entrada con evidencia recibida por Dirección. */
let ADMIN_ENTRY={busy:false,opening:0,file:null,url:null,permit:null,uploaded:false,uncertain:false,trigger:null};
function adminEntryMessage(text){$('admin-entry-message').textContent=text||'';}
function adminEntryError(reason){
  return ({sin_permiso:'Solo Dirección puede registrar entradas por otra persona.',sesion:'Tu sesión venció. Vuelve a ingresar.',
    fecha_hora:'Indica una fecha y hora de entrada que ya hayan ocurrido (hora de Lima).',nota_requerida:'Explica brevemente por qué Dirección registra esta entrada.',
    modalidad_invalida:'Selecciona Presencial o Virtual.',no_existe:'El colaborador ya no está activo. Actualiza la lista.',
    antes_contrato:'La fecha es anterior al inicio de su contrato.',no_labora:'El colaborador no tiene jornada ese día. Configura primero su jornada o una excepción laboral.',
    horario_incompleto:'Completa primero el horario de entrada y salida del colaborador para esa fecha.',
    ya_marcado:'Ya existe una entrada para esta persona y fecha. No se reemplazó. Actualiza la lista para revisarla.',
    permiso_vencido:'El permiso de carga venció. Pulsa Registrar entrada para iniciar una nueva carga; tu foto se conserva.',
    permiso_invalido:'No se pudo validar la autorización. Vuelve a abrir este formulario.',registro_cambiado:'El registro cambió después de confirmarse. Actualiza la lista para revisarlo.',
    evidencia_no_verificada:'No se pudo verificar la foto subida. Reintenta la carga; tu imagen se conserva.',
    actualizacion:'Esta función aún no está activada. Falta aplicar la migración de entradas por Dirección y actualizar el servicio de evidencias.'})[reason]||'No se pudo completar el registro. Tu foto se conserva; vuelve a intentarlo.';
}
function resetAdminEntryPermit(){ADMIN_ENTRY.permit=null;ADMIN_ENTRY.uploaded=false;ADMIN_ENTRY.uncertain=false;}
function renderAdminEntryState(){
  $('admin-entry-fields').disabled=ADMIN_ENTRY.busy||ADMIN_ENTRY.uncertain;
  $('admin-entry-submit').disabled=ADMIN_ENTRY.busy||!ADMIN_ENTRY.file;
  $('admin-entry-submit').textContent=ADMIN_ENTRY.busy?'Registrando…':ADMIN_ENTRY.uncertain?'Comprobar registro':'Registrar entrada';
  $('admin-entry-dialog').setAttribute('aria-busy',String(ADMIN_ENTRY.busy));
  document.querySelectorAll('[data-close-admin-entry]').forEach(button=>button.disabled=ADMIN_ENTRY.busy);
}
async function openAdminEntry(personId=null){
  if(APP.access?.rol!=='direccion'||ADMIN_ENTRY.busy)return;
  const request=++ADMIN_ENTRY.opening;
  ADMIN_ENTRY.trigger=document.activeElement;clearAdminEntryFile();resetAdminEntryPermit();
  $('admin-entry-form').reset();$('admin-entry-date').max=isoLima();
  $('admin-entry-date').value=$('admin-list-date').value||isoLima();
  $('admin-entry-person').innerHTML='<option value="">Cargando colaboradores…</option>';
  $('admin-entry-modal').hidden=false;document.body.classList.add('admin-entry-open');
  adminEntryMessage('Cargando colaboradores…');renderAdminEntryState();$('admin-entry-person').focus();
  try{
    const {data,error}=await db.rpc('dash_admin_equipo',{p_incluir_inactivos:false});
    if(request!==ADMIN_ENTRY.opening)return;
    if(error||!data?.ok)throw new Error('equipo');
    $('admin-entry-person').innerHTML='<option value="">Selecciona al colaborador</option>'+(data.personas||[]).map(person=>`<option value="${esc(person.id)}">${esc(person.nombre)} · ${esc(person.area||'Sin área')}</option>`).join('');
    if(personId)$('admin-entry-person').value=String(personId);
    adminEntryMessage('');
  }catch{if(request===ADMIN_ENTRY.opening)adminEntryMessage('No se pudo cargar el equipo. Cierra y vuelve a abrir el formulario.');}
}
function clearAdminEntryFile(){
  if(ADMIN_ENTRY.url)URL.revokeObjectURL(ADMIN_ENTRY.url);
  ADMIN_ENTRY.file=null;ADMIN_ENTRY.url=null;
  $('admin-entry-preview').hidden=true;$('admin-entry-preview').removeAttribute('src');$('admin-entry-file').value='';
}
function closeAdminEntry(){
  if(ADMIN_ENTRY.busy)return;
  ADMIN_ENTRY.opening++;$('admin-entry-modal').hidden=true;document.body.classList.remove('admin-entry-open');
  clearAdminEntryFile();resetAdminEntryPermit();ADMIN_ENTRY.trigger?.focus();
}
async function chooseAdminEntryFile(file){
  if(!file||ADMIN_ENTRY.busy||ADMIN_ENTRY.uncertain)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>25*1024*1024){
    $('admin-entry-file').value='';return adminEntryMessage('Elige una imagen JPG, PNG o WebP de hasta 25 MB.');
  }
  ADMIN_ENTRY.busy=true;renderAdminEntryState();adminEntryMessage('Preparando imagen…');
  try{
    const blob=await compressImage(file);clearAdminEntryFile();resetAdminEntryPermit();
    ADMIN_ENTRY.file=blob;ADMIN_ENTRY.url=URL.createObjectURL(blob);
    $('admin-entry-preview').src=ADMIN_ENTRY.url;$('admin-entry-preview').hidden=false;adminEntryMessage('');
  }catch{adminEntryMessage('No se pudo leer la imagen. Elige otra foto.');}
  finally{ADMIN_ENTRY.busy=false;renderAdminEntryState();}
}
async function submitAdminEntry(event){
  event.preventDefault();
  if(ADMIN_ENTRY.busy||!ADMIN_ENTRY.file||APP.access?.rol!=='direccion')return;
  if(!ADMIN_ENTRY.uncertain&&!$('admin-entry-form').reportValidity())return;
  const payload={accion:'entrada_direccion',ext:'jpg',colaborador:Number($('admin-entry-person').value),fecha:$('admin-entry-date').value,
    hora:$('admin-entry-time').value,modalidad:$('admin-entry-mode').value,nota:$('admin-entry-note').value.trim()};
  const signature=JSON.stringify(payload);
  if(ADMIN_ENTRY.permit?.signature!==signature)resetAdminEntryPermit();
  ADMIN_ENTRY.busy=true;renderAdminEntryState();adminEntryMessage('Protegiendo evidencia…');
  let confirmed=false;
  try{
    if(!ADMIN_ENTRY.permit){
      const {data:{session}}=await db.auth.getSession();if(!session)throw Object.assign(new Error(),{motivo:'sesion'});
      const response=await fetch(SUPABASE_URL+'/functions/v1/dash-evidencia',{method:'POST',headers:{apikey:SUPABASE_ANON,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const permit=await response.json().catch(()=>null);
      if(!response.ok||!permit?.ok)throw Object.assign(new Error(),{motivo:permit?.motivo});
      if(!permit.permiso||!permit.ruta||!permit.token)throw Object.assign(new Error(),{motivo:'actualizacion'});
      ADMIN_ENTRY.permit={...permit,signature};
    }
    if(!ADMIN_ENTRY.uploaded){
      const {error}=await db.storage.from('asis-evidencias').uploadToSignedUrl(ADMIN_ENTRY.permit.ruta,ADMIN_ENTRY.permit.token,ADMIN_ENTRY.file,{contentType:'image/jpeg'});
      if(error){resetAdminEntryPermit();throw error;}ADMIN_ENTRY.uploaded=true;
    }
    adminEntryMessage('Confirmando entrada…');ADMIN_ENTRY.uncertain=true;
    const {data,error}=await db.rpc('dash_admin_confirmar_entrada',{p_permiso:ADMIN_ENTRY.permit.permiso});
    if(error){if(error.code==='PGRST202'){ADMIN_ENTRY.uncertain=false;throw Object.assign(error,{motivo:'actualizacion'});}throw error;}
    if(!data?.ok){
      ADMIN_ENTRY.uncertain=false;
      if(['permiso_vencido','evidencia_no_verificada'].includes(data?.motivo))resetAdminEntryPermit();
      throw Object.assign(new Error(),{motivo:data?.motivo});
    }
    confirmed=true;ADMIN_ENTRY.uncertain=false;
    toast(`Entrada ${data.modalidad} registrada por Dirección · ${data.estado==='T'?'Tardanza':'Presente'}.`);
  }catch(error){adminEntryMessage(ADMIN_ENTRY.uncertain?'No pudimos comprobar la respuesta del servidor. Pulsa Comprobar registro para verificar el mismo intento sin duplicarlo.':adminEntryError(error.motivo));}
  finally{ADMIN_ENTRY.busy=false;renderAdminEntryState();}
  if(confirmed){
    closeAdminEntry();
    $('admin-list-date').value=payload.fecha;
    try{await loadAdminAttendance();}catch{toast('La entrada quedó registrada. Actualiza la lista para verla.',true);}
  }
}
$('admin-entry-open').onclick=()=>openAdminEntry();
$('admin-entry-form').onsubmit=submitAdminEntry;
$('admin-entry-form').oninput=()=>{if(!ADMIN_ENTRY.busy&&!ADMIN_ENTRY.uncertain)resetAdminEntryPermit();};
$('admin-entry-file').onchange=event=>chooseAdminEntryFile(event.target.files[0]);
document.querySelectorAll('[data-close-admin-entry]').forEach(button=>button.onclick=closeAdminEntry);
$('admin-entry-modal').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeAdminEntry();}
  if(event.key!=='Tab')return;
  const items=[...$('admin-entry-dialog').querySelectorAll('button,input,select,textarea')].filter(el=>!el.matches(':disabled')&&el.offsetParent!==null);
  const first=items[0],last=items.at(-1);if(!first){event.preventDefault();return;}
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
