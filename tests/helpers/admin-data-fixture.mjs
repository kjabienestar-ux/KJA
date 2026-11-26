import {fixtureData,date} from './seguimiento-fixture.mjs';
import {peopleFixtureData} from './people-workbench-fixture.mjs';
export const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function adminDataFixture(){
  const data=JSON.parse(JSON.stringify(fixtureData()).replaceAll(date,today)),team=peopleFixtureData();
  team.hoy=today;team.personas=team.personas.slice(0,5);team.personas.forEach(p=>{p.activo=true;p.foto_path=null;p.foto_actualizada_at=null;});
  data.dash_admin_equipo=team;data.dash_admin_instituciones={ok:true,personas:team.personas};data.dash_admin_saldos_dias_libres={ok:true,saldos:[]};
  data.dash_admin_roles={ok:true,co_lideres_max:2,resumen:{areas:2,sin_lider:1,con_lider:1},areas:team.areas.map((area,i)=>({...area,personas_activas:3,personas:team.personas.filter(p=>p.area_id===area.id),lider:i?null:{...team.personas[0],cuenta_activa:true},co_lideres:[]})),historial:[]};
  const [year,month]=today.split('-').map(Number),n=new Date(year,month,0).getDate();
  data.dash_admin_mes={ok:true,hoy:today,areas:team.areas,personas:team.personas.map(p=>({...p,resumen:{P:5,T:1,J:0,pendientes:0,incompletas:0},dias:Array.from({length:n},(_,i)=>({fecha:today.slice(0,8)+String(i+1).padStart(2,'0'),laborable:true,estado:i<5?'P':null,motivo:'Sin registro'}))})),feriados:[]};
  data.dash_admin_cierres_mes={ok:true,cierres:[]};
  data.dash_admin_feriados_proximos={ok:true,hoy:today,puede_editar:true,feriados:[]};
  data.dash_admin_marcado={ok:true,resumen:{activos:5,con_pin:4,sin_pin:1,bloqueados:0,sin_dni:0},config:{activo:true,tolerancia_min:15,clave:'fixture-only'},personas:team.personas.map(p=>({...p,dni_configurado:true,tiene_pin:true,tiene_cuenta:true})),solicitudes:[],historial:[]};
  data.dash_admin_geocerca={ok:true,config:{oficina_lat:null,oficina_lon:null}};
  data.dash_reporte_facebook={desde:today.slice(0,8)+'01',hasta:today,inicio_sistema:today.slice(0,8)+'01',habilitado:true,generado_at:today+'T15:00:00Z',filas:team.personas.flatMap(p=>[0,1].map(i=>({id:p.id,nombre:p.nombre,area:p.area,fecha:today.slice(0,8)+String(i+1).padStart(2,'0'),estado:i?'sin_evidencia':'con_evidencia',revision:'aprobado',capturas:i?0:3})))};
  data.dash_ranking_mes={version:4,salida_anticipacion_min:5,salida_gracia_min:30,filas:team.personas.map(p=>({...p,inicio_conocido:true,metricas:{dias_mes:10,dias:10,dias_participacion:12,entradas_puntuales:10,salidas_mes:10,salidas_puntuales:10,rpe_mes:10,rpe_cumplidos:10,facebook_mes:12,facebook_cumplidos:10}}))};
  return data;
}
