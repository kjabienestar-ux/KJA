(function(root){
'use strict';
const active=new WeakMap();
function open(options){
 const {container,rpc,name,legacy,id,key,render,isCurrent=()=>true,scope=()=>'',onData=()=>{}}=options;
 const state={page:0,cursors:[null],busy:false,next:null,legacyRows:null,legacyData:null};
 const initialScope=scope();active.set(container,state);
 const current=()=>active.get(container)===state&&isCurrent()&&scope()===initialScope;
 const controls=()=>`<nav class="history-pages" aria-label="Páginas del historial"><button type="button" data-history-page="previous" ${state.page===0?'disabled':''}>Anterior</button><span role="status"> Página ${state.page+1} </span><button type="button" data-history-page="next" ${state.next==null?'disabled':''}>Siguiente</button></nav>`;
 async function load(page){
  if(state.busy||!current())return false;
  state.failedPage=page;state.busy=true;container.setAttribute('aria-busy','true');container.querySelectorAll('[data-history-page]').forEach(button=>button.disabled=true);
  try{
   let result;
   if(state.legacyRows===null){
    result=await rpc(name,{p_colab:Number(id),p_antes:state.cursors[page],p_limite:12});
    if(!current())return false;
    if(result.error?.code==='PGRST202'){
     result=await rpc(legacy,{p_colab:Number(id)});
     if(!current())return false;
     if(!result.error&&result.data?.ok){state.legacyRows=result.data[key]||[];state.legacyData=result.data;}
    }
   }
   if(state.legacyRows!==null)result={data:{...state.legacyData,[key]:state.legacyRows.slice(page*12,page*12+12),siguiente:(page+1)*12<state.legacyRows.length?{offset:(page+1)*12}:null}};
   if(!current())return false;
   if(result.error||!result.data?.ok)throw Error('history');
   state.page=page;state.next=result.data.siguiente??null;
   onData(result.data);render(result.data[key]||[],state.legacyData||result.data);
   container.insertAdjacentHTML('beforeend',controls());return true;
  }catch(error){
   if(current()){
    container.querySelector('[data-history-error]')?.remove();
    container.insertAdjacentHTML('beforeend','<p data-history-error role="alert">No se pudo cargar esta página. <button type="button" data-history-page="retry">Reintentar</button></p>');
    container.querySelector('[data-history-page="previous"]')?.toggleAttribute('disabled',state.page===0);
    container.querySelector('[data-history-page="next"]')?.toggleAttribute('disabled',state.next==null);
   }
   return false;
  }finally{state.busy=false;if(current())container.setAttribute('aria-busy','false');}
 }
 container.onclick=event=>{
  const button=event.target.closest('[data-history-page]');if(!button)return;event.stopPropagation();if(state.busy||!current())return;
  const action=button.dataset.historyPage;
  if(action==='next'&&state.next!=null){state.cursors[state.page+1]=state.next;load(state.page+1);}
  else if(action==='previous'&&state.page>0)load(state.page-1);
  else if(action==='retry')load(state.failedPage??state.page);
 };
 return load(0);
}
root.KJAHistoryPages={open};
})(globalThis);
