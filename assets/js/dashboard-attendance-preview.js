/* Informe visible en Colaboradores; el visor solicita los archivos al abrir una fecha. */
let ATTENDANCE_PREVIEW={version:0,bundle:null,people:[]};
function resetAttendancePreview(){
  ATTENDANCE_PREVIEW.version++;ATTENDANCE_PREVIEW.bundle=null;
  const host=$('attendance-report-preview');if(host){host.hidden=true;host.innerHTML='';host.removeAttribute('aria-busy');}
  const view=$('attendance-report-view');if(view){view.disabled=false;view.textContent='Ver informe';}
  if(typeof ADMIN_MONTH_DIALOG!=='undefined'&&ADMIN_MONTH_DIALOG?.kind==='attendance-report')closeMonthModal();
}
function attendancePreviewMarkup(bundle){
  const M=KJAAttendanceReport;
  const headers=[M.dailyHeaders[0],'Día',...M.dailyHeaders.slice(1)];
  const weekday=date=>new Intl.DateTimeFormat('es-PE',{weekday:'long',timeZone:'America/Lima'}).format(new Date(date+'T12:00:00-05:00'));
  const files=(items,d,person,kind,index)=>items.length?`<button type="button" class="attendance-evidence-link" data-attendance-day="${esc(d.date)}" data-attendance-person="${esc(String(person.id))}" data-attendance-kind="${kind}" aria-label="Ver ${esc(M.dailyHeaders[index])} de ${esc(person.nombre)} del ${esc(M.date(d.date))}">${M.dailyRow(d)[index].split('\n').map(line=>`<span>${esc(line)}</span>`).join('')}</button>`:'Sin archivo';
  return `<header class="attendance-preview-heading"><div><h3 tabindex="-1" id="attendance-preview-title">Informe de asistencia</h3><p>${esc(M.date(bundle.range.from))} al ${esc(M.date(bundle.range.to))} · Pulsa una fecha para ver todas sus evidencias.</p></div><button type="button" data-attendance-hide>Cerrar informe</button></header>`+
    bundle.reports.map(r=>`<section class="attendance-preview-person"><h4>${esc(r.person.nombre)}</h4>${r.note?`<p>${esc(r.note)}</p>`:`<p>${r.totals.puntuales} puntuales · ${r.totals.tardanzas} tardanzas · ${r.totals.archivos} archivos</p><div class="attendance-preview-scroll" role="region" aria-label="Asistencias de ${esc(r.person.nombre)}" tabindex="0"><table><colgroup>${[9,9,13,6,6,10,11,12,10,14].map(width=>`<col style="width:${width}%">`).join('')}</colgroup><thead><tr>${headers.map(label=>`<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>${r.days.map(d=>`<tr><th scope="row"><button type="button" data-attendance-day="${esc(d.date)}" data-attendance-person="${esc(String(r.person.id))}" aria-label="Ver evidencias de ${esc(r.person.nombre)} del ${esc(M.date(d.date))}">${esc(M.date(d.date))}</button></th><td>${esc(weekday(d.date))}</td><td class="${d.key==='puntuales'?'is-punctual':d.key==='tardanzas'?'is-late':''}">${esc(d.entry)}</td><td>${esc(d.arrival)}</td><td>${esc(d.exit)}</td><td class="${d.jornada==='Incompleta'?'is-incomplete':''}">${esc(d.jornada)}</td>${[d.groups.entrada,d.groups.comparticiones,d.groups.rpe,[...d.groups.salida,...d.groups.asignado]].map((group,i)=>`<td>${files(group,d,r.person,['entrada','comparticiones','rpe','otros'][i],i+5)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}</section>`).join('');
}
async function showAttendancePreview(personId=null){
  if(!APP.access?.acceso_panel)return;
  const host=$('attendance-report-preview'),button=$('attendance-report-view');if(!host)return;
  if(personId!=null){
    const person=(APP.adminTeam?.personas||[]).find(p=>String(p.id)===String(personId));if(!person)return;
    ATTENDANCE_EXPORT_IDS.clear();ATTENDANCE_EXPORT_IDS.add(String(person.id));renderAttendanceExport();
  }
  const people=attendanceExportPeople();
  resetAttendancePreview();const version=ATTENDANCE_PREVIEW.version;
  ATTENDANCE_PREVIEW.people=people;host.hidden=false;
  const live=()=>version===ATTENDANCE_PREVIEW.version&&APP.access?.acceso_panel;
  try{
    if(!people.length)throw Error('Selecciona al menos un colaborador para ver el informe.');
    const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Lima'});
    const range=KJAAttendanceReport.period($('attendance-export-from').value,$('attendance-export-to').value,today);
    host.setAttribute('aria-busy','true');host.innerHTML='<p role="status">Consultando asistencia y evidencias…</p>';
    if(button){button.disabled=true;button.textContent='Cargando informe…';}
    host.scrollIntoView?.({block:'start',behavior:'auto'});
    const bundle=await collectAttendanceReport(people,range,message=>{if(live())host.innerHTML=`<p role="status">${esc(message)}</p>`;},{signFiles:false,isCurrent:live});
    if(!live()||!bundle)return;
    ATTENDANCE_PREVIEW.bundle=bundle;host.innerHTML=attendancePreviewMarkup(bundle);
    $('attendance-preview-title')?.focus({preventScroll:true});
  }catch(error){if(live())host.innerHTML=`<p role="alert">${esc(error.message||'No se pudo cargar el informe.')}</p><button type="button" data-attendance-retry>Reintentar</button>`;}
  finally{if(live()){host.removeAttribute('aria-busy');if(button){button.disabled=false;button.textContent='Ver informe';}}}
}
function openAttendancePreviewDay(personId,date,kind=null){
  if(!APP.access?.acceso_panel)return;
  const report=ATTENDANCE_PREVIEW.bundle?.reports.find(r=>String(r.person.id)===String(personId));
  const day=report?.days.find(d=>d.date===date);
  if(!day||!(APP.adminTeam?.personas||[]).some(p=>String(p.id)===String(personId)))return;
  const ordered=[...report.days].sort((a,b)=>a.date.localeCompare(b.date)),index=ordered.findIndex(d=>d.date===date);
  const nav=(d,label)=>`<button type="button" ${d?`data-attendance-modal-day="${esc(d.date)}" data-attendance-person="${esc(String(personId))}"`:'disabled'}>${label}${d?' · '+esc(KJAAttendanceReport.date(d.date)):''}</button>`;
  ADMIN_MONTH_DIALOG={kind:'attendance-report',personId:String(personId),date};
  openMonthModal('ASISTENCIA Y EVIDENCIAS',report.person.nombre,`${KJAAttendanceReport.date(date)} · ${day.entry} · Entrada ${day.arrival} · Salida ${day.exit}`,
    '<nav class="attendance-day-navigation" aria-label="Cambiar día del informe">'+nav(ordered[index-1],'Día anterior')+nav(ordered[index+1],'Día siguiente')+'</nav><section id="attendance-preview-day" aria-label="Todas las evidencias del día" aria-live="polite"></section>');
  const modal=$('admin-month-modal');modal.classList.add('month-detail-modal');
  const files=kind==='otros'?[...day.groups.salida,...day.groups.asignado]:Object.hasOwn(day.groups,kind)?day.groups[kind]:[];
  modal._dayDetail=KJAMonthDayDetail.mount($('attendance-preview-day'),{person:report.person,day:day.sourceDay,canManageFacebook:false,initialFile:files[0]||null});
}
if($('attendance-report-view'))$('attendance-report-view').onclick=()=>showAttendancePreview();
if($('attendance-report-preview'))$('attendance-report-preview').onclick=event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-attendance-day'))openAttendancePreviewDay(button.dataset.attendancePerson,button.dataset.attendanceDay,button.dataset.attendanceKind);
  if(button.hasAttribute('data-attendance-retry'))void showAttendancePreview();
  if(button.hasAttribute('data-attendance-hide')){resetAttendancePreview();$('attendance-report-view')?.focus();}
};
if($('admin-month-modal'))$('admin-month-modal').addEventListener('click',event=>{const button=event.target.closest('[data-attendance-modal-day]');if(button&&ADMIN_MONTH_DIALOG?.kind==='attendance-report')openAttendancePreviewDay(button.dataset.attendancePerson,button.dataset.attendanceModalDay);});
if($('admin-people-list'))$('admin-people-list').addEventListener('click',event=>{const button=event.target.closest('[data-team-attendance]');if(button)void showAttendancePreview(button.dataset.teamAttendance);});
if($('admin-attendance-export-card')){
  $('admin-attendance-export-card').addEventListener('change',()=>resetAttendancePreview());
  $('admin-attendance-export-card').addEventListener('click',event=>{if(event.target.closest('#attendance-export-visible,#attendance-export-clear,#attendance-export-original'))resetAttendancePreview();});
}
