/* Ficha de consulta del interno. Usa los permisos y datos del directorio. */
let ADMIN_PROFILE={request:0,person:null,sections:[],trigger:null};
const PROFILE_DAY_NAMES=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

function profileValue(value){return value==null||value===''?'Sin registrar':String(value)}
function profileTime(start,end){
  if(!start||!end)return 'Horario sin completar';
  const a=fmtTime(start),b=fmtTime(end);
  return `${a} – ${b}${b<=a?' (día siguiente)':''}`;
}
function profileFacebookActivity(person,extra){
  const section={title:'Comparticiones de Facebook · mes actual',rows:[]};
  if(APP.access.rol!=='direccion'){section.note='El reporte de comparticiones está disponible para Dirección.';return section;}
  if(extra.loading){section.note='Consultando las evidencias de Facebook…';return section;}
  const report=extra.activity;
  if(!report||!Array.isArray(report.filas)){section.note='No se pudo consultar si compartió en Facebook. Pulsa «Reintentar».';return section;}
  const rows=report.filas.filter(row=>String(row.id)===String(person.id)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const yes=rows.filter(row=>row.estado==='con_evidencia').length,no=rows.filter(row=>row.estado==='sin_evidencia').length;
  const labels={con_evidencia:'Sí, con evidencia',sin_evidencia:'No, sin evidencia',en_plazo:'Pendiente · aún en plazo',no_programado:'No le corresponde',sin_historial:'Sin historial',sin_inicio:'Sin fecha de ingreso',no_incorporado:'Aún no incorporado',sin_horario:'Sin horario configurado'};
  section.note=`Del ${adminDate(report.desde)} al ${adminDate(report.hasta)}. ${yes} días con evidencia · ${no} días sin evidencia. Los días aún en plazo pueden cambiar.`;
  section.head=['Fecha','¿Compartió?','Capturas'];
  section.rows=rows.map(row=>[adminDate(row.fecha),labels[row.estado]||'Sin información',row.estado==='con_evidencia'?String(row.capturas||0):'—']);
  if(!rows.length)section.note+=' No hay registros disponibles para esta persona en el período.';
  return section;
}
function adminProfileSections(person,extra={}){
  const r=person.resumen||{},hours=value=>value==null?'Sin registrar':adminHours(value);
  const date=value=>value?adminDate(value):'Sin registrar';
  const sections=[
    {title:'Identidad y vínculo',rows:[['Nombre completo',profileValue(person.nombre)],['DNI',profileValue(person.dni)],['Institución',profileValue(person.institucion)],['Área',profileValue(person.area)],['Vínculo',ADMIN_LINKS[person.tipo_vinculo]||profileValue(person.tipo_vinculo)],['Estado',person.activo?'Activo':'Dado de baja'],['Acceso al portal',person.tiene_cuenta?'Activado':'Aún no ingresó'],['PIN de acceso',person.tiene_pin?'Configurado':'Sin configurar']]},
    {title:'Horario semanal',note:'Horas de Lima (Perú). Se muestra el horario vigente.',head:['Día','Modalidad','Horario','Vínculo'],rows:ADMIN_DAYS.map(([,dow],index)=>{
      const day=(person.horario_semanal||{})[String(dow)]||{},mode=adminMode(person,dow),off=mode==='no_gestiona';
      return [PROFILE_DAY_NAMES[index],ADMIN_MODES[mode]?.[0]||profileValue(mode),off?'No laborable':profileTime(day.ini||person.hora_inicio,day.fin||person.hora_fin),off?'—':ADMIN_LINKS[person.tipo_vinculo==='ambos'?(day.vinc||'practicas'):person.tipo_vinculo]||'Sin registrar'];
    })},
    {title:'Contrato y avance',rows:[['Estado del contrato',person.contrato_pendiente?'Pendiente de confirmar':contractState(person)[0]],['Fecha de inicio',date(person.contrato_inicio)],['Fecha de fin del documento',date(person.contrato_fin_referencia)],['Término estimado',r.pendiente?'Por definir':date(r.fecha_fin_estimada)],['Meta del contrato',hours(person.contrato_horas)],['Horas previas reconocidas',hours(person.horas_previas)],['Horas registradas',hours(r.marcadas)],['Horas cumplidas',hours(r.cumplidas)],['Horas pendientes',hours(r.faltantes)],['Horas por semana',hours(r.semana_horas)],['Observaciones',profileValue(person.contrato_nota)]]}
  ];
  sections.splice(1,0,...profileAttendanceSections(person,extra),profileFacebookActivity(person,extra));
  if(r.voluntariado){const v=r.voluntariado;sections.push({title:'Voluntariado',rows:[['Meta',hours(v.meta)],['Horas cumplidas',hours(v.cumplidas)],['Horas pendientes',hours(v.faltantes)],['Horas por semana',hours(v.semana_horas)],['Término estimado',date(v.fecha_fin_estimada)]]})}
  if(APP.access.rol==='direccion')sections.push({title:'Días libres',rows:[['Saldo disponible',person.dias_libres_saldo==null?'No disponible':String(person.dias_libres_saldo)]]});
  if(r.alertas?.length)sections.push({title:'Observaciones de seguimiento',rows:r.alertas.map((text,index)=>[`Observación ${index+1}`,String(text)])});
  const fb=extra.facebook;
  if(fb?.ok){
    const schedule=fb.configurado?fb.horario||{}:fallbackFacebookSchedule(person);
    sections.push({title:'Horario de Facebook',note:fb.configurado?'Horario de comparticiones configurado para esta persona.':'Comparte según su horario laboral.',head:['Día','Horario'],rows:ADMIN_DAYS.map(([,dow],index)=>[PROFILE_DAY_NAMES[index],schedule[String(dow)]?profileTime(schedule[String(dow)].ini,schedule[String(dow)].fin):'No comparte'])});
  }else sections.push({title:'Horario de Facebook',note:extra.loading?'Cargando horario…':'No se pudo cargar el horario. Usa «Reintentar» para consultar nuevamente.',rows:[]});
  const history=extra.history;
  const labels={horario:'Horario y modalidad',horas_contrato:'Meta de horas',fechas:'Fechas y contrato',otro:'Identidad o estado'};
  sections.push({title:'Historial de cambios',note:history?.ok?((history.historial||[]).length?'Cambios registrados, del más reciente al más antiguo.':'Sin cambios registrados.'):extra.loading?'Cargando historial…':'No se pudo cargar el historial. Usa «Reintentar» para consultar nuevamente.',head:['Fecha','Cambio','Motivo','Registrado por'],rows:history?.ok?(history.historial||[]).map(h=>[date(h.fecha||h.created_at),labels[h.tipo]||profileValue(h.tipo),profileValue(h.nota),profileValue(h.creado_por)]):[]});
  return sections;
}
function profileSectionsMarkup(sections){
  return sections.map(section=>`<section class="person-profile-block${section.attendanceDetail?' person-profile-attendance':''}"><h3>${esc(section.title)}</h3>${section.note?`<p class="person-profile-note">${esc(section.note)}</p>`:''}${section.rows.length?(section.head?`<div class="person-profile-table-wrap" tabindex="0" role="region" aria-label="${esc(section.title)}"><table><thead><tr>${section.head.map(x=>`<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${section.rows.map(row=>`<tr>${row.map((value,index)=>index===0?`<th scope="row">${esc(value)}</th>`:`<td>${esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:`<dl>${section.rows.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`):''}</section>`).join('');
}
function closeAdminProfile(restoreFocus=true){
  ADMIN_PROFILE.request++;
  const host=$('admin-person-profile');if(!host)return;
  host.hidden=true;
  for(const el of document.querySelectorAll('#admin-people-section > [data-profile-hidden]')){el.hidden=false;delete el.dataset.profileHidden;}
  if(restoreFocus&&ADMIN_PROFILE.trigger?.isConnected)ADMIN_PROFILE.trigger.focus();
  ADMIN_PROFILE.person=null;
}
async function openAdminProfile(id,trigger){
  if(!APP.access.acceso_panel)return;
  const person=(APP.adminTeam?.personas||[]).find(p=>String(p.id)===String(id));if(!person)return;
  const host=$('admin-person-profile');if(!host)return;
  const request=++ADMIN_PROFILE.request;
  ADMIN_PROFILE.person=person;ADMIN_PROFILE.trigger=trigger||ADMIN_PROFILE.trigger;
  for(const el of document.querySelectorAll('#admin-people-section > :not(#admin-person-profile)')){if(!el.hidden){el.dataset.profileHidden='';el.hidden=true;}}
  host.hidden=false;
  host.innerHTML=`<div class="person-profile-actions"><button type="button" class="admin-secondary-action" data-profile-back>Volver a colaboradores</button><div><button type="button" class="admin-secondary-action" data-profile-retry hidden>Reintentar</button>${APP.adminTeam.puede_editar?'<button type="button" class="admin-secondary-action" data-profile-edit>Editar datos</button>':''}<button type="button" class="admin-primary-action" data-profile-download disabled>Descargar ficha PDF</button></div></div><header class="person-profile-head">${profileAvatarMarkup(person)}<div><h2 id="person-profile-title" tabindex="-1">Ficha del interno</h2><p class="person-profile-name">${esc(person.nombre)}</p><p>${esc(person.area||'Sin área')} · ${esc(ADMIN_LINKS[person.tipo_vinculo]||'Sin vínculo')} · ${person.activo?'Activo':'Dado de baja'}</p></div></header><p class="person-profile-status" role="status" aria-live="polite">Cargando información complementaria…</p><div class="person-profile-content">${profileSectionsMarkup(adminProfileSections(person,{loading:true}))}</div>`;
  host.querySelector('[data-profile-back]').onclick=()=>closeAdminProfile();
  host.querySelector('[data-profile-retry]').onclick=()=>openAdminProfile(id);
  const edit=host.querySelector('[data-profile-edit]');if(edit)edit.onclick=()=>{closeAdminProfile(false);openAdminPerson(id)};
  host.querySelector('[data-profile-download]').onclick=downloadAdminProfile;
  $('person-profile-title').focus();
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const results=await Promise.allSettled([db.rpc('dash_admin_horario_compartir',{p_colab:Number(id)}),db.rpc('dash_admin_historial_colaborador',{p_colab:Number(id)}),APP.access.rol==='direccion'?db.rpc('dash_reporte_facebook',{p_desde:today.slice(0,7)+'-01',p_hasta:today}):Promise.resolve({data:null}),loadProfileAttendance(person,today,()=>request===ADMIN_PROFILE.request,(done,total)=>{host.querySelector('.person-profile-status').textContent=`Cargando asistencia desde el ingreso: ${done} de ${total} meses…`;}).then(data=>({data}))]);
  if(request!==ADMIN_PROFILE.request)return;
  const data=results.map((result,index)=>result.status==='fulfilled'&&!result.value.error&&(index===2?Array.isArray(result.value.data?.filas):result.value.data?.ok)?result.value.data:null);
  ADMIN_PROFILE.sections=adminProfileSections(person,{facebook:data[0],history:data[1],activity:data[2],attendance:data[3]});
  host.querySelector('.person-profile-content').innerHTML=profileSectionsMarkup(ADMIN_PROFILE.sections);
  const incomplete=!data[0]||!data[1]||(APP.access.rol==='direccion'&&!data[2])||!data[3]||data[3].missing?.length;
  host.querySelector('.person-profile-status').textContent=incomplete?'Parte de la información no está disponible. Puedes reintentar; la descarga indicará los datos que faltan.':'Información del directorio actual. El PDF incluye asistencia desde el ingreso, Facebook, horario, contrato e historial.';
  host.querySelector('[data-profile-retry]').hidden=!incomplete;
  host.querySelector('[data-profile-download]').disabled=false;
}
function buildAdminProfilePdf(person,sections){
  const doc=new jspdf.jsPDF({unit:'mm',format:'a4',compress:true});
  doc.setProperties({title:`Ficha del interno - ${person.nombre}`,author:'KJA'});
  doc.setFontSize(19);doc.setTextColor(9,36,76);doc.text('KJA · Ficha del interno',16,20);
  const name=doc.splitTextToSize(String(person.nombre||'Sin nombre'),178);
  doc.setFontSize(12);doc.text(name,16,30);
  let y=35+name.length*7;
  for(const section of sections){
    if(y>250){doc.addPage();y=20}
    doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text(section.title,16,y);y+=7;
    if(section.note){doc.setFont('helvetica','normal');doc.setFontSize(9);const lines=doc.splitTextToSize(section.note,178);doc.text(lines,16,y);y+=lines.length*4.5+3;}
    if(section.rows.length){doc.autoTable({startY:y,head:section.head?[section.head]:undefined,body:section.rows,theme:'striped',margin:{left:16,right:16,top:18,bottom:20},rowPageBreak:'avoid',styles:{font:'helvetica',fontSize:9,cellPadding:3,overflow:'linebreak',textColor:[21,36,58]},headStyles:{fillColor:[9,36,76],textColor:255},alternateRowStyles:{fillColor:[247,247,244]}});y=doc.lastAutoTable.finalY+12;}
  }
  const pages=doc.getNumberOfPages(),date=new Date().toLocaleString('es-PE',{timeZone:'America/Lima'});
  for(let page=1;page<=pages;page++){doc.setPage(page);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(82,97,119);doc.text(`Generado: ${date} (Lima)`,16,286);doc.text(`${page} / ${pages}`,194,286,{align:'right'});}
  return doc;
}
async function downloadAdminProfile(){
  const person=ADMIN_PROFILE.person,sections=ADMIN_PROFILE.sections;if(!person||!APP.access.acceso_panel)return;
  const host=$('admin-person-profile'),button=host.querySelector('[data-profile-download]');button.disabled=true;button.textContent='Preparando PDF…';
  try{
    await KJAFacebookPDF.load();
    const doc=buildAdminProfilePdf(person,sections);
    const name=String(person.nombre||person.id).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_');
    doc.save(`KJA_Ficha_${name}.pdf`);
  }catch(error){host.querySelector('.person-profile-status').textContent='No se pudo generar el PDF. Vuelve a pulsar «Descargar ficha PDF».';}
  finally{button.disabled=false;button.textContent='Descargar ficha PDF';}
}
