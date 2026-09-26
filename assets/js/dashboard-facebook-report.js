(function(){
  'use strict';
  const get=id=>document.getElementById(id),m=globalThis.KJAFacebookReport;
  let data=null,request=0,pdfBusy=false,reportAreaDetails=[],reportMatrixEmpty=null,currentViewMode='area',cachedGroups=[];
  const narrowReportLayout=window.matchMedia('(max-width: 900px)');
  const today=()=>isoLima();
  const pretty=value=>{
    try{
      return new Intl.DateTimeFormat('es-PE',{timeZone:'UTC',weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(new Date(value+'T12:00:00Z'));
    }catch(_){return value;}
  };

  function clear(){
    request++;data=null;cachedGroups=[];
    get('fb-report-results').hidden=true;
    get('fb-report-results').setAttribute('aria-busy','false');
    get('fb-report-export').disabled=true;
    get('fb-report-pdf').disabled=true;
    get('fb-report-status').dataset.error='false';
    get('fb-report-status').textContent='Pulsa Consultar reporte para cargar este período.';
    if(get('fb-report-kpis'))get('fb-report-kpis').replaceChildren();
    if(get('fb-report-area-summary'))get('fb-report-area-summary').replaceChildren();
    if(get('fb-report-person-view'))get('fb-report-person-view').replaceChildren();
  }

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

  function setViewMode(mode){
    currentViewMode=mode;
    const btnArea=get('fb-btn-view-area'),btnPerson=get('fb-btn-view-person');
    const areaSummary=get('fb-report-area-summary');
    const matrixPane=get('fb-report-matrix'),personPane=get('fb-report-person-view');
    const searchWrap=get('fb-report-search-wrap');

    if(btnArea){btnArea.classList.toggle('active',mode==='area');btnArea.setAttribute('aria-selected',String(mode==='area'));}
    if(btnPerson){btnPerson.classList.toggle('active',mode==='person');btnPerson.setAttribute('aria-selected',String(mode==='person'));}
    if(areaSummary){areaSummary.hidden=mode!=='area';areaSummary.classList.toggle('active',mode==='area');}
    if(matrixPane){matrixPane.hidden=mode!=='area';matrixPane.classList.toggle('active',mode==='area');}
    if(personPane){personPane.hidden=mode!=='person';personPane.classList.toggle('active',mode==='person');}
    if(searchWrap){searchWrap.hidden=mode!=='person';}
    if(mode==='person'&&cachedGroups.length){renderPersonView(cachedGroups);}
  }

  function renderKpis(groups){
    const container=get('fb-report-kpis');
    if(!container)return;
    container.replaceChildren();
    if(!groups.length)return;
    const dates=groups[0]?.dates||[];
    const totalPersons=groups.reduce((n,g)=>n+g.persons.length,0);
    const totalYes=groups.reduce((n,g)=>n+g.totals.reduce((s,t)=>s+t.yes,0),0);
    const totalNo=groups.reduce((n,g)=>n+g.totals.reduce((s,t)=>s+t.no,0),0);
    const totalEvaluated=totalYes+totalNo;
    const totalNotApplicable=totalPersons*dates.length-totalEvaluated;
    const pct=totalEvaluated>0?`${((totalYes/totalEvaluated)*100).toFixed(1)}%`:'—';
    const totalAreas=groups.length;

    const cards=[
      {label:'COLABORADORES',val:totalPersons,sub:`${totalAreas} ${totalAreas===1?'área':'áreas'}`},
      {label:'TOTAL EVALUACIONES',val:totalEvaluated,sub:'Días evaluados'},
      {label:'CON EVIDENCIA (SÍ)',val:totalYes,sub:'Publicaciones registradas',type:'yes'},
      {label:'SIN EVIDENCIA (NO)',val:totalNo,sub:'Faltantes en fecha',type:'no'},
      {label:'% CUMPLIMIENTO',val:pct,sub:totalEvaluated>0?(parseFloat(pct)>=80?'Excelente nivel':parseFloat(pct)>=50?'Regular':'Bajo cumplimiento'):'Sin datos',type:'pct'},
      {label:'NO APLICA / OTROS',val:totalNotApplicable,sub:'Días sin asignación'},
      {label:'ÁREAS EVALUADAS',val:totalAreas,sub:'Equipos activos'}
    ];

    cards.forEach(c=>{
      const card=document.createElement('div');
      card.className=`fb-kpi-card${c.type?' fb-kpi-'+c.type:''}`;
      const lbl=document.createElement('span');lbl.className='fb-kpi-label';lbl.textContent=c.label;
      const val=document.createElement('strong');val.className='fb-kpi-val';val.textContent=c.val;
      const sub=document.createElement('small');sub.className='fb-kpi-sub';sub.textContent=c.sub;
      card.append(lbl,val,sub);
      container.append(card);
    });
  }

  function renderAreaSummary(groups){
    const container=get('fb-report-area-summary');
    if(!container)return;
    container.replaceChildren();
    if(groups.length<=1)return;

    const region=document.createElement('div');
    region.className='fb-report-table fb-area-summary-wrap';
    region.setAttribute('role','region');
    region.setAttribute('aria-label','Control de publicaciones Facebook por área');

    const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody'),foot=document.createElement('tfoot');
    const headerCols=['Área','Colaboradores','Con evidencia (Sí)','No compartió','Total evaluados','% Cumplimiento','Evaluación'];
    const hTr=document.createElement('tr');
    headerCols.forEach(colName=>{
      const th=document.createElement('th');
      th.textContent=colName;
      th.setAttribute('scope','col');
      hTr.append(th);
    });
    head.append(hTr);

    let sumPersons=0,sumYes=0,sumNo=0,sumEval=0;
    groups.forEach(g=>{
      const tr=document.createElement('tr');
      const yes=g.totals.reduce((s,t)=>s+t.yes,0);
      const no=g.totals.reduce((s,t)=>s+t.no,0);
      const evaluated=yes+no;
      const pct=evaluated>0?((yes/evaluated)*100):0;
      const evalStatus=evaluated===0?'Sin evaluar':(pct>=80?'Excelente':(pct>=50?'Regular':'Bajo'));

      sumPersons+=g.persons.length;
      sumYes+=yes;
      sumNo+=no;
      sumEval+=evaluated;

      const thArea=document.createElement('th');thArea.textContent=g.area;thArea.setAttribute('scope','row');
      const tdColab=document.createElement('td');tdColab.textContent=g.persons.length;tdColab.className='fb-td-num';
      const tdYes=document.createElement('td');tdYes.textContent=yes;tdYes.className='fb-stat-yes';
      const tdNo=document.createElement('td');tdNo.textContent=no;tdNo.className='fb-stat-no';
      const tdEval=document.createElement('td');tdEval.textContent=evaluated;tdEval.className='fb-td-num';
      const tdPct=document.createElement('td');tdPct.textContent=evaluated>0?`${pct.toFixed(1)}%`:'—';tdPct.className='fb-stat-pct';
      const tdEvalStatus=document.createElement('td');
      const badge=document.createElement('span');
      badge.className=`fb-status-badge fb-badge-${evalStatus.toLowerCase().replace(/\s+/g,'-')}`;
      badge.textContent=evalStatus;
      tdEvalStatus.append(badge);

      tr.append(thArea,tdColab,tdYes,tdNo,tdEval,tdPct,tdEvalStatus);
      body.append(tr);
    });

    const sumPct=sumEval>0?`${((sumYes/sumEval)*100).toFixed(1)}%`:'—';
    const numPct=sumEval>0?(sumYes/sumEval)*100:0;
    const finalStatus=sumEval===0?'Sin evaluar':(numPct>=80?'Excelente':(numPct>=50?'Regular':'Bajo'));

    const fTr=document.createElement('tr');
    const fTitle=document.createElement('th');fTitle.textContent='RESUMEN FINAL (TOTALES)';fTitle.setAttribute('scope','row');
    const fColab=document.createElement('td');fColab.textContent=sumPersons;fColab.className='fb-td-num';
    const fYes=document.createElement('td');fYes.textContent=sumYes;fYes.className='fb-stat-yes';
    const fNo=document.createElement('td');fNo.textContent=sumNo;fNo.className='fb-stat-no';
    const fEval=document.createElement('td');fEval.textContent=sumEval;fEval.className='fb-td-num';
    const fPct=document.createElement('td');fPct.textContent=sumPct;fPct.className='fb-stat-pct';
    const fStatus=document.createElement('td');
    const fBadge=document.createElement('span');
    fBadge.className=`fb-status-badge fb-badge-${finalStatus.toLowerCase().replace(/\s+/g,'-')}`;
    fBadge.textContent=finalStatus;
    fStatus.append(fBadge);

    fTr.append(fTitle,fColab,fYes,fNo,fEval,fPct,fStatus);
    foot.append(fTr);

    table.append(head,body,foot);
    region.append(table);
    container.append(region);
  }

  function renderPersonView(groups){
    const container=get('fb-report-person-view');
    if(!container)return;
    container.replaceChildren();
    if(!groups.length){
      const empty=document.createElement('p');
      empty.className='fb-report-matrix-empty';
      empty.textContent='No hay colaboradores para esta área y período.';
      container.append(empty);
      return;
    }
    const dates=groups[0]?.dates||[];
    const searchVal=(get('fb-report-search')?.value||'').trim().toLowerCase();
    const allPersons=[];
    groups.forEach(g=>{
      g.persons.forEach(p=>{
        const yes=p.cells.filter(c=>c.value==='Sí').length;
        const no=p.cells.filter(c=>c.value==='No').length;
        const evaluated=yes+no;
        const pct=evaluated>0?((yes/evaluated)*100):0;
        const status=evaluated===0?'Sin evaluar':(pct>=80?'Excelente':(pct>=50?'Regular':'Bajo'));
        allPersons.push({id:p.id,nombre:p.nombre,area:g.area,cells:p.cells,yes,no,evaluated,pct,status});
      });
    });
    allPersons.sort((a,b)=>a.area.localeCompare(b.area,'es')||a.nombre.localeCompare(b.nombre,'es'));
    const filtered=searchVal?allPersons.filter(p=>p.nombre.toLowerCase().includes(searchVal)||p.area.toLowerCase().includes(searchVal)):allPersons;

    if(!filtered.length){
      const empty=document.createElement('p');
      empty.className='fb-report-matrix-empty';
      empty.textContent='No se encontraron colaboradores que coincidan con la búsqueda.';
      container.append(empty);
      return;
    }

    const region=document.createElement('div');
    region.className='fb-report-table fb-person-table-wrap';
    region.setAttribute('role','region');
    region.setAttribute('aria-label','Facebook · Reporte por persona');
    region.setAttribute('tabindex','0');

    const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody'),foot=document.createElement('tfoot');
    const headerCols=['N°','Colaborador','Área',...dates.map(pretty),'Sí compartió','No compartió','% Cump.','Estado'];
    const hTr=document.createElement('tr');
    headerCols.forEach(colName=>{
      const th=document.createElement('th');
      th.textContent=colName;
      th.setAttribute('scope','col');
      hTr.append(th);
    });
    head.append(hTr);

    filtered.forEach((p,idx)=>{
      const tr=document.createElement('tr');
      const tdNum=document.createElement('td');tdNum.textContent=idx+1;tdNum.className='fb-td-num';
      const thName=document.createElement('th');thName.textContent=p.nombre;thName.setAttribute('scope','row');thName.className='fb-td-name';
      const tdArea=document.createElement('td');tdArea.textContent=p.area;tdArea.className='fb-td-area';
      tr.append(tdNum,thName,tdArea);

      p.cells.forEach(c=>{
        const td=document.createElement('td');
        td.textContent=c.value;
        td.dataset.answer=c.value;
        td.title=m.labels[c.state]||'Sin registro';
        tr.append(td);
      });

      const tdYes=document.createElement('td');tdYes.textContent=p.yes;tdYes.className='fb-stat-yes';
      const tdNo=document.createElement('td');tdNo.textContent=p.no;tdNo.className='fb-stat-no';
      const tdPct=document.createElement('td');tdPct.textContent=p.evaluated>0?`${p.pct.toFixed(1)}%`:'—';tdPct.className='fb-stat-pct';
      const tdStatus=document.createElement('td');
      const badge=document.createElement('span');
      badge.className=`fb-status-badge fb-badge-${p.status.toLowerCase().replace(/\s+/g,'-')}`;
      badge.textContent=p.status;
      tdStatus.append(badge);

      tr.append(tdYes,tdNo,tdPct,tdStatus);
      body.append(tr);
    });

    const sumYes=filtered.reduce((s,p)=>s+p.yes,0);
    const sumNo=filtered.reduce((s,p)=>s+p.no,0);
    const sumEval=sumYes+sumNo;
    const sumPct=sumEval>0?`${((sumYes/sumEval)*100).toFixed(1)}%`:'—';

    const fTr=document.createElement('tr');
    const tdFTitle=document.createElement('td');
    tdFTitle.colSpan=3;
    tdFTitle.textContent=`TOTAL (${filtered.length} colaboradores)`;
    tdFTitle.className='fb-footer-title';
    fTr.append(tdFTitle);

    dates.forEach((_,dIdx)=>{
      const td=document.createElement('td');
      const dYes=filtered.filter(p=>p.cells[dIdx]?.value==='Sí').length;
      const dNo=filtered.filter(p=>p.cells[dIdx]?.value==='No').length;
      td.textContent=`${dYes} / ${dNo}`;
      td.title=`Sí: ${dYes}, No: ${dNo}`;
      fTr.append(td);
    });

    const tdFYes=document.createElement('td');tdFYes.textContent=sumYes;tdFYes.className='fb-stat-yes';
    const tdFNo=document.createElement('td');tdFNo.textContent=sumNo;tdFNo.className='fb-stat-no';
    const tdFPct=document.createElement('td');tdFPct.textContent=sumPct;tdFPct.className='fb-stat-pct';
    const tdFEmpty=document.createElement('td');tdFEmpty.textContent='—';
    fTr.append(tdFYes,tdFNo,tdFPct,tdFEmpty);
    foot.append(fTr);

    table.append(head,body,foot);
    region.append(table);
    container.append(region);
  }

  function layoutReportMatrix(){
    if(!data)return;
    const container=get('fb-report-matrix');container.replaceChildren();
    container.dataset.singleArea=String(reportAreaDetails.length===1);
    if(reportMatrixEmpty){container.append(reportMatrixEmpty);return;}
    if(narrowReportLayout.matches){container.append(...reportAreaDetails);return;}
    const columns=Array.from({length:reportAreaDetails.length===1?1:2},()=>{
      const column=document.createElement('div');column.className='fb-report-matrix-column';container.append(column);return column;
    });
    reportAreaDetails.forEach((section,index)=>columns[index%2].append(section));
  }
  if(narrowReportLayout.addEventListener)narrowReportLayout.addEventListener('change',layoutReportMatrix);
  else narrowReportLayout.addListener(layoutReportMatrix);

  function render(){
    if(!data)return;
    const groups=m.matrix(rows(),data.desde,data.hasta);
    cachedGroups=groups;
    reportAreaDetails=[];reportMatrixEmpty=null;

    // Render KPIs
    renderKpis(groups);

    // Render Area summary table
    renderAreaSummary(groups);

    // Render Area view
    for(let index=0;index<groups.length;index++){
      const group=groups[index];
      const section=document.createElement('details'),heading=document.createElement('summary'),title=document.createElement('span'),count=document.createElement('span');
      section.className='fb-report-area-group';
      section.open=index===0;
      heading.className='fb-report-area-heading';
      title.className='fb-report-area-title';
      count.className='fb-report-area-count';
      title.textContent=group.area;
      count.textContent=` · ${group.persons.length} ${group.persons.length===1?'persona':'personas'}`;
      heading.append(title,count);
      const region=document.createElement('div');region.className='fb-report-table';region.setAttribute('role','region');region.setAttribute('aria-label',`Facebook · ${group.area}`);region.setAttribute('tabindex','0');
      const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody'),foot=document.createElement('tfoot');
      head.append(row(['Colaborador',...group.dates.map(pretty)],true));
      for(const person of group.persons){
        const tr=document.createElement('tr'),name=document.createElement('th');name.setAttribute('scope','row');name.textContent=person.nombre;tr.append(name);
        for(const cell of person.cells){const td=document.createElement('td');td.textContent=cell.value;td.dataset.answer=cell.value;td.title=m.labels[cell.state]||'Sin registro';tr.append(td);}
        body.append(tr);
      }
      for(const [label,values] of [['Sí',group.totals.map(t=>t.yes)],['No',group.totals.map(t=>t.no)],['Total evaluado',group.totals.map(t=>t.yes+t.no)]])foot.append(row([label,...values]));
      table.append(head,body,foot);region.append(table);section.append(heading,region);reportAreaDetails.push(section);
    }
    if(!groups.length){reportMatrixEmpty=document.createElement('p');reportMatrixEmpty.className='fb-report-matrix-empty';reportMatrixEmpty.textContent='No hay colaboradores para esta área y período.';}
    layoutReportMatrix();

    // Render Person view
    renderPersonView(groups);

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

  // View toggle listeners
  get('fb-btn-view-area')?.addEventListener('click',()=>setViewMode('area'));
  get('fb-btn-view-person')?.addEventListener('click',()=>setViewMode('person'));
  get('fb-report-search')?.addEventListener('input',()=>{if(cachedGroups.length)renderPersonView(cachedGroups);});

  get('fb-report-export').onclick=()=>{
    if(!data)return;
    const button=get('fb-report-export');button.disabled=true;
    try{
      const currentArea=get('fb-report-area')?.value||'';
      const bytes=globalThis.KJAFacebookExcel.build(m.matrix(rows(),data.desde,data.hasta),{...data,area:currentArea,provisional:provisional()});
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),link=document.createElement('a');
      link.href=url;link.download=`facebook_${data.desde}_${data.hasta}.xlsx`;
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
  get('fb-report-reference').value=limit;period();setViewMode('area');
})();

