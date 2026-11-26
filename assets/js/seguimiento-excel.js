/* Reporte de marcaciones: lectura autorizada por fecha y OOXML local. */
(function(g){
  'use strict';
  const x=v=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const col=n=>{let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
  const time=v=>v?new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'—';
  const add=(d,n)=>{const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
  const weekday=d=>['DO','LU','MA','MI','JU','VI','SA'][new Date(d+'T12:00:00Z').getUTCDay()];
  const ddmmyyyy=d=>d.split('-').reverse().join('/');
  // Filas OOXML con texto en línea; un objeto {name,area} genera la celda de identidad.
  function writer(){
    const rows=[];let n=0;
    const cell=(ref,[value,style])=>'<c r="'+ref+'" s="'+style+'" t="inlineStr"><is>'+(value&&typeof value==='object'?'<r><rPr><b/><sz val="11"/><color rgb="FF304538"/><rFont val="Calibri"/></rPr><t xml:space="preserve">'+x(value.name)+'\n</t></r><r><rPr><sz val="10"/><color rgb="FF7A857D"/><rFont val="Calibri"/></rPr><t xml:space="preserve">'+x(value.area)+'</t></r>':'<t xml:space="preserve">'+x(value)+'</t>')+'</is></c>';
    return {rows,get n(){return n},row(values,style=0,height=25){n++;rows.push('<row r="'+n+'" ht="'+height+'" customHeight="1">'+values.map((v,i)=>cell(col(i+1)+n,Array.isArray(v)?v:[v,style])).join('')+'</row>')}};
  }
  function dates(from,to){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw Error('Revisa las fechas del período.');
    const list=[];for(let d=from;d<=to;d=add(d,1)){list.push(d);if(list.length>93)throw Error('Selecciona un máximo de 93 días.')}return list;
  }
  function status(r){
    if(!r)return ['Sin información',7];
    if(r.entrada_estado==='J'||r.cierre?.justificado||r.cierre_estado==='justificado')return ['Justificado',7];
    if(r.entrada_at){
      const missingExit=!r.salida_at&&r.cierre?.requiere_salida!==false;
      if(r.entrada_estado==='T')return [missingExit?'Tardanza / Sin salida':'Tardanza',5];
      if(missingExit)return ['Sin salida',5];
      if(r.entrada_estado==='P')return ['Normal',4];
      return ['Entrada registrada',7];
    }
    if(r.labora===false||r.cierre?.aplica_jornada===false||r.cierre_estado==='no_aplica')return ['No programado',7];
    return ['No marcó',6];
  }
  function build(days,records,meta){
    const people=new Map();for(const day of days)for(const r of records[day]){const id=String(r.colaborador_id);if(!people.has(id))people.set(id,{name:r.colaborador,area:r.area,days:{}});people.get(id).days[day]=r}
    const list=[...people.values()].sort((a,b)=>String(a.area||'').localeCompare(String(b.area||''),'es')||String(a.name).localeCompare(String(b.name),'es'));
    if(!list.length)throw Error('No hay colaboradores para los filtros elegidos.');
    const colors=['FFFFFF','315E48','F5F6F2','DFF1E5','FFF0CF','FAE0DF','EDF0ED'];
    const fills='<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+colors.map(c=>'<fill><patternFill patternType="solid"><fgColor rgb="FF'+c+'"/><bgColor indexed="64"/></patternFill></fill>').join('');
    const styles='<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><color rgb="FF304538"/><name val="Calibri"/></font><font><b/><sz val="22"/><color rgb="FFA24D34"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="9">'+fills+'</fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD6DFD8"/></left><right style="thin"><color rgb="FFD6DFD8"/></right><top style="thin"><color rgb="FFD6DFD8"/></top><bottom style="thin"><color rgb="FFD6DFD8"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9">'+[[0,0,0],[1,0,0],[2,3,1],[0,4,1],[0,5,1],[0,6,1],[0,7,1],[0,8,1]].map(([f,fill,b])=>'<xf numFmtId="0" fontId="'+f+'" fillId="'+fill+'" borderId="'+b+'" xfId="0" applyAlignment="1" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>').join('')+'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1" applyBorder="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    const sheets=[];
    // Todo el período ocupa una sola hoja; cada fecha añade una columna.
    {
      const block=days,single=days.length===1,headers=single?['Colaborador / Área','Horario programado','Ingreso','Estado de marcaciones','Salida','Estado de salida']:['Colaborador / Área',...block.map(d=>d.slice(8)+'/'+d.slice(5,7)+'\n'+weekday(d)),'Resumen'];
      const last=col(headers.length),sheet=writer(),row=sheet.row;
      const merged=[];
      row(['KJA · Reporte de asistencia'],1,42);row([days[0]+' '+weekday(days[0])+' al '+days.at(-1)+' '+weekday(days.at(-1))+' · '+meta.scope]);row(['Generado: '+meta.updated+' · Hora de Lima'+(meta.today?' · PROVISIONAL: incluye hoy':'' )]);
      row([],0,12);
      const counts=[0,0,0];for(const p of list)for(const d of block){const s=status(p.days[d])[1];if(s>=4&&s<=6)counts[s-4]++}
      row(['Colaboradores: '+list.length+' · Normal: '+counts[0]+' · Tardanza / sin salida: '+counts[1]+' · No marcó: '+counts[2]],3,30);
      row([],0,10);
      const legend=[['Normal',4],['Tardanza / Sin salida',5],['No marcó entrada',6],['No programado / Justificado / Sin información',7]],values=Array(headers.length).fill('');
      legend.forEach((item,i)=>{const start=Math.floor(i*headers.length/4),end=Math.floor((i+1)*headers.length/4)-1;values[start]=item;for(let j=start+1;j<=end;j++)values[j]=['',item[1]];if(end>start)merged.push(col(start+1)+'7:'+col(end+1)+'7')});
      row(values,0,36);row([],0,14);row(headers,2,34);
      let previousArea=null;
      for(const p of list){const area=p.area||'Sin área';if(previousArea!==null&&previousArea!==area)row([],0,12);previousArea=area;if(single){const r=p.days[block[0]],s=status(r);row([[{name:p.name,area},8],r?.schedule||'No disponible',time(r?.entrada_at),[s[0],s[1]],time(r?.salida_at),r?.salida_at?'Registrada':r?.entrada_at?'Salida pendiente':'—'],0,48)}else{const c=[0,0,0];const cells=block.map(d=>{const r=p.days[d],s=status(r);if(s[1]>=4&&s[1]<=6)c[s[1]-4]++;return [s[0]+'\n'+time(r?.entrada_at)+' / '+time(r?.salida_at),s[1]]});row([[{name:p.name,area},8],...cells,c[0]+' normal\n'+c[1]+' tard./sin salida\n'+c[2]+' sin marca'],0,48)}}
      row([],0,14);
      row(['Entrada / salida. Amarillo: tardanza o salida requerida sin registrar. Hoy es provisional; no acredita incumplimiento definitivo.'],0,30);row(['No marcó indica ausencia de entrada al consultar; no acredita ausencia laboral. Los totales corresponden a todo el período.'],0,30);
      const merges=[...[1,2,3,5,sheet.n-1,sheet.n].map(i=>'A'+i+':'+last+i),...merged];
      const xml='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"></sheetView></sheetViews><cols>'+headers.map((_,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(i===0?36:single?23:19)+'" customWidth="1"/>').join('')+'</cols><sheetData>'+sheet.rows.join('')+'</sheetData><mergeCells count="'+merges.length+'">'+merges.map(ref=>'<mergeCell ref="'+ref+'"/>').join('')+'</mergeCells><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="0" fitToHeight="0"/></worksheet>';
      sheets.push({name:'Detalle de asistencia',xml,repeat:9,last:last+sheet.n});
    }
    return g.KJAFacebookExcel.buildWorkbook(sheets,styles);
  }
  function pendingStyles(){
    const colors=['FFFFFF','315E48','F5F6F2','FAE0DF'];
    const fills='<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+colors.map(c=>'<fill><patternFill patternType="solid"><fgColor rgb="FF'+c+'"/><bgColor indexed="64"/></patternFill></fill>').join('');
    const fonts=[['',11,'304538'],['<b/>',22,'A24D34'],['<b/>',11,'FFFFFF'],['<b/>',11,'9B2C2C']].map(([b,sz,c])=>'<font>'+b+'<sz val="'+sz+'"/><color rgb="FF'+c+'"/><name val="Calibri"/></font>').join('');
    // 0 base · 1 título · 2 encabezado · 3 resumen · 4 estado en rojo · 5 texto a la izquierda · 6 dato centrado.
    const xfs=[[0,0,0,'center'],[1,0,0,'center'],[2,3,1,'center'],[0,4,1,'center'],[3,5,1,'center'],[0,0,1,'left'],[0,0,1,'center']];
    return '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4">'+fonts+'</fonts><fills count="'+(colors.length+2)+'">'+fills+'</fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD6DFD8"/></left><right style="thin"><color rgb="FFD6DFD8"/></right><top style="thin"><color rgb="FFD6DFD8"/></top><bottom style="thin"><color rgb="FFD6DFD8"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="'+xfs.length+'">'+xfs.map(([f,fill,b,h])=>'<xf numFmtId="0" fontId="'+f+'" fillId="'+fill+'" borderId="'+b+'" xfId="0" applyAlignment="1" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="'+h+'" vertical="center" wrapText="1"'+(h==='left'?' indent="1"':'')+'/></xf>').join('')+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  }
  // Solo jornadas en rojo de Seguimiento diario (Incompleta o Sin entrada), una fila por persona y fecha.
  function buildPending(days,records,meta){
    const people=new Map();
    for(const day of days)for(const r of records[day]||[]){const id=String(r.colaborador_id);if(!people.has(id))people.set(id,{name:r.colaborador,area:r.area||'Sin área',days:[]});people.get(id).days.push({...r,fecha:day})}
    const list=[...people.values()].sort((a,b)=>a.area.localeCompare(b.area,'es')||String(a.name).localeCompare(String(b.name),'es'));
    if(!list.length)throw Error('Ningún colaborador tiene estado en rojo con los filtros elegidos.');
    const single=days.length===1,headers=['Colaborador / Área',...(single?[]:['Fecha']),'Horario programado','Estado','Pendientes','Entrada','Salida'],widths=[36,...(single?[]:[15]),19,16,58,11,11];
    const last=col(headers.length),sheet=writer(),row=sheet.row,merged=[];
    const total=list.reduce((sum,p)=>sum+p.days.length,0),incomplete=list.reduce((sum,p)=>sum+p.days.filter(d=>d.codigo==='incompleta').length,0);
    row(['KJA · Reporte de pendientes'],1,42);row([days[0]+' '+weekday(days[0])+(single?'':' al '+days.at(-1)+' '+weekday(days.at(-1)))+' · '+meta.scope]);row(['Generado: '+meta.updated+' · Hora de Lima'+(meta.today?' · PROVISIONAL: incluye hoy':'')]);
    row([],0,12);
    row(['Colaboradores con pendientes: '+list.length+' · Jornadas en rojo: '+total+' · Incompletas: '+incomplete+' · Sin entrada: '+(total-incomplete),...Array(headers.length-1).fill('')],3,30);
    row([],0,10);
    const legend=[['Incompleta · la jornada terminó sin cierre válido',4],['Sin entrada · no registró su entrada',4]],values=Array(headers.length).fill(''),legendRow=sheet.n+1;
    legend.forEach((item,i)=>{const start=Math.floor(i*headers.length/2),end=Math.floor((i+1)*headers.length/2)-1;values[start]=item;for(let j=start+1;j<=end;j++)values[j]=['',item[1]];if(end>start)merged.push(col(start+1)+legendRow+':'+col(end+1)+legendRow)});
    row(values,0,36);row([],0,14);row(headers,2,34);
    let previousArea=null;
    for(const p of list){
      if(previousArea!==null&&previousArea!==p.area)row([],0,12);previousArea=p.area;
      const start=sheet.n+1;
      p.days.forEach((r,i)=>{
        const text=r.pendientes?.length?r.pendientes.join(' · '):'Sin pendientes identificados';
        row([[i?'':{name:p.name,area:p.area},5],...(single?[]:[[ddmmyyyy(r.fecha)+'\n'+weekday(r.fecha),6]]),[r.horario||'No disponible',6],[r.estado,4],[text,5],[time(r.entrada_at),6],[time(r.salida_at),6]],0,Math.max(single?48:40,15*Math.ceil(text.length/52)+12));
      });
      if(p.days.length>1)merged.push('A'+start+':A'+sheet.n);
    }
    row([],0,14);
    row(['Solo se incluyen jornadas en rojo de Seguimiento diario: Incompleta o Sin entrada. Hoy es provisional; no acredita incumplimiento definitivo.'],0,30);row(['Pendientes según la vista al consultar: entregables, marcaciones y revisiones. Una evidencia registrada aún puede estar pendiente de aprobación.'],0,30);
    const merges=[...[1,2,3,5,sheet.n-1,sheet.n].map(i=>'A'+i+':'+last+i),...merged];
    const xml='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"></sheetView></sheetViews><cols>'+widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols><sheetData>'+sheet.rows.join('')+'</sheetData><mergeCells count="'+merges.length+'">'+merges.map(ref=>'<mergeCell ref="'+ref+'"/>').join('')+'</mergeCells><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="0" fitToHeight="0"/></worksheet>';
    return g.KJAFacebookExcel.buildWorkbook([{name:'Pendientes en rojo',xml,repeat:9,last:last+sheet.n}],pendingStyles());
  }
  function mount(root,context,read,{csv=null,pending=null}={}){
    const titles={xlsx:'Marcaciones en Excel',csv:'Registro diario en CSV',pending:'Pendientes en Excel'};
    const paths={pending:'<path d="M6 3h8l4 4v14H6zM14 3v5h4M12 10.5v4.5M12 17.5v.5"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',back:'<path d="M19 12H5m5-5-5 5 5 5"/>',next:'<path d="m9 5 7 7-7 7"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',sheet:'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6M12 10v8"/>',file:'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/>',filter:'<path d="M4 5h16M7 12h10M10 19h4"/>',people:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/>',check:'<path d="m5 12 4 4L19 6"/>',error:'<path d="m12 3 10 18H2zM12 9v5m0 3v1"/>',refresh:'<path d="M20 10a8 8 0 1 0-2 8M20 3v7h-7"/>'};
    const icon=name=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+paths[name]+'</svg>';
    const dialog=document.createElement('dialog');dialog.id='seg-download-dialog';dialog.className='seg-download-dialog';dialog.setAttribute('aria-labelledby','seg-download-title');dialog.setAttribute('aria-describedby','seg-download-intro');
    dialog.innerHTML='<header class="seg-d-head"><div><h3 id="seg-download-title"></h3><p id="seg-download-intro"></p></div><button type="button" class="seg-d-close" data-download="close" aria-label="Cerrar descargas">'+icon('close')+'</button></header>'+
      '<div class="seg-d-body"><section id="seg-download-choose"><button type="button" class="seg-d-option" data-download="xlsx"><span class="seg-d-file-icon">'+icon('sheet')+'</span><span class="seg-d-file-text"><b>Marcaciones en Excel <em>XLSX</em></b><small>Entradas, salidas y estados con colores.</small><span>Un día, una semana o fechas exactas</span></span>'+icon('next')+'</button><button type="button" class="seg-d-option" data-download="csv"><span class="seg-d-file-icon">'+icon('file')+'</span><span class="seg-d-file-text"><b>Registro diario en CSV <em>CSV</em></b><small>Detalle completo del día para procesar.</small><span>Todo el equipo autorizado del día</span></span>'+icon('next')+'</button><button type="button" class="seg-d-option" data-download="pending"><span class="seg-d-file-icon">'+icon('pending')+'</span><span class="seg-d-file-text"><b>Pendientes en Excel <em>XLSX</em></b><small>Solo colaboradores con estado en rojo y lo que les falta.</small><span>Un día, una semana o fechas exactas</span></span>'+icon('next')+'</button><p class="seg-d-note">'+icon('calendar')+'Las fechas se eligen en el siguiente paso.</p></section>'+
      '<section id="seg-download-config" hidden><div id="seg-download-period"><div class="seg-d-periods" role="group" aria-label="Período del Excel">'+[['day','Un día'],['week','Una semana'],['range','Fechas exactas']].map(([value,label])=>'<button type="button" data-period="'+value+'" aria-pressed="false">'+icon('calendar')+label+'</button>').join('')+'</div><select id="seg-x-mode" aria-label="Período del Excel" hidden><option value="day">Un día</option><option value="week">Una semana</option><option value="range">Fechas exactas</option></select></div><label class="seg-d-date"><span class="sr-only" id="seg-download-date-label">Fecha</span><input id="seg-x-from" type="date" min="2020-01-01"></label><label id="seg-download-to" hidden>Hasta<input id="seg-x-to" type="date" min="2020-01-01"></label><p class="seg-d-alert" id="seg-download-validation" role="alert" hidden></p><div class="seg-d-scope" id="seg-download-scope"><span id="seg-download-scope-icon"></span><div><b id="seg-download-scope-title"></b><p id="seg-download-scope-note"></p></div></div></section>'+
      '<section class="seg-d-state" id="seg-download-state" hidden><span class="seg-d-state-icon" id="seg-download-state-icon"></span><h4 id="seg-download-state-title"></h4><p id="seg-download-description"></p><div class="seg-d-progress-wrap" id="seg-download-progress-wrap" hidden><div class="seg-d-progress" id="seg-download-progress" role="progressbar" aria-label="Consulta de marcaciones" aria-valuemin="0" aria-valuemax="100"><span></span></div><p id="seg-download-progress-label"></p></div><div class="seg-d-result" id="seg-download-result" hidden>'+icon('file')+'<div><span id="seg-download-filename"></span><small id="seg-download-filedetail"></small></div></div></section><p class="sr-only" id="seg-x-status" role="status" aria-live="polite" aria-atomic="true"></p></div>'+
      '<footer class="seg-d-foot"><span class="seg-d-context" id="seg-download-context">'+icon('file')+'Seguimiento diario</span><button type="button" class="seg-d-back" id="seg-download-back" data-download="back" hidden></button><div class="seg-d-actions"><button type="button" class="seg-d-dismiss" id="seg-download-dismiss" data-download="close">Cancelar</button><button type="button" class="seg-d-primary" id="seg-x-download" data-download="primary" hidden></button></div></footer>';
    document.body.append(dialog);
    const el=id=>dialog.querySelector('#'+id),mode=el('seg-x-mode'),from=el('seg-x-from'),to=el('seg-x-to'),button=el('seg-x-download'),notice=el('seg-x-status');
    let stage='choose',file='xlsx',generation=0,busy=false,owner='',picker=null;
    const today=()=>context().today||(typeof g.isoLima==='function'?g.isoLima():new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
    const display=d=>d?d.split('-').reverse().join('/'):'—';
    const dateText=()=>display(from.value)+(from.value===to.value?'':' → '+display(to.value));
    const permitted=ctx=>ctx.allowed&&ctx.active!==false;
    const emptyError=()=>Object.assign(Error('No hay registros para el período y los filtros seleccionados.'),{code:'EMPTY'});
    const requestKey=()=>[file,mode.value,from.value,to.value].join(':');
    function validate(){
      try{dates(from.value,to.value);if(from.value<'2020-01-01'||to.value>today())throw Error('Selecciona fechas desde 2020 hasta hoy en Lima.');return ''}catch(error){return error.message}
    }
    function controls(){
      button.disabled=busy||!permitted(context())||stage==='config'&&(picker?.isPending()||!!validate());
    }
    if(typeof initKjaDatePicker==='function')picker=initKjaDatePicker(from,{label:'Fecha o período',partner:to,popupId:'seg-from-popup',theme:'warm',rangeMode:()=>mode.value,embedded:true,confirmSelection:true,persistent:true,onPendingChange:controls});
    else el('seg-download-to').hidden=false;
    function sync(){
      const d=from.value||context().date||today();from.max=to.max=today();
      if(file==='csv')mode.value='day';
      if(mode.value==='day')to.value=d;
      if(mode.value==='week'){const dow=new Date(d+'T12:00:00Z').getUTCDay();from.value=add(d,-((dow+6)%7));if(from.value<from.min)from.value=from.min;to.value=[add(d,-((dow+6)%7)+6),today()].sort()[0];}
      to.disabled=mode.value!=='range';
      dialog.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===mode.value)));
      el('seg-download-period').hidden=file==='csv';
      el('seg-download-date-label').textContent=mode.value==='day'?'Fecha':mode.value==='week'?'Semana':'Desde / hasta';
      const error=validate();el('seg-download-validation').textContent=error;el('seg-download-validation').hidden=!error;from.setAttribute('aria-invalid',String(!!error));
      const ctx=context();el('seg-download-scope-icon').innerHTML=icon(file==='csv'?'people':'filter');
      el('seg-download-scope-title').textContent=file==='csv'?'Día completo · Todo el equipo autorizado':(ctx.area?ctx.areaLabel||'Área filtrada':'Todas las áreas')+(ctx.query?' · Nombre: '+ctx.query:'');
      el('seg-download-scope-title').title=el('seg-download-scope-title').textContent;
      el('seg-download-scope-note').textContent=file==='csv'?'Sin filtros de área o nombre':mode.value==='range'?'Todas las bandejas · Máximo 93 días':mode.value==='week'?'Todas las bandejas · Lunes a domingo, hasta hoy':'Todas las bandejas';
      picker?.sync();controls();
    }
    function render(){
      el('seg-download-choose').hidden=stage!=='choose';el('seg-download-config').hidden=stage!=='config';el('seg-download-state').hidden=['choose','config'].includes(stage);
      el('seg-download-title').textContent=stage==='choose'?'¿Qué deseas descargar?':stage==='config'?titles[file]:'Descargas de asistencia';
      el('seg-download-intro').textContent=stage==='choose'?'Elige el archivo y luego configura el período.':stage==='config'?(file==='csv'?'Descarga el detalle completo de una fecha.':'Elige el período que necesitas consultar.'):titles[file];
      el('seg-download-intro').hidden=stage==='config';
      dialog.setAttribute('aria-describedby',stage==='config'?'seg-download-scope-note':'seg-download-intro');
      el('seg-download-context').hidden=stage!=='choose';el('seg-download-back').hidden=stage==='choose'||stage==='loading';
      el('seg-download-back').innerHTML=icon('back')+(stage==='config'?'Cambiar archivo':stage==='success'?'Otra descarga':'Volver');
      el('seg-download-dismiss').hidden=!['choose','loading'].includes(stage);button.hidden=['choose','loading'].includes(stage);
      button.innerHTML=icon(stage==='error'?'refresh':stage==='success'?'check':'download')+(stage==='config'?'Descargar '+(file==='csv'?'CSV':'Excel'):stage==='success'?'Listo':stage==='error'?'Reintentar':'Cambiar fechas');
      el('seg-download-progress-wrap').hidden=stage!=='loading';el('seg-download-result').hidden=stage!=='success';
      dialog.dataset.stage=stage;
      if(stage==='config'){sync();picker?.open();}else controls();
    }
    function state(next,title,description){
      stage=next;el('seg-download-state-title').textContent=title;el('seg-download-description').textContent=description;
      el('seg-download-state-icon').innerHTML=icon(next==='loading'?'refresh':next==='success'?'check':next==='empty'?'file':'error');
      notice.textContent=title+'. '+description;render();
    }
    function close({restoreFocus=true}={}){
      generation++;busy=false;picker?.close();
      if(dialog.open){if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}
      if(restoreFocus){const launch=root.querySelector('#seg-export');if(launch&&!launch.hidden&&!launch.disabled)launch.focus({preventScroll:true});}
    }
    function open(){
      const ctx=context();if(!permitted(ctx))return false;
      generation++;busy=false;owner=ctx.owner;file='xlsx';mode.value='day';from.value=to.value=ctx.date||today();stage='choose';notice.textContent='';picker?.close();sync();render();
      if(!dialog.open){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
      dialog.querySelector('[data-download="xlsx"]').focus();return true;
    }
    function refresh(){if(!dialog.open)return;if(!permitted(context())||context().owner!==owner){close({restoreFocus:false});return}if(stage==='config')sync();}
    function progress(done,total){const percent=Math.round(done/total*100);el('seg-download-progress').setAttribute('aria-valuenow',String(percent));el('seg-download-progress').firstElementChild.style.width=percent+'%';el('seg-download-progress-label').textContent=done+' de '+total+' días consultados';notice.textContent='Consultando '+done+' de '+total+' días.';}
    async function download(){
      if(busy||!dialog.open||!permitted(context())||picker?.isPending())return;
      sync();if(validate()){stage='config';render();return;}
      const ctx=context(),signature=JSON.stringify(ctx),key=requestKey(),run=++generation;
      const guard=()=>{if(run!==generation||!dialog.open)return false;if(!permitted(context())||JSON.stringify(context())!==signature||requestKey()!==key)throw Error('Cambió la sesión o los filtros. Vuelve a descargar.');return true};
      busy=true;state('loading','Preparando archivo','Estamos reuniendo '+(file==='pending'?'los pendientes':'las marcaciones')+' del período seleccionado.');
      const match=r=>(!ctx.area||String(r.area_id??'__none')===ctx.area)&&(!ctx.query||norm(r.colaborador+' '+r.area).includes(norm(ctx.query)));
      const meta=ds=>({scope:(ctx.area?ctx.areaLabel||'Área filtrada':'Todas las áreas')+(ctx.query?' · Búsqueda: '+ctx.query:''),updated:new Date().toLocaleString('es-PE',{timeZone:'America/Lima'}),today:ds.includes(today())});
      try{
        const ds=dates(from.value,to.value);progress(0,ds.length);let result;
        if(file==='csv'){
          if(!csv)throw Error('La descarga CSV no está disponible. Recarga el panel.');
          result=await csv(ds[0]);if(!guard())return;if(result.empty)throw emptyError();progress(1,1);
        }else if(file==='pending'){
          if(!pending)throw Error('El reporte de pendientes no está disponible. Recarga el panel.');
          const records={};
          for(let i=0;i<ds.length;i+=3){
            if(!guard())return;
            await Promise.all(ds.slice(i,i+3).map(async d=>{
              const list=await pending(d);
              if(!Array.isArray(list))throw Error('No se pudo consultar el día '+d+'. Reintenta; no se descargó un reporte parcial.');
              records[d]=list.filter(match);
            }));
            if(!guard())return;progress(Math.min(i+3,ds.length),ds.length);
          }
          if(!ds.some(d=>records[d].length))throw Object.assign(Error('Ningún colaborador tiene estado en rojo en el período y los filtros seleccionados.'),{code:'EMPTY'});
          result={content:buildPending(ds,records,meta(ds)),type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',name:'pendientes-'+ds[0]+'_'+ds.at(-1)+'.xlsx'};
        }else{
          const records={};
          for(let i=0;i<ds.length;i+=3){
            if(!guard())return;
            await Promise.all(ds.slice(i,i+3).map(async d=>{
              const [a,b]=await Promise.all([read('dash_admin_control_diario',d,ctx.owner),read('dash_admin_cierres',d,ctx.owner)]);
              if(a.error||b.error||!a.data?.ok||!b.data?.ok||!Array.isArray(a.data.filas)||!Array.isArray(b.data.personas)||(a.data.fecha&&a.data.fecha!==d)||(b.data.fecha&&b.data.fecha!==d))throw Error('No se pudo consultar el día '+d+'. Reintenta; no se descargó un reporte parcial.');
              const people=new Map(b.data.personas.map(p=>[String(p.id),p]));records[d]=a.data.filas.filter(match).map(r=>{const p=people.get(String(r.colaborador_id));return {...r,cierre:p?.cierre,schedule:p?.hora_inicio_programada&&p?.hora_salida_programada?p.hora_inicio_programada+' – '+p.hora_salida_programada:null}});
            }));
            if(!guard())return;progress(Math.min(i+3,ds.length),ds.length);
          }
          if(!ds.some(d=>records[d].length))throw emptyError();
          result={content:build(ds,records,meta(ds)),type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',name:'asistencia-'+ds[0]+'_'+ds.at(-1)+'.xlsx'};
        }
        if(!guard())return;
        const url=URL.createObjectURL(new Blob([result.content],{type:result.type})),a=document.createElement('a');a.href=url;a.download=result.name;dialog.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
        busy=false;el('seg-download-filename').textContent=result.name;el('seg-download-filedetail').textContent=dateText()+' · '+(file==='csv'?'CSV · día completo':file==='pending'?'XLSX · solo estados en rojo':'XLSX · una sola hoja');
        state('success','Tu archivo está listo','La descarga se ha iniciado. Puedes volver al seguimiento o preparar otro archivo.');
      }catch(error){if(run!==generation||!dialog.open)return;busy=false;state(error.code==='EMPTY'?'empty':'error',error.code==='EMPTY'?(file==='pending'?'No hay pendientes en rojo':'No hay registros para exportar'):'No se pudo preparar el archivo',error.message||'Intenta descargar de nuevo.');}
      finally{if(run===generation){busy=false;controls();}}
    }
    mode.onchange=()=>{sync();picker?.resetSelection();};from.onchange=sync;to.onchange=sync;
    dialog.addEventListener('click',event=>{
      const b=event.target.closest('[data-download],[data-period]');if(!b||b.disabled)return;
      if(b.dataset.period){if(mode.value!==b.dataset.period){mode.value=b.dataset.period;mode.onchange();}return;}
      const action=b.dataset.download;
      if(action==='close'){close();return;}
      if(Object.hasOwn(titles,action)){file=action;mode.value='day';to.value=from.value;stage='config';render();if(picker)picker.focus();else from.focus();return;}
      if(action==='back'){picker?.close();stage=stage==='config'||stage==='success'?'choose':'config';notice.textContent='';render();if(stage==='choose')dialog.querySelector('[data-download="xlsx"]').focus();else if(picker)picker.focus();else from.focus();return;}
      if(action==='primary'){if(stage==='success')close();else if(stage==='empty'){stage='config';render();}else void download();}
    });
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('close',()=>{generation++;busy=false;picker?.close();});
    return {open,close,refresh,isOpen:()=>dialog.open};
  }
  g.KJASeguimientoExcel={mount,build,buildPending,status,dates};
})(window);
