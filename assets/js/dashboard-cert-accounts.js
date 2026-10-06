let CERT_ACCOUNTS={rows:[],busy:false,loaded:false,request:0};
function certAccountsAllowed(){return APP.identity.isSystem&&APP.access.rol==='direccion'&&APP.access.acceso_panel;}
function certAccountsMessage(message){$('cert-accounts-message').textContent=message||'';}
async function loadCertificateAccounts(){
 if(!certAccountsAllowed()||CERT_ACCOUNTS.busy)return;
 const request=++CERT_ACCOUNTS.request;CERT_ACCOUNTS.loaded=false;
 $('cert-account-list').innerHTML='<p class="cert-account-empty">Cargando cuentas…</p>';certAccountsMessage('');
 try{
  const {data,error}=await db.rpc('dash_cert_cuentas');
  if(request!==CERT_ACCOUNTS.request||!certAccountsAllowed())return;
  if(error||!data?.ok)throw Error(error?.code==='PGRST202'?'Falta activar la gestión de cuentas en Supabase. Ejecuta dashboard_100_cuentas_certificados.sql.':'No se pudieron cargar las cuentas. Revisa tus permisos y actualiza.');
  CERT_ACCOUNTS.rows=data.cuentas||[];CERT_ACCOUNTS.loaded=true;renderCertificateAccounts();
 }catch(error){CERT_ACCOUNTS.rows=[];$('cert-account-list').innerHTML='';certAccountsMessage(error.message);}
}
function renderCertificateAccounts(){
 const query=$('cert-account-search').value.trim().toLocaleLowerCase('es');
 const rows=CERT_ACCOUNTS.rows.filter(p=>`${p.nombre} ${p.email}`.toLocaleLowerCase('es').includes(query));
 $('cert-account-count').textContent=`${rows.length} de ${CERT_ACCOUNTS.rows.length} cuentas`;
 $('cert-account-list').innerHTML=rows.map(p=>`<article class="cert-account-row"><div class="cert-account-person"><h3>${esc(p.nombre)}</h3><p>${esc(p.email||'Sin correo')}</p><div class="cert-account-meta"><span class="cert-account-state ${p.activo?'':'suspended'}">${p.activo?'Acceso activo':'Acceso suspendido'}</span><span>· ${p.rol==='admin'?'Administrador':'Colaborador'}</span><span>· ${p.serie==null?'Sin serie':`Serie ${esc(p.serie)}`}</span></div></div><div class="cert-account-actions"><button type="button" data-cert-action="edit" data-cert-id="${esc(p.id)}">Editar</button><button type="button" data-cert-action="recovery" data-cert-id="${esc(p.id)}" ${p.activo?'':'disabled'}>Recuperar contraseña</button><button type="button" class="${p.activo?'cert-danger':''}" data-cert-action="status" data-cert-id="${esc(p.id)}">${p.activo?'Suspender':'Reactivar'}</button></div></article>`).join('')||'<p class="cert-account-empty">No hay cuentas para esta búsqueda.</p>';
}
function openCertificateAccount(person=null){
 if(CERT_ACCOUNTS.busy||!certAccountsAllowed())return;
 $('cert-account-form').reset();$('cert-account-id').value=person?.id||'';
 $('cert-account-form-title').textContent=person?'Editar cuenta':'Nueva cuenta';$('cert-account-save').textContent=person?'Guardar cambios':'Crear cuenta';
 $('cert-account-name').value=person?.nombre||'';$('cert-account-email').value=person?.email||'';$('cert-account-email').disabled=!!person;
 $('cert-account-role').value=person?.rol||'colaborador';$('cert-account-series').value=person?.serie??'';
 $('cert-account-password-field').hidden=!!person;$('cert-account-password').required=false;
 $('cert-account-form-message').textContent='';$('cert-account-form').hidden=false;$('cert-account-name').focus();
}
function certAccountsBusy(busy){
 CERT_ACCOUNTS.busy=busy;
 $('view-cert-cuentas').querySelectorAll('button,input,select').forEach(el=>el.disabled=busy);
 if(!busy){
  $('cert-account-email').disabled=!!$('cert-account-id').value;
  $('cert-account-list').querySelectorAll('[data-cert-action="recovery"]').forEach(button=>{
   button.disabled=!CERT_ACCOUNTS.rows.find(p=>p.id===button.dataset.certId)?.activo;
  });
 }
 $('view-cert-cuentas').setAttribute('aria-busy',String(busy));
}
async function certificateAccountEdge(body){
 const {data,error}=await db.functions.invoke('cert-cuentas',{body});
 if(error){let message='No se pudo completar la operación. Comprueba que cert-cuentas esté desplegada.';
  try{message=(await error.context.json()).error||message;}catch{}
  throw Error(message);
 }
 if(!data?.ok)throw Error(data?.error||'No se recibió confirmación del servidor.');return data;
}
async function saveCertificateProfile(person){
 const {data,error}=await db.rpc('dash_cert_guardar',{p_id:person.id,p_nombre:person.nombre,p_rol:person.rol,p_serie:person.serie,p_activo:person.activo});
 if(error||!data?.ok)throw Error(error?.message||'No se pudo guardar la cuenta.');
}
$('cert-account-form').addEventListener('submit',async event=>{
 event.preventDefault();if(CERT_ACCOUNTS.busy||!certAccountsAllowed())return;
 const id=$('cert-account-id').value,person=CERT_ACCOUNTS.rows.find(p=>p.id===id);
 const values={id,nombre:$('cert-account-name').value.trim(),rol:$('cert-account-role').value,serie:$('cert-account-series').value===''?null:Number($('cert-account-series').value),activo:person?.activo??true};
 if(id&&!person){$('cert-account-form-message').textContent='Actualiza la lista antes de editar.';return;}
 certAccountsBusy(true);$('cert-account-form-message').textContent='Guardando…';
 try{
  if(id)await saveCertificateProfile(values);
  else await certificateAccountEdge({action:'create',...values,email:$('cert-account-email').value.trim(),password:$('cert-account-password').value});
  $('cert-account-form').hidden=true;$('cert-account-password').value='';certAccountsBusy(false);
  await loadCertificateAccounts();toast(id?'Cuenta actualizada.':'Cuenta configurada.');
 }catch(error){$('cert-account-form-message').textContent=error.message;}
 finally{certAccountsBusy(false);}
});
$('cert-account-list').addEventListener('click',async event=>{
 const button=event.target.closest('[data-cert-action]');if(!button||CERT_ACCOUNTS.busy||!certAccountsAllowed())return;
 const person=CERT_ACCOUNTS.rows.find(p=>p.id===button.dataset.certId);if(!person)return;
 const action=button.dataset.certAction;if(action==='edit')return openCertificateAccount(person);
 const question=action==='recovery'?`¿Enviar un correo de recuperación a ${person.email}? La contraseña corresponde a su cuenta de acceso compartida con otros módulos.`:`¿${person.activo?'Suspender':'Reactivar'} el acceso a certificados de ${person.nombre}? Sus certificados emitidos se conservarán.`;
 if(!confirm(question))return;certAccountsBusy(true);certAccountsMessage('Procesando…');
 try{
  if(action==='recovery'){await certificateAccountEdge({action:'recovery',id:person.id});certAccountsMessage('Correo de recuperación enviado.');}
  else{await saveCertificateProfile({...person,activo:!person.activo});certAccountsBusy(false);await loadCertificateAccounts();toast('Acceso actualizado.');}
 }catch(error){certAccountsMessage(error.message);}finally{certAccountsBusy(false);}
});
$('cert-accounts-new').onclick=()=>openCertificateAccount();
$('cert-accounts-refresh').onclick=loadCertificateAccounts;
$('cert-account-search').addEventListener('input',()=>{if(CERT_ACCOUNTS.loaded)renderCertificateAccounts();});
$('cert-account-cancel').onclick=()=>{if(CERT_ACCOUNTS.busy)return;$('cert-account-form').hidden=true;$('cert-account-password').value='';$('cert-accounts-new').focus();};
