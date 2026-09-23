import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const modelSource=fs.readFileSync(new URL('../assets/js/facebook-report-model.js',import.meta.url),'utf8');
const uiSource=fs.readFileSync(new URL('../assets/js/dashboard-facebook-report.js',import.meta.url),'utf8');
const excelSource=fs.readFileSync(new URL('../assets/js/facebook-report-excel.js',import.meta.url),'utf8');
const layoutSource=fs.readFileSync(new URL('../assets/js/facebook-report-excel-layout.js',import.meta.url),'utf8');
const c=vm.createContext({});vm.runInContext(modelSource,c);const m=c.KJAFacebookReport;
const plain=value=>JSON.parse(JSON.stringify(value));
test('Monday and Thursday cover every day without overlap, including month/year boundaries',()=>{
  assert.deepEqual(plain(m.cutoff('2026-09-14','lunes')),{report:'2026-09-14',desde:'2026-09-10',hasta:'2026-09-13'});
  assert.deepEqual(plain(m.cutoff('2026-09-17','jueves')),{report:'2026-09-17',desde:'2026-09-14',hasta:'2026-09-16'});
  assert.deepEqual(plain(m.cutoff('2026-10-01','jueves')),{report:'2026-10-01',desde:'2026-09-28',hasta:'2026-09-30'});
  assert.deepEqual(plain(m.cutoff('2027-01-04','lunes')),{report:'2027-01-04',desde:'2026-12-31',hasta:'2027-01-03'});
  const a=m.cutoff('2026-09-14','lunes'),b=m.cutoff('2026-09-17','jueves');
  assert.equal(new Set([...m.days(a.desde,a.hasta),...m.days(b.desde,b.hasta)]).size,7);
  assert.equal(m.cutoff('2026-09-16','jueves').report,'2026-09-10');
});
test('general report includes today or ends at historical month end; leap years and invalid ranges',()=>{
  assert.deepEqual(plain(m.month('2026-09-16','2026-09-16')),{desde:'2026-09-01',hasta:'2026-09-16'});
  assert.equal(m.month('2024-02-10','2026-09-16').hasta,'2024-02-29');
  assert.throws(()=>m.days('2026-02-30','2026-03-02'));
  assert.throws(()=>m.days('2026-09-02','2026-09-01'));
  assert.throws(()=>m.days('2026-01-01','2026-09-01'));
});
test('counts people/day, not screenshots; observed and pending submissions are still evidence',()=>{
  const states=['con_evidencia','con_evidencia','con_evidencia','sin_evidencia','en_plazo','sin_horario','no_programado','sin_inicio','no_incorporado','sin_historial'];
  const rows=states.map((estado,id)=>({id,fecha:'2026-09-10',estado,revision:['aprobada','pendiente','observada'][id],capturas:50}));
  const [day,empty]=m.summarize(rows,'2026-09-10','2026-09-11');
  assert.equal(day.total,6);assert.equal(day.con,3);assert.equal(day.sin,1);assert.equal(day.plazo,1);assert.equal(day.horario,1);assert.equal(day.excluidos,4);
  assert.equal(day.aprobadas,1);assert.equal(day.pendientes,1);assert.equal(day.observadas,1);assert.equal(empty.total,0);
});
test('CSV protects formulas and preserves quotes, accents and newlines',()=>{
  const out=m.csv([['=1+1','  @SUM(A1)','José "Peña"','a\nb']]);
  assert.ok(out.startsWith('\uFEFF'));assert.ok(out.includes('"\'=1+1"'));assert.ok(out.includes('"\'  @SUM(A1)"'));assert.ok(out.includes('"José ""Peña"""'));assert.ok(out.includes('"a\nb"'));
});
function fixture(rpc){
  class Element{
    constructor(){this.value='';this.children=[];this.dataset={};this.hidden=false;this.disabled=false;this.textContent='';}
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this.children=children;}
    get options(){return this.children;}
    setAttribute(key,value){this[key]=value;}
    addEventListener(type,fn){this['on'+type]=fn;}
    click(){}
    remove(){}
  }

  const downloads=[];
  const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
  const ctx=vm.createContext({document:{getElementById:get,createElement:()=>new Element(),body:{append:link=>downloads.push(link)}},Option:function(text,value){this.text=text;this.value=value;},APP:{access:{rol:'direccion'},adminSection:'facebook'},db:{rpc},isoLima:()=> '2026-09-16',Intl,Date,Set,Blob,TextEncoder,URL:{createObjectURL:blob=>{downloads.push(blob);return 'blob:report';},revokeObjectURL(){}},setTimeout:fn=>fn()});
  ctx.window=ctx;vm.runInContext(modelSource,ctx);vm.runInContext(layoutSource,ctx);vm.runInContext(excelSource,ctx);vm.runInContext(uiSource,ctx);
  return {ctx,get,downloads};
}
const response={desde:'2026-09-10',hasta:'2026-09-13',inicio_sistema:'2026-09-07',habilitado:true,generado_at:'2026-09-16T15:00:00Z',filas:[{id:1,nombre:'Ana',area:'Diseño',fecha:'2026-09-10',estado:'con_evidencia',revision:'pendiente',capturas:3},{id:2,nombre:'Juan',area:'Salud',fecha:'2026-09-10',estado:'sin_evidencia',capturas:0}]};
test('Wednesday defaults to Thursday 17, includes today and groups the result by area',async()=>{
  const calls=[];const {ctx,get}=fixture(async(name,args)=>{calls.push({name,args});return {data:response};});
  await ctx.loadAdminFacebookReport();assert.equal(calls[0].name,'dash_reporte_facebook');assert.equal(calls[0].args.p_desde,'2026-09-14');assert.equal(calls[0].args.p_hasta,'2026-09-16');
  assert.equal(get('fb-report-reference').value,'2026-09-17');assert.equal(get('fb-report-reference').max,'2026-09-17');
  const matrix=get('fb-report-matrix');
  assert.equal(get('fb-report-results').hidden,false);assert.equal(get('fb-report-export').disabled,false);assert.equal(matrix.children.length,2);
  assert.equal(matrix.children[0].open,true);assert.equal(matrix.children[1].open,false);
  get('fb-report-area').value='Diseño';get('fb-report-area').onchange();assert.equal(matrix.children.length,1);
  const summary=matrix.children[0].children[0];
  assert.equal(summary.children[0].textContent,'Diseño');assert.equal(summary.children[1].textContent,' · 1 persona');
});
test('Monday 14 selection lists September 10–13, then Thursday lists September 14–16',()=>{
  const {get}=fixture(async()=>({data:response}));
  get('fb-report-kind').value='lunes';get('fb-report-kind').onchange();
  assert.equal(get('fb-report-reference').value,'2026-09-14');assert.equal(get('fb-report-from').value,'2026-09-10');assert.equal(get('fb-report-to').value,'2026-09-13');
  get('fb-report-kind').value='jueves';get('fb-report-kind').onchange();
  assert.equal(get('fb-report-from').value,'2026-09-14');assert.equal(get('fb-report-to').value,'2026-09-16');
  get('fb-report-reference').value='2026-09-10';get('fb-report-reference').onchange();
  assert.equal(get('fb-report-from').value,'2026-09-07');assert.equal(get('fb-report-to').value,'2026-09-09');
});
test('area matrix has one row per person, three yes/no cells, and totals without counting screenshots',()=>{
  const dates=['2026-09-14','2026-09-15','2026-09-16'],names=['Jaser','Fabricio','Johnny','Anthony'];
  const rows=names.flatMap((nombre,id)=>dates.map((fecha,i)=>({id,nombre,area:'Ingeniería',fecha,estado:i===0?'con_evidencia':i===1?'sin_evidencia':'en_plazo',capturas:50,revision:'observada'})));
  const [group]=m.matrix(rows,dates[0],dates[2]);
  assert.equal(group.persons.length,4);assert.deepEqual(plain(group.dates),dates);
  for(const person of group.persons)assert.deepEqual(plain(person.cells.map(c=>c.value)),['Sí','No','No']);
  assert.deepEqual(plain(group.totals),[{yes:4,no:0},{yes:0,no:4},{yes:0,no:4}]);
  const exported=m.compactRecords([group]);assert.deepEqual(plain(exported[1]),['Colaborador',...dates]);assert.equal(exported.filter(r=>names.includes(r[0])).length,4);
  assert.ok(!m.csv(exported).includes('50'));assert.ok(!m.csv(exported).includes('observada'));
  assert.equal(m.answer('no_programado'),'No comparte ese día');assert.equal(m.answer('sin_historial'),'Sistema aún no activo');assert.equal(m.answer('sin_inicio'),'Falta fecha de ingreso');
  assert.equal(m.answer('no_incorporado'),'Aún no incorporado');assert.equal(m.answer(undefined),'Sin información');
});
test('today results are visibly provisional and future activity dates are rejected',async()=>{
  let calls=0;const {ctx,get}=fixture(async()=>{calls++;return {data:{...response,hasta:'2026-09-16',hoy:'2026-09-16',provisional:true}};});
  await ctx.loadAdminFacebookReport();assert.match(get('fb-report-scope').textContent,/Provisional/);
  get('fb-report-to').value='2026-09-17';await ctx.loadAdminFacebookReport();assert.equal(calls,1);assert.match(get('fb-report-status').textContent,/hasta hoy/);assert.equal(get('fb-report-export').disabled,true);
});
test('old RPC requiring yesterday explains how to enable today',async()=>{
  const {ctx,get}=fixture(async()=>({error:{message:'Selecciona hasta 93 días, como máximo hasta ayer (hora de Lima).'}}));
  await ctx.loadAdminFacebookReport();assert.match(get('fb-report-status').textContent,/migración 65/);assert.equal(get('fb-report-export').disabled,true);
});
test('changing dates invalidates pending results and disables export',async()=>{
  let resolve;const {ctx,get}=fixture(()=>new Promise(r=>resolve=r));const loading=ctx.loadAdminFacebookReport();
  get('fb-report-kind').value='jueves';get('fb-report-kind').onchange();resolve({data:response});await loading;
  assert.equal(get('fb-report-results').hidden,true);assert.equal(get('fb-report-export').disabled,true);
});
test('RPC failures stay distinct from zero evidence and cannot export stale data',async()=>{
  let fail=false;const {ctx,get}=fixture(async()=>fail?{error:{code:'PGRST202'}}:{data:response});
  await ctx.loadAdminFacebookReport();fail=true;await ctx.loadAdminFacebookReport();
  assert.equal(get('fb-report-results').hidden,true);assert.equal(get('fb-report-export').disabled,true);assert.match(get('fb-report-status').textContent,/migración 64/);
});
test('non-direction users never request report data',async()=>{
  let calls=0;const {ctx}=fixture(async()=>{calls++;return {data:response};});ctx.APP.access.rol='lider';await ctx.loadAdminFacebookReport();assert.equal(calls,0);
});

