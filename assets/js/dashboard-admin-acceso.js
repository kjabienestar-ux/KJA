/* KJA · Fase 5 — Acceso, PIN y cierre seguro de la transición. */
const OFFICE_RADIUS_M=1000;
const OFFICE_MAP_DEFAULT=[-12.046374,-77.042793];
let OFFICE_MAP=null,OFFICE_MARKER=null,OFFICE_RADIUS=null,OFFICE_MAP_LIBRARY=null,OFFICE_MAP_INITIALIZING=false,OFFICE_ORIGINAL=null,OFFICE_SELECTED_LABEL='',OFFICE_SEARCH_AT=0;
function setOfficeDetectLabel(text){const button=$('admin-office-detect'),label=button.querySelector('span');if(label)label.textContent=text;else button.textContent=text}

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
  const officeReady=cfg.oficina_lat!==null&&cfg.oficina_lat!==undefined&&cfg.oficina_lon!==null&&cfg.oficina_lon!==undefined&&Number.isFinite(Number(cfg.oficina_lat))&&Number.isFinite(Number(cfg.oficina_lon));
  OFFICE_ORIGINAL=officeReady?{lat:Number(cfg.oficina_lat),lon:Number(cfg.oficina_lon)}:null;OFFICE_SELECTED_LABEL='';
  syncOfficeSelection({saved:true});prepareOfficeMap();
  setOfficeDetectLabel(officeReady?'Actualizar desde este dispositivo':'Usar mi ubicación actual');
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
  const events=APP.adminAccess?.eventos||[],labels={config_portal:'Actualizó las reglas de marcado',config_oficina:'Cambió la ubicación de la oficina',regenerar_enlace:'Regeneró el enlace de activación',reiniciar_pin:'Reinició un PIN',resolver_horario:'Cerró un aviso de horario',resolver_solicitud:'Resolvió una solicitud personal'};
  $('admin-access-audit').innerHTML=events.length?events.map(event=>{
    const before=event.detalle?.antes||{},after=event.detalle?.despues||{},formatPoint=point=>point.oficina_lat!=null&&point.oficina_lon!=null&&validOfficePoint(Number(point.oficina_lat),Number(point.oficina_lon))?`${Number(point.oficina_lat).toFixed(6)}, ${Number(point.oficina_lon).toFixed(6)}`:'Sin punto',locationDetail=event.accion==='config_oficina'?`<em class="audit-location-change">${esc(formatPoint(before))} → ${esc(formatPoint(after))}</em>`:'';
    return `<article><i class="${event.accion}"></i><span><b>${esc(labels[event.accion]||event.accion)}</b><small>${esc(event.actor||'Dirección')}${event.colaborador?' · '+esc(event.colaborador):''}</small>${locationDetail}</span><time>${new Date(event.created_at).toLocaleString('es-PE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'})}</time></article>`;
  }).join(''):'<p class="admin-empty">Las próximas acciones sensibles quedarán registradas aquí.</p>';
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

