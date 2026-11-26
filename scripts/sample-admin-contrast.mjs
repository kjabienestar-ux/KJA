// Measure the rendered backing beneath glyphs that axe could not evaluate.
// Only run against the isolated dashboard fixture. This is pixel evidence for
// the captured state, not a proof for arbitrary images, data or future states.

const linear = value => {
  const v=value/255;
  return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
};
const luminance = rgb => .2126*linear(rgb[0])+.7152*linear(rgb[1])+.0722*linear(rgb[2]);
export function contrast(fg,bg){
  const l1=luminance(fg),l2=luminance(bg);
  return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
}
export function parseColor(input){
  const m=/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(input);
  if(!m)return null;
  const result=[+m[1],+m[2],+m[3],m[4]===undefined?1:+m[4]];
  return result.slice(0,3).every(n=>n>=0&&n<=255)&&result[3]>=0&&result[3]<=1?result:null;
}
export function sampleGlyphBacking(before,after,width,height,rect,ink){
  let minimum=Infinity,pixels=0,worstBackground=null;
  for(let y=Math.max(0,Math.floor(rect.y));y<Math.min(height,Math.ceil(rect.y+rect.h));y++){
    for(let x=Math.max(0,Math.floor(rect.x));x<Math.min(width,Math.ceil(rect.x+rect.w));x++){
      const i=(y*width+x)*4;
      // Compare the normal image to the same geometry with only glyph fill
      // removed. Ignore subpixel noise; do not use antialiased foreground
      // pixels to compute WCAG contrast (use the CSS foreground instead).
      if(Math.max(...[0,1,2].map(c=>Math.abs(before[i+c]-after[i+c])))<8)continue;
      const bg=[after[i],after[i+1],after[i+2]];
      const effective=bg.map((v,c)=>ink[c]*ink[3]+v*(1-ink[3]));
      const ratio=contrast(effective,bg);pixels++;
      if(ratio<minimum){minimum=ratio;worstBackground=bg;}
    }
  }
  return pixels?{ratio:minimum,pixels,worstBackground}:null;
}

async function decodePair(decoder,a,b){
  const result=await decoder.evaluate(async({a,b})=>{
    async function decode(source){
      const img=new Image();img.src='data:image/png;base64,'+source;await img.decode();
      const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
      const data=ctx.getImageData(0,0,img.width,img.height).data;
      let binary='';for(let i=0;i<data.length;i+=16384)binary+=String.fromCharCode(...data.subarray(i,i+16384));
      return {width:img.width,height:img.height,rgba:btoa(binary)};
    }
    return [await decode(a),await decode(b)];
  },{a:a.toString('base64'),b:b.toString('base64')});
  const [normal,hidden]=result;
  if(normal.width!==hidden.width||normal.height!==hidden.height)throw Error('La geometría de captura cambió');
  return {width:normal.width,height:normal.height,before:Buffer.from(normal.rgba,'base64'),after:Buffer.from(hidden.rgba,'base64')};
}

