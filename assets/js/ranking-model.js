(function(root){
  'use strict';
  const defaults={entrada:25,rpe:25,facebook:30,salida:20,penalizacion:3,tope:15};
  const pairs={entrada:['entradas_puntuales','dias_mes'],rpe:['rpe_cumplidos','rpe_mes'],facebook:['facebook_cumplidos','facebook_mes'],salida:['salidas_puntuales','dias_mes']};
  function evaluate(rows,config=defaults){
    const keys=Object.keys(defaults),weights={};
    for(const key of keys){const n=Number(config[key]);if(!Number.isFinite(n)||n<0||n>100)throw Error('Los valores deben estar entre 0 y 100.');weights[key]=n}
    if(Math.abs(Object.keys(pairs).reduce((n,k)=>n+weights[k],0)-100)>.001)throw Error('Los cuatro criterios deben sumar 100 puntos.');
    const evaluated=rows.map(row=>{
      const m=row.metricas||{},eligible=!!row.inicio_conocido&&Number(m.dias_participacion)>0,parts={};let total=0,coverage=0;
      const participation=Number(m.dias_mes)>0?Math.min(1,Math.max(0,Number(m.dias||0)/Number(m.dias_mes))):0;
      for(const [key,[num,den]] of Object.entries(pairs)){
        const required=Number(m[den]||0),done=Number(m[num]||0);
        parts[key]=required>0?Math.min(1,Math.max(0,done/required))*weights[key]:null;
        if(parts[key]!==null){total+=parts[key];coverage+=weights[key]}
      }
      const penalty=Math.min(weights.tope,Math.max(0,Number(m.asignaciones_incumplidas)||0)*weights.penalizacion);
      return {...row,parts,coverage,participation,penalty,score:eligible?Math.round(Math.max(0,total-penalty)*100)/100:null};
    }).sort((a,b)=>(b.score??-1)-(a.score??-1)||a.nombre.localeCompare(b.nombre,'es'));
    let previous=null,rank=0;
    return evaluated.map((row,i)=>{if(row.score!==previous){rank=i+1;previous=row.score}return {...row,rank:row.score===null?null:rank}});
  }
  root.KJARankingModel={defaults,evaluate,pairs};
  if(typeof module!=='undefined')module.exports=root.KJARankingModel;
})(typeof globalThis!=='undefined'?globalThis:this);
