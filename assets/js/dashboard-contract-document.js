/* Documento del contrato en la ficha del colaborador (supabase/dashboard_128_documento_contrato.sql).
   Queda oculto hasta que dashboard.html active window.KJA_CONTRATO_DOCUMENTO, para no llamar funciones
   que todavía no existan en Supabase. El archivo se sube recién al guardar la ficha. */
const CONTRACT_DOC_BUCKET='asis-contratos',CONTRACT_DOC_MAX=10*1024*1024;
const CONTRACT_DOC_TYPES={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
// saved: documento registrado · file/type: elegido y aún sin subir · remove: quitar al guardar.
let CONTRACT_DOC={saved:null,file:null,type:'',remove:false,localUrl:''};

// Vista previa: ?contrato=preview en localhost muestra el campo antes del SQL, sin llamar a Supabase.
const CONTRACT_DOC_PREVIEW=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&new URLSearchParams(location.search).get('contrato')==='preview';

function contractDocumentEnabled(){return window.KJA_CONTRATO_DOCUMENTO===true||CONTRACT_DOC_PREVIEW}
function contractDocumentPreviewOnly(){return CONTRACT_DOC_PREVIEW&&window.KJA_CONTRATO_DOCUMENTO!==true}

async function loadContractDocuments(){
  if(contractDocumentPreviewOnly())return new Map();
  if(!contractDocumentEnabled())return null;
  const {data,error}=await db.rpc('dash_admin_documentos_contrato');
  if(error||!data?.ok)return null;
  return new Map((data.documentos||[]).map(doc=>[String(doc.colaborador_id),doc]));
}

function contractDocSize(bytes){
  const n=Number(bytes)||0;
  return n>=1048576?`${(n/1048576).toLocaleString('es-PE',{maximumFractionDigits:1})} MB`:`${Math.max(1,Math.round(n/1024))} KB`;
}
function contractDocDate(value){
  const d=new Date(value);
  return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'short',year:'numeric'});
}
function contractDocMsg(text,bad=false){
  const status=$('admin-contract-document-status');
  status.querySelector('span').textContent=text||'';
  status.classList.toggle('bad',bad);
  status.hidden=!text;
}
function clearContractDocLocal(){
  if(CONTRACT_DOC.localUrl)URL.revokeObjectURL(CONTRACT_DOC.localUrl);
  CONTRACT_DOC.localUrl='';
}

function renderContractDocument(){
  const {saved,file,remove}=CONTRACT_DOC,current=file?{nombre:file.name,tipo:CONTRACT_DOC.type}:remove?null:saved;
  $('admin-contract-document-drop').hidden=!!current;
  $('admin-contract-document-file').hidden=!current;
  if(current){
    const kind=current.tipo==='application/pdf'?'PDF':'IMG';
    $('admin-contract-document-kind').textContent=kind;
    $('admin-contract-document-kind').dataset.kind=kind;
    $('admin-contract-document-name').textContent=current.nombre;
    $('admin-contract-document-name').title=current.nombre;
    $('admin-contract-document-detail').textContent=file?`${contractDocSize(file.size)} · Se subirá al guardar`:`${contractDocSize(saved.tamano)} · Subido el ${contractDocDate(saved.subido_at)}`;
    $('admin-contract-document-remove').textContent=file?'Descartar':'Quitar';
  }
  $('admin-contract-document-undo').hidden=!remove;
  contractDocMsg(remove?'El documento actual se quitará al guardar.':contractDocumentPreviewOnly()?'Vista previa local: el archivo no se sube hasta ejecutar el SQL 128.':'');
}

function openContractDocument(person){
  const root=$('admin-contract-document');if(!root)return;
  clearContractDocLocal();
  CONTRACT_DOC={saved:person?.contrato_documento||null,file:null,type:'',remove:false,localUrl:''};
  root.hidden=!(contractDocumentEnabled()&&APP.adminTeam?.documentos_contrato);
  $('admin-contract-document-input').value='';
  renderContractDocument();
}

function pickContractDocument(file){
  if(!file)return;
  // Algunos equipos entregan el PDF sin tipo; la extensión lo confirma.
  const type=file.type||(/\.pdf$/i.test(file.name)?'application/pdf':'');
  if(!CONTRACT_DOC_TYPES[type])return contractDocMsg('Adjunta un PDF o una imagen JPG, PNG o WebP.',true);
  if(!file.size)return contractDocMsg('El archivo está vacío.',true);
  if(file.size>CONTRACT_DOC_MAX)return contractDocMsg(`El archivo pesa ${contractDocSize(file.size)} y el máximo es 10 MB.`,true);
  clearContractDocLocal();
  Object.assign(CONTRACT_DOC,{file,type,remove:false});
  renderContractDocument();
}

