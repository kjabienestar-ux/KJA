(function(root){
  'use strict';
  const defaults={entrada:25,rpe:25,facebook:30,salida:20,penalizacion:3,tope:15};
  const pairs={entrada:['entradas_puntuales','dias_mes'],rpe:['rpe_cumplidos','rpe_mes'],facebook:['facebook_cumplidos','facebook_mes'],salida:['salidas_puntuales','salidas_mes']};
  function evaluate(rows,config=defaults){
    const keys=Object.keys(defaults),weights={};
    for(const key of keys){const n=Number(config[key]);if(!Number.isFinite(n)||n<0||n>100)throw Error('Los valores deben estar entre 0 y 100.');weights[key]=n}
    if(Math.abs(Object.keys(pairs).reduce((n,k)=>n+weights[k],0)-100)>.001)throw Error('Los cuatro criterios deben sumar 100 puntos.');
    const evaluated=rows.map(row=>{
      const m={...row.metricas,salidas_mes:row.metricas?.salidas_mes??row.metricas?.dias_mes??0},eligible=!!row.inicio_conocido&&Number(m.dias_participacion)>0,parts={};let total=0,coverage=0;
      const participation=Number(m.dias_mes)>0?Math.min(1,Math.max(0,Number(m.dias||0)/Number(m.dias_mes))):0;
      for(const [key,[num,den]] of Object.entries(pairs)){
        const required=Number(m[den]||0),done=Number(m[num]||0);
        const neutralRpe=key==='rpe'&&required===0&&Number(m.rpe_exentos_presencial||0)>0;
        parts[key]=required>0?Math.min(1,Math.max(0,done/required))*weights[key]:neutralRpe?weights[key]:null;
        if(parts[key]!==null){total+=parts[key];coverage+=weights[key]}
      }
      const penalty=Math.min(weights.tope,Math.max(0,Number(m.asignaciones_incumplidas)||0)*weights.penalizacion);
      return {...row,metricas:m,parts,coverage,participation,penalty,score:eligible?Math.round(Math.max(0,total-penalty)*100)/100:null};
    }).sort((a,b)=>(b.score??-1)-(a.score??-1)||a.nombre.localeCompare(b.nombre,'es'));
    let previous=null,rank=0;
    return evaluated.map((row,i)=>{if(row.score!==previous){rank=i+1;previous=row.score}return {...row,rank:row.score===null?null:rank}});
  }
  function summarize(rows){
    const evaluated=rows.filter(r=>r.score!==null),criteria=Object.entries(pairs).map(([key,[num,den]])=>{
      const expected=rows.reduce((n,r)=>n+Number(r.metricas?.[den]||0),0);
      const done=rows.reduce((n,r)=>n+Math.min(Number(r.metricas?.[den]||0),Math.max(0,Number(r.metricas?.[num]||0))),0);
      return {key,done,expected,rate:expected?done/expected*100:null};
    });
    return {count:rows.length,evaluated:evaluated.length,average:evaluated.length?evaluated.reduce((n,r)=>n+r.score,0)/evaluated.length:null,criteria,pending:rows.reduce((n,r)=>n+Number(r.metricas?.revisiones_pendientes||0),0),penalty:evaluated.reduce((n,r)=>n+r.penalty,0)};
  }
  root.KJARankingModel={defaults,evaluate,pairs,summarize};
  if(typeof module!=='undefined')module.exports=root.KJARankingModel;
})(typeof globalThis!=='undefined'?globalThis:this);
