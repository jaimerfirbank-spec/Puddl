const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const api=fs.readFileSync('api/image-to-map.js','utf8').replace('export default ','');
const graph=()=>({nodes:[{id:'n1',label:'A',shape:'circle',x:10,y:10,width:50,height:50}],edges:[],warnings:[],image_summary:'A node'});
function server(fetch){
 const context=vm.createContext({process:{env:{OPENAI_API_KEY:'test',SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public-test'}},fetch,AbortSignal,console:{error(){}},Buffer});vm.runInContext(api,context);
 return async(req)=>{let result;const res={setHeader(){},end(body){result={status:this.statusCode,...JSON.parse(body)}}};await context.handler(req,res);return result};
}
const request=()=>({method:'POST',headers:{authorization:'Bearer test'},body:{image:'data:image/png;base64,iVBORw0KGgo='}});
test('photo scripts parse',()=>{new vm.Script(fs.readFileSync('image-to-map-bridge.js','utf8'));for(const m of fs.readFileSync('image-to-map-prototype.html','utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(m[1]);});
test('unauthenticated photo requests never call a provider',async()=>{const handler=server(()=>{throw Error('network called')});const req=request();req.headers={};assert.equal((await handler(req)).status,401)});
test('allowance failure stops before the paid reader',async()=>{let calls=0;const handler=server(async()=>{calls++;return calls===1?{ok:true,json:async()=>({id:'user'})}:{ok:true,json:async()=>false}});assert.equal((await handler(request())).status,429);assert.equal(calls,2)});
test('invalid graph references are rejected instead of handed to the editor',async()=>{let calls=0;const bad=graph();bad.edges=[{source:'n1',target:'missing',direction:'source_to_target'}];const handler=server(async()=>{calls++;return{ok:true,json:async()=>calls===1?{id:'u'}:calls===2?true:{output_text:JSON.stringify(bad)}}});assert.equal((await handler(request())).status,502)});
test('authorized valid reads return their graph',async()=>{let calls=0;const handler=server(async()=>{calls++;return{ok:true,json:async()=>calls===1?{id:'u'}:calls===2?true:{output_text:JSON.stringify(graph())}}});const response=await handler(request());assert.equal(response.status,200);assert.equal(response.result.nodes.length,1)});
function bridge(payload){
 const callbacks={},storage=new Map([['puddl_image_import',JSON.stringify(payload)]]);
 const c=vm.createContext({_authUser:{id:'test'},URLSearchParams,location:{search:'?imageImport=1',pathname:'/',hash:''},document:{readyState:'complete',getElementById:()=>({style:{}})},sessionStorage:{getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},W:1000,H:600,zoom:1,panX:0,panY:0,CONNECTION_STYLES:[],cleared:false,showStatus(){},saveBeforeMapChange:async()=>true,validateMapSnapshot(){},_executeReset(){c.cleared=true},restoreSnap(s){c.draft=JSON.parse(s)},saveState(){},markUnsaved(){},fitAll(){},window:{addEventListener(n,fn){callbacks[n]=fn},history:{replaceState(){}}}});
 vm.runInContext(fs.readFileSync('image-to-map-bridge.js','utf8'),c);return {c,callbacks,storage};
}
test('malformed photo import preserves the current map and pending payload',async()=>{const {c,callbacks,storage}=bridge({...graph(),nodes:[{id:'n1',x:NaN,y:0,width:20,height:20}]});await callbacks.load();assert.equal(c.cleared,false);assert.equal(storage.has('puddl_image_import'),true)});
test('photo import preserves image aspect ratio and direction',async()=>{const g=graph();g.nodes.push({...g.nodes[0],id:'n2',x:110,y:110});g.edges=[{source:'n1',target:'n2',direction:'target_to_source'}];const {c,callbacks}=bridge({...g,imageWidth:2000,imageHeight:1000});await new Promise(r=>setImmediate(r));assert.equal(c.cleared,true);assert.equal(c.draft.edges[0].from,2);assert.equal(c.draft.edges[0].to,1);const [a,b]=c.draft.nodes;assert.equal((b.x-a.x)/(b.y-a.y),2)});
