(function(){
  'use strict';
  const get=id=>document.getElementById(id),m=globalThis.KJAFacebookReport;
  let data=null,request=0,pdfBusy=false;
  const today=()=>isoLima();
  const pretty=value=>new Intl.DateTimeFormat('es-PE',{timeZone:'UTC',weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(new Date(value+'T12:00:00Z'));
  function clear(){request++;data=null;get('fb-report-results').hidden=true;get('fb-report-results').setAttribute('aria-busy','false');get('fb-report-export').disabled=true;get('fb-report-pdf').disabled=true;get('fb-report-status').dataset.error='false';get('fb-report-status').textContent='Pulsa Consultar reporte para cargar este período.';}
  function period(){
    clear();const kind=get('fb-report-kind').value,ref=get('fb-report-reference').value||today(),custom=kind==='custom';
    get('fb-report-reference-label').hidden=custom;
    get('fb-report-reference').required=!custom;
    get('fb-report-from').readOnly=!custom;get('fb-report-to').readOnly=!custom;
    let range;
    if(kind==='general')range=m.month(ref,today());
    else if(!custom)range=m.cutoff(ref,kind);
    if(range){get('fb-report-from').value=range.desde;get('fb-report-to').value=range.hasta;}
    if(range?.report)get('fb-report-reference').value=range.report;
    get('fb-report-to').max=today();
    get('fb-report-reference').max=kind==='general'?today():m.shift(today(),1);
    get('fb-report-period').textContent=range?.report?`Reporte del ${pretty(range.report)} · ${pretty(range.desde)} al ${pretty(range.hasta)}.`:kind==='general'?'Mes seleccionado, hasta hoy si es el mes actual.':'Selecciona hasta 93 días, como máximo hasta hoy.';
  }
  function rows(){return (data?.filas||[]).filter(r=>!get('fb-report-area').value||r.area===get('fb-report-area').value);}
  function row(values,header=false){const tr=document.createElement('tr');values.forEach(value=>{const td=document.createElement(header?'th':'td');td.textContent=value??'—';if(header)td.setAttribute('scope','col');tr.append(td);});return tr;}
  function provisional(){return data?.provisional===true||data?.hasta===(data?.hoy||today())||data?.filas.some(r=>r.estado==='en_plazo');}
  function render(){
    if(!data)return;
    const groups=m.matrix(rows(),data.desde,data.hasta),container=get('fb-report-matrix');container.replaceChildren();
    for(const group of groups){
      const section=document.createElement('section'),heading=document.createElement('h3');
      heading.textContent=`${group.area} · ${group.persons.length} ${group.persons.length===1?'persona':'personas'}`;
      const region=document.createElement('div');region.className='fb-report-table';region.setAttribute('role','region');region.setAttribute('aria-label',`Facebook · ${group.area}`);region.setAttribute('tabindex','0');
      const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody'),foot=document.createElement('tfoot');
      head.append(row(['Colaborador',...group.dates.map(pretty)],true));
      for(const person of group.persons){
        const tr=document.createElement('tr'),name=document.createElement('th');name.setAttribute('scope','row');name.textContent=person.nombre;tr.append(name);
        for(const cell of person.cells){const td=document.createElement('td');td.textContent=cell.value;td.dataset.answer=cell.value;td.title=m.labels[cell.state]||'Sin registro';tr.append(td);}
        body.append(tr);
      }
      for(const [label,values] of [['Sí',group.totals.map(t=>t.yes)],['No',group.totals.map(t=>t.no)],['Total evaluado',group.totals.map(t=>t.yes+t.no)]])foot.append(row([label,...values]));
      table.append(head,body,foot);region.append(table);section.append(heading,region);container.append(section);
    }
    if(!groups.length){const empty=document.createElement('p');empty.textContent='No hay colaboradores para esta área y período.';container.append(empty);}
    get('fb-report-scope').textContent=`${pretty(data.desde)} al ${pretty(data.hasta)}${provisional()?' · Provisional: incluye hoy o franjas aún abiertas. Los “No” pueden cambiar al registrar evidencia.':''}`;
    get('fb-report-results').hidden=false;get('fb-report-export').disabled=!groups.length;
    get('fb-report-pdf').disabled=pdfBusy||!data.filas.length;
  }
  window.loadAdminFacebookReport=async()=>{
    if(APP.access?.rol!=='direccion')return;
    clear();const token=request,from=get('fb-report-from').value,to=get('fb-report-to').value,status=get('fb-report-status');
    status.dataset.error='false';
    try{
      m.days(from,to);if(from<'2020-01-01'||to>today())throw new Error('Selecciona fechas desde 2020 y como máximo hasta hoy.');
      status.textContent='Consultando Facebook…';get('fb-report-results').setAttribute('aria-busy','true');
      const result=await db.rpc('dash_reporte_facebook',{p_desde:from,p_hasta:to});
      if(token!==request)return;
      if(result.error){
        if(result.error.code==='PGRST202')throw new Error('El reporte aún no está habilitado. Falta aplicar la migración 64 de reportes Facebook y su actualización 65.');
        if(result.error.message?.includes('hasta ayer'))throw new Error('Falta actualizar el reporte en Supabase: aplica la migración 65 para consultar hoy.');
        throw new Error('No se pudo consultar el reporte. Vuelve a intentarlo.');
      }
      if(!result.data||!Array.isArray(result.data.filas))throw new Error('El servidor devolvió un reporte inválido. Vuelve a intentarlo.');
      data=result.data;
      const selected=get('fb-report-area').value;
      get('fb-report-area').replaceChildren(new Option('Todas las áreas',''),...[...new Set(data.filas.map(r=>r.area))].sort((a,b)=>a.localeCompare(b,'es')).map(area=>new Option(area,area)));
      get('fb-report-area').value=[...get('fb-report-area').options].some(o=>o.value===selected)?selected:'';
      render();status.textContent=`Actualizado ${new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'short',timeStyle:'short'}).format(new Date(data.generado_at))} · hora de Lima.`;
    }catch(error){if(token!==request)return;status.dataset.error='true';status.textContent=error.message||'No se pudo cargar el reporte. Vuelve a intentarlo.';}
    finally{if(token===request)get('fb-report-results').setAttribute('aria-busy','false');}
  };
  get('fb-report-form').addEventListener('submit',event=>{event.preventDefault();window.loadAdminFacebookReport();});
  get('fb-report-kind').onchange=()=>{get('fb-report-reference').value=get('fb-report-kind').value==='general'?today():m.shift(today(),1);period();};
  get('fb-report-reference').onchange=period;
  for(const id of ['fb-report-from','fb-report-to'])get(id).onchange=clear;
  get('fb-report-area').onchange=render;
  get('fb-report-export').onclick=()=>{
    if(!data)return;
    const button=get('fb-report-export');button.disabled=true;
    try{
      const bytes=globalThis.KJAFacebookExcel.build(m.matrix(rows(),data.desde,data.hasta),{...data,provisional:provisional()});
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),link=document.createElement('a');link.href=url;link.download=`facebook_${data.desde}_${data.hasta}.xlsx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){get('fb-report-status').dataset.error='true';get('fb-report-status').textContent='No se pudo preparar el Excel. Actualiza la página e inténtalo nuevamente.';}
    finally{button.disabled=false;}
  };
  get('fb-report-pdf').onclick=async()=>{
    if(!data||pdfBusy)return;
    const snapshot=data,token=request,meta={...snapshot,provisional:provisional()},button=get('fb-report-pdf');
    pdfBusy=true;button.disabled=true;button.textContent='Preparando PDF…';
    try{
      await globalThis.KJAFacebookPDF.load();
      if(token!==request)return;
      const groups=m.matrix(snapshot.filas,snapshot.desde,snapshot.hasta);
      const bytes=globalThis.KJAFacebookPDF.build(groups,meta);
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),link=document.createElement('a');
      link.href=url;link.download=`facebook_detalle_${snapshot.desde}_${snapshot.hasta}.pdf`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      get('fb-report-status').dataset.error='false';get('fb-report-status').textContent='PDF preparado: detalle de todas las áreas y ranking final.';
    }catch(error){if(token===request){get('fb-report-status').dataset.error='true';get('fb-report-status').textContent='No se pudo preparar el PDF. Vuelve a intentarlo.';}}
    finally{pdfBusy=false;button.textContent='Descargar PDF completo';button.disabled=!data?.filas.length;}
  };
  const refresh=get('admin-refresh'),previousRefresh=refresh.onclick;
  refresh.onclick=event=>APP.adminSection==='facebook'?window.loadAdminFacebookReport():previousRefresh?.call(refresh,event);
  const limit=m.shift(today(),1),monday=m.cutoff(limit,'lunes'),thursday=m.cutoff(limit,'jueves');
  get('fb-report-kind').value=monday.report>thursday.report?'lunes':'jueves';
  get('fb-report-reference').value=limit;period();
})();
