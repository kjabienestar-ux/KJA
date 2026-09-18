/* Informes PDF y Excel: selección de internos independiente del filtro del directorio. */
const ATTENDANCE_EXPORT_PEOPLE=[
  {label:'Melina',dni:'72686519',tokens:['melina','loyola']},
  {label:'Doris',dni:'71089285',tokens:['doris','inga']},
  {label:'Erika',dni:'71338491',tokens:['erika','moreno']},
  {label:'Alviery',dni:'73939131',tokens:['alviery','gonzales']},
  {label:'Ronny',dni:'72020383',tokens:['ronny','ruiz']},
  {label:'Gian Franco Miranda',dni:'72657419',tokens:['gian','franco','miranda']},
  {label:'Alejandra Pimentel',dni:'78021060',tokens:['alejandra','pimentel']}
];
let ATTENDANCE_EXPORT_BUSY=false;
let ATTENDANCE_EXPORT_INITIALIZED=false;
const ATTENDANCE_EXPORT_IDS=new Set();
function attendanceExportPeople(){return (APP.adminTeam?.personas||[]).filter(person=>ATTENDANCE_EXPORT_IDS.has(String(person.id)));}
function attendanceExportVisible(){
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const query=normalize($('attendance-export-search')?.value||'').trim();
  return (APP.adminTeam?.personas||[]).filter(person=>normalize(`${person.nombre} ${person.dni||''} ${person.area||''}`).includes(query));
}
function syncAttendanceExportSelection(){
  const selected=attendanceExportPeople(),count=$('attendance-export-count'),preview=$('attendance-export-preview');
  if(count)count.textContent=`${selected.length} seleccionado${selected.length===1?'':'s'}`;
  if(preview){preview.textContent=selected.length?selected.map(person=>person.nombre).join(' · '):'Elige uno o varios internos para preparar el informe.';preview.title=preview.textContent;}
}
function attendanceExportSelection(people){
  const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const selected=[],issues=[];
  for(const target of ATTENDANCE_EXPORT_PEOPLE){
    const byDni=people.filter(person=>String(person.dni||'').trim()===target.dni);
    const matches=byDni.length?byDni:people.filter(person=>target.tokens.every(token=>normalized(person.nombre).includes(token)));
    if(matches.length!==1){issues.push(`${target.label}: ${matches.length?'hay más de una coincidencia':'no se encontró en el directorio'}`);continue;}
    if(selected.some(person=>String(person.id)===String(matches[0].id))){issues.push(`${target.label}: identidad duplicada`);continue;}
    selected.push(matches[0]);
  }
  return {selected,issues};
}
function renderAttendanceExport(){
  const button=$('admin-attendance-export'),status=$('admin-attendance-export-status');if(!button||ATTENDANCE_EXPORT_BUSY)return;
  if(!ATTENDANCE_EXPORT_INITIALIZED&&APP.adminTeam){attendanceExportSelection(APP.adminTeam.personas||[]).selected.forEach(person=>ATTENDANCE_EXPORT_IDS.add(String(person.id)));ATTENDANCE_EXPORT_INITIALIZED=true;}
  const selected=attendanceExportPeople(),visible=attendanceExportVisible(),options=$('attendance-export-options');
  button.disabled=!APP.access.acceso_panel||!selected.length;
  if($('admin-attendance-excel'))$('admin-attendance-excel').disabled=button.disabled;
  if(options)options.innerHTML=visible.length?visible.map(person=>`<label class="attendance-export-option"><input type="checkbox" value="${esc(String(person.id))}" ${ATTENDANCE_EXPORT_IDS.has(String(person.id))?'checked':''}><span class="attendance-export-avatar" aria-hidden="true">${esc(String(person.nombre||'').split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase())}</span><span class="attendance-export-person"><b>${esc(person.nombre)}</b><small>${esc(person.area||'Sin área')} · DNI ${esc(person.dni||'sin registrar')}${person.activo?'':' · Dado de baja'}</small></span></label>`).join(''):'<p>No encontramos coincidencias. Prueba con otro nombre o DNI.</p>';
  syncAttendanceExportSelection();
  status.textContent=selected.length?'Un archivo consolidado · Asistencia desde el ingreso.':'Selecciona al menos un interno para descargar.';
}
async function collectAttendanceExport(people,today,onProgress=()=>{},includeProfile=false){
  // Reutilizar cada lectura mensual dentro de esta descarga evita consultarla siete veces.
  const cache=new Map(),reports=[];
  const month=period=>{
    if(!cache.has(period.key))cache.set(period.key,loadProfileAttendanceMonth(period));
    return cache.get(period.key);
  };
  const read=async(name,args)=>{try{const result=await db.rpc(name,args);return result.error?null:result.data;}catch(error){return null;}};
  const activity=includeProfile&&APP.access.rol==='direccion'?await read('dash_reporte_facebook',{p_desde:today.slice(0,7)+'-01',p_hasta:today}):null;
  for(const [index,person] of people.entries()){
    onProgress(person,index+1,people.length,0,0);
    const attendance=await loadProfileAttendance(person,today,()=>true,(done,total)=>onProgress(person,index+1,people.length,done,total),month);
    if(!attendance?.ok||attendance.missing?.length)throw new Error(`No se pudo completar la asistencia de ${person.nombre}${attendance?.missing?.length?` (${attendance.missing.join(', ')})`:''}. Vuelve a exportar para reintentar.`);
    const [facebook,history]=includeProfile?await Promise.all([read('dash_admin_horario_compartir',{p_colab:Number(person.id)}),read('dash_admin_historial_colaborador',{p_colab:Number(person.id)})]):[null,null];
    const extra={attendance,facebook,history,activity};
    reports.push({person,attendance,extra,sections:includeProfile?adminProfileSections(person,extra):profileAttendanceSections(person,{attendance})});
  }
  return reports;
}
function buildAttendanceExportPdf(reports,today){
  if(!reports.length)throw new Error('Selecciona al menos un interno.');
  const doc=new jspdf.jsPDF({unit:'mm',format:'a4',compress:true});
  doc.setProperties({title:`KJA - Informe de ${reports.length} internos`,author:'KJA'});
  const text=(value,x,y,size=10,bold=false)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(21,36,58);doc.text(value,x,y)};
  const table=options=>doc.autoTable({theme:'striped',margin:{top:20,bottom:20,left:16,right:16},rowPageBreak:'avoid',styles:{font:'helvetica',fontSize:8,cellPadding:2.5,overflow:'linebreak',textColor:[21,36,58]},headStyles:{fillColor:[9,36,76],textColor:255},alternateRowStyles:{fillColor:[247,247,244]},...options});
  text('KJA · Reporte de asistencia',16,22,19,true);
  text(`Desde el ingreso de cada persona · Corte: ${adminDate(today)}`,16,32);
  const metric=(report,label)=>report.sections.find(section=>section.title==='Asistencia desde el ingreso')?.rows.find(row=>row[0]===label)?.[1]??'—';
  table({startY:42,head:[['Colaborador','Ingreso','P','T','J','F','INC','Horas']],body:reports.map(report=>[report.person.nombre,report.person.contrato_inicio?adminDate(report.person.contrato_inicio):'Sin fecha',...['Presentes (puntuales)','Tardanzas','Justificados','Faltas (sin registro)','Jornadas incompletas','Horas válidas registradas'].map(label=>metric(report,label))])});
  let y=doc.lastAutoTable.finalY+10;
  const intro='P: presentes puntuales · T: tardanzas · J: justificados · F: días laborables pasados sin registro · INC: jornadas incompletas. El detalle individual incluye los demás estados. Los valores sin información se indican con un guion.';
  text(doc.splitTextToSize(intro,178),16,y,9);
  for(const report of reports){
    doc.addPage();y=22;
    doc.setFontSize(15);const name=doc.splitTextToSize(report.person.nombre,178);text(name,16,y,15,true);y+=name.length*6+4;
    text(`DNI: ${report.person.dni||'Sin registrar'} · ${report.person.activo?'Activo':'Dado de baja'}`,16,y);y+=7;
    doc.setFontSize(10);const area=doc.splitTextToSize(report.person.area||'Sin área',178);text(area,16,y);y+=area.length*5+9;
    for(const section of report.sections){
      doc.setFontSize(9);const note=section.note?doc.splitTextToSize(section.note,178):[];
      if(y+14+note.length*4.5>260){doc.addPage();y=22;}
      text(section.title,16,y,12,true);y+=7;
      if(note.length){text(note,16,y,9);y+=note.length*4.5+4;}
      if(section.rows.length){table({startY:y,head:section.head?[section.head]:undefined,body:section.rows});y=doc.lastAutoTable.finalY+12;}
    }
  }
  const pages=doc.getNumberOfPages(),generated=new Date().toLocaleString('es-PE',{timeZone:'America/Lima'});
  for(let page=1;page<=pages;page++){doc.setPage(page);text(`KJA · ${generated} (Lima)`,16,286,8);doc.text(`${page} / ${pages}`,194,286,{align:'right'});}
  return doc;
}
async function downloadAttendanceExport(format='pdf'){
  if(ATTENDANCE_EXPORT_BUSY||!APP.access.acceso_panel)return;
  const button=$('admin-attendance-export'),status=$('admin-attendance-export-status');
  const selected=attendanceExportPeople();
  if(!selected.length){renderAttendanceExport();return;}
  const excel=$('admin-attendance-excel'),picker=$('attendance-export-picker');
  ATTENDANCE_EXPORT_BUSY=true;button.disabled=true;if(excel)excel.disabled=true;if(picker)picker.disabled=true;
  status.textContent='Preparando el informe…';
  try{
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    if(format==='pdf')await KJAFacebookPDF.load();
    const reports=await collectAttendanceExport(selected,today,(person,index,count,done,total)=>{status.textContent=`${index} de ${count}: ${person.nombre}${total?` · ${done} de ${total} meses`:''}…`;},true);
    if(format==='xlsx'){
      const bytes=KJAInternExcel.build(reports,today),url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),link=document.createElement('a');
      link.href=url;link.download=`KJA_Consolidado_${reports.length}_internos_${today}.xlsx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }else buildAttendanceExportPdf(reports,today).save(`KJA_Informe_${reports.length}_internos_${today}.pdf`);
    const unavailable=reports.some(report=>report.sections.some(section=>section.note?.includes('No se pudo')));
    status.textContent=`${format==='xlsx'?'Excel':'PDF'} generado para ${reports.length} internos.${unavailable?' Hay información complementaria no disponible; se indica en el informe.':''}`;
  }catch(error){status.textContent=error.message||'No se pudo generar el informe. Vuelve a exportar para reintentar.';}
  finally{ATTENDANCE_EXPORT_BUSY=false;button.disabled=!attendanceExportPeople().length;if(excel)excel.disabled=button.disabled;if(picker)picker.disabled=false;}
}
if($('admin-attendance-export'))$('admin-attendance-export').onclick=()=>downloadAttendanceExport('pdf');
if($('admin-attendance-excel'))$('admin-attendance-excel').onclick=()=>downloadAttendanceExport('xlsx');
if($('attendance-export-search'))$('attendance-export-search').oninput=renderAttendanceExport;
if($('attendance-export-options'))$('attendance-export-options').onchange=event=>{
  const input=event.target;if(input.type!=='checkbox')return;
  if(input.checked)ATTENDANCE_EXPORT_IDS.add(input.value);else ATTENDANCE_EXPORT_IDS.delete(input.value);
  // Keep the focused checkbox in place for keyboard selection.
  const selected=attendanceExportPeople();$('admin-attendance-export').disabled=!selected.length;$('admin-attendance-excel').disabled=!selected.length;
  syncAttendanceExportSelection();
  $('admin-attendance-export-status').textContent=selected.length?'Un archivo consolidado · Asistencia desde el ingreso.':'Selecciona al menos un interno para descargar.';
};
if($('attendance-export-visible'))$('attendance-export-visible').onclick=()=>{attendanceExportVisible().forEach(person=>ATTENDANCE_EXPORT_IDS.add(String(person.id)));renderAttendanceExport();};
if($('attendance-export-clear'))$('attendance-export-clear').onclick=()=>{ATTENDANCE_EXPORT_IDS.clear();renderAttendanceExport();};
if($('attendance-export-original'))$('attendance-export-original').onclick=()=>{ATTENDANCE_EXPORT_IDS.clear();const match=attendanceExportSelection(APP.adminTeam?.personas||[]);match.selected.forEach(person=>ATTENDANCE_EXPORT_IDS.add(String(person.id)));renderAttendanceExport();if(match.issues.length)$('admin-attendance-export-status').textContent=match.issues.join(' · ');};
