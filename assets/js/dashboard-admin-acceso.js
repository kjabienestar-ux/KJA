/* KJA · Fase 5 — Acceso, PIN y cierre seguro de la transición. */
function accessMessage(text,bad=false){
  const el=$('admin-access-message');el.textContent=text||'';el.classList.toggle('show',!!text);el.classList.toggle('bad',!!text&&bad);
}
function accessUrls(){
  const local=['localhost','127.0.0.1'].includes(location.hostname);
  const portal=location.origin+(local?'/dashboard.html':'/dashboard');
  const activation=location.origin+(local?'/marcar.html':'/marcar')+'?k='+(APP.adminAccess?.config?.clave||'');
  return {portal,activation};
}
function accessRelative(value){
  if(!value)return 'Sin ingresos registrados';
  const minutes=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000));
  if(minutes<1)return 'Ingresó recién';if(minutes<60)return `Ingresó hace ${minutes} min`;
  const hours=Math.floor(minutes/60);if(hours<24)return `Ingresó hace ${hours} h`;
  const days=Math.floor(hours/24);if(days===1)return 'Ingresó ayer';if(days<30)return `Ingresó hace ${days} días`;
  const months=Math.round(days/30);return `Ingresó hace ${months} mes${months===1?'':'es'}`;
}
function accessFuture(value){
  if(!value)return '—';const minutes=Math.ceil((new Date(value).getTime()-Date.now())/60000);
  return minutes<=0?'se libera ahora':`se libera en ${minutes} min`;
}

async function loadAdminAccess(){
  if(APP.access.rol!=='direccion')return;
  const request=++APP.adminAccessRequest,button=$('admin-refresh');button.disabled=true;accessMessage('');
  $('admin-access-list').innerHTML='<p class="admin-empty">Revisando accesos del equipo…</p>';
  const [{data,error},{data:geoData,error:geoError}]=await Promise.all([db.rpc('dash_admin_marcado'),db.rpc('dash_admin_geocerca')]);
  if(request!==APP.adminAccessRequest)return;button.disabled=false;
  if(error||!data?.ok||geoError||!geoData?.ok){
    APP.adminAccess=null;
    const missing=(error&&(error.code==='PGRST202'||String(error.message||'').includes('dash_admin_marcado')))||(geoError&&(geoError.code==='PGRST202'||String(geoError.message||'').includes('dash_admin_geocerca')));
    accessMessage(missing?'La modalidad y geocerca todavía no están instaladas en Supabase. Ejecuta dashboard_13_modalidad_y_geocerca.sql.':'No se pudo cargar el centro de acceso. Actualiza e inténtalo nuevamente.',true);
    $('admin-access-list').innerHTML='<p class="admin-empty">La información de acceso no está disponible.</p>';return;
  }
  data.config={...(data.config||{}),...(geoData.config||{})};
  APP.adminAccess=data;renderAdminAccess();
}

function renderAdminAccess(){
  const data=APP.adminAccess;if(!data)return;const cfg=data.config||{},summary=data.resumen||{},urls=accessUrls();
  $('admin-portal-url').value=urls.portal;$('admin-activation-url').value=urls.activation;
  $('admin-access-tolerance').value=cfg.tolerancia_min??15;$('admin-access-evidence').checked=true;$('admin-access-evidence').disabled=true;$('admin-access-legacy').checked=!!cfg.activo;
  $('admin-office-lat').value=cfg.oficina_lat??'';$('admin-office-lon').value=cfg.oficina_lon??'';
  const officeReady=Number.isFinite(Number(cfg.oficina_lat))&&Number.isFinite(Number(cfg.oficina_lon));
  $('admin-office-rule').classList.toggle('configured',officeReady);
  $('admin-office-status').textContent=officeReady?`Configurada · radio ${Number(cfg.radio_presencial_m||1000)/1000} km`:'Aún no configurada · presencial bloqueado';
  $('admin-office-detect').textContent=officeReady?'Actualizar desde este dispositivo':'Usar mi ubicación actual';
  $('admin-access-updated').textContent=cfg.actualizado_at?'Última actualización: '+new Date(cfg.actualizado_at).toLocaleString('es-PE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'}):'Sin fecha de actualización';
  const activationStep=document.querySelector('.activation-route');activationStep.classList.toggle('disabled',!cfg.activo);
  const health=$('admin-access-health'),blocked=Number(summary.bloqueados||0),missing=Number(summary.sin_pin||0);
  health.className='admin-access-health '+(blocked||(!cfg.activo&&missing)?'warning':'ready');
  health.innerHTML=`<i></i>${blocked?`${blocked} acceso${blocked===1?'':'s'} bloqueado${blocked===1?'':'s'}`:!cfg.activo&&missing?`Activación cerrada · ${missing} sin PIN`:'Portal y accesos operativos'}`;
  const kpis=[['PERSONAS ACTIVAS',summary.activos||0],['CON PIN',summary.con_pin||0],['SIN PIN',summary.sin_pin||0],['BLOQUEADOS',summary.bloqueados||0],['SIN DNI',summary.sin_dni||0]];
  $('admin-access-kpis').innerHTML=kpis.map(item=>`<article class="admin-list-kpi"><small>${item[0]}</small><b>${item[1]}</b></article>`).join('');
  renderAccessRequests();renderAccessPeople();renderAccessAudit();paintAccessQr(urls.portal);
}