function validOfficePoint(lat,lon){return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180}
function readOfficePoint(){
  const latText=$('admin-office-lat').value.trim(),lonText=$('admin-office-lon').value.trim(),lat=Number(latText),lon=Number(lonText);
  return latText&&lonText&&validOfficePoint(lat,lon)?{lat,lon}:null;
}
function officePointChanged(point=readOfficePoint()){
  if(!OFFICE_ORIGINAL)return !!point;if(!point)return true;
  return Math.abs(point.lat-OFFICE_ORIGINAL.lat)>0.0000005||Math.abs(point.lon-OFFICE_ORIGINAL.lon)>0.0000005;
}
function syncOfficeSelection({saved=false,source='',accuracy=null}={}){
  const point=readOfficePoint(),changed=officePointChanged(point),rule=$('admin-office-rule');
  rule.classList.toggle('configured',!!point);rule.classList.toggle('pending',!!point&&changed);
  $('admin-office-coordinate').textContent=point?(OFFICE_SELECTED_LABEL||`${point.lat.toFixed(6)}, ${point.lon.toFixed(6)}`):'Selecciona una ubicación en el mapa';
  $('admin-office-save-state').textContent=point?(changed?'Falta guardar':'Guardado'):'Sin ubicación';
  $('admin-office-status').textContent=point?(changed?(source==='device'&&accuracy?`Punto listo · precisión ${accuracy} m · falta guardar`:'Nuevo punto listo · falta guardar'):'Configurada · radio 1 km'):'Aún no configurada · presencial bloqueado';
  if(saved&&point)$('admin-office-save-state').textContent='Guardado';
}
function officeMarkerIcon(){
  return window.L.divIcon({className:'admin-office-marker',html:'<span class="admin-office-pin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg></span>',iconSize:[40,40],iconAnchor:[20,36]});
}
function clearOfficeMapPoint(){
  if(!OFFICE_MAP)return;if(OFFICE_MARKER){OFFICE_MAP.removeLayer(OFFICE_MARKER);OFFICE_MARKER=null}if(OFFICE_RADIUS){OFFICE_MAP.removeLayer(OFFICE_RADIUS);OFFICE_RADIUS=null}
}
function paintOfficeMapPoint(point,{focus=false}={}){
  if(!OFFICE_MAP||!point)return;
  const latlng=[point.lat,point.lon];
  if(!OFFICE_MARKER){
    OFFICE_MARKER=window.L.marker(latlng,{draggable:true,keyboard:true,title:'Ubicación oficial de la oficina',alt:'Ubicación oficial de la oficina',icon:officeMarkerIcon()}).addTo(OFFICE_MAP);
    OFFICE_MARKER.on('dragend',event=>{const moved=event.target.getLatLng();setOfficePoint(moved.lat,moved.lng,{source:'map'});});
  }else OFFICE_MARKER.setLatLng(latlng);
  if(!OFFICE_RADIUS)OFFICE_RADIUS=window.L.circle(latlng,{radius:OFFICE_RADIUS_M,color:'#075abc',weight:2,opacity:.9,fillColor:'#2b8ee4',fillOpacity:.13,interactive:false}).addTo(OFFICE_MAP);
  else OFFICE_RADIUS.setLatLng(latlng).setRadius(OFFICE_RADIUS_M);
  if(focus)OFFICE_MAP.fitBounds(OFFICE_RADIUS.getBounds(),{padding:[28,28],maxZoom:15,animate:false});
}
function setOfficePoint(lat,lon,{source='map',accuracy=null,focus=false,label=''}={}){
  lat=Number(lat);lon=Number(lon);if(!validOfficePoint(lat,lon))return accessMessage('La ubicación seleccionada no contiene coordenadas válidas.',true);
  $('admin-office-lat').value=lat.toFixed(6);$('admin-office-lon').value=lon.toFixed(6);OFFICE_SELECTED_LABEL=label||'';
  paintOfficeMapPoint({lat,lon},{focus});syncOfficeSelection({source,accuracy});
}
function loadOfficeMapLibrary(){
  if(window.L)return Promise.resolve(window.L);if(OFFICE_MAP_LIBRARY)return OFFICE_MAP_LIBRARY;
  OFFICE_MAP_LIBRARY=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('map_timeout')),12000);
    let style=document.querySelector('link[data-kja-office-map]');
    const styleReady=new Promise((ok,fail)=>{
      if(style?.dataset.loaded==='true'||style?.sheet)return ok();
      if(!style){style=document.createElement('link');style.rel='stylesheet';style.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';style.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';style.crossOrigin='anonymous';style.dataset.kjaOfficeMap='true';document.head.appendChild(style)}
      style.onload=()=>{style.dataset.loaded='true';ok()};style.onerror=()=>fail(new Error('map_style'));
    });
    let script=document.querySelector('script[data-kja-office-map]');
    const scriptReady=new Promise((ok,fail)=>{
      if(window.L)return ok();
      if(!script){script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';script.crossOrigin='anonymous';script.dataset.kjaOfficeMap='true';document.head.appendChild(script)}
      script.onload=()=>{script.dataset.loaded='true';window.L?ok():fail(new Error('map_library'))};script.onerror=()=>fail(new Error('map_library'));
    });
    Promise.all([styleReady,scriptReady]).then(()=>{clearTimeout(timeout);resolve(window.L)}).catch(error=>{clearTimeout(timeout);reject(error)});
  }).catch(error=>{OFFICE_MAP_LIBRARY=null;throw error});
  return OFFICE_MAP_LIBRARY;
}
async function prepareOfficeMap(){
  const shell=$('admin-office-map-shell');if(!shell||APP.adminSection!=='marcado')return;
  if(OFFICE_MAP){const point=readOfficePoint();point?paintOfficeMapPoint(point):clearOfficeMapPoint();requestAnimationFrame(()=>OFFICE_MAP.invalidateSize(false));return;}
  if(OFFICE_MAP_INITIALIZING)return;OFFICE_MAP_INITIALIZING=true;
  shell.dataset.state='loading';$('admin-office-map-state').querySelector('b').textContent='Cargando mapa…';$('admin-office-map-state').querySelector('small').textContent='También puedes usar las coordenadas exactas.';$('admin-office-map-retry').hidden=true;
  try{
    await loadOfficeMapLibrary();
    OFFICE_MAP=window.L.map('admin-office-map',{zoomControl:true,attributionControl:true}).setView(OFFICE_MAP_DEFAULT,11);
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(OFFICE_MAP);
    OFFICE_MAP.on('click',event=>setOfficePoint(event.latlng.lat,event.latlng.lng,{source:'map'}));
    shell.dataset.state='ready';const point=readOfficePoint();if(point)paintOfficeMapPoint(point,{focus:true});
    requestAnimationFrame(()=>OFFICE_MAP.invalidateSize(false));
  }catch(error){
    shell.dataset.state='error';$('admin-office-map-state').querySelector('b').textContent='El mapa no pudo cargar';$('admin-office-map-state').querySelector('small').textContent='Reintenta o ingresa las coordenadas exactas para continuar.';$('admin-office-map-retry').hidden=false;$('admin-office-coordinates').open=true;
  }finally{OFFICE_MAP_INITIALIZING=false}
}
function retryOfficeMap(){
  document.querySelectorAll('[data-kja-office-map]').forEach(node=>{if(node.dataset.loaded!=='true')node.remove()});OFFICE_MAP_LIBRARY=null;prepareOfficeMap();
}
function officeSearchCacheKey(query){return 'kja-office-search:'+query.trim().toLocaleLowerCase('es-PE')}
function readOfficeSearchCache(query){try{const saved=JSON.parse(localStorage.getItem(officeSearchCacheKey(query))||'null');return saved&&Date.now()-saved.at<2592000000?saved.items:null}catch(error){return null}}
function writeOfficeSearchCache(query,items){try{localStorage.setItem(officeSearchCacheKey(query),JSON.stringify({at:Date.now(),items}))}catch(error){}}
function renderOfficeSearchResults(items){
  const box=$('admin-office-results');box.hidden=false;$('admin-office-search').setAttribute('aria-expanded','true');
  box.innerHTML=items.length?items.map((item,index)=>`<button type="button" role="option" data-office-result="${index}" data-lat="${item.lat}" data-lon="${item.lon}" data-label="${esc(item.display_name)}"><i>${index+1}</i><b>${esc(item.display_name)}</b></button>`).join('')+'<small>Búsqueda © OpenStreetMap · selecciona un resultado para ajustar el pin.</small>':'<small>No encontramos esa dirección. Prueba con calle, distrito y ciudad.</small>';
}
async function searchOfficeAddress(){
  const input=$('admin-office-search'),button=$('admin-office-search-button'),query=input.value.trim();
  if(button.disabled)return;
  if(query.length<4)return accessMessage('Escribe al menos cuatro caracteres para buscar la oficina.',true);
  button.disabled=true;button.textContent='Buscando…';accessMessage('');
  try{
    let items=readOfficeSearchCache(query);
    if(!items){
      const wait=Math.max(0,1000-(Date.now()-OFFICE_SEARCH_AT));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));OFFICE_SEARCH_AT=Date.now();
      const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=pe&q='+encodeURIComponent(query);
      const response=await fetch(url,{headers:{Accept:'application/json'},referrerPolicy:'strict-origin-when-cross-origin'});if(!response.ok)throw new Error('search_network');
      const raw=await response.json();items=(Array.isArray(raw)?raw:[]).map(item=>({lat:Number(item.lat),lon:Number(item.lon),display_name:String(item.display_name||'Ubicación encontrada')})).filter(item=>validOfficePoint(item.lat,item.lon));writeOfficeSearchCache(query,items);
    }
    renderOfficeSearchResults(items);
  }catch(error){$('admin-office-results').hidden=false;$('admin-office-results').innerHTML='<small>No pudimos consultar el mapa. Puedes hacer clic directamente sobre él o usar coordenadas exactas.</small>'}
  finally{button.disabled=false;button.textContent='Buscar'}
}
function chooseOfficeSearchResult(button){
  setOfficePoint(button.dataset.lat,button.dataset.lon,{source:'search',focus:true,label:button.dataset.label});$('admin-office-search').value=button.dataset.label;$('admin-office-results').hidden=true;$('admin-office-search').setAttribute('aria-expanded','false');
}
function applyOfficeCoordinates(){
  const latText=$('admin-office-lat').value.trim(),lonText=$('admin-office-lon').value.trim();
  if(!latText&&!lonText){OFFICE_SELECTED_LABEL='';clearOfficeMapPoint();syncOfficeSelection();return}
  const lat=Number(latText),lon=Number(lonText);if(!validOfficePoint(lat,lon))return;
  setOfficePoint(lat,lon,{source:'coordinates',focus:true});
}

