/* KJA · Mapas compartidos del dashboard: oficina y ruta presencial. */
let KJA_MAP_LIBRARY_PROMISE=null;

function loadKjaMapLibrary(){
  if(window.L)return Promise.resolve(window.L);
  if(KJA_MAP_LIBRARY_PROMISE)return KJA_MAP_LIBRARY_PROMISE;
  KJA_MAP_LIBRARY_PROMISE=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('map_timeout')),12000);
    let style=document.querySelector('link[data-kja-map-library]');
    const styleReady=new Promise((ok,fail)=>{
      if(style?.dataset.loaded==='true'||style?.sheet)return ok();
      if(!style){
        style=document.createElement('link');style.rel='stylesheet';
        style.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        style.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        style.crossOrigin='anonymous';style.dataset.kjaMapLibrary='true';
        document.head.appendChild(style);
      }
      style.onload=()=>{style.dataset.loaded='true';ok()};
      style.onerror=()=>fail(new Error('map_style'));
    });
    let script=document.querySelector('script[data-kja-map-library]');
    const scriptReady=new Promise((ok,fail)=>{
      if(window.L)return ok();
      if(!script){
        script=document.createElement('script');
        script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
        script.crossOrigin='anonymous';script.dataset.kjaMapLibrary='true';
        document.head.appendChild(script);
      }
      script.onload=()=>{script.dataset.loaded='true';window.L?ok():fail(new Error('map_library'))};
      script.onerror=()=>fail(new Error('map_library'));
    });
    Promise.all([styleReady,scriptReady]).then(()=>{clearTimeout(timeout);resolve(window.L)}).catch(error=>{clearTimeout(timeout);reject(error)});
  }).catch(error=>{KJA_MAP_LIBRARY_PROMISE=null;throw error});
  return KJA_MAP_LIBRARY_PROMISE;
}

function resetKjaMapLibrary(){
  document.querySelectorAll('[data-kja-map-library]').forEach(node=>{if(node.dataset.loaded!=='true')node.remove()});
  KJA_MAP_LIBRARY_PROMISE=null;
}

let MARK_ROUTE_MAP=null;
let MARK_ROUTE_MAP_INITIALIZING=false;
let MARK_ROUTE_OFFICE=null;
let MARK_ROUTE_USER=null;
let MARK_ROUTE_RADIUS=null;
let MARK_ROUTE_LINE=null;

