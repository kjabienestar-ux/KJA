/* Exportación OOXML local: texto tipado, estilos y ZIP sin dependencias de red. */
(function(root){
  'use strict';
  const enc=new TextEncoder();
  const xml=v=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
  function zip(files){
    const parts=[],central=[];let offset=0;
    const crc=bytes=>{let c=0xffffffff;for(const byte of bytes){c^=byte;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
    const header=(size,entries)=>{const b=new Uint8Array(size),v=new DataView(b.buffer);for(const [at,value,width] of entries)width===2?v.setUint16(at,value,true):v.setUint32(at,value,true);return b;};
    for(const [path,content] of files){const name=enc.encode(path),bytes=enc.encode(content),sum=crc(bytes);
      const h=header(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[12,33,2],[14,sum,4],[18,bytes.length,4],[22,bytes.length,4],[26,name.length,2]]);
      parts.push(h,name,bytes);
      central.push(header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[14,33,2],[16,sum,4],[20,bytes.length,4],[24,bytes.length,4],[28,name.length,2],[42,offset,4]]),name);
      offset+=h.length+name.length+bytes.length;
    }
    const centralLength=central.reduce((n,b)=>n+b.length,0);
    parts.push(...central,header(22,[[0,0x06054b50,4],[8,files.length,2],[10,files.length,2],[12,centralLength,4],[16,offset,4]]));
    const out=new Uint8Array(parts.reduce((n,b)=>n+b.length,0));let i=0;for(const b of parts){out.set(b,i);i+=b.length;}return out;
  }
  function build(groups,meta){
    if(!groups.length)throw new Error('No hay áreas para exportar.');
    const {sheets,styles}=root.KJAFacebookExcelLayout.create(groups,meta);
    return buildWorkbook(sheets,styles);
  }
  function buildWorkbook(sheets,styles){
    if(!sheets.length)throw new Error('No hay hojas para exportar.');
    const names=sheets.map(s=>s.name);
    const files=[['[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
      ['_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml',`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${names.map((name,i)=>`<sheet name="${xml(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><definedNames>${sheets.map((s,i)=>`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${xml("'"+s.name+"'!$1:$"+s.repeat)}</definedName><definedName name="_xlnm.Print_Area" localSheetId="${i}">${xml("'"+s.name+"'!$A$1:"+s.last.replace(/([A-Z]+)(\d+)/,'$$$1$$$2'))}</definedName>`).join('')}</definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
      ['xl/_rels/workbook.xml.rels',`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],['xl/styles.xml',styles],...sheets.map((s,i)=>[`xl/worksheets/sheet${i+1}.xml`,s.xml])];
    return zip(files);
  }
  root.KJAFacebookExcel={build,buildWorkbook};
})(globalThis);
