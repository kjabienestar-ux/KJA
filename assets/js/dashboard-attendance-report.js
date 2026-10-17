/* Consulta autorizada de los archivos de cada fecha, sin cambios en Supabase. */
async function collectAttendanceReport(people,range,onProgress=()=>{},{signFiles=true,isCurrent=()=>true}={}){
  const months=new Map(),reports=[];
  const loadMonth=p=>{if(!months.has(p.key))months.set(p.key,loadProfileAttendanceMonth(p));return months.get(p.key)};
  for(const [index,person] of people.entries()){
    if(!isCurrent())return null;
    onProgress(`${index+1} de ${people.length}: ${person.nombre} · asistencia…`);
    const attendance=await loadProfileAttendance(person,range.to,isCurrent,()=>{},loadMonth,range.from);
    if(!isCurrent())return null;
    if(!attendance?.ok||attendance.missing?.length)throw Error(`No se pudo completar la asistencia de ${person.nombre}. Reintenta la descarga.`);
    const details=new Map(),days=attendance.days||[];
    for(let i=0;i<days.length;i+=4){
      if(!isCurrent())return null;
      await Promise.all(days.slice(i,i+4).map(async day=>{
        const {data,error}=await db.rpc('dash_equipo_dia_detalle',{p_colaborador:Number(person.id),p_fecha:day.fecha});
        if(error||!data?.ok)throw Error(`No se pudieron consultar las evidencias de ${person.nombre} del ${KJAAttendanceReport.date(day.fecha)}. Reintenta la descarga.`);
        details.set(day.fecha,data);
      }));
      if(!isCurrent())return null;
      onProgress(`Colaborador ${index+1} de ${people.length}: ${person.nombre} · ${Math.min(i+4,days.length)} de ${days.length} días`,{done:Math.min(i+4,days.length),total:days.length,unit:'días consultados'});
    }
    reports.push(KJAAttendanceReport.build(person,attendance,details));
  }
  const files=reports.flatMap(r=>r.files),signed=new Map();
  files.forEach((file,index)=>{file.ref=index+1});
  if(!signFiles)return {reports,range,files,unavailable:0};
  // Firmar al final: los enlaces duran una hora desde la generación.
  for(let i=0;i<files.length;i+=6){
    await Promise.all(files.slice(i,i+6).map(async file=>{
      const key=file.bucket+'/'+file.path;
      if(!signed.has(key))signed.set(key,(async()=>{
        try{const {data,error}=await db.storage.from(file.bucket).createSignedUrl(file.path,3600);return !error&&/^https:\/\//.test(data?.signedUrl||'')?data.signedUrl:null;}catch{return null;}
      })());
      file.url=await signed.get(key);
    }));
    onProgress('Preparando los enlaces de los archivos del PDF',{done:Math.min(i+6,files.length),total:files.length,unit:'archivos'});
  }
  return {reports,range,files,unavailable:files.filter(f=>!f.url).length};
}
function buildFocusedAttendancePdf(bundle){
  const M=KJAAttendanceReport,doc=new jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
  doc.setProperties({title:'KJA · Asistencia y evidencias',author:'KJA'});
  const text=(s,x,y,size=10,bold=false)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(21,36,58);doc.text(s,x,y)};
  const color=value=>value==='Puntual'||value==='Día libre'?[221,240,228]:value==='Tardanza'?[255,241,204]:value==='Incompleta'?[249,218,219]:null;
  const table=opts=>doc.autoTable({theme:'striped',margin:{top:17,bottom:17,left:14,right:14},rowPageBreak:'avoid',styles:{font:'helvetica',fontSize:9,cellPadding:3,overflow:'linebreak',textColor:[21,36,58]},headStyles:{fillColor:[9,36,76],textColor:255},alternateRowStyles:{fillColor:[246,248,250]},didParseCell:data=>{const fill=color(data.cell.raw);if(data.section==='body'&&fill)data.cell.styles.fillColor=fill},...opts});
  text('Asistencia y evidencias',14,22,22,true);
  text(`${M.date(bundle.range.from)} al ${M.date(bundle.range.to)} · ${bundle.reports.length} personas`,14,31,11);
  table({startY:40,head:[M.summaryHeaders],body:bundle.reports.map(M.summaryRow),columnStyles:{0:{cellWidth:63}}});
  let y=doc.lastAutoTable.finalY+8;
  if(y>174){doc.addPage();y=22;}
  text('Puntualidad = entradas puntuales / entradas registradas (puntuales + tardanzas).',14,y,9);
  text('La entrada y el cierre se evalúan por separado. Los archivos subidos no implican aprobación.',14,y+6,9);
  text('Las referencias # enlazan con el índice de archivos. Enlaces privados válidos durante 1 hora.',14,y+12,9);
  for(const r of bundle.reports){
    doc.addPage();doc.setFontSize(15);const title=doc.splitTextToSize(r.person.nombre,265);text(title,14,22,15,true);y=22+title.length*6;
    if(r.note){text(r.note,14,y+12,11);continue;}
    text(`${r.totals.puntuales} puntuales · ${r.totals.tardanzas} tardanzas · ${r.totals.archivos} archivos`,14,y+3,10);
    table({startY:y+10,head:[M.dailyHeaders],body:r.days.map(M.dailyRow),columnStyles:{0:{cellWidth:24},1:{cellWidth:37},2:{cellWidth:17},3:{cellWidth:17},4:{cellWidth:27}}});
  }
  if(bundle.files.length){
    doc.addPage();text('Archivos subidos',14,22,18,true);text('Pulsa Abrir archivo. Si el enlace venció, genera nuevamente el informe.',14,30,10);
    const groups=bundle.reports.flatMap(r=>{
      const rows=new Map();for(const file of r.files){const key=JSON.stringify([file.date,file.type,file.title,file.uploaded]);if(!rows.has(key))rows.set(key,[]);rows.get(key).push(file);}return [...rows.values()];
    });
    // Una entrega con muchas capturas ocupa una fila; cada referencia abre su archivo.
    table({startY:38,head:[['Colaborador','Fecha','Evidencia','Subido (Lima)','Abrir archivo (#)']],body:groups.map(files=>{const f=files[0];return [f.person,M.date(f.date),f.title,f.uploaded?M.date(new Date(f.uploaded).toLocaleDateString('en-CA',{timeZone:'America/Lima'}))+' '+M.time(f.uploaded):'—',files.map(item=>'#'+item.ref+(item.url?'':' (sin enlace)')).join(' ')];}),columnStyles:{0:{cellWidth:59},1:{cellWidth:24},2:{cellWidth:53},3:{cellWidth:37},4:{cellWidth:96}},didDrawCell:data=>{
      if(data.section!=='body'||data.column.index!==4)return;
      const files=groups[data.row.index],lineHeight=data.cell.styles.fontSize/doc.internal.scaleFactor*doc.getLineHeightFactor();
      for(const [lineIndex,line] of data.cell.text.entries())for(const match of line.matchAll(/#(\d+)/g)){
        const file=files.find(f=>f.ref===Number(match[1]));if(!file?.url)continue;
        const x=data.cell.x+data.cell.padding('left')+doc.getTextWidth(line.slice(0,match.index));
        doc.link(x,data.cell.y+data.cell.padding('top')+lineIndex*lineHeight,doc.getTextWidth(match[0]),lineHeight,{url:file.url});
      }
    },didParseCell:data=>{if(data.section==='body'&&data.column.index===4)data.cell.styles.textColor=[7,90,188]}});
  }
  const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);text('KJA · Asistencia y evidencias · Hora de Lima',14,201,8);doc.text(`${i} / ${pages}`,283,201,{align:'right'});}
  return doc;
}