async function saveAccessSettings(event){
  event.preventDefault();accessMessage('');const tolerance=Number($('admin-access-tolerance').value),active=$('admin-access-legacy').checked,evidence=true,latText=$('admin-office-lat').value.trim(),lonText=$('admin-office-lon').value.trim(),officeLat=Number(latText),officeLon=Number(lonText),officeReady=!!latText&&!!lonText&&validOfficePoint(officeLat,officeLon);
  if(!Number.isInteger(tolerance)||tolerance<0||tolerance>120)return accessMessage('La tolerancia debe ser un número entero entre 0 y 120 minutos.',true);
  if((!!latText)!=(!!lonText)||((latText||lonText)&&!officeReady))return accessMessage('Revisa la latitud y longitud: ambas deben ser coordenadas válidas.',true);
  const point=officeReady?{lat:officeLat,lon:officeLon}:null,locationChanged=officePointChanged(point);
  if(OFFICE_ORIGINAL&&!point)return accessMessage('La ubicación oficial no puede quedar vacía. Selecciona otro punto para reemplazarla.',true);
  if(locationChanged&&OFFICE_ORIGINAL&&!confirm(`¿Cambiar la ubicación oficial de la oficina?\n\nEl radio de 1 km se calculará inmediatamente desde el nuevo punto (${officeLat.toFixed(6)}, ${officeLon.toFixed(6)}).`))return;
  if(!point&&!OFFICE_ORIGINAL&&!confirm('La oficina todavía no tiene una ubicación. El marcado presencial permanecerá bloqueado hasta configurarla. ¿Guardar las demás reglas?'))return;
  const missing=Number(APP.adminAccess?.resumen?.sin_pin||0);
  if(!active&&missing&&!confirm(`Hay ${missing} persona${missing===1?'':'s'} sin PIN. Si cierras la activación anterior no podrá${missing===1?'':'n'} crear uno hasta que vuelvas a habilitarla. ¿Continuar?`))return;
  const button=$('admin-access-save');button.disabled=true;button.textContent='Guardando…';
  try{
    const {data,error}=await db.rpc('dash_admin_guardar_reglas',{p_tolerancia:tolerance,p_activo:active,p_exigir_evidencia:evidence,p_oficina_lat:officeReady?officeLat:null,p_oficina_lon:officeReady?officeLon:null,p_radio_presencial_m:OFFICE_RADIUS_M});
    if(error||!data?.ok)return accessMessage(data?.motivo==='sin_permiso'?'Solo Dirección puede cambiar la ubicación oficial.':data?.motivo==='configuracion'?'Revisa los valores de configuración.':'No se pudieron guardar las reglas.',true);
    await loadAdminAccess();toast(locationChanged?'Ubicación oficial y radio presencial actualizados.':'Reglas de marcado actualizadas.');
  }catch(error){accessMessage('No pudimos guardar los cambios. Revisa tu conexión e inténtalo nuevamente.',true)}
  finally{button.disabled=false;button.textContent='Guardar reglas'}
}
async function detectOfficeLocation(){
  const button=$('admin-office-detect');button.disabled=true;setOfficeDetectLabel('Obteniendo ubicación…');accessMessage('Permite la ubicación únicamente si estás físicamente en la oficina.');
  const geo=await geolocation({timeout:15000,maximumAge:0});
  button.disabled=false;
  if(!geo.ok){setOfficeDetectLabel('Intentar nuevamente');return accessMessage(markFailureMessage(geo.motivo),true);}
  if(geo.accuracy>150){setOfficeDetectLabel('Mejorar precisión');return accessMessage(`La precisión actual es de ${geo.accuracy} m. Acércate a una ventana o activa el GPS antes de guardar el punto oficial.`,true);}
  setOfficePoint(geo.lat,geo.lon,{source:'device',accuracy:geo.accuracy,focus:true});
  setOfficeDetectLabel('Tomar ubicación nuevamente');accessMessage('Ubicación capturada. Pulsa “Guardar reglas” para activar la geocerca de 1 km.');
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
$('admin-office-search-button').onclick=searchOfficeAddress;$('admin-office-search').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();searchOfficeAddress()}else if(event.key==='Escape'){$('admin-office-results').hidden=true;event.currentTarget.setAttribute('aria-expanded','false')}};
$('admin-office-results').onclick=event=>{const button=event.target.closest('[data-office-result]');if(button)chooseOfficeSearchResult(button)};$('admin-office-lat').onchange=applyOfficeCoordinates;$('admin-office-lon').onchange=applyOfficeCoordinates;$('admin-office-map-retry').onclick=retryOfficeMap;
$('admin-access-search').oninput=renderAccessPeople;$('admin-access-filter').onchange=renderAccessPeople;
$('admin-access-list').onclick=event=>{const button=event.target.closest('[data-access-reset]');if(button)resetAccessPin(button.dataset.accessReset)};
$('admin-access-requests').onclick=event=>{const edit=event.target.closest('[data-access-edit-person]'),resolve=event.target.closest('[data-access-resolve]');if(edit)return editAccessPerson(edit.dataset.accessEditPerson);if(resolve)return resolveAccessRequest(resolve.dataset.accessResolve,resolve.dataset.applied==='true')};
