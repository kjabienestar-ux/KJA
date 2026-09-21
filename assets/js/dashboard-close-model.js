(function(root){
  function stateTone(state){
    if(state==='lista_para_salir')return 'ready';
    if(state==='completa'||state==='regularizada')return 'complete';
    if(state==='incompleta')return 'incomplete';
    return state||'waiting';
  }

  function stateLabel(state){
    return {
      sin_entrada:'Sin entrada',en_curso:'En curso',lista_para_salir:'Lista para salir',
      completa:'Completa',regularizada:'Completa',incompleta:'Incompleta',justificado:'Justificado',no_aplica:'No aplica'
    }[state]||'Pendiente';
  }

  function attendancePresentation(mark,close){
    if(close&&close.aplica){
      const state=close.estado||'sin_entrada';
      return {state,label:stateLabel(state),complete:state==='completa'||state==='regularizada',incomplete:state==='incompleta',hasEntry:!!close.entrada_at||!!mark};
    }
    const state=mark?.estado||'';
    const labels={P:'Presente',T:'Tardanza',J:'Justificado',NG:'No gestiona'};
    return {state,label:labels[state]||'Sin registro',complete:['P','T','J'].includes(state),incomplete:false,hasEntry:!!mark};
  }

  function incompleteReasons(mark,close){
    if(!close||close.estado!=='incompleta')return [];
    const reasons=[];
    if(Object.hasOwn(close,'entrada_at')&&!close.entrada_at&&!mark)reasons.push('Registro de entrada');
    const labels={rpe:'RPE y evidencias del día',salida:'Evidencia de salida'};
    for(const item of close.requisitos||[]){
      // Facebook has its own deadline and does not determine the working-day close.
      if((item.tipo!=='comparticiones'||close.solo_asistencia_comparticiones)&&!item.completo)reasons.push(item.titulo||labels[item.tipo]||'Evidencia pendiente');
    }
    for(const item of close.asignaciones||[]){
      if(!item.completo&&item.estado!=='cancelada')reasons.push(item.titulo||'Entregable asignado');
    }
    if(close.requiere_salida!==false&&Object.hasOwn(close,'salida_at')&&!close.salida_at)reasons.push('Registro de salida');
    return [...new Set(reasons)];
  }

  function evidenceSelectionPolicy({requirement,mode,count,min=5,max=50,collageAllowed=true}){
    if(count<1)return {ok:false,reason:'vacio'};
    if(requirement!=='comparticiones')return count<=5?{ok:true}:{ok:false,reason:'maximo'};
    if(mode==='collage'){
      if(!collageAllowed)return {ok:false,reason:'collage_no_permitido'};
      return count===1?{ok:true}:{ok:false,reason:'cantidad_collage'};
    }
    return count>=min&&count<=max?{ok:true}:{ok:false,reason:count<min?'minimo':'maximo'};
  }

  function hasPendingWork(close){
    return (close?.requisitos||[]).some(item=>!['salida','comparticiones'].includes(item.tipo)&&!item.completo)
      || (close?.asignaciones||[]).some(item=>item.estado!=='cancelada'&&!item.completo);
  }
  function teamEntryException(person,close,date){
    if(person.contrato_pendiente)return 'Datos pendientes de actualizar';
    const days=person.dias_laborables;
    const weekday=new Date(`${date}T12:00:00Z`).getUTCDay()||7;
    const day=person.horario_semanal?.[String(weekday)];
    if(!Array.isArray(days)||!days.length)return 'Horario pendiente de actualizar';
    if(close?.solo_comparticiones||close?.estado==='no_aplica'||day?.mod==='no_gestiona'||(!day?.mod&&!days.map(Number).includes(weekday)))return 'No labora hoy';
    if(!(day?.ini||person.hora_inicio)||!(day?.fin||person.hora_fin))return 'Horario pendiente de actualizar';
    return '';
  }
  root.KJACloseModel=Object.freeze({stateTone,stateLabel,attendancePresentation,incompleteReasons,evidenceSelectionPolicy,hasPendingWork,teamEntryException});
})(typeof window==='undefined'?globalThis:window);
