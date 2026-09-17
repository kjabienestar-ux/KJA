import fs from 'node:fs';
import vm from 'node:vm';
export function pdfHarness(){
  const context=vm.createContext({TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,console,Intl,Date,atob,btoa,setTimeout,clearTimeout,navigator:{userAgent:'PDF test'},document:{createElement:()=>({})}});
  context.window=context;context.self=context;
  for(const name of ['vendor/jspdf-4.2.1.umd.min','vendor/jspdf-autotable-5.0.7.min','facebook-report-model','facebook-report-pdf']){
    vm.runInContext(fs.readFileSync(new URL(`../../assets/js/${name}.js`,import.meta.url),'utf8'),context);
  }
  return context;
}
