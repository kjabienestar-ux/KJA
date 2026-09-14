import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js=fs.readFileSync(new URL('../assets/js/dashboard.js',import.meta.url),'utf8');
function harness(requirement='asignado'){
  const elements=new Map(),messages=[],uploads=[],requests=[];
  const c={DAILY_EVIDENCE:{requirement,assignment:42,files:[],existingFiles:[]},FACEBOOK_EVIDENCE_MAX:50,
    $:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id)},
    dailyEvidenceMode:()=> 'individuales',dailyEvidenceMessage:m=>messages.push(m),
    clearDailyEvidenceFiles:()=>{c.DAILY_EVIDENCE.files=[]},renderDailyEvidencePreviews:()=>{},
    URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}},
    compressImage:async()=>{throw new Error('Documents must not pass through image compression')},
    SUPABASE_URL:'https://example.test',SUPABASE_ANON:'test',DAILY_EVIDENCE_BUCKET:'asis-cierre-evidencias',
    db:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})},storage:{from:()=>({uploadToSignedUrl:async(...args)=>{uploads.push(args);return {}}})}},
    fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true,ruta:'private/document.pdf',token:'token'})}},
    esc:s=>String(s).replaceAll('<','&lt;').replaceAll('"','&quot;')};
  vm.createContext(c);
  for(const [start,end] of [['function dailyDocumentType(','function readVideoMetadata('],['async function requestDailyEvidencePermit(','async function requestDailyVideoPermit('],['async function uploadDailyEvidence(','async function uploadDailyVideo(']])vm.runInContext(js.slice(js.indexOf(start),js.indexOf(end)),c);
  return {c,messages,uploads,requests};
}
for(const ext of ['pdf','doc','docx','ppt','pptx'])test(`assigned ${ext} keeps bytes and MIME through signed upload`,async()=>{
  const h=harness(),file={name:`Entrega.${ext.toUpperCase()}`,type:'',size:1024};
  await h.c.chooseDailyEvidence([file]);
  assert.equal(h.c.DAILY_EVIDENCE.files.length,1);
  const prepared=h.c.DAILY_EVIDENCE.files[0];assert.equal(prepared.blob,file);
  await h.c.uploadDailyEvidence(prepared);
  assert.equal(h.requests[0].ext,ext);assert.equal(h.requests[0].asignacion,42);
  assert.equal(h.uploads[0][2],file);assert.equal(h.uploads[0][3].contentType,prepared.type);
});
test('documents over 10 MB and unknown types cannot be submitted',async()=>{
  for(const file of [{name:'big.pdf',size:10485761},{name:'script.html',type:'text/html',size:10}]){
    const h=harness();await h.c.chooseDailyEvidence([file]);assert.equal(h.c.DAILY_EVIDENCE.files.length,0);assert.ok(h.messages.length);
  }
});
test('Facebook and exit still require images',async()=>{
  for(const requirement of ['comparticiones','salida','rpe']){
    const h=harness(requirement);await h.c.chooseDailyEvidence([{name:'file.pdf',size:100}]);assert.equal(h.c.DAILY_EVIDENCE.files.length,0);
  }
});
test('replacement carries document extension and preview opens file without img',async()=>{
  const h=harness();h.c.DAILY_EVIDENCE.editing=true;
  await h.c.requestDailyEvidencePermit('docx');assert.equal(h.requests[0].accion,'reemplazar');assert.equal(h.requests[0].ext,'docx');
  const preview=h.c.dailyFilePreview({mime:'application/pdf',url:'https://example.test/private',name:'<test>'},0);
  assert.ok(preview.includes('<a '));assert.ok(!preview.includes('<img'));assert.ok(preview.includes('&lt;test>'));
});
