/* Solo el servidor de revisión incluye esta fixture; dashboard.html no la carga. */
window.APP={sessionUid:'preview',access:{rol:'direccion',acceso_panel:true}};
window.$=id=>document.getElementById(id);
window.isoLima=()=> '2026-11-19';
window.cap=text=>text.charAt(0).toUpperCase()+text.slice(1);
window.esc=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.groupAdminLeaveRequests=()=>[];
window.renderAdminRequestGroup=()=>'';
window.syncAdminLeaveReview=()=>{};
window.profileAvatarMarkup=()=>'<span class="admin-person-avatar" aria-hidden="true">PF</span>';
window.toast=()=>{};
window.hydrateProfilePhotos=async people=>people;
window.previewState={release:null,pending:false};
function previewSnapshot(empty=false,pending=false){
  const people=empty?[]:Array.from({length:6},(_,i)=>({id:i+1,nombre:['Persona de prueba A','Persona de prueba B','Persona de prueba C','Persona de prueba D','Persona de prueba E','Persona de prueba F'][i],asis_areas:{nombre:'Área de ensayo'}}));
  return {today:isoLima(),peopleRes:{data:people},marksRes:{data:people.slice(0,3).map(person=>({colaborador_id:person.id,estado:'P'}))},
    closesRes:{data:{ok:true,personas:people.slice(0,2).map(person=>({id:person.id,cierre:{estado:'completa',requisitos:[],asignaciones:[]}}))}},
    legacyRequestsRes:pending?{data:[],pending:true}:{data:empty?[]:[{id:1,colaborador_id:1,horario_nuevo:'09:00 a 18:00 · ejemplo',creado_at:'2026-11-19T14:00:00Z'}]},
    personalRequestsRes:pending?{data:null,pending:true}:{data:{ok:true,solicitudes:[]}},controlRes:{data:{ok:true,filas:[]}}};
}
function paintPreview(empty=false,pending=false){
  const snapshot=previewSnapshot(empty,pending);renderAdminHubSnapshot(snapshot);
  APP.adminHubSnapshotKey=APP.sessionUid+'|'+APP.access.rol+'|'+isoLima();
  APP.adminHubSnapshot={key:APP.adminHubSnapshotKey,snapshot};
}
window.previewOverview=async mode=>{
  if(mode==='data'&&previewState.release){previewState.release();return;}
  if(mode==='data'||mode==='empty'||mode==='partial'){
    paintPreview(mode==='empty',mode==='partial');return;
  }
  previewState.release?.();
  if(mode==='loading'){APP.adminHubSnapshotKey=null;APP.adminHubSnapshot=null;}
  return withAdminSkeleton('overview',()=>new Promise(resolve=>{
    const complete=()=>{paintPreview();previewState.release=null;resolve(true)};
    if(mode==='error'){
      setTimeout(()=>{renderAdminHubError(!!APP.adminHubSnapshotKey);resolve(false)},800);return;
    }
    if(mode==='refresh'){setTimeout(complete,1400);return;}
    previewState.release=complete;
  }));
};
document.getElementById('admin-refresh').onclick=()=>previewOverview('refresh');
document.getElementById('admin-request-refresh').onclick=()=>previewOverview('refresh');
document.querySelector('[data-admin-overview-retry]').onclick=()=>previewOverview('refresh');
