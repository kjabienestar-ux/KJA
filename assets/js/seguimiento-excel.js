/* Reporte de marcaciones: lectura autorizada por fecha y OOXML local. */
(function(g){
  'use strict';
  const x=v=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const col=n=>{let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
  const time=v=>v?new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'—';
  const add=(d,n)=>{const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
  const weekday=d=>['DO','LU','MA','MI','JU','VI','SA'][new Date(d+'T12:00:00Z').getUTCDay()];
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
      const last=col(headers.length),rows=[];let n=0;
      const row=(values,style=0,height=25)=>{n++;rows.push('<row r="'+n+'" ht="'+height+'" customHeight="1">'+values.map((v,i)=>{const item=Array.isArray(v)?v:[v,style];return '<c r="'+col(i+1)+n+'" s="'+item[1]+'" t="inlineStr"><is>'+(item[0]&&typeof item[0]==='object'?'<r><rPr><b/><sz val="11"/><color rgb="FF304538"/><rFont val="Calibri"/></rPr><t xml:space="preserve">'+x(item[0].name)+'\n</t></r><r><rPr><sz val="10"/><color rgb="FF7A857D"/><rFont val="Calibri"/></rPr><t xml:space="preserve">'+x(item[0].area)+'</t></r>':'<t xml:space="preserve">'+x(item[0])+'</t>')+'</is></c>'}).join('')+'</row>')};
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
      const merges=[...[1,2,3,5,n-1,n].map(i=>'A'+i+':'+last+i),...merged];
      const xml='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"></sheetView></sheetViews><cols>'+headers.map((_,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(i===0?36:single?23:19)+'" customWidth="1"/>').join('')+'</cols><sheetData>'+rows.join('')+'</sheetData><mergeCells count="'+merges.length+'">'+merges.map(ref=>'<mergeCell ref="'+ref+'"/>').join('')+'</mergeCells><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="0" fitToHeight="0"/></worksheet>';
      sheets.push({name:'Detalle de asistencia',xml,repeat:9,last:last+n});
    }
    return g.KJAFacebookExcel.buildWorkbook(sheets,styles);
  }
  function mount(root,context,read){
    const box=document.createElement('details');box.className='seg-excel';box.innerHTML='<summary>Exportar marcaciones a Excel</summary><div class="seg-excel-controls"><label>Período<select id="seg-x-mode"><option value="day">Un día</option><option value="week">Semana</option><option value="range">Rango personalizado</option></select></label><label>Fecha / período<input id="seg-x-from" type="date"></label><label>Hasta<input id="seg-x-to" type="date"></label><button type="button" class="seg-button" id="seg-x-download">Descargar Excel</button></div><p>Respeta el área y la búsqueda por nombre de Seguimiento diario. Incluye todas las personas coincidentes, cualquiera sea su bandeja. Máximo 93 días.</p><p id="seg-x-status" role="status" aria-live="polite"></p>';
    root.querySelector('.seg-toolbar').after(box);
    const mode=box.querySelector('select'),from=box.querySelector('#seg-x-from'),to=box.querySelector('#seg-x-to'),button=box.querySelector('button'),notice=box.querySelector('#seg-x-status');
    if(typeof initAreaPickerElement==='function')initAreaPickerElement(mode,'seg-period-popup','seg-period-options','Elige el período del reporte',null,{icon:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',label:'Un día',filter:'Período del reporte',search:'Buscar período…',searchLabel:'Buscar período',list:'Períodos',empty:'Sin resultados.'});
    from.min=to.min='2020-01-01';
    if(typeof initKjaDatePicker==='function'){
      initKjaDatePicker(from,{label:'Fecha o período',partner:to,popupId:'seg-from-popup',theme:'warm',rangeMode:()=>mode.value});
      to.closest('label').hidden=true;
    }
    const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    function sync(){const d=from.value||context().date||today();from.max=to.max=today();if(mode.value==='day')to.value=d;if(mode.value==='week'){const dow=new Date(d+'T12:00:00Z').getUTCDay();from.value=add(d,-((dow+6)%7));to.value=[add(from.value,6),today()].sort()[0]}to.disabled=mode.value!=='range';if(typeof syncKjaDatePickers==='function')syncKjaDatePickers()}
    box.addEventListener('toggle',()=>{if(box.open&&!from.value){from.value=context().date;sync()}button.disabled=!context().allowed});mode.onchange=sync;from.onchange=sync;
    button.onclick=async()=>{
      const ctx=context(),signature=JSON.stringify(ctx);if(!ctx.allowed){notice.textContent='Solo Dirección puede exportar este reporte.';return}
      button.disabled=true;
      try{sync();const ds=dates(from.value,to.value);if(from.value<'2020-01-01'||to.value>today())throw Error('Selecciona fechas desde 2020 hasta hoy en Lima.');const records={};
        for(let i=0;i<ds.length;i+=3){notice.textContent='Consultando '+Math.min(i+3,ds.length)+' de '+ds.length+' días…';await Promise.all(ds.slice(i,i+3).map(async d=>{
          const [a,b]=await Promise.all([read('dash_admin_control_diario',d,ctx.owner),read('dash_admin_cierres',d,ctx.owner)]);
          if(a.error||b.error||!a.data?.ok||!b.data?.ok||!Array.isArray(a.data.filas)||!Array.isArray(b.data.personas)||(a.data.fecha&&a.data.fecha!==d)||(b.data.fecha&&b.data.fecha!==d))throw Error('No se pudo consultar el día '+d+'. Reintenta; no se descargó un reporte parcial.');
          const people=new Map(b.data.personas.map(p=>[String(p.id),p]));records[d]=a.data.filas.filter(r=>(!ctx.area||String(r.area_id??'__none')===ctx.area)&&(!ctx.query||norm(r.colaborador+' '+r.area).includes(norm(ctx.query)))).map(r=>{const p=people.get(String(r.colaborador_id));return {...r,cierre:p?.cierre,schedule:p?.hora_inicio_programada&&p?.hora_salida_programada?p.hora_inicio_programada+' – '+p.hora_salida_programada:null}});
        }));if(JSON.stringify(context())!==signature)throw Error('Cambió la sesión o los filtros. Vuelve a descargar.');}
        const bytes=build(ds,records,{scope:(ctx.area?'Área filtrada':'Todas las áreas')+(ctx.query?' · Búsqueda: '+ctx.query:''),updated:new Date().toLocaleString('es-PE',{timeZone:'America/Lima'}),today:ds.includes(today())});
        const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download='asistencia-'+ds[0]+'_'+ds.at(-1)+'.xlsx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notice.textContent='Excel descargado: '+ds.length+' día(s).';
      }catch(e){notice.textContent=e.message||'No se pudo generar el Excel.'}finally{button.disabled=!context().allowed}
    };
  }
  g.KJASeguimientoExcel={mount,build,status,dates};
})(window);
