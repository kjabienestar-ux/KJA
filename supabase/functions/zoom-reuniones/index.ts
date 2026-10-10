import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {zoomClient} from './zoom-api.mjs';
import {handler} from './handler.mjs';
const env=(key:string)=>Deno.env.get(key);
Deno.serve(handler({createClient,env,zoom:zoomClient(env)}));