function contractDocumentPending(){return !!(CONTRACT_DOC.file||(CONTRACT_DOC.remove&&CONTRACT_DOC.saved))}

// La pestaña se abre antes de pedir el enlace firmado para que el navegador no la bloquee.
async function viewSavedContractDocument(doc){
  if(!doc?.path)return;
  const tab=window.open('','_blank');
  const {data,error}=await db.storage.from(CONTRACT_DOC_BUCKET).createSignedUrl(doc.path,900);
  if(error||!data?.signedUrl){tab?.close();return toast('No pudimos abrir el contrato. Comprueba que tu sesión siga vigente.',true);}
  if(!tab)return window.open(data.signedUrl,'_blank','noopener');
  tab.opener=null;tab.location.href=data.signedUrl;
}
function viewContractDocument(){
  if(!CONTRACT_DOC.file)return viewSavedContractDocument(CONTRACT_DOC.saved);
  if(!CONTRACT_DOC.localUrl)CONTRACT_DOC.localUrl=URL.createObjectURL(CONTRACT_DOC.file);
  window.open(CONTRACT_DOC.localUrl,'_blank');
}
function viewContractDocumentOf(id){
  const person=(APP.adminTeam?.personas||[]).find(x=>String(x.id)===String(id));
  return viewSavedContractDocument(person?.contrato_documento);
}

// Devuelve '' si todo salió bien o la frase para avisar; a estas alturas la ficha ya está guardada.
async function saveContractDocument(personId,reason){
  if(!contractDocumentPending())return '';
  if(contractDocumentPreviewOnly())return 'en la vista previa local los archivos no se suben.';
  const bucket=db.storage.from(CONTRACT_DOC_BUCKET),id=Number(personId),retry=' Vuelve a abrir la ficha para intentarlo.';
  if(CONTRACT_DOC.file){
    const {file,type}=CONTRACT_DOC,path=`${id}/${crypto.randomUUID()}.${CONTRACT_DOC_TYPES[type]}`;
    const upload=await bucket.upload(path,file,{contentType:type,upsert:false});
    if(upload.error)return 'no se pudo subir el archivo.'+retry;
    const {data,error}=await db.rpc('dash_admin_registrar_documento_contrato',{p_colab:id,p_path:path,p_nombre:file.name,p_tipo:type,p_tamano:file.size,p_motivo:reason||null});
    if(error||!data?.ok){
      await bucket.remove([path]);
      return {sin_permiso:'tu rol no permite adjuntar contratos.',archivo:'el archivo no es válido.'}[data?.motivo]||'no se pudo registrar el archivo.'+retry;
    }
    if(data.anterior&&data.anterior!==path)await bucket.remove([data.anterior]);
    return '';
  }
  const {data,error}=await db.rpc('dash_admin_quitar_documento_contrato',{p_colab:id,p_motivo:reason||null});
  if(error||!data?.ok)return data?.motivo==='sin_permiso'?'tu rol no permite quitar contratos.':'no se pudo quitar el documento.'+retry;
  if(data.path)await bucket.remove([data.path]);
  return '';
}

function contractDocumentLink(person){
  if(!person?.contrato_documento)return '';
  return `<button type="button" class="admin-contract-doc" data-contract-document="${person.id}" aria-label="Ver contrato de ${esc(person.nombre)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 11.5-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/></svg>Ver contrato</button>`;
}

(function(){
  const drop=$('admin-contract-document-drop'),input=$('admin-contract-document-input');
  if(!drop||!input)return;
  drop.addEventListener('click',()=>input.click());
  // Se vacía al leerlo para que elegir el mismo archivo otra vez también cuente.
  input.addEventListener('change',()=>{pickContractDocument(input.files[0]);input.value=''});
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('is-dragging')});
  drop.addEventListener('dragleave',()=>drop.classList.remove('is-dragging'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('is-dragging');pickContractDocument(e.dataTransfer.files[0])});
  $('admin-contract-document-view').addEventListener('click',viewContractDocument);
  $('admin-contract-document-replace').addEventListener('click',()=>input.click());
  $('admin-contract-document-remove').addEventListener('click',()=>{
    if(CONTRACT_DOC.file){clearContractDocLocal();Object.assign(CONTRACT_DOC,{file:null,type:''});}
    else CONTRACT_DOC.remove=true;
    renderContractDocument();
  });
  $('admin-contract-document-undo').addEventListener('click',()=>{CONTRACT_DOC.remove=false;renderContractDocument()});
})();
