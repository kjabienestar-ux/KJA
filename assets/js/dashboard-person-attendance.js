/* Historial desde el ingreso usando el mismo libro y cierres de Mes completo. */
function profileAttendanceMonths(start,end){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||start<'2020-01-01'||start>end)return [];
  const parsed=new Date(start+'T12:00:00Z');
  if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==start)return [];
  const months=[];let [year,month]=start.slice(0,7).split('-').map(Number);
  while(`${year}-${String(month).padStart(2,'0')}`<=end.slice(0,7)){
    months.push({year,month,key:`${year}-${String(month).padStart(2,'0')}`});
    month++;if(month===13){month=1;year++;}
  }
  return months;
}
async function loadProfileAttendanceMonth(period){
  return Promise.all([
    db.rpc('dash_admin_mes',{p_anio:period.year,p_mes:period.month,p_incluir_inactivos:true}),
    db.rpc('dash_admin_cierres_mes',{p_anio:period.year,p_mes:period.month})
  ]);
}
async function loadProfileAttendance(person,today,isCurrent=()=>true,onProgress=()=>{},loadMonth=loadProfileAttendanceMonth){
  const start=String(person.contrato_inicio||'').slice(0,10);
  if(!start)return {ok:true,missingStart:true};
  if(start>today)return {ok:true,start,end:today,days:[],futureStart:true,missing:[]};
  const months=profileAttendanceMonths(start,today);
  if(!months.length)return {ok:false,message:'La fecha de ingreso no es válida para consultar el historial (desde 2020).'};
  const days=[],missing=[];let end=today;
  for(let i=0;i<months.length;i+=2){
    if(!isCurrent())return null;
    await Promise.all(months.slice(i,i+2).map(async period=>{
      try{
        const [book,closes]=await loadMonth(period);
        if(book.error||closes.error||!book.data?.ok||!closes.data?.ok)throw new Error('Mes no disponible');
        const found=(book.data.personas||[]).find(item=>String(item.id)===String(person.id));
        if(!Array.isArray(found?.dias))throw new Error('Persona no disponible');
        if(book.data.hoy&&book.data.hoy<end)end=book.data.hoy;
        const byDate=new Map((closes.data.cierres||[]).filter(item=>String(item.colaborador_id)===String(person.id)).map(item=>[item.fecha,item]));
        for(const day of found.dias){
          if(day.fecha<start||day.fecha>today||day.futura)continue;
          const close=byDate.get(day.fecha);
          days.push({...day,cierre_estado:close?.estado||null,salida_at:close?.salida_at||null});
        }
      }catch(error){missing.push(period.key);}
    }));
    if(isCurrent())onProgress(Math.min(i+2,months.length),months.length);
  }
  return {ok:true,start,end,days:days.filter(day=>day.fecha<=end).sort((a,b)=>b.fecha.localeCompare(a.fecha)),missing:missing.sort()};
}
function profileAttendanceState(day,today,person,now=new Date()){
  if(day.estado==='J')return ['justificados','Justificado'];
  if(day.estado==='NG')return ['no_gestiona','No gestiona'];
  if(day.cierre_estado==='incompleta')return ['incompletas','Jornada incompleta'];
  if(day.cierre_estado==='en_curso')return ['en_curso','Jornada en curso'];
  if(day.estado==='P')return ['presentes','Presente'];
  if(day.estado==='T')return ['tardanzas','Tardanza'];
  if(day.estado)return ['sin_datos',`Estado: ${day.estado}`];
  if(!day.laborable)return ['no_laborables',({feriado:'Feriado',permiso:'Permiso / día libre',preinicio:'Antes del ingreso'})[day.motivo]||'No laborable'];
  if(day.fecha===today)return ['pendientes','Pendiente de hoy'];
  const weekday=new Date(day.fecha+'T12:00:00Z').getUTCDay()||7;
  const shift=person.horario_semanal?.[String(weekday)]||{};
  const start=shift.ini||person.hora_inicio,end=shift.fin||person.hora_fin;
  if(start&&end&&end<=start){
    const until=new Date(`${day.fecha}T${String(end).slice(0,5)}:00-05:00`).getTime()+86400000;
    if(now.getTime()<=until)return ['pendientes','Pendiente · turno nocturno'];
  }
  // Una persona dada de baja no tiene fecha de cese en el directorio:
  // no convertir automáticamente sus días sin registro en faltas.
  if(!person.activo)return ['sin_datos','Sin registro · revisar baja'];
  return ['faltas','Falta · sin registro'];
}
function profileAttendanceSections(person,extra){
  const title='Asistencia desde el ingreso',report=extra.attendance;
  if(extra.loading)return [{title,note:'Consultando todos los meses desde la fecha de ingreso…',rows:[]}];
  if(!report?.ok)return [{title,note:report?.message||'No se pudo cargar la asistencia. Pulsa «Reintentar».',rows:[]}];
  if(report.missingStart)return [{title,note:'Falta registrar la fecha de ingreso en el contrato para consultar la asistencia completa.',rows:[]}];
  if(report.futureStart)return [{title,note:`El ingreso está programado para el ${adminDate(report.start)}. Aún no hay jornadas que evaluar.`,rows:[]}];
  const totals={presentes:0,tardanzas:0,justificados:0,faltas:0,incompletas:0,en_curso:0,pendientes:0,no_gestiona:0,no_laborables:0,sin_datos:0};
  const time=value=>value?new Date(value).toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}):'—';
  let hours=0;
  const rows=report.days.map(day=>{
    const [key,label]=profileAttendanceState(day,report.end,person);totals[key]++;
    const valid=['presentes','tardanzas','justificados'].includes(key);
    if(valid)hours+=Number(day.horas||0);
    return [adminDate(day.fecha),label,time(day.marcado_at),time(day.salida_at),valid&&day.horas!=null?adminHours(day.horas):'—',[day.nota,day.excepcion_nota,day.feriado_nota].filter(Boolean).join(' · ')||'—'];
  });
  const partial=report.missing.length?` Lectura parcial: no se pudieron cargar ${report.missing.join(', ')}. Los totales solo incluyen los meses disponibles. Pulsa «Reintentar».`:'';
  const labels={presentes:'Presentes (puntuales)',tardanzas:'Tardanzas',justificados:'Justificados',faltas:'Faltas (sin registro)',incompletas:'Jornadas incompletas',en_curso:'Jornadas en curso',pendientes:'Pendientes de hoy',no_gestiona:'No gestiona',no_laborables:'Días no laborables / permisos',sin_datos:'Días por revisar'};
  return [
    {title,note:`Del ${adminDate(report.start)} al ${adminDate(report.end)}.${partial}`,rows:[...Object.entries(labels).map(([key,label])=>[label,String(totals[key])]),['Horas válidas registradas',adminHours(hours)]]},
    {title:'Detalle diario de asistencia',attendanceDetail:true,note:'Hora de Lima. Una falta corresponde a un día laborable pasado sin registro. Hoy y las jornadas en curso quedan pendientes. Se usan el horario y las excepciones del libro mensual vigente; los días sin registro de personas dadas de baja requieren revisión.',head:['Fecha','Asistencia','Entrada','Salida','Horas','Observaciones'],rows}
  ];
}
