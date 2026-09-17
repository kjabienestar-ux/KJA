(function(root){
  'use strict';
  const labels={con_evidencia:'Con evidencia',sin_evidencia:'Sin evidencia',en_plazo:'En plazo',no_programado:'No comparte ese día',sin_historial:'Anterior al sistema',sin_inicio:'Sin fecha de ingreso',no_incorporado:'Aún no incorporado',sin_horario:'Sin horario de cierre'};
  function date(value){
    const d=new Date(value+'T12:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(+d)||d.toISOString().slice(0,10)!==value)throw new Error('Fecha inválida.');
    return d;
  }
  function shift(value,days){const d=date(value);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
  function cutoff(value,kind){
    const day=date(value).getUTCDay(),target=kind==='lunes'?1:4;
    const report=shift(value,-((day-target+7)%7));
    return {report,desde:shift(report,kind==='lunes'?-4:-3),hasta:shift(report,-1)};
  }
  function month(value,today){
    date(value);date(today);
    const desde=value.slice(0,7)+'-01',end=date(desde);end.setUTCMonth(end.getUTCMonth()+1,0);
    const hasta=end.toISOString().slice(0,10);
    return {desde,hasta:hasta>=today?today:hasta};
  }
  function days(from,to){date(from);date(to);if(to<from||(+date(to)-date(from))/86400000>92)throw new Error('Selecciona un rango de hasta 93 días.');const result=[];for(let d=from;d<=to;d=shift(d,1))result.push(d);return result;}
  function summarize(rows,from,to){
    return days(from,to).map(fecha=>{
      const day=rows.filter(r=>r.fecha===fecha),count=state=>day.filter(r=>r.estado===state).length;
      const con=count('con_evidencia'),sin=count('sin_evidencia'),plazo=count('en_plazo'),horario=count('sin_horario');
      return {fecha,total:con+sin+plazo+horario,con,sin,plazo,horario,
        aprobadas:day.filter(r=>r.estado==='con_evidencia'&&r.revision==='aprobada').length,
        pendientes:day.filter(r=>r.estado==='con_evidencia'&&r.revision==='pendiente').length,
        observadas:day.filter(r=>r.estado==='con_evidencia'&&r.revision==='observada').length,
        excluidos:day.length-con-sin-plazo-horario};
    });
  }
  function csvCell(value){let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
  function answer(state){
    if(state==='con_evidencia')return 'Sí';
    if(['sin_evidencia','en_plazo','sin_horario'].includes(state))return 'No';
    return ({no_programado:'No comparte ese día',sin_historial:'Sistema aún no activo',sin_inicio:'Falta fecha de ingreso',no_incorporado:'Aún no incorporado'})[state]||'Sin información';
  }
  function matrix(rows,from,to){
    const dates=days(from,to),areas=new Map();
    for(const r of rows){
      if(!dates.includes(r.fecha))continue;
      const name=r.area||'Sin área';
      if(!areas.has(name))areas.set(name,new Map());
      const people=areas.get(name);
      if(!people.has(r.id))people.set(r.id,{id:r.id,nombre:r.nombre,states:new Map()});
      people.get(r.id).states.set(r.fecha,r.estado);
    }
    return [...areas].sort(([a],[b])=>a.localeCompare(b,'es')).map(([area,people])=>{
      const persons=[...people.values()].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map(p=>({id:p.id,nombre:p.nombre,cells:dates.map(d=>({value:answer(p.states.get(d)),state:p.states.get(d)}))}));
      return {area,dates,persons,totals:dates.map((_,i)=>({yes:persons.filter(p=>p.cells[i].value==='Sí').length,no:persons.filter(p=>p.cells[i].value==='No').length}))};
    });
  }
  function compactRecords(groups){
    return groups.flatMap(g=>[[g.area],['Colaborador',...g.dates],...g.persons.map(p=>[p.nombre,...p.cells.map(c=>c.value)]),['Sí',...g.totals.map(t=>t.yes)],['No',...g.totals.map(t=>t.no)],['Total evaluado',...g.totals.map(t=>t.yes+t.no)],[]]);
  }
  function csv(records){return '\uFEFF'+records.map(r=>r.map(csvCell).join(';')).join('\r\n');}
  function ranking(groups){
    const sorted=groups.map(g=>{const yes=g.totals.reduce((n,t)=>n+t.yes,0),no=g.totals.reduce((n,t)=>n+t.no,0);return {area:g.area,people:g.persons.length,yes,no,evaluated:yes+no};})
      .sort((a,b)=>Number(b.evaluated>0)-Number(a.evaluated>0)||b.yes-a.yes||a.area.localeCompare(b.area,'es'));
    let previous=null,rank=0;
    return sorted.map((r,i)=>{if(r.yes!==previous)rank=i+1;previous=r.yes;return {...r,rank:r.evaluated?rank:null};});
  }
  root.KJAFacebookReport={labels,shift,cutoff,month,days,summarize,answer,matrix,compactRecords,ranking,csv};
})(globalThis);