function markRoutePoint(value){if(value===null||value===undefined||value==='')return null;const number=Number(value);return Number.isFinite(number)?number:null}
function markRouteOffice(){
  const lat=markRoutePoint(MARK_PROTOCOL_STATE?.oficina_lat),lon=markRoutePoint(MARK_PROTOCOL_STATE?.oficina_lon);
  return lat!=null&&lon!=null&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180?{lat,lon}:null;
}
function markRouteUser(){
  const lat=markRoutePoint(MARK_GEO?.lat),lon=markRoutePoint(MARK_GEO?.lon);
  return lat!=null&&lon!=null&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180?{lat,lon}:null;
}
function markRoutePin(kind){
  const office=kind==='office',label=office?'Oficina KJA':'Tu ubicación';
  const icon=office?'<path d="M7 20V8l5-4 5 4v12M4 20h16M10 11h4M10 15h4"/>':'<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>';
  return window.L.divIcon({className:`mark-route-marker ${kind}`,html:`<span title="${label}"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg></span>`,iconSize:[42,42],iconAnchor:[21,38]});
}
function markRouteDistanceFallback(a,b){
  if(!a||!b)return null;const rad=value=>value*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function markDirectionsUrl(user,office){
  if(!user||!office)return '';
  const params=new URLSearchParams({api:'1',origin:`${user.lat},${user.lon}`,destination:`${office.lat},${office.lon}`,dir_action:'navigate'});
  return 'https://www.google.com/maps/dir/?'+params.toString();
}
function paintMarkRouteSummary(){
  const panel=$('mark-route-panel');if(!panel)return;
  const office=markRouteOffice(),user=markRouteUser(),serverDistance=markRoutePoint(MARK_GEO?.distance),distance=serverDistance??markRouteDistanceFallback(user,office),link=$('mark-route-open');
  $('mark-route-distance').textContent=user&&office&&Number.isFinite(distance)?formatDistance(distance):'Por verificar';
  const inside=user&&office&&Number.isFinite(distance)&&distance<=Number(MARK_PROTOCOL_STATE?.radio_presencial_m||1000);
  $('mark-route-status').textContent=!office?'Oficina sin configurar':!user?'Ubicación pendiente':inside?'Dentro del radio':'Fuera del radio';
  $('mark-route-status').dataset.state=!office?'error':!user?'pending':inside?'ready':'error';
  $('mark-route-copy').textContent=!office?'Dirección debe configurar el punto oficial antes de habilitar el marcado presencial.':!user?'Verifica tu ubicación para aparecer en el mapa y calcular tu distancia.':inside?`Estás a ${formatDistance(distance)} de la oficina. Puedes continuar con tu registro.`:`Estás a ${formatDistance(distance)} de la oficina. Revisa la ruta para acercarte al radio permitido.`;
  const url=markDirectionsUrl(user,office);if(url){link.href=url;link.removeAttribute('aria-disabled');link.classList.remove('disabled')}else{link.removeAttribute('href');link.setAttribute('aria-disabled','true');link.classList.add('disabled')}
}
function paintMarkRouteLayers(){
  if(!MARK_ROUTE_MAP)return;
  const office=markRouteOffice(),user=markRouteUser();
  if(office){
    const point=[office.lat,office.lon];
    if(!MARK_ROUTE_OFFICE)MARK_ROUTE_OFFICE=window.L.marker(point,{keyboard:true,title:'Oficina KJA',alt:'Oficina KJA',icon:markRoutePin('office')}).addTo(MARK_ROUTE_MAP);else MARK_ROUTE_OFFICE.setLatLng(point);
    if(!MARK_ROUTE_RADIUS)MARK_ROUTE_RADIUS=window.L.circle(point,{radius:Number(MARK_PROTOCOL_STATE?.radio_presencial_m||1000),color:'#e21b72',weight:2,opacity:.76,fillColor:'#ed5796',fillOpacity:.09,interactive:false}).addTo(MARK_ROUTE_MAP);else MARK_ROUTE_RADIUS.setLatLng(point).setRadius(Number(MARK_PROTOCOL_STATE?.radio_presencial_m||1000));
  }
  if(user){
    const point=[user.lat,user.lon];
    if(!MARK_ROUTE_USER)MARK_ROUTE_USER=window.L.marker(point,{keyboard:true,title:'Tu ubicación',alt:'Tu ubicación',icon:markRoutePin('user')}).addTo(MARK_ROUTE_MAP);else MARK_ROUTE_USER.setLatLng(point);
  }else if(MARK_ROUTE_USER){MARK_ROUTE_MAP.removeLayer(MARK_ROUTE_USER);MARK_ROUTE_USER=null}
  if(office&&user){
    const points=[[user.lat,user.lon],[office.lat,office.lon]];
    if(!MARK_ROUTE_LINE)MARK_ROUTE_LINE=window.L.polyline(points,{color:'#075abc',weight:3,opacity:.82,dashArray:'8 9',lineCap:'round',interactive:false}).addTo(MARK_ROUTE_MAP);else MARK_ROUTE_LINE.setLatLngs(points);
    const group=window.L.featureGroup([MARK_ROUTE_OFFICE,MARK_ROUTE_USER,MARK_ROUTE_RADIUS]);MARK_ROUTE_MAP.fitBounds(group.getBounds(),{padding:[34,34],maxZoom:16,animate:false});
  }else{
    if(MARK_ROUTE_LINE){MARK_ROUTE_MAP.removeLayer(MARK_ROUTE_LINE);MARK_ROUTE_LINE=null}
    if(MARK_ROUTE_RADIUS)MARK_ROUTE_MAP.fitBounds(MARK_ROUTE_RADIUS.getBounds(),{padding:[28,28],maxZoom:15,animate:false});
  }
}
async function prepareMarkRouteMap(){
  const panel=$('mark-route-panel'),shell=$('mark-route-map-shell');if(!panel||panel.hidden||(APP.inicio?.dia?.modalidad||'virtual')!=='presencial')return;
  paintMarkRouteSummary();
  if(!markRouteOffice()){shell.dataset.state='error';$('mark-route-map-state').querySelector('b').textContent='Oficina sin ubicación';$('mark-route-map-state').querySelector('small').textContent='Dirección debe guardar el punto oficial.';return}
  if(MARK_ROUTE_MAP){paintMarkRouteLayers();requestAnimationFrame(()=>MARK_ROUTE_MAP.invalidateSize(false));return}
  if(MARK_ROUTE_MAP_INITIALIZING)return;MARK_ROUTE_MAP_INITIALIZING=true;shell.dataset.state='loading';
  try{
    await loadKjaMapLibrary();
    MARK_ROUTE_MAP=window.L.map('mark-route-map',{zoomControl:true,attributionControl:true,dragging:true,scrollWheelZoom:false}).setView([markRouteOffice().lat,markRouteOffice().lon],14);
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(MARK_ROUTE_MAP);
    shell.dataset.state='ready';paintMarkRouteLayers();requestAnimationFrame(()=>MARK_ROUTE_MAP.invalidateSize(false));
  }catch(error){shell.dataset.state='error';$('mark-route-map-state').querySelector('b').textContent='El mapa no pudo cargar';$('mark-route-map-state').querySelector('small').textContent='La verificación y el botón de indicaciones siguen disponibles.';}
  finally{MARK_ROUTE_MAP_INITIALIZING=false}
}
function renderMarkRouteMap(){paintMarkRouteSummary();if(MARK_ROUTE_MAP)paintMarkRouteLayers();else void prepareMarkRouteMap()}
function resetMarkRouteMap(){
  if(MARK_ROUTE_MAP){MARK_ROUTE_MAP.remove();MARK_ROUTE_MAP=null}
  MARK_ROUTE_OFFICE=null;MARK_ROUTE_USER=null;MARK_ROUTE_RADIUS=null;MARK_ROUTE_LINE=null;MARK_ROUTE_MAP_INITIALIZING=false;
}