function renderAccessRequests(){
  const requests=APP.adminAccess?.solicitudes||[];$('admin-access-request-count').textContent=requests.length;
  $('admin-access-requests-wrap').classList.toggle('empty',!requests.length);
  $('admin-access-requests').innerHTML=requests.length?requests.map(request=>`<article class="admin-access-request">
    <span class="avatar">${initials(request.nombre)}</span><span><b>${esc(request.nombre)}</b><small>${esc(request.area||'Sin área')} · ${accessRelative(request.creado_at).replace('Ingresó','Avisó')}</small></span>
    <span class="access-request-change"><small>HORARIO INFORMADO</small><b>${esc(request.horario_nuevo)}</b><em>Anterior: ${esc(request.horario_previo||'No registrado')}</em></span>
    <span class="access-request-actions"><button type="button" data-access-edit-person="${request.colaborador_id}">Abrir ficha</button><button type="button" data-access-resolve="${request.id}" data-applied="true">Marcar atendido</button><button type="button" class="quiet" data-access-resolve="${request.id}" data-applied="false">Descartar</button></span>
  </article>`).join(''):'<p class="admin-empty">No hay cambios de horario pendientes.</p>';
}
function filteredAccessPeople(){
  const query=$('admin-access-search').value.trim().toLocaleLowerCase('es'),filter=$('admin-access-filter').value;
  return (APP.adminAccess?.personas||[]).filter(person=>(!query||`${person.nombre} ${person.area||''}`.toLocaleLowerCase('es').includes(query))&&(
    !filter||(filter==='ready'&&person.tiene_pin&&!person.bloqueado)||(filter==='missing'&&!person.tiene_pin)||(filter==='blocked'&&person.bloqueado)||(filter==='no-dni'&&!person.dni_configurado)
  ));
}
function renderAccessPeople(){
  if(!APP.adminAccess)return;const people=filteredAccessPeople();
  $('admin-access-list').innerHTML=people.length?people.map(person=>{
    const state=person.bloqueado?'blocked':person.tiene_pin?'ready':'missing';
    const label=person.bloqueado?'Bloqueado':person.tiene_pin?'PIN configurado':'Sin PIN';
    const detail=person.bloqueado?accessFuture(person.bloqueado_hasta):person.tiene_pin?accessRelative(person.ultimo_ingreso):person.dni_configurado?'Pendiente de activación':'Registra primero su DNI';
    return `<article class="admin-access-person ${state}"><span class="avatar">${initials(person.nombre)}</span><span class="access-person-name"><b>${esc(person.nombre)}</b><small>${esc(person.area||'Sin área')} · ${person.dni_configurado?'DNI listo':'Sin DNI'}</small></span><span class="access-pin-state"><i></i><span><b>${label}</b><small>${esc(detail)}</small></span></span><span class="access-account-state"><b>${person.tiene_cuenta?'Dashboard activado':'Sin primer ingreso'}</b><small>${person.fallidos_total?person.fallidos_total+' intentos fallidos históricos':'Sin alertas de acceso'}</small></span><span class="access-person-action">${person.tiene_pin?`<button type="button" data-access-reset="${person.id}">Reiniciar PIN</button>`:'<em>—</em>'}</span></article>`;
  }).join(''):'<p class="admin-empty">No hay personas para los filtros seleccionados.</p>';
}
function renderAccessAudit(){
  const events=APP.adminAccess?.eventos||[],labels={config_portal:'Actualizó las reglas de marcado',regenerar_enlace:'Regeneró el enlace de activación',reiniciar_pin:'Reinició un PIN',resolver_horario:'Cerró un aviso de horario',resolver_solicitud:'Resolvió una solicitud personal'};
  $('admin-access-audit').innerHTML=events.length?events.map(event=>`<article><i class="${event.accion}"></i><span><b>${esc(labels[event.accion]||event.accion)}</b><small>${esc(event.actor||'Dirección')}${event.colaborador?' · '+esc(event.colaborador):''}</small></span><time>${new Date(event.created_at).toLocaleString('es-PE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'})}</time></article>`).join(''):'<p class="admin-empty">Las próximas acciones sensibles quedarán registradas aquí.</p>';
}

