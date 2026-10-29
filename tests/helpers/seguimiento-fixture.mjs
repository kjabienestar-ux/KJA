import fs from 'node:fs';
export const date='2026-10-28';
const control=fs.readFileSync('assets/js/dashboard-admin-control.js','utf8');
const cierre=fs.readFileSync('assets/js/dashboard-admin-cierre.js','utf8');
const between=(text,start,end)=>text.slice(text.indexOf(start),text.indexOf(end,text.indexOf(start)));
export const helperSource=fs.readFileSync('assets/js/dashboard-close-model.js','utf8')+
  '\nconst CLOSE_MODEL=window.KJACloseModel;\n'+
  control.slice(0,control.indexOf("$('admin-control-date').value=isoLima();"))+
  '\n'+cierre.slice(0,cierre.indexOf('function adminDrawKey('))+
  '\n'+between(cierre,'function adminReviewStateLabel(','function adminReviewMessage(');
export const moduleSource=fs.readFileSync('assets/js/dashboard-admin-seguimiento.js','utf8');
export function fixtureData(){
  const close=(extra={})=>({estado:'en_curso',aplica_jornada:true,requiere_salida:true,requiere_rpe:true,entrada_at:date+'T13:01:00Z',salida_at:null,modalidad:'virtual',requisitos:[{tipo:'rpe',titulo:'RPE del día',completo:true},{tipo:'comparticiones',titulo:'Facebook',completo:true},{tipo:'salida',titulo:'Salida',completo:false}],asignaciones:[],...extra});
  const people=[
    {id:1,nombre:'María Díaz',area_id:1,area:'Marketing',labora:true,hora_inicio_programada:'08:00',hora_salida_programada:'13:00',cierre:close()},
    {id:2,nombre:'Jorge Ruiz',area_id:2,area:'Psicología',labora:true,cierre:close({estado:'completa',salida_at:date+'T18:00:00Z',requisitos:[]})},
    {id:3,nombre:'Gloria Pérez',area_id:1,area:'Marketing',labora:false,cierre:close({estado:'no_aplica',aplica_jornada:false,entrada_at:null,requisitos:[{tipo:'comparticiones',titulo:'Facebook',completo:true}]})},
    {id:4,nombre:'Carla Salas',area_id:2,area:'Psicología',labora:true,cierre:close({estado:'sin_entrada',entrada_at:null,requisitos:[{tipo:'rpe',titulo:'RPE',completo:false}]})}
  ];
  const delivery=(id,person,extra={})=>({id,colaborador_id:person.id,colaborador:person.nombre,area:person.area,fecha:date,requisito:'rpe',titulo:'RPE del día',estado:'completo',revision_estado:'pendiente',completado_at:date+'T16:00:00Z',archivos:[{path:id+'/reporte.png',mime:'image/png'}],...extra});
  const reviews=[delivery(11,people[0],{archivos:[{path:'11/reporte.png',mime:'image/png'},{path:'11/anexo.png',mime:'image/png'}],detalle:'Reporte del equipo.'}),delivery(12,people[0],{requisito:'comparticiones',titulo:'Facebook'}),delivery(21,people[1],{revision_estado:'aprobada',jornada_cerrada:true}),delivery(31,people[2],{requisito:'comparticiones',titulo:'Facebook'})];
  const rows=people.map(p=>({colaborador_id:p.id,colaborador:p.nombre,area_id:p.area_id,area:p.area,labora:p.labora,entrada_at:p.cierre.entrada_at,salida_at:p.cierre.salida_at,entrada_estado:p.cierre.entrada_at?'P':'',cierre_estado:p.cierre.estado,evidencias_pendientes:1,revision_pendiente:reviews.filter(d=>d.colaborador_id===p.id&&d.revision_estado==='pendiente').length,revision_observada:0,horas_validas:p.id===2?5:0}));
  return {
    dash_admin_cierres:{ok:true,fecha:date,personas:people,asignaciones:[],areas:[{id:1,nombre:'Marketing'},{id:2,nombre:'Psicología'}]},
    dash_admin_control_diario:{ok:true,fecha:date,filas:rows},
    dash_supervision_impedimentos:{ok:true,fecha:date,impedimentos:[]},
    dash_admin_revision_entregas:{ok:true,fecha:date,puede_revisar:true,entregas:reviews}
  };
}
export const bootstrapSource=`
window.APP={sessionUid:'fixture',access:{rol:'direccion',acceso_panel:true},identity:{isLeader:false},view:'gestion',adminSection:'seguimiento'};
window.$=id=>document.getElementById(id);
window.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.initials=s=>String(s||'').split(' ').slice(0,2).map(x=>x[0]).join('');
window.isoLima=()=> '2026-10-28';
window.addIsoDays=(s,n)=>new Date(new Date(s+'T12:00:00Z').getTime()+n*86400000).toISOString().slice(0,10);
window.toast=(...args)=>window.fixtureToasts.push(args);
window.fixtureToasts=[];window.confirm=()=>true;
`;
