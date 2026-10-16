export function publicationPhones(value){
  const raw=String(value||'').trim();
  const normalize=part=>part.replace(/[\s()+-]/g,'');
  const valid=number=>/^[1-9]\d{7,14}$|^0\d{7,10}$/.test(number);
  if(valid(normalize(raw)))return normalize(raw).startsWith('0')?[]:[normalize(raw)];
  const numbers=raw.split(/\s*(?:[\/;,|\n]+|\s+[yo]\s+)\s*|(?=\+\d|\(\d{1,3}\))/i).filter(Boolean).map(normalize);
  return numbers.length&&numbers.length<=2&&numbers.every(valid)?[...new Set(numbers)].filter(number=>!number.startsWith('0')):[];
}