async function copyAccess(kind){
  const input=$(kind==='portal'?'admin-portal-url':'admin-activation-url'),text=input.value;
  try{await navigator.clipboard.writeText(text);toast(kind==='portal'?'Dirección del portal copiada.':'Enlace de activación copiado.')}
  catch(error){input.focus();input.select();toast('El enlace quedó seleccionado. Copia con Ctrl+C.',true)}
}
function paintAccessQr(text){
  const canvas=$('admin-access-qr'),message=$('admin-access-qr-message');
  const draw=()=>window.QRCode.toCanvas(canvas,text,{width:190,margin:1,color:{dark:'#0b2347',light:'#ffffff'}},error=>{if(error){canvas.hidden=true;message.textContent='No se pudo generar el QR.'}else{canvas.hidden=false;message.textContent=''}});
  if(window.QRCode)return draw();
  if(document.querySelector('script[data-kja-qr]'))return;
  const script=document.createElement('script');script.dataset.kjaQr='true';script.src='https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';script.onload=draw;script.onerror=()=>message.textContent='El QR no cargó; el enlace sigue disponible.';document.head.appendChild(script);
}
function downloadAccessQr(){
  const canvas=$('admin-access-qr');if(canvas.hidden||!canvas.width)return accessMessage('El QR todavía no está disponible para descargar.',true);
  const link=document.createElement('a');link.download='KJA-Portal-QR.png';link.href=canvas.toDataURL('image/png');link.click();toast('QR descargado.');
}