async function sampleTarget(page,root,decoder,target){
  const locator=root.locator(target);
  if(await locator.count()!==1)return {target,status:'review',reason:'selector-no-univoco'};
  try{await locator.scrollIntoViewIfNeeded({timeout:2500});}catch{return {target,status:'review',reason:'no-visible'};}
  await page.mouse.move(0,0);
  const metadata=await locator.evaluate(el=>{
    // Save original inline style exactly. Mutation is limited to the glyph
    // fill and text shadow and is reverted in finally below.
    const segments=[],holders=new Set();
    const add=(holder,rects,text,pseudo=null)=>{
      const style=getComputedStyle(holder,pseudo);
      if(style.visibility!=='visible'||style.display==='none')return;
      let compositeUnsupported=false;
      for(let p=holder;p;p=p.parentElement){
        const s=getComputedStyle(p);
        if(Number(s.opacity)!==1||s.mixBlendMode!=='normal'||s.filter!=='none')compositeUnsupported=true;
      }
      const ink=style.webkitTextFillColor||style.color;
      for(const rect of rects){
        let l=Math.max(0,rect.left),t=Math.max(0,rect.top),r=Math.min(innerWidth,rect.right),b=Math.min(innerHeight,rect.bottom);
        for(let p=holder.parentElement;p;p=p.parentElement){
          const cs=getComputedStyle(p),bb=p.getBoundingClientRect();
          if(/hidden|clip|auto|scroll/.test(cs.overflowX)){l=Math.max(l,bb.left);r=Math.min(r,bb.right);}
          if(/hidden|clip|auto|scroll/.test(cs.overflowY)){t=Math.max(t,bb.top);b=Math.min(b,bb.bottom);}
        }
        if(r-l<1||b-t<1)continue;
        segments.push({x:l,y:t,w:r-l,h:b-t,text:text.slice(0,100),ink,fontSize:parseFloat(style.fontSize),fontWeight:parseInt(style.fontWeight,10),compositeUnsupported});
        holders.add(holder);
      }
    };
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    for(let n=walker.nextNode();n;n=walker.nextNode()){
      const holder=n.parentElement,text=n.textContent.trim();if(!text||!holder||holder.closest('svg,script,style,.sr-only'))continue;
      const range=document.createRange();range.selectNodeContents(n);add(holder,[...range.getClientRects()],text);
    }
    if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement){
      const text=el.value||el.placeholder;if(text)add(el,[el.getBoundingClientRect()],text,el.value?null:'::placeholder');
    }
    if(!segments.length)return {segments:[]};
    const left=Math.floor(Math.min(...segments.map(s=>s.x))),top=Math.floor(Math.min(...segments.map(s=>s.y)));
    const right=Math.ceil(Math.max(...segments.map(s=>s.x+s.w))),bottom=Math.ceil(Math.max(...segments.map(s=>s.y+s.h)));
    window.__kjaContrastGlyphStyles=[...holders].map(n=>({n,style:n.getAttribute('style')}));
    return {segments:segments.map(s=>({...s,x:s.x-left,y:s.y-top})),clip:{x:left+scrollX,y:top+scrollY,width:right-left,height:bottom-top}};
  });
  if(!metadata.segments.length)return {target,status:'review',reason:'sin-texto-visible'};
  let pair;
  try{
    const options={clip:metadata.clip,animations:'disabled',caret:'hide',scale:'css'};
    const normal=await page.screenshot(options);
    await page.evaluate(()=>{for(const {n} of window.__kjaContrastGlyphStyles){n.style.setProperty('-webkit-text-fill-color','transparent','important');n.style.setProperty('text-shadow','none','important');}});
    const hidden=await page.screenshot(options);
    pair=await decodePair(decoder,normal,hidden);
  } finally {
    await page.evaluate(()=>{for(const {n,style} of window.__kjaContrastGlyphStyles??[]){if(style===null)n.removeAttribute('style');else n.setAttribute('style',style);}delete window.__kjaContrastGlyphStyles;});
  }
  const segments=metadata.segments.map(s=>{
    const {text,ink,fontSize,fontWeight,compositeUnsupported}=s;
    const color=parseColor(ink),minimum=fontSize>=24||(fontWeight>=700&&fontSize>=18.6667)?3:4.5;
    if(compositeUnsupported||!color)return {text,ink,minimum,status:'review',reason:'composicion-no-simple'};
    const measured=sampleGlyphBacking(pair.before,pair.after,pair.width,pair.height,s,color);
    if(!measured)return {text,ink,minimum,status:'review',reason:'sin-pixeles-de-glifo'};
    return {text,ink,minimum,...measured,status:measured.ratio>=minimum?'pass':'fail'};
  });
  return {target,status:segments.some(s=>s.status==='fail')?'fail':segments.every(s=>s.status==='pass')?'pass':'review',segments};
}

export async function sampleIncompleteContrast(page,root,decoder,targets){
  const results=[];
  for(const item of targets){
    try{results.push(await sampleTarget(page,root,decoder,item.target));}
    catch(error){results.push({target:item.target,status:'review',reason:String(error.message).slice(0,200)});}
  }
  return results;
}
