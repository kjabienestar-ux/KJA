import fs from 'node:fs';
export const peopleScriptFiles=['history-pages.js','dashboard-admin-equipo.js','dashboard-areas.js','dashboard-person-delete.js','dashboard-person-attendance.js','dashboard-person-profile.js','dashboard-people-workbench.js'];
export const peopleSources=peopleScriptFiles.map(file=>fs.readFileSync('assets/js/'+file,'utf8'));
export function peopleFixtureData(){
 const week={'1':{mod:'virtual',ini:'08:00',fin:'13:00'},'2':{mod:'presencial',ini:'08:00',fin:'13:00'},'3':{mod:'virtual',ini:'08:00',fin:'13:00'},'4':{mod:'no_gestiona'},'5':{mod:'no_gestiona'},'6':{mod:'no_gestiona'},'7':{mod:'no_gestiona'}};
 const names=['Ana Victoria Torres Salazar','Diego Medina Rojas','Lucía Campos Vega','Mateo Ríos López','Elena Vargas Paredes','Camila Rojas Torres'];
 return {ok:true,hoy:'2026-11-04',puede_editar:true,jornadas_disponibles:true,areas:[{id:1,nombre:'Ingeniería',activo:true},{id:2,nombre:'Marketing',activo:true}],personas:names.map((nombre,i)=>({id:i+1,nombre,dni:i===4?'':String(i+1).padStart(8,'0'),activo:i!==5,area_id:i<3?1:2,area:i<3?'Ingeniería':'Marketing',institucion:i===2?'Universidad de Ciencias y Tecnología - Sede Lima Centro':'UTP - LIMA CENTRO',correo:i===2?'':'ana@example.test',dias_laborables:[1,2,3],hora_inicio:'08:00',hora_fin:'13:00',horario_semanal:week,horario_vigente:week,tipo_vinculo:i===3?'ambos':'practicas',contrato_inicio:'2026-09-01',contrato_fin_referencia:'2026-12-31',contrato_horas:360,contrato_pendiente:i===4,horas_previas:20,dias_libres_saldo:2,tiene_pin:i!==2,tiene_cuenta:true,jornadas:[],jornadas_version:0,resumen:{meta:360,marcadas:180,cumplidas:200,previas:20,faltantes:160,semana_horas:15},horarios_temporales:[]}))};
}
export const peopleBootstrap=`
window.APP={access:{acceso_panel:true,rol:'direccion'},adminSection:'colaboradores',adminTeam:FIXTURE_TEAM,adminTeamRequest:0};
window.$=id=>document.getElementById(id);
window.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.isoLima=()=>APP.adminTeam.hoy;
window.fmtTime=s=>s?String(s).slice(0,5):'—';
window.profileAvatarMarkup=p=>'<span class="avatar" aria-hidden="true">'+esc(p.nombre.split(' ').map(x=>x[0]).slice(0,2).join(''))+'</span>';
window.paintPersonAvatar=()=>{};window.toast=(...x)=>fixtureToasts.push(x);window.fixtureToasts=[];
window.renderAttendanceExport=()=>{};window.loadContractDocuments=async()=>new Map();window.hydrateProfilePhotos=async x=>x;
window.confirm=()=>true;window.alert=()=>{};
window.db={rpc:async(name,args)=>{
 window.fixtureCalls.push({name,args});
 if(name==='dash_admin_equipo')return {data:APP.adminTeam};
 if(name==='dash_admin_instituciones')return {data:{ok:true,personas:APP.adminTeam.personas}};
 if(name==='dash_admin_guardar_jornada')return window.fixtureSaveError?{error:{message:'test'}}:{data:{ok:true,id:101}};
 if(name==='dash_admin_horario_compartir')return {data:{ok:true,configurado:true,horario:{}}};
 if(name==='dash_admin_historial_colaborador')return {data:{ok:true,historial:[]}};
 if(name==='dash_admin_saldos_dias_libres')return {data:{ok:true,saldos:[]}};
 if(name==='dash_admin_dias_libres')return {data:{ok:true,persona:{saldo:2},movimientos:[]}};
 return {data:{ok:true}};
}};window.fixtureCalls=[];
`;