async function saveAccessSettings(event){
  event.preventDefault();accessMessage('');const tolerance=Number($('admin-access-tolerance').value),active=$('admin-access-legacy').checked,evidence=true,officeLat=Number($('admin-office-lat').value),officeLon=Number($('admin-office-lon').value),officeReady=Number.isFinite(officeLat)&&Number.isFinite(officeLon)&&$('admin-office-lat').value!==''&&$('admin-office-lon').value!=='';
  if(!Number.isInteger(tolerance)||tolerance<0||tolerance>120)return accessMessage('La tolerancia debe ser un número entero entre 0 y 120 minutos.',true);
  const missing=Number(APP.adminAccess?.resumen?.sin_pin||0);
  if(!active&&missing&&!confirm(`Hay ${missing} persona${missing===1?'':'s'} sin PIN. Si cierras la activación anterior no podrá${missing===1?'':'n'} crear uno hasta que vuelvas a habilitarla. ¿Continuar?`))return;
  const button=$('admin-access-save');button.disabled=true;button.textContent='Guardando…';
  const {data,error}=await db.rpc('dash_admin_guardar_reglas',{p_tolerancia:tolerance,p_activo:active,p_exigir_evidencia:evidence,p_oficina_lat:officeReady?officeLat:null,p_oficina_lon:officeReady?officeLon:null,p_radio_presencial_m:1000});
  button.disabled=false;button.textContent='Guardar reglas';
  if(error||!data?.ok)return accessMessage(data?.motivo==='configuracion'?'Revisa los valores de configuración.':'No se pudieron guardar las reglas.',true);
  await loadAdminAccess();toast('Reglas de marcado actualizadas.');
}
async function detectOfficeLocation(){
  const button=$('admin-office-detect');button.disabled=true;button.textContent='Obteniendo ubicación…';accessMessage('Permite la ubicación únicamente si estás físicamente en la oficina.');
  const geo=await geolocation({timeout:15000,maximumAge:0});
  button.disabled=false;
  if(!geo.ok){button.textContent='Intentar nuevamente';return accessMessage(markFailureMessage(geo.motivo),true);}
  if(geo.accuracy>150){button.textContent='Mejorar precisión';return accessMessage(`La precisión actual es de ${geo.accuracy} m. Acércate a una ventana o activa el GPS antes de guardar el punto oficial.`,true);}
  $('admin-office-lat').value=geo.lat;$('admin-office-lon').value=geo.lon;
  $('admin-office-rule').classList.add('configured');$('admin-office-status').textContent=`Punto listo · precisión ${geo.accuracy} m · falta guardar`;
  button.textContent='Tomar ubicación nuevamente';accessMessage('Ubicación capturada. Pulsa “Guardar reglas” para activar la geocerca de 1 km.');
}
async function rotateAccessLink(){
  if(!confirm('¿Regenerar el enlace de activación?\n\nLa dirección anterior dejará de funcionar inmediatamente. Los PIN, el dashboard y las asistencias no cambiarán.'))return;
  const button=$('admin-access-rotate');button.disabled=true;button.textContent='Regenerando…';
  const {data,error}=await db.rpc('dash_admin_regenerar_enlace');button.disabled=false;button.textContent='Regenerar enlace';
  if(error||!data?.ok)return accessMessage('No se pudo regenerar el enlace. La dirección actual continúa vigente.',true);
  await loadAdminAccess();toast('Nuevo enlace de activación generado.');
}
async function resetAccessPin(id){
  const person=(APP.adminAccess?.personas||[]).find(item=>String(item.id)===String(id));if(!person)return;
  const activation=!!APP.adminAccess?.config?.activo;
  if(!confirm(`¿Reiniciar el PIN de ${person.nombre}?\n\nSe cerrarán sus sesiones personales y deberá crear un PIN nuevamente.${activation?'':' La activación está deshabilitada; tendrás que habilitarla para que pueda hacerlo.'}`))return;
  accessMessage('Reiniciando PIN…');const {data,error}=await db.rpc('dash_admin_reiniciar_pin',{p_colab:Number(id)});
  if(error||!data?.ok)return accessMessage('No se pudo reiniciar el PIN; el acceso actual se conserva.',true);
  await loadAdminAccess();toast('PIN reiniciado y sesiones personales cerradas.');
}
async function resolveAccessRequest(id,applied){
  if(!applied&&!confirm('¿Descartar este aviso sin aplicar el horario solicitado?'))return;
  accessMessage('Cerrando aviso…');const {data,error}=await db.rpc('dash_admin_resolver_horario',{p_id:Number(id),p_aplicada:applied});
  if(error||!data?.ok)return accessMessage('No se pudo cerrar el aviso.',true);
  await loadAdminAccess();toast(applied?'Aviso marcado como atendido.':'Aviso descartado.');
}
async function editAccessPerson(id){
  await showAdminSection('colaboradores');if(typeof openAdminPerson==='function')openAdminPerson(id);
}

document.querySelectorAll('[data-copy-access]').forEach(button=>button.onclick=()=>copyAccess(button.dataset.copyAccess));
$('admin-download-qr').onclick=downloadAccessQr;$('admin-access-settings').onsubmit=saveAccessSettings;$('admin-access-rotate').onclick=rotateAccessLink;$('admin-office-detect').onclick=detectOfficeLocation;
$('admin-access-search').oninput=renderAccessPeople;$('admin-access-filter').onchange=renderAccessPeople;
$('admin-access-list').onclick=event=>{const button=event.target.closest('[data-access-reset]');if(button)resetAccessPin(button.dataset.accessReset)};
$('admin-access-requests').onclick=event=>{const edit=event.target.closest('[data-access-edit-person]'),resolve=event.target.closest('[data-access-resolve]');if(edit)return editAccessPerson(edit.dataset.accessEditPerson);if(resolve)return resolveAccessRequest(resolve.dataset.accessResolve,resolve.dataset.applied==='true')};
