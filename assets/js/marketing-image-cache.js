(function(root){
  'use strict';
  root.KJAMarketingImageCache=function({fetchImage=fetch,urls=URL,now=Date.now}={}){
    const entries=new Map();let generation=0,active='';
    const owns=url=>[...entries.values()].some(item=>item.url===url);
    const release=url=>{if(url!==active)urls.revokeObjectURL(url)};
    function setActive(url){const previous=active;active=url||'';if(previous&&previous!==active&&!owns(previous))urls.revokeObjectURL(previous)}
    function clear(){generation++;if(active&&!owns(active))urls.revokeObjectURL(active);active='';for(const item of entries.values()){clearTimeout(item.timer);urls.revokeObjectURL(item.url)}entries.clear()}
    async function get(key,source){
      const cached=entries.get(key);
      if(cached&&cached.expires>now())return cached.url;
      if(cached){clearTimeout(cached.timer);release(cached.url);entries.delete(key)}
      const version=generation,response=await fetchImage(source);
      if(!response.ok)throw new Error('No se pudo abrir el flyer. Vuelve a intentarlo.');
      const blob=await response.blob();
      if(version!==generation)throw new Error('La sesión cambió. Vuelve a abrir la publicación.');
      const url=urls.createObjectURL(blob);
      // Límite breve y acotado; las URLs de origen se obtienen con autorización vigente.
      const item={url,expires:now()+50000,timer:null};
      item.timer=setTimeout(()=>{if(entries.get(key)===item){entries.delete(key);release(url)}},50000);
      entries.set(key,item);
      while(entries.size>4){const oldest=entries.keys().next().value,old=entries.get(oldest);clearTimeout(old.timer);release(old.url);entries.delete(oldest)}
      return url;
    }
    return {get,clear,setActive,owns:url=>url===active||owns(url)};
  };
})(globalThis);
