// Positive component-role rules for the older admin styles. The color's hue
// does not decide the semantic role. Lightness is used only to avoid turning
// a deliberately dark/filled surface into a pale one without its text pair.
import postcss from 'postcss';
export function rightmostCompound(selector){
  let depth=0,quote='',start=0;
  for(let i=0;i<selector.length;i++){
    const c=selector[i];if(c==='\\'){i++;continue;}
    if(quote){if(c===quote)quote='';continue;}
    if(c==='"'||c==="'"){quote=c;continue;}
    if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;
    else if(depth===0&&/[>+~\s]/.test(c))start=i+1;
  }
  const t=selector.slice(start).trim();return /^:(?:is|where)\(/.test(t)?'':t;
}
const element=/^(?:\*|[a-z][\w-]*)(?=$|[.#:\[])/i;
const className=/\.(?:admin|assignment|apl|seg|asg|rk|rh|pw|aw|fbr|md|moonrow|role|contract|kja-date|kja-month|area-picker)[\w-]*\b/;
const outsideRole=/\b(?:tone|area-theme|area-color|area-badge|medal|podium|chart|ring|avatar|initials|logo|brand|map|qr|leaflet|media|image|photo|video|preview|evidence-gallery|canvas|signature)\b|data-medal/i;
const status=/\b(?:status|state|badge|tag|pill|tone|indicator|metric|kpi|warning|danger|error|success|pending|approved|selected|active|marked|off|ready|missing|complete|incomplete)\b|aria-(?:selected|pressed|checked)|\.(?:p|t|j|ng|on|bad|ok)\b/i;
const field=/^(?:input|select|textarea)\b|\b(?:field|search|input|select|picker|trigger|combobox|coordinates|control)(?:[-\w]*)\b/i;
const surface=/\b(?:card|panel|sheet|toolbar|table|group|row|list|ledger|container|head|header|foot|footer|dialog|section|body|block|shell|wrap|empty)(?:[-\w]*)\b/i;
const muted=/^(?:small|time|p|em)\b|\b(?:muted|caption|hint|help|description|subtitle|subheading|meta|note|footnote|subtext|legend|secondary|context|origin|history)(?:[-\w]*)\b/i;
const mainText=/^(?:h[1-6]|strong|b|label)\b|\b(?:heading|title|label|name|value|person-name|text|copy)(?:[-\w]*)\b/i;
const secondary=/\b(?:secondary-action|cancel|soft|ghost|retry|back|clear|close-btn|refresh|export|link)(?:[-\w]*)\b/i;
const primary=/\b(?:primary-action|cta-btn|submit|save-btn|confirm-btn)(?:[-\w]*)\b/i;
function hexLightness(value){
  let h=value.toLowerCase().replace(/^#/,'');if(h.length===3)h=[...h].map(c=>c+c).join('');if(!/^[0-9a-f]{6}$/.test(h))return null;
  const c=h.match(/../g).map(x=>{let n=parseInt(x,16)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722;
}
function roleFor(selector,prop,value){
  const t=rightmostCompound(selector);if(!t||!className.test(selector)||outsideRole.test(t)||/::(?:before|after|selection|[-\w]*scrollbar)/.test(t))return null;
  const lum=hexLightness(value);if(lum===null)return null;
  const interactive=/:hover|:active|:focus|\[aria-expanded/.test(t),edge=/^border(?:-[\w-]+)?$/.test(prop)&&!/^border-(?:radius|style|width)$/.test(prop);
  const fill=/^(?:background|background-color)$/.test(prop),text=prop==='color';
  if(/:disabled|\[disabled\]/.test(t)&&field.test(t))return text?'action-disabled-text':fill?'action-disabled-bg':edge?'field-border':null;
  if(status.test(t))return null; // specific states remain in the reviewed palette map
  if(text&&lum<.55){if(muted.test(t))return 'text-secondary';if(mainText.test(t))return 'text-primary';if(secondary.test(t))return 'action-secondary';}
  if(fill&&lum>.68){if(/:hover/.test(t)&&(field.test(t)||surface.test(t)||secondary.test(t)))return 'surface-hover';if(field.test(t)||secondary.test(t)||surface.test(t))return 'surface-opaque';}
  if(fill&&lum<.25&&primary.test(t))return /:hover/.test(t)?'action-primary-hover':/:active/.test(t)?'action-primary-pressed':'action-primary';
  if(edge&&lum>.15&&lum<.97){if(field.test(t))return 'field-border';if(surface.test(t)||secondary.test(t))return /^border-(?:top|bottom|left|right)/.test(prop)?'divider-subtle':'surface-border';}
  return null;
}
export function componentRoleToken(selector,prop,value){
  const roles=postcss.list.comma(selector).map(s=>roleFor(s.trim(),prop,value));return roles.length&&roles[0]&&roles.every(r=>r===roles[0])?roles[0]:null;
}
function stateTone(selector){
  // The class/attribute, not the hue, identifies the business state. Match
  // complete tokens; e.g. "incomplete" must never match "complete".
  if(!className.test(selector)||/tone-|area-theme|area-badge|medal|podium|chart|avatar|logo|brand|map|qr|preview|gallery|:not\(|:has\(|:is\([^)]*,/.test(selector))return null;
  const explicit=/(?:(?:[.#])(?:[\w-]*-)?(?:incompleta|incomplete|observada|observed|rejected|reject|error|danger|blocked|bad|ausente)(?=$|[\s.:#>\[\)])|\[data-(?:state|status|tone)=["']?(?:observada|incompleta|error|danger|blocked)["']?\])/i;
  if(explicit.test(selector))return 'status-error';
  if(/(?:\[data-(?:state|status|tone)=["']?(?:pending|pendiente|warning|warning-review)["']?\]|\.(?:[\w-]*-)?(?:pending|pendiente|warning|late|tardanza|is-amber|has-pending)(?=$|[\s.:#>\[\)]))/.test(selector))return 'status-warning';
  if(/(?:\[data-(?:state|status|tone)=["']?(?:aprobada|completa|regularizada|ready|success)["']?\]|\.(?:[\w-]*-)?(?:aprobada|approved|completa|complete|regularizada|ready|success|registered|lista_para_salir|is-yes)(?=$|[\s.:#>\[\)]))/.test(selector))return 'status';
  if(/(?:\.(?:[\w-]*-)?(?:justificado|justificada|justified)(?=$|[\s.:#>\[\)])|\[data-(?:state|status)=["']?justificado["']?\])/.test(selector))return 'status-justified';
  if(/(?:\.(?:[\w-]*-)?(?:info|entregada|virtual)(?=$|[\s.:#>\[\)])|\[data-(?:state|status|tone)=["']?(?:info|entregada)["']?\])/.test(selector))return 'status-info';
  if(/\.(?:[\w-]*-)?(?:neutral|is-na|is-out|sin_entrada|no_aplica|unregistered)(?=$|[\s.:#>\[\)])/.test(selector))return 'status-neutral';
  if(/(?:apl-mark|admin-month-cell|month-day-current|month-state-picker|admin-current-state|admin-status-pill|admin-month-legend|admin-state-btn)/.test(selector)){
    if(/\.p(?=$|[\s.:#>\[])/.test(selector))return 'status';if(/\.t(?=$|[\s.:#>\[])/.test(selector))return 'status-warning';if(/\.j(?=$|[\s.:#>\[])/.test(selector))return 'status-justified';
    if(/apl-mark/.test(selector)&&/\.ng(?=$|[\s.:#>\[])/.test(selector))return 'status-neutral';
  }
  return null;
}
export function stateRoleToken(selector,prop,value){
  const lum=hexLightness(value);if(lum===null)return null;
  const tones=postcss.list.comma(selector).map(s=>stateTone(s.trim()));const tone=tones[0];if(!tone||!tones.every(t=>t===tone))return null;
  if(prop==='color'||prop==='stroke')return lum>.88?'on-action':tone+'-text';
  if(/^(?:background|background-color|fill)$/.test(prop))return tone+(lum>.4?'-bg':'-text');
  if(/^border(?:-[\w-]+)?$/.test(prop)&&!/^border-(?:radius|style|width)$/.test(prop))return lum>.55?'surface-border':tone+'-text';
  return null;
}
