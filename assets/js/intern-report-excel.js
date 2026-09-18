/* Libro de informes del panel: OOXML local, sin enviar datos a servicios externos. */
(function(root){
  'use strict';
  const x=value=>String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
  const col=n=>{let result='';for(;n;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result;};
  const value=(v,s=0,f)=>({v:v??'',s,f});
  const date=iso=>iso?value((Date.parse(String(iso).slice(0,10)+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000,5):value('Sin registrar');
  const time=text=>/^\d{2}:\d{2}/.test(text||'')?value((Number(text.slice(0,2))*60+Number(text.slice(3,5)))/1440,7):value('—');
  const font=(size,color,bold=false)=>`<font>${bold?'<b/>':''}<sz val="${size}"/><color rgb="FF${color}"/><name val="Calibri"/></font>`;
  const baseStyles=`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="166" formatCode="0.0&quot; h&quot;"/></numFmts><fonts count="4">${font(11,'15243A')}${font(22,'FFFFFF',true)}${font(10,'526177')}${font(11,'FFFFFF',true)}</fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF09244C"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F4F9"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9">${[[0,0,0],[1,2,0],[2,0,0],[3,2,0],[0,0,1],[0,0,164],[0,0,165],[0,0,20],[0,0,166]].map(([f,b,n])=>`<xf numFmtId="${n}" fontId="${f}" fillId="${b}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="1"><dxf><fill><patternFill patternType="solid"><fgColor rgb="FFF0F4F9"/><bgColor rgb="FFF0F4F9"/></patternFill></fill></dxf></dxfs></styleSheet>`;
  // Colores de la matriz: azul institucional, modalidades y grupos distinguibles.
  const scheduleFills=['3978C9','FFF6A5','DDF0E4','F9DADB','E7E6F4','DDEEF4','E9DDF2','FBE5D5','D9EEE9'];
  const scheduleSpecs=[[3,4],[0,5],[0,6],[0,7],[0,8],[0,9],[0,10],[0,11],[0,12]];
  const scheduleStyles=baseStyles.replace('<fills count="4">','<fills count="13">').replace('</fills>',scheduleFills.map(color=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`).join('')+'</fills>').replace('<cellXfs count="9">','<cellXfs count="18">').replace('</cellXfs>',scheduleSpecs.map(([font,fill])=>`<xf numFmtId="0" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`).join('')+'</cellXfs>');
  const styles=scheduleStyles.replace('<fills count="13">','<fills count="14">').replace('</fills>','<fill><patternFill patternType="solid"><fgColor rgb="FFCA96F4"/><bgColor indexed="64"/></patternFill></fill></fills>').replace('<cellXfs count="18">','<cellXfs count="19">').replace('</cellXfs>','<xf numFmtId="0" fontId="1" fillId="13" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs>');
  function cell(ref,input){
    const item=input&&typeof input==='object'&&'v' in input?input:value(input,typeof input==='number'?4:0);
    const numeric=typeof item.v==='number'&&Number.isFinite(item.v);
    return `<c r="${ref}" s="${item.s}"${numeric?'':' t="inlineStr"'}>${item.f?`<f>${x(item.f)}</f>`:''}${numeric?`<v>${item.v}</v>`:`<is><t xml:space="preserve">${x(typeof item.v==='number'?'Sin registrar':item.v)}</t></is>`}</c>`;
  }
  function sheet(name,headers,widths,rows,note){
    const end=col(headers.length),last=Math.max(6,rows.length+5);
    const row=(index,items,height)=>`<row r="${index}" ht="${height}" customHeight="1">${items.map((item,i)=>cell(col(i+1)+index,item)).join('')}</row>`;
    const body=rows.length?rows:[['Sin registros para la selección.']];
    const data=body.map((items,i)=>{const lines=Math.max(...items.map((item,j)=>{const text=item?.v??item??'';return String(text).split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/Math.max(10,widths[j]-2))),0);}));return row(i+6,items,Math.min(180,Math.max(28,lines*15)));}).join('');
    const xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><tabColor rgb="FF09244C"/><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${end}${last}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="2" ySplit="5" topLeftCell="C6" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="C6" sqref="C6"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="28"/><cols>${widths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${row(1,headers.map((_,i)=>value(i?'':`KJA · ${name}`,1)),36)}${row(2,[value(note,2)],48)}${row(3,[value(`${rows.length} registros · Fechas y horas de Lima (Perú).`,2)],24)}${row(5,headers.map(header=>value(header,3)),32)}${data}</sheetData>${rows.length?`<autoFilter ref="A5:${end}${last}"/>`:''}<mergeCells count="3"><mergeCell ref="A1:${end}1"/><mergeCell ref="A2:${end}2"/><mergeCell ref="A3:${end}3"/></mergeCells><conditionalFormatting sqref="A6:${end}${last}"><cfRule type="expression" dxfId="0" priority="1"><formula>MOD(ROW(),2)=0</formula></cfRule></conditionalFormatting><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;L KJA · ${x(name)}&amp;R Página &amp;P de &amp;N</oddFooter></headerFooter></worksheet>`;
    return {name,xml,repeat:5,last:`${end}${last}`};
  }
  function scheduleSheet(rows,today){
    const result=sheet('Horarios',['N°','Colaborador','Área','Inicio general','Fin general',...PROFILE_DAY_NAMES],[8,34,24,15,15,27,27,27,27,27,27,27],rows,`Horario semanal vigente al ${today}. Amarillo: virtual · Verde: presencial · Rojo: no gestiona · Lila: opcional. (+1 día): salida al día siguiente.`);
    result.xml=result.xml.replace('xSplit="2"','xSplit="3"').replaceAll('C6','D6').replace(/(<row r="5"[^>]*>)([\s\S]*?)(<\/row>)/,(_,open,cells,close)=>open+cells.replaceAll('s="3"','s="9"')+close).replace(/<conditionalFormatting[\s\S]*?<\/conditionalFormatting>/,'');
    return result;
  }

  function matrixStyle(result,freeze=2){
    result.xml=result.xml.replace('xSplit="2"',`xSplit="${freeze}"`).replaceAll('C6',`${col(freeze+1)}6`).replace(/(<row r="5"[^>]*>)([\s\S]*?)(<\/row>)/,(_,open,cells,close)=>open+cells.replaceAll('s="3"','s="9"')+close).replace(/<conditionalFormatting[\s\S]*?<\/conditionalFormatting>/,'');
    return result;
  }
  function create(reports,today){
    if(!reports.length)throw new Error('Selecciona al menos un interno.');
    const schedules=[],attendance=[],summary=[];
    const codes={presentes:['P',11],tardanzas:['T',10],justificados:['J',14],faltas:['F',12],incompletas:['INC',16],en_curso:['EC',13],pendientes:['PD',13],no_gestiona:['NG',0],no_laborables:['—',0],sin_datos:['REV',13]};
    for(const report of reports){
      const p=report.person,area=p.area||'Sin área',days=report.attendance.days||[],counts=Object.fromEntries(Object.keys(codes).map(key=>[key,0]));
      const week=ADMIN_DAYS.map(([,dow])=>{
        const day=p.horario_semanal?.[String(dow)]||{},mode=adminMode(p,dow),off=mode==='no_gestiona',start=day.ini||p.hora_inicio,end=day.fin||p.hora_fin;
        const parts=[(ADMIN_MODES[mode]?.[0]||mode).toUpperCase()];
        if(!off){parts.push(start&&end?`${String(start).slice(0,5)} – ${String(end).slice(0,5)}${end<=start?' (+1 día)':''}`:'Horario sin completar');if(p.tipo_vinculo==='ambos')parts.push(ADMIN_LINKS[day.vinc||'practicas']||'Prácticas');}
        return value(parts.join('\n'),({virtual:10,presencial:11,no_gestiona:12,opcional:13})[mode]||0);
      });
      const areaStyle=14+[...area].reduce((total,char)=>total+char.charCodeAt(0),0)%4;
      schedules.push([value(String(p.id),9),p.nombre,value(area,areaStyle),time(p.hora_inicio),time(p.hora_fin),...week]);
      const months=new Map();let hours=0;
      for(const day of days){
        const month=day.fecha.slice(0,7);if(!months.has(month))months.set(month,{days:new Map(),hours:0});
        const key=profileAttendanceState(day,report.attendance.end,p)[0],state=codes[key]||codes.sin_datos;
        counts[key]=(counts[key]||0)+1;months.get(month).days.set(Number(day.fecha.slice(8)),value(state[0],state[1]));
        if(['presentes','tardanzas','justificados'].includes(key)){const h=Number(day.horas||0);hours+=h;months.get(month).hours+=h;}
      }
      const refs=[];
      for(const [month,data] of [...months.entries()].sort(([a],[b])=>a.localeCompare(b))){
        const row=attendance.length+6;refs.push(row);
        const [year,m]=month.split('-').map(Number),monthLabel=new Date(Date.UTC(year,m-1,1)).toLocaleDateString('es-PE',{month:'long',year:'numeric',timeZone:'UTC'});
        attendance.push([p.nombre,value(area,areaStyle),monthLabel,...Array.from({length:31},(_,i)=>data.days.get(i+1)||value('',0)),value(data.hours,8)]);
      }
      const available=!!report.attendance.ok&&!report.attendance.missingStart&&!report.attendance.missing?.length;
      const countCell=(keys)=>{
        const total=keys.reduce((sum,key)=>sum+counts[key],0);
        const formulas=refs.flatMap(row=>keys.map(key=>`COUNTIF('Asistencia'!D${row}:AH${row},"${codes[key][0]}")`));
        return available?value(total,4,formulas.length?formulas.join('+'):undefined):'—';
      };
      const fb=report.extra?.activity,fbRows=fb?.filas?.filter(row=>String(row.id)===String(p.id));
      const fbText=fbRows?.length?`${fbRows.filter(row=>row.estado==='con_evidencia').length} sí / ${fbRows.filter(row=>row.estado==='sin_evidencia').length} no`:'Sin datos';
      const notes=[];
      if(report.attendance.missingStart)notes.push('Falta fecha de ingreso');
      if(report.attendance.futureStart)notes.push('Ingreso futuro');
      if(!report.attendance.ok)notes.push('Asistencia no disponible');
      if(report.attendance.missing?.length)notes.push(`Meses no disponibles: ${report.attendance.missing.join(', ')}`);
      if(counts.sin_datos)notes.push(`${counts.sin_datos} días por revisar`);
      if(!p.activo)notes.push('Dado de baja: revisar días sin registro');
      if(counts.incompletas)notes.push(`${counts.incompletas} jornadas incompletas`);
      if(counts.en_curso+counts.pendientes)notes.push(`${counts.en_curso+counts.pendientes} pendientes`);
      summary.push([p.nombre,String(p.dni||''),p.institucion||'',value(area,areaStyle),date(p.contrato_inicio),countCell(['presentes']),countCell(['tardanzas']),countCell(['justificados']),countCell(['faltas']),notes.join(' · ')||'—']);
    }
    const summarySheet=matrixStyle(sheet('Resumen',['Colaborador','DNI','Institución','Área','Ingreso','Presentes','Tardanzas','Justificados','Faltas','Observaciones'],[34,14,30,25,15,13,13,14,12,38],summary,''));
    // Formato compacto de la referencia: título, espacio y encabezado en fila 3.
    summarySheet.xml=summarySheet.xml.replace(/<row r="[23]"[\s\S]*?<\/row>/g,'').replace(/(<row r="1"[^>]*>)([\s\S]*?)(<\/row>)/,(_,a,b,c)=>a+b.replaceAll('s="1"','s="18"')+c).replace(/<row r="(\d+)"/g,(text,n)=>`<row r="${Number(n)>=5?Number(n)-2:n}"`).replace(/<c r="([A-Z]+)(\d+)"/g,(text,column,n)=>`<c r="${column}${Number(n)>=5?Number(n)-2:n}"`).replace(/<mergeCells[\s\S]*?<\/mergeCells>/,'<mergeCells count="1"><mergeCell ref="A1:J1"/></mergeCells>').replace(/<dimension ref="[^"]+"\/>/,`<dimension ref="A1:J${summary.length+3}"/>`).replace(/<autoFilter ref="[^"]+"\/>/,`<autoFilter ref="A3:J${summary.length+3}"/>`).replace('ySplit="5"','ySplit="3"').replaceAll('C6','C4');
    summarySheet.last=`J${summary.length+3}`;summarySheet.repeat=3;
    const attendanceSheet=matrixStyle(sheet('Asistencia',['Colaborador','Área','Mes',...Array.from({length:31},(_,i)=>String(i+1)),'Horas válidas'],[34,24,22,...Array(31).fill(6),16],attendance,'P: presente · T: tardanza · J: justificado · F: falta · INC: incompleta · EC: en curso · PD: pendiente · NG: no gestiona · REV: revisar · —: no laborable. Vacío: fuera del período o día inexistente.'),3);
    // Una fila por colaborador y mes; espacio suficiente para leer los códigos de tres letras.
    attendanceSheet.xml=attendanceSheet.xml.replace('showGridLines="0"','showGridLines="0" zoomScale="80"');
    return {styles,sheets:[summarySheet,scheduleSheet(schedules,today),attendanceSheet]};
  }
  root.KJAInternExcel={create,build:(reports,today)=>{const book=create(reports,today);return root.KJAFacebookExcel.buildWorkbook(book.sheets,book.styles);}};
})(globalThis);
