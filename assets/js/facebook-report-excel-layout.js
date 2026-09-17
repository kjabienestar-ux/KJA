/* Diseño del libro: resumen ejecutivo y matriz consolidada, sin hojas por área. */
(function(root){
  'use strict';
  const x=v=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
  const col=n=>{let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
  const cell=(r,v,s=0,f)=>`<c r="${r}" s="${s}"${typeof v==='number'?'':' t="inlineStr"'}>${f?`<f>${x(f)}</f>`:''}${typeof v==='number'?`<v>${v}</v>`:`<is><t xml:space="preserve">${x(v)}</t></is>`}</c>`;
  const palette=['FFFFFF','09244C','F0F4F9','E4F3EB','FCEBEC','EF0B72'];
  const font=(size,color,bold=false)=>`<font>${bold?'<b/>':''}<sz val="${size}"/><color rgb="FF${color}"/><name val="Calibri"/></font>`;
  // id: body, title, muted, header, date, value, zebra, total, area, KPI, KPI label, percent.
  const specs=[[0,0,0,'left'],[1,1,0,'left'],[2,0,0,'left'],[3,1,0,'left'],[3,1,164,'center'],[0,0,0,'center'],[0,2,0,'center'],[4,2,1,'center'],[4,2,0,'left'],[5,3,1,'left'],[4,3,0,'left'],[4,0,9,'center']];
  const styles=`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="[$-es-PE]ddd, dd mmm"/></numFmts><fonts count="6">${font(11,'15243A')}${font(26,'FFFFFF',true)}${font(10,'526177')}${font(11,'FFFFFF',true)}${font(11,'09244C',true)}${font(30,'126451',true)}</fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${palette.map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="2" borderId="0"/></cellStyleXfs><cellXfs count="12">${specs.map(([font,fill,num,align])=>`<xf numFmtId="${num}" fontId="${font}" fillId="${fill+2}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="${align}" vertical="center" wrapText="1" indent="${align==='left'?1:0}"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="3"><dxf><font><b/><color rgb="FF126451"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFE4F3EB"/><bgColor rgb="FFE4F3EB"/></patternFill></fill></dxf><dxf><font><b/><color rgb="FFA0273B"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFFCEBEC"/><bgColor rgb="FFFCEBEC"/></patternFill></fill></dxf><dxf><font><color rgb="FF526177"/></font></dxf></dxfs></styleSheet>`;
  function page(widths){
    const rows=new Map(),merges=[],rules=[];
    function put(n,cells,height=28){rows.set(n,{cells,height});}
    function band(n,start,end,value,style,height=28){put(n,Array.from({length:end-start+1},(_,i)=>cell(col(start+i)+n,i?'':value,style)).join(''),height);if(end>start)merges.push(`${col(start)}${n}:${col(end)}${n}`);}
    function output(lastRow,{freeze=0,filter='',tab='075ABC',landscape=false}={}){
      // Color the visible unused canvas white as well, so gridlines stay absent even if toggled by Excel.
      for(let n=1;n<=Math.max(38,lastRow+3);n++)if(!rows.has(n))put(n,widths.map((_,i)=>cell(col(i+1)+n,'')).join(''),n===1?12:16);
      const last=col(widths.length);
      return `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><tabColor rgb="FF${tab}"/><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${last}${Math.max(38,lastRow+3)}"/><sheetViews><sheetView showGridLines="0" showRowColHeaders="0" zoomScale="90" workbookViewId="0">${freeze?`<pane ySplit="${freeze}" topLeftCell="A${freeze+1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="B${freeze+1}" sqref="B${freeze+1}"/>`:'<selection activeCell="A1" sqref="A1"/>'}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="28"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${[...rows].sort(([a],[b])=>a-b).map(([n,r])=>`<row r="${n}" ht="${r.height}" customHeight="1">${r.cells}</row>`).join('')}</sheetData>${filter?`<autoFilter ref="${filter}"/>`:''}<mergeCells count="${merges.length}">${merges.map(r=>`<mergeCell ref="${r}"/>`).join('')}</mergeCells>${rules.join('')}<printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.15" footer="0.15"/><pageSetup paperSize="9" orientation="${landscape?'landscape':'portrait'}" fitToWidth="${widths.length>10?0:1}" fitToHeight="0"/><headerFooter><oddFooter>&amp;LKJA · Facebook&amp;RPágina &amp;P de &amp;N</oddFooter></headerFooter></worksheet>`;
    }
    return {put,band,rules,output};
  }
  function create(groups,meta){
    const date=d=>d.split('-').reverse().join('/'),period=`${date(meta.desde)} — ${date(meta.hasta)}`;
    const updated=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'short',timeStyle:'short'}).format(new Date(meta.generado_at));
    const dates=groups[0].dates,last=col(dates.length+2),detail=page([3,43,...dates.map(()=>24),3]);
    detail.band(2,2,dates.length+2,'Facebook / detalle por áreas',1,52);
    detail.band(3,2,dates.length+2,period,3,27);
    detail.band(4,2,dates.length+2,'Sí: con evidencia    ·    No: sin evidencia    ·    No comparte ese día: sin tarea asignada',2,32);
    detail.band(5,2,dates.length+2,`${meta.provisional?'PROVISIONAL · ':''}Actualizado ${updated} (Lima)`,2,24);
    let r=7;const refs=[];
    for(const group of groups){
      detail.band(r++,2,dates.length+2,`${group.area}   /   ${group.persons.length} ${group.persons.length===1?'persona':'personas'}`,8,34);
      detail.put(r,cell(`B${r}`,'Colaborador',3)+dates.map((d,i)=>cell(`${col(i+3)}${r}`,Math.round((Date.parse(d+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000),4)).join(''),32);r++;
      const start=r;
      group.persons.forEach((p,i)=>{detail.put(r,cell(`B${r}`,p.nombre,i%2?8:0)+p.cells.map((c,j)=>cell(`${col(j+3)}${r}`,c.value,i%2?6:5)).join(''),32);r++;});
      const end=r-1,yes=r,no=r+1,total=r+2;
      ['Sí','No','Evaluados'].forEach((label,i)=>{detail.put(r,cell(`B${r}`,label,8)+group.totals.map((t,j)=>{const c=col(j+3);return cell(`${c}${r}`,i===0?t.yes:i===1?t.no:t.yes+t.no,7,i<2?`COUNTIF(${c}${start}:${c}${end},"${label}")`:`SUM(${c}${yes}:${c}${no})`);}).join(''),24);r++;});
      detail.rules.push(`<conditionalFormatting sqref="C${start}:${last}${end}"><cfRule type="cellIs" dxfId="0" priority="${refs.length*3+1}" operator="equal"><formula>"Sí"</formula></cfRule><cfRule type="cellIs" dxfId="1" priority="${refs.length*3+2}" operator="equal"><formula>"No"</formula></cfRule><cfRule type="expression" dxfId="2" priority="${refs.length*3+3}"><formula>AND(C${start}&lt;&gt;"Sí",C${start}&lt;&gt;"No")</formula></cfRule></conditionalFormatting>`);
      refs.push({group,yes,no,total,yesCount:group.totals.reduce((n,t)=>n+t.yes,0),noCount:group.totals.reduce((n,t)=>n+t.no,0)});r++;
    }
    const summary=page([3,38,16,16,16,18,18,3]);
    summary.band(2,2,7,'Facebook / reporte de equipo',1,54);
    summary.band(3,2,7,`KJA     ·     ${period}`,3,28);
    summary.band(4,2,7,`${meta.provisional?'PROVISIONAL · ':''}Actualizado ${updated} (Lima)`,2,27);
    const top=11,bottom=top+groups.length-1,total=bottom+1;
    const sumYes=refs.reduce((n,g)=>n+g.yesCount,0),sumNo=refs.reduce((n,g)=>n+g.noCount,0),people=groups.reduce((n,g)=>n+g.persons.length,0);
    // Three restrained KPI blocks; counts represent persona/día, except people.
    for(const [a,b,label] of [[2,3,'PERSONAS'],[4,5,'CON EVIDENCIA · PERSONA/DÍA'],[6,7,'SIN EVIDENCIA · PERSONA/DÍA']]){
      // Multiple blocks share rows, so accumulate before committing.
      summary.band(6,a,b,label,10,32);
    }
    // Replace shared rows with all three blocks; merges above remain valid.
    summary.put(6,cell('B6','PERSONAS',10)+cell('C6','',10)+cell('D6','CON EVIDENCIA · PERSONA/DÍA',10)+cell('E6','',10)+cell('F6','SIN EVIDENCIA · PERSONA/DÍA',10)+cell('G6','',10),34);
    summary.band(7,2,3,'',9,48);summary.band(7,4,5,'',9,48);summary.band(7,6,7,'',9,48);
    summary.put(7,cell('B7',people,9,`SUM(C${top}:C${bottom})`)+cell('C7','',9)+cell('D7',sumYes,9,`SUM(D${top}:D${bottom})`)+cell('E7','',9)+cell('F7',sumNo,9,`SUM(E${top}:E${bottom})`)+cell('G7','',9),48);
    summary.band(9,2,7,'Participación por área',8,30);
    summary.put(10,['Área','Personas','Sí','No','No evaluados','Registro'].map((v,i)=>cell(`${col(i+2)}10`,v,3)).join(''),32);
    refs.forEach((item,i)=>{const n=top+i,g=item.group,y=item.yesCount,no=item.noCount,ex=g.persons.length*dates.length-y-no;
      summary.put(n,cell(`B${n}`,g.area,i%2?8:0)+cell(`C${n}`,g.persons.length,5)+cell(`D${n}`,y,5,`SUM('Detalle'!C${item.yes}:${last}${item.yes})`)+cell(`E${n}`,no,5,`SUM('Detalle'!C${item.no}:${last}${item.no})`)+cell(`F${n}`,ex,5,`C${n}*${dates.length}-D${n}-E${n}`)+cell(`G${n}`,y+no?y/(y+no):0,11,`IFERROR(D${n}/SUM(D${n}:E${n}),0)`),32);
    });
    summary.put(total,cell(`B${total}`,'TOTAL',8)+['C','D','E','F'].map((c,i)=>cell(`${c}${total}`,[people,sumYes,sumNo,people*dates.length-sumYes-sumNo][i],7,`SUM(${c}${top}:${c}${bottom})`)).join('')+cell(`G${total}`,sumYes+sumNo?sumYes/(sumYes+sumNo):0,11,`IFERROR(D${total}/SUM(D${total}:E${total}),0)`),32);
    summary.band(total+2,2,7,'Cómo leer este reporte',8,28);
    summary.band(total+3,2,7,'Sí = evidencia registrada. No = sin evidencia al consultar. No comparte ese día = sin tarea asignada.',2,34);
    summary.band(total+4,2,7,'Registro = Sí / (Sí + No). No evaluados incluye días sin tarea, anteriores al ingreso o sin información. Los conteos Sí/No suman personas por día.',2,36);
    summary.band(total+5,2,7,meta.provisional?'El período sigue abierto: los No pueden cambiar. Consulta la pestaña Detalle para ver cada persona y fecha.':'Consulta Detalle para ver cada persona y fecha. Se usa el equipo activo y sus horarios actuales.',2,32);
    summary.rules.push(`<conditionalFormatting sqref="G${top}:G${bottom}"><cfRule type="dataBar" priority="1"><dataBar><cfvo type="num" val="0"/><cfvo type="num" val="1"/><color rgb="FF24A68A"/></dataBar></cfRule></conditionalFormatting>`);
    return {styles,sheets:[{name:'Resumen',xml:summary.output(total+5,{tab:'EF0B72',filter:`B10:G${bottom}`}),last:`H${total+5}`,repeat:10},{name:'Detalle',xml:detail.output(r-1,{freeze:5,landscape:true}),last:`${col(dates.length+3)}${r-1}`,repeat:5}]};
  }
  root.KJAFacebookExcelLayout={create};
})(globalThis);