test('PDF download includes every area even when the screen is filtered',async()=>{
  const {ctx,get,downloads}=fixture(async()=>({data:response}));let exported;
  ctx.KJAFacebookPDF={load:async()=>{},build:(groups,meta)=>{exported={groups,meta};return new TextEncoder().encode('%PDF-test');}};
  await ctx.loadAdminFacebookReport();get('fb-report-area').value='Diseño';get('fb-report-area').onchange();
  await get('fb-report-pdf').onclick();
  assert.deepEqual(Array.from(exported.groups,g=>g.area),['Diseño','Salud']);
  assert.equal(exported.meta.desde,response.desde);assert.equal(downloads[0].type,'application/pdf');
  assert.match(downloads[1].download,/facebook_detalle_.*\.pdf$/);assert.equal(get('fb-report-pdf').disabled,false);
});
test('PDF load failure allows retry and a changed period cancels pending export',async()=>{
  const {ctx,get,downloads}=fixture(async()=>({data:response}));
  ctx.KJAFacebookPDF={load:async()=>{throw new Error('network');},build:()=>{throw new Error('must not generate');}};
  await ctx.loadAdminFacebookReport();await get('fb-report-pdf').onclick();
  assert.match(get('fb-report-status').textContent,/No se pudo preparar el PDF/);assert.equal(get('fb-report-pdf').disabled,false);
  let resolve;ctx.KJAFacebookPDF.load=()=>new Promise(r=>resolve=r);
  const pending=get('fb-report-pdf').onclick();assert.equal(get('fb-report-pdf').disabled,true);
  get('fb-report-kind').value='lunes';get('fb-report-kind').onchange();resolve();await pending;
  assert.equal(downloads.length,0);assert.equal(get('fb-report-pdf').disabled,true);
});

