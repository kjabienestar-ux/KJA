/* Un mismo conjunto de datos para el Excel y el PDF de asistencia y evidencias. */
(function(root){
  'use strict';
  const labels={entrada:'Foto de entrada',comparticiones:'Facebook',rpe:'RPE',salida:'Foto de salida',asignado:'Asignación'};
  const time=v=>v?new Date(v).toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}):'—';
  const date=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'—';
  const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
  function period(from,to,today){
    if(!validDate(from)||!validDate(to)||from<'2020-01-01'||from>to||to>today)throw Error('Elige fechas válidas: desde 2020, en orden y hasta hoy.');
    return {from,to};
  }
  function build(person,attendance,details){
    const files=[],days=[],totals={puntuales:0,tardanzas:0,faltas:0,conEvidencia:0,archivos:0,incompletas:0};
    for(const day of attendance.days||[]){
      const detail=details.get(day.fecha);
      if(!detail?.ok)throw Error(`No se pudieron consultar las evidencias de ${person.nombre} del ${date(day.fecha)}. Reintenta la descarga.`);
      const seen=new Set(),groups={entrada:[],comparticiones:[],rpe:[],salida:[],asignado:[]};
      function add(file,type,title,uploaded){
        if(!file.path||!['asis-evidencias','asis-cierre-evidencias'].includes(file.bucket))return;
        const key=file.bucket+'/'+file.path;if(seen.has(key))return;seen.add(key);
        const item={...file,person:person.nombre,date:day.fecha,type,title,uploaded};
        files.push(item);(groups[type]||groups.asignado).push(item);
      }
      for(const f of detail.entrada_archivos||[])add(f,'entrada',labels.entrada,detail.entrada_at);
      for(const delivery of detail.entregas||[]){
        for(const f of delivery.archivos||[])add(f,delivery.tipo,delivery.titulo||labels[delivery.tipo]||'Evidencia',delivery.completado_at);
      }
      const state=detail.estado||day.estado;
      const asOf=attendance.asOf||new Date().toLocaleDateString('en-CA',{timeZone:'America/Lima'});
      const fallback=root.profileAttendanceState({...day,estado:state,cierre_estado:null},asOf,person);
      const key=state==='P'?'puntuales':state==='T'?'tardanzas':fallback[0];
      const entry=state==='P'?'Puntual':state==='T'?'Tardanza':fallback[1];
      if(key in totals)totals[key]++;
      const close=detail.cierre?.estado||day.cierre_estado;
      if(close==='incompleta'&&key!=='incompletas')totals.incompletas++;
      const count=seen.size;if(count)totals.conEvidencia++;totals.archivos+=count;
      const jornada=({completa:'Completa',regularizada:'Regularizada',incompleta:'Incompleta',en_curso:'En curso',no_aplica:'No aplica',justificado:'Justificada',sin_entrada:'Sin entrada',lista_para_salir:'Pendiente de salida'})[close]||'—';
      days.push({date:day.fecha,sourceDay:{...day},entry,key,arrival:time(detail.entrada_at||day.marcado_at),exit:time(detail.salida_at||day.salida_at),jornada,groups,count});
    }
    const entries=totals.puntuales+totals.tardanzas;
    const note=attendance.missingStart?'Falta fecha de ingreso':attendance.futureStart?'Ingreso posterior al período':!days.length?'Sin días en el período':'';
    return {person,days,files,totals,punctuality:entries?Math.round(totals.puntuales*100/entries):null,note};
  }
  const summaryHeaders=['Colaborador','Puntuales','Tardanzas','Puntualidad','Faltas','Días con archivos','Archivos','Jornadas incompletas'];
  const summaryRow=r=>[r.person.nombre,...(r.note?Array(7).fill('—'):[r.totals.puntuales,r.totals.tardanzas,r.punctuality==null?'—':r.punctuality+'%',r.totals.faltas,r.totals.conEvidencia,r.totals.archivos,r.totals.incompletas])];
  const dailyHeaders=['Fecha','Entrada','Hora','Salida','Jornada','Foto entrada','Facebook','RPE','Otros archivos'];
  const refs=items=>{
    if(!items.length)return 'Sin archivo';
    const ids=items.map(f=>f.ref).sort((a,b)=>a-b),runs=[];
    for(let i=0;i<ids.length;i++){const first=ids[i];while(i+1<ids.length&&ids[i+1]===ids[i]+1)i++;runs.push(first===ids[i]?'#'+first:`#${first}–#${ids[i]}`);}
    return `${items.length} archivo${items.length===1?'':'s'}\n${runs.join(', ')}`;
  };
  const dailyRow=d=>[date(d.date),d.entry,d.arrival,d.exit,d.jornada,refs(d.groups.entrada),refs(d.groups.comparticiones),refs(d.groups.rpe),refs([...d.groups.salida,...d.groups.asignado])];
  root.KJAAttendanceReport={build,period,date,time,summaryHeaders,summaryRow,dailyHeaders,dailyRow};
})(globalThis);
