/* PDF de todo el período: matrices legibles por área y ranking final. */
(function(root){
  'use strict';
  let loading;
  function script(src){return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>{el.remove();reject(new Error('No se pudo cargar el generador PDF. Inténtalo nuevamente.'));};document.head.append(el);});}
  async function load(){
    if(root.jspdf?.jsPDF&&root.jspdf.jsPDF.API.autoTable)return;
    if(!loading)loading=(async()=>{
      if(!root.jspdf?.jsPDF)await script('assets/js/vendor/jspdf-4.2.1.umd.min.js');
      if(!root.jspdf.jsPDF.API.autoTable)await script('assets/js/vendor/jspdf-autotable-5.0.7.min.js');
    })().catch(error=>{loading=null;throw error;});
    await loading;
  }
  const navy=[9,36,76],ink=[21,36,58],muted=[82,97,119];
  const displayDate=value=>new Intl.DateTimeFormat('es-PE',{timeZone:'UTC',weekday:'short',day:'2-digit',month:'short'}).format(new Date(value+'T12:00:00Z'));
  function build(groups,meta){
    if(!groups.length)throw new Error('No hay áreas para exportar.');
    const doc=new root.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
    doc.setProperties({title:`Facebook - Detalle completo ${meta.desde} al ${meta.hasta}`,author:'KJA',subject:'Evidencias de Facebook por persona y día; ranking por área'});
    const width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight(),left=14,usable=width-left*2;
    const base={theme:'plain',margin:{top:54,left,right:left,bottom:20},rowPageBreak:'avoid',showHead:'everyPage',showFoot:'lastPage',
      styles:{font:'helvetica',fontSize:9,cellPadding:2,valign:'middle',textColor:ink,overflow:'linebreak',lineColor:[227,232,238],lineWidth:{bottom:0.15}},
      headStyles:{fillColor:navy,textColor:255,fontStyle:'bold',halign:'center'},
      footStyles:{fillColor:[225,235,245],textColor:navy,fontStyle:'bold',halign:'center'},
      alternateRowStyles:{fillColor:[246,248,251]}};
    let y=54;
    for(const group of groups){
      // A maximum of seven days per block avoids microscopic monthly columns.
      for(let start=0;start<group.dates.length;start+=7){
        const dates=group.dates.slice(start,start+7),count=dates.length;
        if(y>height-65){doc.addPage();y=54;}
        const columns={0:{cellWidth:80,halign:'left'}};
        dates.forEach((_,i)=>columns[i+1]={cellWidth:(usable-80)/count,halign:'center'});
        const title=`${group.area}  |  ${group.persons.length} ${group.persons.length===1?'persona':'personas'}${group.dates.length>7?`  |  ${displayDate(dates[0])} al ${displayDate(dates.at(-1))}`:''}`;
        doc.autoTable({...base,startY:y,columnStyles:columns,pageBreak:group.persons.length<=5&&y>54?'avoid':'auto',
          head:[[{content:title,colSpan:count+1,styles:{halign:'left',fillColor:[240,244,249],textColor:navy,fontSize:11}}],['Colaborador',...dates.map(displayDate)]],
          body:group.persons.map(p=>[p.nombre,...p.cells.slice(start,start+7).map(c=>c.value)]),
          foot:[['Sí',...group.totals.slice(start,start+7).map(t=>t.yes)],['No',...group.totals.slice(start,start+7).map(t=>t.no)],['Total evaluado',...group.totals.slice(start,start+7).map(t=>t.yes+t.no)]],
          didParseCell:({section,column,cell})=>{
            if(section!=='body'||column.index===0)return;
            const value=String(cell.raw);
            if(value==='Sí'){cell.styles.fillColor=[228,243,235];cell.styles.textColor=[18,100,81];cell.styles.fontStyle='bold';}
            else if(value==='No'){cell.styles.fillColor=[252,235,236];cell.styles.textColor=[160,39,59];cell.styles.fontStyle='bold';}
            else{cell.styles.textColor=muted;cell.styles.fontSize=8;}
          }
        });
        y=doc.lastAutoTable.finalY+9;
      }
    }
    doc.addPage();const rankingStart=doc.getNumberOfPages(),ranking=root.KJAFacebookReport.ranking(groups);
    doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(9);
    doc.text('Ordenado por total de Sí (persona/día), no por número de capturas ni por porcentaje.',left,56);
    doc.text('Los empates comparten puesto. Las áreas sin días evaluados se muestran sin posición.',left,62);
    doc.autoTable({...base,startY:69,margin:{...base.margin,top:54},
      columnStyles:{0:{cellWidth:30,halign:'center'},1:{cellWidth:usable-112},2:{cellWidth:36,halign:'center'},3:{cellWidth:46,halign:'center'}},
      head:[['Puesto','Área','Personas','Total de Sí']],
      body:ranking.map(r=>[r.rank===null?'Sin evaluación':String(r.rank),r.area,r.people,r.yes]),
      foot:[['','TOTAL',ranking.reduce((n,r)=>n+r.people,0),ranking.reduce((n,r)=>n+r.yes,0)]]
    });
    const pages=doc.getNumberOfPages(),updated=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'short',timeStyle:'short'}).format(new Date(meta.generado_at));
    for(let page=1;page<=pages;page++){
      doc.setPage(page);doc.setFillColor(...navy);doc.rect(left,10,usable,18,'F');doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(17);
      doc.text(page>=rankingStart?'KJA / Ranking por área':'KJA / Facebook - Detalle completo',left+5,22);
      doc.setTextColor(...ink);doc.setFont('helvetica','normal');doc.setFontSize(9);
      doc.text(`${meta.desde.split('-').reverse().join('/')} al ${meta.hasta.split('-').reverse().join('/')}  |  Todas las áreas del reporte`,left,35);
      doc.setTextColor(...muted);doc.setFontSize(8);
      doc.text(`Actualizado ${updated} (Lima)${meta.provisional?'  |  PROVISIONAL: los No de franjas abiertas pueden cambiar.':''}`,left,41);
      doc.text('Sí: evidencia registrada. No: sin evidencia al consultar. No comparte ese día: sin tarea asignada.',left,47);
      doc.setDrawColor(227,232,238);doc.line(left,height-14,width-left,height-14);
      doc.setFontSize(7.5);doc.text('Equipo activo y horarios actuales. Un Sí equivale a una persona con evidencia en una fecha.',left,height-9);
      doc.text(`${page} / ${pages}`,width-left,height-9,{align:'right'});
    }
    return new Uint8Array(doc.output('arraybuffer'));
  }
  root.KJAFacebookPDF={load,build};
})(globalThis);
