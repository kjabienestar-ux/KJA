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

  function evidenceSelectionPolicy({requirement,mode,count,min=5,max=50,collageAllowed=true}){
    if(count<1)return {ok:false,reason:'vacio'};
    if(requirement!=='comparticiones')return count<=5?{ok:true}:{ok:false,reason:'maximo'};
    if(mode==='collage'){
      if(!collageAllowed)return {ok:false,reason:'collage_no_permitido'};
      return count===1?{ok:true}:{ok:false,reason:'cantidad_collage'};
    }
    return count>=min&&count<=max?{ok:true}:{ok:false,reason:count<min?'minimo':'maximo'};
  }

  root.KJACloseModel=Object.freeze({stateTone,stateLabel,attendancePresentation,evidenceSelectionPolicy});
})(typeof window==='undefined'?globalThis:window);
