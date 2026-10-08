/* Corrections are read from deliveries, independently of notification read/deletion state. */
const EVIDENCE_CORRECTIONS={owner:'',items:[],config:{},seen:new Set(),loading:false,current:null,request:0};
function pendingEvidenceCorrection(date){
  const state=EVIDENCE_CORRECTIONS;
  if(state.owner!==APP.sessionUid||!date)return null;
  const item=state.items.find(item=>item.fecha===date);
  return item?{...item,...state.config}:null;
}
function resetEvidenceCorrections(){
  EVIDENCE_CORRECTIONS.request++;
  Object.assign(EVIDENCE_CORRECTIONS,{owner:APP.sessionUid,items:[],config:{},seen:new Set(),loading:false,current:null});
  $('evidence-correction-modal').close();
  $('evidence-correction-banner').hidden=true;
}
function renderEvidenceCorrections(){
  const banner=$('evidence-correction-banner'),items=EVIDENCE_CORRECTIONS.items;
  banner.hidden=!APP.identity.hasPersonal||!items.length;
  $('evidence-correction-count').textContent=items.length===1?'Tienes una compartición por corregir':
    `Tienes ${items.length} entregas de comparticiones por corregir`;
  $('evidence-correction-pending').innerHTML=items.map(item=>
    `<button type="button" data-open-evidence-correction="${esc(item.id)}">Corregir entrega del ${esc(item.fecha.split('-').reverse().join('/'))}</button>`).join('');
}
function correctionModalBlocked(){
  return document.hidden||$('portal').hidden||DAILY_EVIDENCE.busy||DAILY_EVIDENCE.loading
    ||!$('daily-evidence-editor').hidden||!!document.querySelector('dialog[open]')
    ||[...document.querySelectorAll('.modal:not([hidden]),[role="dialog"]:not([hidden])')].some(el=>el.getClientRects().length>0);
}
function showNextEvidenceCorrection(){
  if(!APP.identity.hasPersonal||EVIDENCE_CORRECTIONS.owner!==APP.sessionUid||correctionModalBlocked())return;
  const item=EVIDENCE_CORRECTIONS.items.find(item=>!item.vista&&!EVIDENCE_CORRECTIONS.seen.has(String(item.id)));
  if(item)openEvidenceCorrection(item.id);
}
function openEvidenceCorrection(id){
  const item=EVIDENCE_CORRECTIONS.items.find(item=>String(item.id)===String(id));
  if(!item||DAILY_EVIDENCE.busy)return;
  EVIDENCE_CORRECTIONS.current=item;
  $('evidence-correction-date').textContent=`Comparticiones de Facebook · ${item.fecha.split('-').reverse().join('/')}`;
  $('evidence-correction-note').textContent=item.nota||'Revisa las capturas y vuelve a enviar tu evidencia.';
  $('evidence-correction-modal').showModal();
  $('evidence-correction-upload').focus({preventScroll:true});
}
async function acknowledgeEvidenceCorrection(item){
  if(!item)return;
  EVIDENCE_CORRECTIONS.seen.add(String(item.id));
  try{
    const {data,error}=await db.rpc('dash_marcar_correccion_vista',{p_entrega:Number(item.id)});
    if(error||!data?.ok)throw error||new Error('vista');
    item.vista=true;
  }catch{toast('Puedes continuar. El aviso podría aparecer otra vez al ingresar.',true);}
}
function dismissEvidenceCorrection(){
  const item=EVIDENCE_CORRECTIONS.current;
  EVIDENCE_CORRECTIONS.current=null;
  $('evidence-correction-modal').close();
  void acknowledgeEvidenceCorrection(item);
}
async function loadEvidenceCorrections(){
  if(!APP.identity.hasPersonal)return;
  if(EVIDENCE_CORRECTIONS.owner!==APP.sessionUid)resetEvidenceCorrections();
  if(EVIDENCE_CORRECTIONS.loading)return;
  const request=++EVIDENCE_CORRECTIONS.request,owner=APP.sessionUid;
  EVIDENCE_CORRECTIONS.loading=true;
  try{
    const {data,error}=await db.rpc('dash_mis_correcciones');
    if(request!==EVIDENCE_CORRECTIONS.request||owner!==APP.sessionUid||!APP.identity.hasPersonal)return;
    if(error||!data?.ok)return;
    const previousIds=EVIDENCE_CORRECTIONS.items.map(item=>item.id).join(',');
    EVIDENCE_CORRECTIONS.items=Array.isArray(data.correcciones)?data.correcciones:[];
    EVIDENCE_CORRECTIONS.config={comparticiones_min:Number(data.comparticiones_min)||1,collage_permitido:!!data.collage_permitido};
    const current=EVIDENCE_CORRECTIONS.current;
    if(current&&!EVIDENCE_CORRECTIONS.items.some(item=>String(item.id)===String(current.id))){
      EVIDENCE_CORRECTIONS.current=null;$('evidence-correction-modal').close();
    }
    renderEvidenceCorrections();
    if(previousIds!==EVIDENCE_CORRECTIONS.items.map(item=>item.id).join(','))await loadDailyClose({quiet:true});
    if(request!==EVIDENCE_CORRECTIONS.request||owner!==APP.sessionUid)return;
    if(APP.cierre)renderDailyClose();
    showNextEvidenceCorrection();
  }catch{/* Keep the pending banner and retry on the next notification refresh. */}
  finally{if(request===EVIDENCE_CORRECTIONS.request)EVIDENCE_CORRECTIONS.loading=false;}
}
function finishEvidenceCorrection(id){
  // Discard lists started before confirmation so they cannot restore the resolved alert.
  EVIDENCE_CORRECTIONS.request++;EVIDENCE_CORRECTIONS.loading=false;
  EVIDENCE_CORRECTIONS.items=EVIDENCE_CORRECTIONS.items.filter(item=>String(item.id)!==String(id));
  renderEvidenceCorrections();
  return loadEvidenceCorrections();
}
$('evidence-correction-later').onclick=dismissEvidenceCorrection;
$('evidence-correction-modal').addEventListener('cancel',event=>{event.preventDefault();dismissEvidenceCorrection();});
$('evidence-correction-upload').onclick=()=>{
  const item=EVIDENCE_CORRECTIONS.current;if(!item)return;
  dismissEvidenceCorrection();
  DAILY_EVIDENCE_TRIGGER=$('evidence-correction-pending').querySelector('button');
  openDailyEvidenceEditor('comparticiones',null,{...item,...EVIDENCE_CORRECTIONS.config});
};
$('evidence-correction-pending').onclick=event=>{
  const button=event.target.closest('[data-open-evidence-correction]');
  if(button)openEvidenceCorrection(button.dataset.openEvidenceCorrection);
};
// Defer interruptions until the user's current dialog or upload has finished.
setInterval(showNextEvidenceCorrection,1500);