function unzipStored(bytes){
  const buffer=Buffer.from(bytes),entries=new Map();let offset=0;
  while(buffer.readUInt32LE(offset)===0x04034b50){
    assert.equal(buffer.readUInt16LE(offset+8),0);
    const length=buffer.readUInt32LE(offset+18),nameLength=buffer.readUInt16LE(offset+26),start=offset+30+nameLength;
    const content=buffer.subarray(start,start+length);let crc=0xffffffff;
    for(const byte of content){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    assert.equal((crc^0xffffffff)>>>0,buffer.readUInt32LE(offset+14));
    entries.set(buffer.subarray(offset+30,start).toString('utf8'),content.toString('utf8'));offset=start+length;
  }
  assert.equal(buffer.readUInt32LE(offset),0x02014b50);assert.equal(buffer.readUInt32LE(buffer.length-22),0x06054b50);
  assert.equal(buffer.readUInt16LE(buffer.length-12),entries.size);assert.equal(buffer.readUInt32LE(buffer.length-6),offset);
  return entries;
}
test('Excel download is a real ZIP workbook, respects area filter and retains explicit reasons',async()=>{
  const {ctx,get,downloads}=fixture(async()=>({data:{...response,filas:[...response.filas,{id:3,nombre:'=SUM(1,2) & <José>',area:'Diseño',fecha:'2026-09-10',estado:'no_programado'}]}}));
  await ctx.loadAdminFacebookReport();get('fb-report-area').value='Diseño';get('fb-report-area').onchange();get('fb-report-export').onclick();
  const [blob,link]=downloads;assert.equal(blob.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');assert.ok(link.download.endsWith('.xlsx'));
  const files=unzipStored(await blob.arrayBuffer()),sheet=files.get('xl/worksheets/sheet2.xml');
  assert.ok(files.has('[Content_Types].xml'));assert.ok(!files.has('xl/worksheets/sheet3.xml'));
  assert.match(files.get('xl/workbook.xml'),/name="Resumen"/);assert.match(sheet,/No comparte ese día/);assert.match(sheet,/Diseño/);assert.ok(!sheet.includes('Salud'));
  assert.match(sheet,/t="inlineStr"><is><t xml:space="preserve">=SUM\(1,2\) &amp; &lt;José&gt;/);
  assert.match(sheet,/COUNTIF\(C9:C10,&quot;Sí&quot;\)/);assert.match(sheet,/state="frozen"/);assert.match(sheet,/<conditionalFormatting/);assert.match(files.get('xl/worksheets/sheet1.xml'),/<autoFilter/);
  assert.ok(!sheet.includes('Capturas'));assert.equal(get('fb-report-export').disabled,false);
});
test('workbook consolidates all areas into two sheets and uses typed date headers beyond Z',()=>{
  const ctx=vm.createContext({TextEncoder,Intl,Date});vm.runInContext(layoutSource,ctx);vm.runInContext(excelSource,ctx);
  const dates=m.days('2026-09-01','2026-09-30');
  const group={area:'Área / con : caracteres inválidos y nombre largo',dates,persons:[{nombre:'Ana',cells:dates.map(()=>({value:'Sí'}))}],totals:dates.map(()=>({yes:1,no:0}))};
  const files=unzipStored(ctx.KJAFacebookExcel.build([group,group],{desde:dates[0],hasta:dates.at(-1),generado_at:'2026-09-17T04:55:30Z',provisional:true}));
  const names=[...files.get('xl/workbook.xml').matchAll(/<sheet name="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(names,['Resumen','Detalle']);
  assert.match(files.get('xl/worksheets/sheet2.xml'),/<c r="AF8" s="4"><v>\d+<\/v>/);assert.match(files.get('xl/worksheets/sheet1.xml'),/PROVISIONAL/);
  assert.match(files.get('xl/worksheets/sheet1.xml'),/showRowColHeaders="0"/);assert.match(files.get('xl/worksheets/sheet1.xml'),/showGridLines="0"/);
  assert.match(files.get('xl/worksheets/sheet1.xml'),/SUM\(&apos;Detalle&apos;!C10:AF10\)/);
  assert.match(files.get('xl/workbook.xml'),/_xlnm.Print_Area/);
});

test('summary links each area to its own totals and excludes unassigned days from percentages',()=>{
  const ctx=vm.createContext({TextEncoder,Intl,Date});vm.runInContext(layoutSource,ctx);vm.runInContext(excelSource,ctx);
  const rows=[
    {id:1,nombre:'Ana',area:'Área A',fecha:'2026-09-16',estado:'con_evidencia'},
    {id:2,nombre:'Luis',area:'Área A',fecha:'2026-09-16',estado:'no_programado'},
    {id:3,nombre:'José',area:'Área B',fecha:'2026-09-16',estado:'sin_evidencia'}
  ];
  const files=unzipStored(ctx.KJAFacebookExcel.build(m.matrix(rows,'2026-09-16','2026-09-16'),{desde:'2026-09-16',hasta:'2026-09-16',generado_at:'2026-09-17T05:00:00Z',provisional:false}));
  const summary=files.get('xl/worksheets/sheet1.xml'),detail=files.get('xl/worksheets/sheet2.xml');
  const value=(sheet,ref)=>sheet.match(new RegExp(`<c r="${ref}"[^>]*>(.*?)<\\/c>`))[1];
  assert.match(value(summary,'B7'),/<v>3<\/v>/);
  assert.match(value(summary,'D7'),/<v>1<\/v>/);assert.match(value(summary,'F7'),/<v>1<\/v>/);
  assert.match(value(summary,'D11'),/SUM\(&apos;Detalle&apos;!C11:C11\)/);
  assert.match(value(summary,'E12'),/SUM\(&apos;Detalle&apos;!C19:C19\)/);
  assert.match(value(summary,'F11'),/<v>1<\/v>/);assert.match(value(summary,'G11'),/<v>1<\/v>/);
  assert.match(value(summary,'G13'),/<v>0.5<\/v>/);
  assert.match(value(detail,'C11'),/COUNTIF\(C9:C10,&quot;Sí&quot;\)/);
  assert.match(value(detail,'C19'),/COUNTIF\(C17:C17,&quot;No&quot;\)/);
  assert.ok(!detail.includes('xSplit='));
});
