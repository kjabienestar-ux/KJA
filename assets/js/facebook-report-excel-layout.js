/* Diseño del libro: estética ejecutiva profesional (estilo Transmedina),
   con tarjetas KPI de resumen, cabecera oscura (#1A1A1A), cuadrícula visible,
   bordes delgados y hojas dedicadas: "Por Área", "Por Persona" y "Matriz Diaria". */
(function(root){
  'use strict';
  const x=v=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
  const col=n=>{let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
  const cell=(r,v,s=0,f)=>{
    const isNum=typeof v==='number'&&Number.isFinite(v);
    return `<c r="${r}" s="${s}"${isNum?'':' t="inlineStr"'}>${f?`<f>${x(f)}</f>`:''}${isNum?`<v>${v}</v>`:`<is><t xml:space="preserve">${x(v)}</t></is>`}</c>`;
  };

  const fontXml=(size,color,bold=false,italic=false)=>`<font>${bold?'<b/>':''}${italic?'<i/>':''}<sz val="${size}"/><color rgb="FF${color}"/><name val="Calibri"/></font>`;
  const fillXml=color=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`;

  // 15 Fuentes
  const fonts=[
    fontXml(10,'1F2937'),              // 0: Regular
    fontXml(13,'111827',true),         // 1: Título bold
    fontXml(9,'6B7280',false,true),    // 2: Subtítulo/filtro italic
    fontXml(10,'FFFFFF',true),         // 3: Encabezado tabla blanco
    fontXml(9,'475569',true),          // 4: KPI etiqueta
    fontXml(14,'111827',true),         // 5: KPI valor oscuro
    fontXml(14,'0F5132',true),         // 6: KPI valor verde
    fontXml(14,'842029',true),         // 7: KPI valor rojo
    fontXml(14,'084298',true),         // 8: KPI valor azul
    fontXml(10,'0F5132',true),         // 9: Verde bold
    fontXml(10,'842029',true),         // 10: Rojo bold
    fontXml(10,'111827',true),         // 11: Oscuro bold
    fontXml(10,'FFFFFF',true),         // 12: Resumen pie blanco bold
    fontXml(9,'6B7280'),               // 13: Texto atenuado
    fontXml(9,'6B7280')                // 14: Fecha exportación
  ];

  // 10 Rellenos
  const fills=[
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    fillXml('1A1A1A'), // 2: Cabecera oscura
    fillXml('F8F9FA'), // 3: Zebra gris claro
    fillXml('E6F4EA'), // 4: Verde suave
    fillXml('FCE8E6'), // 5: Rojo suave
    fillXml('E8F0FE'), // 6: Azul suave
    fillXml('FFFFFF'), // 7: Blanco
    fillXml('F1F5F9'), // 8: KPI encabezado
    fillXml('FEF3C7')  // 9: Ámbar suave
  ];

  // 5 Bordes
  const borders=[
    '<border><left/><right/><top/><bottom/><diagonal/></border>',
    '<border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border>',
    '<border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border>',
    '<border><left style="thin"><color rgb="FF374151"/></left><right style="thin"><color rgb="FF374151"/></right><top style="thin"><color rgb="FF374151"/></top><bottom style="thin"><color rgb="FF374151"/></bottom><diagonal/></border>',
    '<border><left style="thin"><color rgb="FF374151"/></left><right style="thin"><color rgb="FF374151"/></right><top style="thin"><color rgb="FF1A1A1A"/></top><bottom style="double"><color rgb="FF1A1A1A"/></bottom><diagonal/></border>'
  ];

  // Especificación de 38 estilos de celda (xf)
  // [font, fill, border, numFmt, align, indent]
  const specs=[
    [0,0,0,0,'left',0],      // 0: Normal
    [1,0,0,0,'left',0],      // 1: Título
    [2,0,0,0,'left',0],      // 2: Subtítulo
    [14,0,0,0,'right',0],    // 3: Timestamp
    [3,2,3,0,'left',1],      // 4: Header Left
    [3,2,3,0,'center',0],    // 5: Header Center
    [3,2,3,0,'right',1],     // 6: Header Right
    [0,0,1,0,'left',1],      // 7: Body Left
    [0,0,1,0,'center',0],    // 8: Body Center
    [0,0,1,1,'right',1],     // 9: Body Num Right
    [11,0,1,0,'left',1],     // 10: Body Bold Left
    [11,0,1,0,'center',0],   // 11: Body Bold Center
    [0,3,1,0,'left',1],      // 12: Zebra Left
    [0,3,1,0,'center',0],    // 13: Zebra Center
    [0,3,1,1,'right',1],     // 14: Zebra Num Right
    [11,3,1,0,'left',1],     // 15: Zebra Bold Left
    [11,3,1,0,'center',0],   // 16: Zebra Bold Center
    [9,4,1,0,'center',0],    // 17: Sí (Verde)
    [10,5,1,0,'center',0],   // 18: No (Rojo)
    [13,0,1,0,'center',0],   // 19: Atenuado
    [13,3,1,0,'center',0],   // 20: Zebra Atenuado
    [0,0,1,164,'center',0],  // 21: Body %
    [0,3,1,164,'center',0],  // 22: Zebra %
    [11,0,1,164,'center',0], // 23: Body Bold %
    [11,3,1,164,'center',0], // 24: Zebra Bold %
    [3,2,3,165,'center',0],  // 25: Header Fecha
    [0,0,1,166,'center',0],  // 26: Body Fecha
    [4,8,2,0,'center',0],    // 27: KPI Etiqueta
    [5,7,2,0,'center',0],    // 28: KPI Valor Normal
    [6,4,2,0,'center',0],    // 29: KPI Valor Verde
    [7,5,2,0,'center',0],    // 30: KPI Valor Rojo
    [8,6,2,164,'center',0],  // 31: KPI Valor Azul (%)
    [12,2,4,0,'left',1],     // 32: Resumen Pie Left
    [12,2,4,1,'center',0],   // 33: Resumen Pie Num Center
    [12,2,4,164,'center',0], // 34: Resumen Pie %
    [9,4,1,0,'center',0],    // 35: Estado Excelente
    [0,9,1,0,'center',0],    // 36: Estado Regular
    [10,5,1,0,'center',0]    // 37: Estado Bajo
  ];

  const styles=`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="0.0%"/><numFmt numFmtId="165" formatCode="[$-es-PE]ddd, dd mmm"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy"/></numFmts><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${specs.length}">${specs.map(([f,b,br,n,al,ind])=>`<xf numFmtId="${n}" fontId="${f}" fillId="${b}" borderId="${br}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="${al}" vertical="center" wrapText="1"${ind?` indent="${ind}"`:''}/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="3"><dxf><font><b/><color rgb="FF0F5132"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFE6F4EA"/><bgColor rgb="FFE6F4EA"/></patternFill></fill></dxf><dxf><font><b/><color rgb="FF842029"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFFCE8E6"/><bgColor rgb="FFFCE8E6"/></patternFill></fill></dxf><dxf><font><color rgb="FF6B7280"/></font></dxf></dxfs></styleSheet>`;

  function page(widths){
    const rows=new Map(),merges=[],rules=[];
    function put(n,cells,height=24){rows.set(n,{cells,height});}
    function band(n,start,end,value,style,height=24){
      put(n,Array.from({length:end-start+1},(_,i)=>cell(col(start+i)+n,i?'':value,style)).join(''),height);
      if(end>start)merges.push(`${col(start)}${n}:${col(end)}${n}`);
    }
    function output(lastRow,{freeze=0,freezeCol=0,filter='',tab='1A1A1A',landscape=false}={}){
      const last=col(widths.length);
      const freezeXml = freeze || freezeCol 
        ? `<pane ${freezeCol?`xSplit="${freezeCol}" `:''}${freeze?`ySplit="${freeze}" `:''}topLeftCell="${col(freezeCol+1)}${freeze+1}" activePane="${freezeCol&&freeze?'bottomRight':freezeCol?'topRight':'bottomLeft'}" state="frozen"/><selection pane="${freezeCol&&freeze?'bottomRight':freezeCol?'topRight':'bottomLeft'}" activeCell="${col(freezeCol+1)}${freeze+1}" sqref="${col(freezeCol+1)}${freeze+1}"/>`
        : '<selection activeCell="A1" sqref="A1"/>';
      return `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><tabColor rgb="FF${tab}"/><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${last}${lastRow}"/><sheetViews><sheetView showGridLines="1" showRowColHeaders="1" zoomScale="100" workbookViewId="0">${freezeXml}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${[...rows].sort(([a],[b])=>a-b).map(([n,r])=>`<row r="${n}" ht="${r.height}" customHeight="1">${r.cells}</row>`).join('')}</sheetData>${filter?`<autoFilter ref="${filter}"/>`:''}<mergeCells count="${merges.length}">${merges.map(r=>`<mergeCell ref="${r}"/>`).join('')}</mergeCells>${rules.join('')}<printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.15" footer="0.15"/><pageSetup paperSize="9" orientation="${landscape?'landscape':'portrait'}" fitToWidth="${widths.length>10?0:1}" fitToHeight="0"/><headerFooter><oddFooter>&amp;LKJA · Facebook&amp;RPágina &amp;P de &amp;N</oddFooter></headerFooter></worksheet>`;
    }
    return {put,band,rules,merges,output};
  }

  function create(groups,meta){
    const date=d=>d.split('-').reverse().join('/'),period=`Desde: ${date(meta.desde)}   Hasta: ${date(meta.hasta)}`;
    const updated=meta.generado_at ? new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'short',timeStyle:'short'}).format(new Date(meta.generado_at)) : '';
    const dates=groups[0]?.dates||[];

    // Métricas ejecutivas consolidadas
    const totalPersons=groups.reduce((n,g)=>n+g.persons.length,0);
    const totalYes=groups.reduce((n,g)=>n+g.totals.reduce((s,t)=>s+t.yes,0),0);
    const totalNo=groups.reduce((n,g)=>n+g.totals.reduce((s,t)=>s+t.no,0),0);
    const totalEvaluated=totalYes+totalNo;
    const totalNotApplicable=totalPersons*dates.length-totalEvaluated;
    const totalPercent=totalEvaluated>0?(totalYes/totalEvaluated):0;
    const totalAreas=groups.length;

    // Lista unificada de todos los colaboradores ordenados por área y nombre
    const allPersons=[];
    groups.forEach(group=>{
      group.persons.forEach(person=>{
        const yes=person.cells.filter(c=>c.value==='Sí').length;
        const no=person.cells.filter(c=>c.value==='No').length;
        const evaluated=yes+no;
        const notApplicable=person.cells.length-evaluated;
        const percent=evaluated>0?(yes/evaluated):0;
        const status=evaluated===0?'Sin evaluar':(percent>=0.8?'Excelente':(percent>=0.5?'Regular':'Bajo'));
        allPersons.push({
          id:person.id,
          nombre:person.nombre,
          area:group.area,
          cells:person.cells,
          yes,
          no,
          notApplicable,
          evaluated,
          percent,
          status
        });
      });
    });
    allPersons.sort((a,b)=>a.area.localeCompare(b.area,'es')||a.nombre.localeCompare(b.nombre,'es'));

    // ==========================================
    // HOJA 1: "Por Área" (Resumen ejecutivo por área)
    // ==========================================
    const areaSheet=page([28,16,20,18,18,18,16]);
    // Fila 1: Título y timestamp
    areaSheet.put(1,cell('A1','KJA BIENESTAR • CONTROL DE PUBLICACIONES FACEBOOK',1)+cell('G1',`Exportado: ${updated}`,3),32);
    // Fila 2: Filtros aplicados
    areaSheet.put(2,cell('A2',`Filtros aplicados: ${period} | Áreas evaluadas: ${totalAreas}${meta.provisional?' | PROVISIONAL':''}`,2),20);

    // Fila 4 y 5: Tarjetas KPI ejecutivas (Exacto Imagen 1)
    // COLABORADORES | TOTAL EVALUACIONES | CON EVIDENCIA (SÍ) | SIN EVIDENCIA (NO) | NO APLICA / OTROS | ÁREAS EVALUADAS | ESTADO GENERAL
    areaSheet.put(4,
      cell('A4','COLABORADORES',27)+
      cell('B4','TOTAL EVALUACIONES',27)+
      cell('C4','CON EVIDENCIA (SÍ)',27)+
      cell('D4','SIN EVIDENCIA (NO)',27)+
      cell('E4','NO APLICA / OTROS',27)+
      cell('F4','ÁREAS EVALUADAS',27)+
      cell('G4','ESTADO GENERAL',27),
      20
    );
    areaSheet.put(5,
      cell('A5',totalPersons,28)+
      cell('B5',totalEvaluated,28)+
      cell('C5',totalYes,29)+
      cell('D5',totalNo,30)+
      cell('E5',totalNotApplicable,28)+
      cell('F5',totalAreas,28)+
      cell('G5',totalPercent>=0.8?'Excelente':totalPercent>=0.5?'Regular':'Bajo',totalPercent>=0.8?35:totalPercent>=0.5?36:37),
      30
    );

    // Fila 6: Encabezado de la tabla principal de áreas (Exacto Imagen 1)
    // ÁREA | COLABORADORES | CON EVIDENCIA (SÍ) | NO COMPARTIO | TOTAL EVALUADOS | % CUMPLIMIENTO | EVALUACIÓN
    areaSheet.put(6,
      cell('A6','ÁREA',4)+
      cell('B6','COLABORADORES',5)+
      cell('C6','CON EVIDENCIA (SÍ)',5)+
      cell('D6','NO COMPARTIO',5)+
      cell('E6','TOTAL EVALUADOS',5)+
      cell('F6','% CUMPLIMIENTO',5)+
      cell('G6','EVALUACIÓN',5),
      28
    );

    let rowArea=7;
    groups.forEach((g,i)=>{
      const zebra=i%2===1;
      const yes=g.totals.reduce((s,t)=>s+t.yes,0);
      const no=g.totals.reduce((s,t)=>s+t.no,0);
      const evaluated=yes+no;
      const pct=evaluated>0?(yes/evaluated):0;
      const evalStatus=evaluated===0?'Sin evaluar':(pct>=0.8?'Excelente':(pct>=0.5?'Regular':'Bajo'));
      const statusStyle=evalStatus==='Excelente'?35:(evalStatus==='Regular'?36:(evalStatus==='Bajo'?37:19));

      areaSheet.put(rowArea,
        cell(`A${rowArea}`,g.area,zebra?15:10)+
        cell(`B${rowArea}`,g.persons.length,zebra?13:8)+
        cell(`C${rowArea}`,yes,zebra?13:8)+
        cell(`D${rowArea}`,no,zebra?13:8)+
        cell(`E${rowArea}`,evaluated,zebra?13:8,`C${rowArea}+D${rowArea}`)+
        cell(`F${rowArea}`,pct,zebra?24:23,`IFERROR(C${rowArea}/E${rowArea},0)`)+
        cell(`G${rowArea}`,evalStatus,statusStyle),
        24
      );
      rowArea++;
    });

    // Fila de resumen final oscuro
    const areaTotalRow=rowArea;
    areaSheet.put(areaTotalRow,
      cell(`A${areaTotalRow}`,'RESUMEN FINAL (TOTALES)',32)+
      cell(`B${areaTotalRow}`,totalPersons,33,`SUM(B7:B${areaTotalRow-1})`)+
      cell(`C${areaTotalRow}`,totalYes,33,`SUM(C7:C${areaTotalRow-1})`)+
      cell(`D${areaTotalRow}`,totalNo,33,`SUM(D7:D${areaTotalRow-1})`)+
      cell(`E${areaTotalRow}`,totalEvaluated,33,`SUM(E7:E${areaTotalRow-1})`)+
      cell(`F${areaTotalRow}`,totalPercent,34,`IFERROR(C${areaTotalRow}/E${areaTotalRow},0)`)+
      cell(`G${areaTotalRow}`,'',32),
      28
    );

    // Notas al pie explicativas
    areaSheet.put(areaTotalRow+2,cell(`A${areaTotalRow+2}`,'* Total Evaluados = Días con evidencia (Sí) + Días sin evidencia (No).',2),20);
    areaSheet.put(areaTotalRow+3,cell(`A${areaTotalRow+3}`,'* No Aplica / Otros: colaboradores en días sin tarea asignada, anteriores a su fecha de ingreso o sin horario.',2),20);
    areaSheet.put(areaTotalRow+4,cell(`A${areaTotalRow+4}`,'* Criterios de Evaluación: Excelente (≥ 80%), Regular (50% - 79%), Bajo (< 50%).',2),20);
    if(meta.provisional){
      areaSheet.put(areaTotalRow+5,cell(`A${areaTotalRow+5}`,'* PERÍODO PROVISIONAL: incluye fecha de hoy o franjas abiertas. Los "No" pueden convertirse en "Sí" al enviar evidencia.',2),20);
    }

    // Regla de barras condicionales para % cumplimiento (Columna F)
    areaSheet.rules.push(`<conditionalFormatting sqref="F7:F${areaTotalRow-1}"><cfRule type="dataBar" priority="1"><dataBar><cfvo type="num" val="0"/><cfvo type="num" val="1"/><color rgb="FF0F5132"/></dataBar></cfRule></conditionalFormatting>`);

    // ==========================================
    // HOJA 2: "Por Persona" (Detalle consolidado)
    // ==========================================
    const personSheet=page([6,34,24,18,18,24,18,18,16]);
    // Fila 1: Título y timestamp
    personSheet.put(1,cell('A1','KJA BIENESTAR • REPORTE DE FACEBOOK POR PERSONA',1)+cell('I1',`Exportado: ${updated}`,3),32);
    // Fila 2: Filtros aplicados
    personSheet.put(2,cell('A2',`Filtros aplicados: ${period} | Colaboradores: ${totalPersons}${meta.provisional?' | PROVISIONAL':''}`,2),20);

    // Fila 4 y 5: Tarjetas KPI ejecutivas (Exacto Imagen 2)
    personSheet.put(4,
      cell('A4','COLABORADORES',27)+
      cell('B4','',27)+
      cell('C4','TOTAL EVALUACIONES',27)+
      cell('D4','CON EVIDENCIA (SÍ)',27)+
      cell('E4','SIN EVIDENCIA (NO)',27)+
      cell('F4','% CUMPLIMIENTO',27)+
      cell('G4','NO APLICA / OTROS',27)+
      cell('H4','ÁREAS EVALUADAS',27)+
      cell('I4','',27),
      20
    );
    personSheet.merges.push('A4:B4','H4:I4');
    personSheet.put(5,
      cell('A5',totalPersons,28)+
      cell('B5','',28)+
      cell('C5',totalEvaluated,28)+
      cell('D5',totalYes,29)+
      cell('E5',totalNo,30)+
      cell('F5',totalPercent,31)+
      cell('G5',totalNotApplicable,28)+
      cell('H5',totalAreas,28)+
      cell('I5','',28),
      30
    );
    personSheet.merges.push('A5:B5','H5:I5');

    // Fila 6: Encabezado oscuro (Exacto Imagen 2)
    personSheet.put(6,
      cell('A6','Nº',5)+
      cell('B6','COLABORADOR',4)+
      cell('C6','ÁREA',4)+
      cell('D6','SI COMPARTIO',5)+
      cell('E6','NO COMPARTIO',5)+
      cell('F6','NO APLICA (POR ACUERDO)',5)+
      cell('G6','DIAS EVALUADOS',5)+
      cell('H6','% CUMPLIMIENTO',5)+
      cell('I6','ESTADO',5),
      28
    );

    let rowPerson=7;
    allPersons.forEach((p,i)=>{
      const zebra=i%2===1;
      const statusStyle=p.status==='Excelente'?35:(p.status==='Regular'?36:(p.status==='Bajo'?37:19));

      personSheet.put(rowPerson,
        cell(`A${rowPerson}`,i+1,zebra?13:8)+
        cell(`B${rowPerson}`,p.nombre,zebra?15:10)+
        cell(`C${rowPerson}`,p.area,zebra?12:7)+
        cell(`D${rowPerson}`,p.yes,zebra?13:8)+
        cell(`E${rowPerson}`,p.no,zebra?13:8)+
        cell(`F${rowPerson}`,p.notApplicable,zebra?13:8)+
        cell(`G${rowPerson}`,p.evaluated,zebra?13:8,`D${rowPerson}+E${rowPerson}`)+
        cell(`H${rowPerson}`,p.percent,zebra?24:23,`IFERROR(D${rowPerson}/G${rowPerson},0)`)+
        cell(`I${rowPerson}`,p.status,statusStyle),
        24
      );
      rowPerson++;
    });

    const personTotalRow=rowPerson;
    personSheet.put(personTotalRow,
      cell(`A${personTotalRow}`,'',32)+
      cell(`B${personTotalRow}`,`RESUMEN FINAL (${allPersons.length} COLABORADORES)`,32)+
      cell(`C${personTotalRow}`,'',32)+
      cell(`D${personTotalRow}`,totalYes,33,`SUM(D7:D${personTotalRow-1})`)+
      cell(`E${personTotalRow}`,totalNo,33,`SUM(E7:E${personTotalRow-1})`)+
      cell(`F${personTotalRow}`,totalNotApplicable,33,`SUM(F7:F${personTotalRow-1})`)+
      cell(`G${personTotalRow}`,totalEvaluated,33,`SUM(G7:G${personTotalRow-1})`)+
      cell(`H${personTotalRow}`,totalPercent,34,`IFERROR(D${personTotalRow}/G${personTotalRow},0)`)+
      cell(`I${personTotalRow}`,'',32),
      28
    );

    // ==========================================
    // HOJA 3: "REVISION DIARIA" (Día a día con congelación)
    // ==========================================
    const matrixWidths=[32,22,...dates.map(()=>15),14,14,16];
    const matrixSheet=page(matrixWidths);
    const lastMatrixCol=col(matrixWidths.length);
    const dateStartCol='C';
    const dateEndCol=col(dates.length+2);
    const totalYesCol=col(dates.length+3);
    const totalNoCol=col(dates.length+4);
    const pctCol=col(dates.length+5);

    // Fila 1 y 2
    matrixSheet.put(1,cell('A1','KJA BIENESTAR • MATRIZ DETALLADA DE ASISTENCIA FACEBOOK',1)+cell(`${lastMatrixCol}1`,`Exportado: ${updated}`,3),32);
    matrixSheet.put(2,cell('A2',`Filtros aplicados: ${period} | Sí: Con evidencia · No: Sin evidencia${meta.provisional?' | PROVISIONAL':''}`,2),20);

    // Fila 4 y 5: KPIs (Exacto Imagen 3: COLABORADORES | ÁREAS EVALUADAS | SI COMPARTIERON | NO COMPARTIERON | % CUMPLIMIENTO)
    matrixSheet.put(4,
      cell('A4','COLABORADORES',27)+
      cell('B4','ÁREAS EVALUADAS',27)+
      cell('C4','SI COMPARTIERON',27)+
      cell('D4','NO COMPARTIERON',27)+
      cell('E4','% CUMPLIMIENTO',27),
      20
    );
    matrixSheet.put(5,
      cell('A5',totalPersons,28)+
      cell('B5',totalAreas,28)+
      cell('C5',totalYes,29)+
      cell('D5',totalNo,30)+
      cell('E5',totalPercent,31),
      30
    );

    // Fila 6: Encabezados de fecha
    const prettyHeader=d=>{
      try{
        return new Intl.DateTimeFormat('es-PE',{timeZone:'UTC',weekday:'short',day:'2-digit',month:'short'}).format(new Date(d+'T12:00:00Z'));
      }catch(_){return d;}
    };

    matrixSheet.put(6,
      cell('A6','COLABORADOR',4)+
      cell('B6','ÁREA',4)+
      dates.map((d,idx)=>cell(`${col(idx+3)}6`,prettyHeader(d),5)).join('')+
      cell(`${totalYesCol}6`,'TOTAL SÍ',5)+
      cell(`${totalNoCol}6`,'TOTAL NO',5)+
      cell(`${pctCol}6`,'% CUMP.',5),
      28
    );

    let rowMat=7;
    allPersons.forEach((p,i)=>{
      const zebra=i%2===1;
      const dateCells=p.cells.map((c,idx)=>{
        const cCol=col(idx+3);
        if(c.value==='Sí')return cell(`${cCol}${rowMat}`,'Sí',17);
        if(c.value==='No')return cell(`${cCol}${rowMat}`,'No',18);
        return cell(`${cCol}${rowMat}`,c.value||'—',zebra?20:19);
      }).join('');

      matrixSheet.put(rowMat,
        cell(`A${rowMat}`,p.nombre,zebra?15:10)+
        cell(`B${rowMat}`,p.area,zebra?12:7)+
        dateCells+
        cell(`${totalYesCol}${rowMat}`,p.yes,zebra?13:8,`COUNTIF(${dateStartCol}${rowMat}:${dateEndCol}${rowMat},"Sí")`)+
        cell(`${totalNoCol}${rowMat}`,p.no,zebra?13:8,`COUNTIF(${dateStartCol}${rowMat}:${dateEndCol}${rowMat},"No")`)+
        cell(`${pctCol}${rowMat}`,p.percent,zebra?24:23,`IFERROR(${totalYesCol}${rowMat}/(${totalYesCol}${rowMat}+${totalNoCol}${rowMat}),0)`),
        24
      );
      rowMat++;
    });

    // Filas finales de conteo por día (Exacto Imagen 3: RESUMEN: SI COMPARTIERON / NO COMPARTIERON)
    const matRowYes=rowMat;
    const matRowNo=rowMat+1;
    const matLastPerson=rowMat-1;

    const daySumsYes=dates.map((_,idx)=>{
      const cCol=col(idx+3);
      const yesSum=allPersons.filter(p=>p.cells[idx]?.value==='Sí').length;
      return cell(`${cCol}${matRowYes}`,yesSum,33,`COUNTIF(${cCol}7:${cCol}${matLastPerson},"Sí")`);
    }).join('');

    const daySumsNo=dates.map((_,idx)=>{
      const cCol=col(idx+3);
      const noSum=allPersons.filter(p=>p.cells[idx]?.value==='No').length;
      return cell(`${cCol}${matRowNo}`,noSum,33,`COUNTIF(${cCol}7:${cCol}${matLastPerson},"No")`);
    }).join('');

    matrixSheet.put(matRowYes,
      cell(`A${matRowYes}`,'RESUMEN: SI COMPARTIERON',32)+
      cell(`B${matRowYes}`,'',32)+
      daySumsYes+
      cell(`${totalYesCol}${matRowYes}`,totalYes,33,`SUM(${totalYesCol}7:${totalYesCol}${matLastPerson})`)+
      cell(`${totalNoCol}${matRowYes}`,'',32)+
      cell(`${pctCol}${matRowYes}`,totalPercent,34,`IFERROR(${totalYesCol}${matRowYes}/(${totalYesCol}${matRowYes}+${totalNoCol}${matRowNo}),0)`),
      26
    );

    matrixSheet.put(matRowNo,
      cell(`A${matRowNo}`,'RESUMEN: NO COMPARTIERON',32)+
      cell(`B${matRowNo}`,'',32)+
      daySumsNo+
      cell(`${totalYesCol}${matRowNo}`,'',32)+
      cell(`${totalNoCol}${matRowNo}`,totalNo,33,`SUM(${totalNoCol}7:${totalNoCol}${matLastPerson})`)+
      cell(`${pctCol}${matRowNo}`,'',32),
      26
    );

    // Formato condicional en la matriz para Sí (verde) y No (rojo)
    matrixSheet.rules.push(
      `<conditionalFormatting sqref="${dateStartCol}7:${dateEndCol}${matLastPerson}">`+
      `<cfRule type="cellIs" dxfId="0" priority="1" operator="equal"><formula>"Sí"</formula></cfRule>`+
      `<cfRule type="cellIs" dxfId="1" priority="2" operator="equal"><formula>"No"</formula></cfRule>`+
      `<cfRule type="expression" dxfId="2" priority="3"><formula>AND(${dateStartCol}7&lt;&gt;"Sí",${dateStartCol}7&lt;&gt;"No")</formula></cfRule>`+
      `</conditionalFormatting>`
    );

    return {
      styles,
      sheets:[
        {
          name:'Por Área',
          xml:areaSheet.output(areaTotalRow+5,{freeze:6,filter:`A6:G${areaTotalRow-1}`,tab:'1A1A1A'}),
          last:`G${areaTotalRow+5}`,
          repeat:6
        },
        {
          name:'Por Persona',
          xml:personSheet.output(personTotalRow+2,{freeze:6,freezeCol:2,filter:`A6:I${personTotalRow-1}`,tab:'0F5132'}),
          last:`I${personTotalRow+2}`,
          repeat:6
        },
        {
          name:'REVISION DIARIA',
          xml:matrixSheet.output(matRowNo+2,{freeze:6,freezeCol:2,landscape:true,tab:'084298'}),
          last:`${lastMatrixCol}${matRowNo+2}`,
          repeat:6
        }
      ]
    };
  }

  root.KJAFacebookExcelLayout={create};
})(globalThis);

