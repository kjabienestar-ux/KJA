// Geometry is measured on elements that genuinely paint a surface. Browser
// defaults on transparent/unpainted containers are not new visual roles.
const rgbHex=hex=>'rgb('+hex.slice(1).match(/../g).map(x=>parseInt(x,16)).join(', ')+')';
const compact=s=>s.replace(/\s+/g,'').replace(/,\./g,',0.');
export function checkPaintedGeometry(report,tokens){
  const radii=new Set(Object.entries(tokens).filter(([k,v])=>/radius/.test(k)&&/^\d+px$/.test(v)).map(([,v])=>v));
  const colors=new Set(Object.values(tokens).flatMap(v=>/^#[0-9a-f]{6}$/i.test(v)?[compact(rgbHex(v))]:/^rgba?\([^)]*\)$/.test(v)?[compact(v)]:[]));
  const unexpected=[],classified=new Map(),elevation=new Set();
  const mark=(role,view,r)=>{const key=role+' | '+r.property+' | '+r.value;const entry=classified.get(key)??{role,property:r.property,value:r.value,views:new Set()};entry.views.add(view);classified.set(key,entry);};
  for(const [view,items]of Object.entries(report.painted??{}))for(const r of items){
    if(r.property==='radius'){
      if(radii.has(r.value))mark('token-radius',view,r);
      else if(r.value==='50%')mark('geometric-circle',view,r);
      else if(view==='mes'&&r.value==='2px'&&r.samples.every(s=>s.parent==='admin-month-area-sticky'))mark('area-marker-geometry',view,r);
      else unexpected.push({view,...r});
    }else if(r.property==='shadow'){
      const v=compact(r.value);
      if(v==='rgba(51,37,26,0.024)0px2px4px0px'){mark('surface-card-shadow',view,r);elevation.add('card');}
      else if(v==='rgba(96,71,48,0.14)0px16px38px0px'){mark('selector-menu-shadow',view,r);elevation.add('menu');}
      else if(v==='rgba(56,49,43,0.18)0px20px60px0px'){mark('surface-dialog-shadow',view,r);elevation.add('dialog');}
      else if(v==='rgba(82,121,102,0.16)0px0px8px3px')mark('field-focus-shadow',view,r);
      else if(v==='rgb(147,71,47)0px-3px0px0pxinset'||v==='rgb(147,71,47)3px0px0px0pxinset')mark('selection-indicator',view,r);
      else if(v==='rgb(222,214,203)0px1px0px0px'||v==='rgb(222,214,203)0px0px0px1px')mark('structural-divider',view,r);
      else if(view==='ranking'&&v==='rgba(214,138,6,0.35)0px4px10px0px'&&r.samples.every(s=>s.classes==='rk-crown'))mark('medal-illustration',view,r);
      else if(view==='ranking'&&v==='rgb(255,255,255)0px0px0px3px,rgb(128,82,16)0px0px0px5px'&&r.samples.every(s=>s.classes.split(/\s+/).includes('rk-av')))mark('medal-ring',view,r);
      else unexpected.push({view,...r});
    }else if(/color/i.test(r.property)){
      if(colors.has(compact(r.value)))mark('token-color',view,r);
      else if(view==='ranking'&&r.property==='backgroundColor'&&r.value==='rgb(255, 248, 234)'&&r.samples.every(s=>s.classes.split(/\s+/).includes('rk-ad-person')))mark('medal-illustration',view,r);
      else unexpected.push({view,...r});
    }
  }
  return {pass:unexpected.length===0,unexpected,paintedRadii:[...new Set([...classified.values()].filter(x=>x.property==='radius').map(x=>x.value))],elevation:[...elevation],functional:[...classified.values()].filter(x=>!x.role.startsWith('token-')&&!x.role.endsWith('-shadow')).map(x=>({...x,views:[...x.views]})),limits:'Only painted surfaces in the measured desktop scenarios; color defaults/inheritance and transparent containers are not palette entries.'};
}
