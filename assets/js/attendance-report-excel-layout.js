/* Excel de colaboradores: identidad, horario vigente y asistencia mensual. */
(function(root){
  'use strict';
  const escape=v=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const col=index=>{let n=index+1,s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
  const cell=(v,s=0,f)=>({v,s,f});
  const row=(cells=[],height=30)=>({cells,height});
  const fonts=[[11,'24262B'],[22,'1C1C1E'],[10,'6E737D'],[11,'344055'],[24,'246B58']];
  const fills=['FFFFFF','F2F3F6','E4F3E9','FFF1D6','FBE7E8','E7EFFB','EEEAF8'];
  // Body, title, note, header, number, success, warning, danger, neutral, KPI,
  // percentage, date, time, hours, information, optional, alternating text.
  const specs=[[0,0,0],[1,0,0],[2,0,0],[3,3,0],[0,0,1],[0,4,0],[0,5,0],[0,6,0],[2,3,0],[4,4,0],[0,0,9],[0,0,164],[0,0,20],[0,0,165],[0,7,0],[0,8,0],[0,3,0],[0,0,49]];
  const styles=`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="0.0&quot; h&quot;"/></numFmts><fonts count="5">${fonts.map(([size,color],i)=>`<font>${[1,3,4].includes(i)?'<b/>':''}<sz val="${size}"/><color rgb="FF${color}"/><name val="Arial"/></font>`).join('')}</fonts><fills count="9"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills><borders count="2"><border/><border><bottom style="hair"><color rgb="FFE4E6EB"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${specs.length}">${specs.map(([f,b,n],i)=>`<xf numFmtId="${n}" fontId="${f}" fillId="${b}" borderId="${[0,4,5,6,7,10,11,12,13,14,15,16].includes(i)?1:0}" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1" applyBorder="1"><alignment horizontal="${[4,10,13].includes(i)?'right':[3,5,6,7,8,9,11,12,14,15].includes(i)?'center':'left'}" vertical="center" wrapText="1"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const date=v=>v&&Number.isFinite(Date.parse(v))?cell((Date.parse(String(v).slice(0,10)+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000,11):cell('Sin registrar',2);
  const time=v=>/^\d{2}:\d{2}/.test(v||'')?cell((Number(v.slice(0,2))*60+Number(v.slice(3,5)))/1440,12):cell('—',8);
  function sheet(name,widths,rows,merges,freeze,filter,xFreeze=1){
    const last=rows.length,end=col(widths.length-1);
    const xmlCell=(v,ref)=>{const c=v&&typeof v==='object'?v:cell(v,typeof v==='number'?4:0),numeric=typeof c.v==='number'&&Number.isFinite(c.v);return `<c r="${ref}" s="${c.s}"${numeric?'':' t="inlineStr"'}>${c.f?`<f>${escape(c.f)}</f>`:''}${numeric?`<v>${c.v}</v>`:`<is><t xml:space="preserve">${escape(c.v)}</t></is>`}</c>`;};
    return {name,last:`${end}${last}`,repeat:freeze,xml:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><tabColor rgb="FF7189AA"/><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${end}${last}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="85"><pane xSplit="${xFreeze}" ySplit="${freeze}" topLeftCell="${col(xFreeze)}${freeze+1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="30"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((r,i)=>`<row r="${i+1}" ht="${r.height}" customHeight="1">${r.cells.map((v,j)=>xmlCell(v,`${col(j)}${i+1}`)).join('')}</row>`).join('')}</sheetData>${filter?`<autoFilter ref="${filter}">${name==='Asistencia'?Array.from({length:widths.length-3},(_,i)=>`<filterColumn colId="${i+3}" hiddenButton="1" showButton="0"/>`).join(''):''}</autoFilter>`:''}<mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="${widths.length>20?8:9}" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`};
  }
  const opening=(title,period,note)=>[row([],12),row([cell(title,1)],38),row([cell(period,2)]),row([cell(note,2)],32),row([],12)];
  const modes={virtual:['Virtual',14],presencial:['Presencial',5],opcional:['Opcional',15],no_gestiona:['No gestiona',8]};
  function schedule(p,dow){
    const day=p.horario_semanal?.[String(dow)]||{},mode=day.mod||((p.dias_laborables||[]).map(Number).includes(dow)?'virtual':'no_gestiona');
    const [label,style]=modes[mode]||['Sin configurar',8];
    if(mode==='no_gestiona')return cell(label,style);
    const start=day.ini||p.hora_inicio,end=day.fin||p.hora_fin;
    const text=start&&end?`${start.slice(0,5)} – ${end.slice(0,5)}${end<=start?' (+1 día)':''}`:'Horario sin completar';
    const link=p.tipo_vinculo==='ambos'?'\n'+({practicas:'Prácticas',voluntariado:'Voluntariado'}[day.vinc||'practicas']||'Sin vínculo'):'';
    return cell(`${label}\n${text}${link}`,style);
  }
  // Estilos compactos exclusivos de Asistencia; las otras hojas no cambian.
  const compactSpecs=[[5,9],[6,0],[6,0],[6,4],[6,5],[6,6],[6,7],[6,8],[6,10],[6,8],[6,0],[6,4],[6,8],[6,7]];
  const compactStyles=styles.replace('<fonts count="5">','<fonts count="7">').replace('</fonts>','<font><b/><sz val="10"/><color rgb="FF344055"/><name val="Arial"/></font><font><sz val="10"/><color rgb="FF173153"/><name val="Arial"/></font></fonts>')
    .replace('<fills count="9">','<fills count="11">').replace('</fills>','<fill><patternFill patternType="solid"><fgColor rgb="FFE4EAF4"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCEFEA"/><bgColor indexed="64"/></patternFill></fill></fills>')
    .replace(`<cellXfs count="${specs.length}">`,`<cellXfs count="${specs.length+compactSpecs.length}">`).replace('</cellXfs>',compactSpecs.map(([font,fill],i)=>`<xf numFmtId="${i===10?165:0}" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="${(i===1||i>=11)?'left':i===10?'right':'center'}" vertical="center" wrapText="1"/></xf>`).join('')+'</cellXfs>');
  const compactEntry={puntuales:['P',21],tardanzas:['T',22],justificados:['J',24],dias_libres:['DL',21],faltas:['F',23],pendientes:['PD',25],en_curso:['PD',25],no_gestiona:['NG',20],no_laborables:['—',20],sin_datos:['SD',20]};
  function create(bundle){
    if(!bundle.reports.length)throw Error('Selecciona al menos un colaborador.');
    const M=root.KJAAttendanceReport,period=`${M.date(bundle.range.from)} al ${M.date(bundle.range.to)} · Hora de Lima`;
    const total=bundle.reports.reduce((a,r)=>({p:a.p+r.totals.puntuales,t:a.t+r.totals.tardanzas,f:a.f+r.totals.faltas}),{p:0,t:0,f:0});
    const summary=opening('KJA · Resumen',period,'P: ingreso puntual · T: llegó tarde. Los indicadores corresponden únicamente al período seleccionado.');
    summary.push(row([cell('COLABORADORES',3),'',cell('INGRESOS PUNTUALES',3),'','',cell('LLEGADAS TARDE',3),'',cell('FALTAS',3),'','']),row([cell(bundle.reports.length,9),'',cell(total.p,9),'','',cell(total.t,9),'',cell(total.f,9),'',''],42),row([],16),row(['Colaborador','DNI','Institución','Área','Ingreso','Presentes (puntuales)','Tardanzas','Justificados','Faltas','Observaciones'].map(h=>cell(h,3)),38));
    const summaryMerges=['A2:J2','A3:J3','A4:J4','A6:B6','C6:E6','F6:G6','H6:J6','A7:B7','C7:E7','F7:G7','H7:J7'];
    const schedules=opening('KJA · Horarios',`${bundle.reports.length} colaboradores · Horario semanal vigente al descargar`,'Azul: virtual · Verde: presencial · Lila: opcional · Gris: no gestiona. (+1 día): salida al día siguiente.');
    schedules.push(row(['N°','Colaborador','Área','Inicio general','Fin general','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map(h=>cell(h,3)),36));
    const attendance=[row([cell('KJA · Asistencia mensual',1)],32),row([cell(period,2)],22),row([cell('P: ingreso puntual · T: tarde · J: justificado · DL: día libre · F: falta · PD: pendiente · NG: no gestiona · SD: sin datos · —: no laborable. Vacío: fuera del período.',2)],24),row([],8)];
    attendance.push(row(['Colaborador','Área','Mes',...Array.from({length:31},(_,i)=>i+1),'Horas válidas'].map(h=>cell(h,18)),28));
    const areaStyles=new Map();
    for(const [personIndex,r] of bundle.reports.entries()){
      const p=r.person,notes=[],count=key=>r.days.filter(d=>d.tasks?.key===key).length;
      if(r.note)notes.push(r.note);
      else {notes.push(`Pendientes: ${count('cumplio')} días cumplió · ${count('no_cumplio')} no cumplió`);if(count('en_curso'))notes.push(`${count('en_curso')} en curso`);if(count('sin_datos'))notes.push(`${count('sin_datos')} sin datos de pendientes`);}
      if(p.activo===false)notes.push('Dado de baja');
      const refs=[],months=new Map();
      for(let d=new Date(bundle.range.from.slice(0,7)+'-01T00:00:00Z');d.toISOString().slice(0,10)<=bundle.range.to;d.setUTCMonth(d.getUTCMonth()+1))months.set(d.toISOString().slice(0,7),new Map());
      for(const d of r.days){if(d.date>=bundle.range.from&&d.date<=bundle.range.to)months.get(d.date.slice(0,7))?.set(Number(d.date.slice(8)),d);}
      for(const [month,days] of months){
        const label=new Date(month+'-01T00:00:00Z').toLocaleDateString('es-PE',{month:'long',year:'numeric',timeZone:'UTC'});
        const rowNumber=attendance.length+1;refs.push(rowNumber);
        const countDays=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();
        const daily=Array.from({length:31},(_,i)=>{const iso=`${month}-${String(i+1).padStart(2,'0')}`;return i>=countDays||iso<bundle.range.from||iso>bundle.range.to||(p.contrato_inicio&&iso<String(p.contrato_inicio).slice(0,10))?null:days.get(i+1)||{key:'sin_datos',tasks:{key:'sin_datos'}};});
        let hours=0,knownHours=false;
        for(const d of days.values())if(['puntuales','tardanzas','justificados'].includes(d.key)&&d.sourceDay?.cierre_estado!=='incompleta'&&d.sourceDay?.cierre_estado!=='en_curso'&&d.sourceDay?.horas!=null&&Number.isFinite(Number(d.sourceDay.horas))){hours+=Number(d.sourceDay.horas);knownHours=true;}
        const area=p.area||'Sin área';if(!areaStyles.has(area))areaStyles.set(area,26+areaStyles.size%2);
        attendance.push(row([cell(p.nombre,29+personIndex%3),cell(area,areaStyles.get(area)),cell(label,19),...daily.map(d=>d?cell(...(compactEntry[d.key]||compactEntry.sin_datos)):cell('',20)),cell(knownHours?hours:'—',28)],26));
      }
      const metric=(code,n)=>r.note?'—':cell(n,4,refs.map(i=>`COUNTIF('Asistencia'!D${i}:AH${i},"${code}")`).join('+'));
      summary.push(row([p.nombre,cell(String(p.dni||''),17),p.institucion?.trim()||'Sin registrar',cell(p.area||'Sin área',16),date(p.contrato_inicio),metric('P',r.totals.puntuales),metric('T',r.totals.tardanzas),metric('J',r.days.filter(d=>d.key==='justificados').length),metric('F',r.totals.faltas),notes.join('\n')],Math.max(58,notes.length*15+12,Math.ceil((p.institucion||'').length/28)*15+12)));
      schedules.push(row([String(p.id??''),p.nombre,cell(p.area||'Sin área',16),time(p.hora_inicio),time(p.hora_fin),...Array.from({length:7},(_,i)=>schedule(p,i+1))],p.tipo_vinculo==='ambos'?68:54));
    }
    return {styles:compactStyles,sheets:[sheet('Resumen',[34,14,32,25,16,16,14,15,12,46],summary,summaryMerges,9,`A9:J${summary.length}`),sheet('Horarios',[8,34,25,16,16,...Array(7).fill(25)],schedules,['A2:L2','A3:L3','A4:L4'],6,`A6:L${schedules.length}`,3),sheet('Asistencia',[34,22,23,...Array(31).fill(4.8),14],attendance,['A1:AI1','A2:AI2','A3:AI3'],5,`A5:AI${attendance.length}`,3)]};
  }
  root.KJAAttendanceExcelLayout={create};
})(globalThis);
