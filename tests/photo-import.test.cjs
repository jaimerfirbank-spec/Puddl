const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const api=fs.readFileSync('api/image-to-map.js','utf8').replace('export default ','');
const graph=()=>({nodes:[{id:'n1',label:'A',shape:'circle',x:10,y:10,width:50,height:50}],edges:[],warnings:[],image_summary:'A node'});
function server(fetch){
 const context=vm.createContext({process:{env:{OPENAI_API_KEY:'test',SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public-test'}},fetch,AbortSignal,console:{error(){}},Buffer});vm.runInContext(api,context);
 return async(req)=>{let result;const res={setHeader(){},end(body){result={status:this.statusCode,...JSON.parse(body)}}};await context.handler(req,res);return result};
}
const request=()=>({method:'POST',headers:{authorization:'Bearer test'},body:{image:'data:image/png;base64,iVBORw0KGgo='}});
test('photo scripts parse',()=>{for(const file of ['image-to-map-bridge.js','lens/reviews.js','lens/inbox.js','lens/shared-review.js'])new vm.Script(fs.readFileSync(file,'utf8'));for(const m of fs.readFileSync('image-to-map-prototype.html','utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(m[1]);});
test('shared reviews are time limited and require a signed private photo',()=>{const source=fs.readFileSync('lens/shared-review.js','utf8');assert.match(source,/expiresAt/);assert.match(source,/storage\\\/v1\\\/object\\\/sign\\\/puddle-lens/);assert.doesNotMatch(source,/innerHTML/)});
test('unauthenticated photo requests never call a provider',async()=>{const handler=server(()=>{throw Error('network called')});const req=request();req.headers={};assert.equal((await handler(req)).status,401)});
test('allowance failure stops before the paid reader',async()=>{let calls=0;const handler=server(async()=>{calls++;return calls===1?{ok:true,json:async()=>({id:'user'})}:{ok:true,json:async()=>false}});assert.equal((await handler(request())).status,429);assert.equal(calls,2)});
test('invalid graph references are rejected instead of handed to the editor',async()=>{let calls=0;const bad=graph();bad.edges=[{source:'n1',target:'missing',direction:'source_to_target'}];const handler=server(async()=>{calls++;return{ok:true,json:async()=>calls===1?{id:'u'}:calls===2?true:{output_text:JSON.stringify(bad)}}});assert.equal((await handler(request())).status,502)});
test('authorized reads run a dedicated high-effort edge verification pass',async()=>{let calls=0;const providerBodies=[];const first=graph(),verified={edges:[{source:'n1',target:'n1',direction:'unclear',confidence:55,notes:'direction unclear'}],warnings:['Checked arrowhead separately']};const handler=server(async(_url,options={})=>{calls++;if(calls>2)providerBodies.push(JSON.parse(options.body));return{ok:true,json:async()=>calls===1?{id:'u'}:calls===2?true:{output_text:JSON.stringify(calls===3?first:verified)}}});const response=await handler(request());assert.equal(response.status,200);assert.equal(response.result.nodes.length,1);assert.equal(response.result.edges[0].direction,'unclear');assert.equal(response.result.warnings.at(-1),'Checked arrowhead separately');assert.equal(providerBodies.length,2);assert.equal(providerBodies[1].reasoning.effort,'high');assert.match(providerBodies[1].instructions,/crossing another line is not a junction/);assert.match(providerBodies[1].instructions,/Fixed nodes/);});
function bridge(payload,ready=true){
 const callbacks={},storage=new Map([['puddl_image_import',JSON.stringify(payload)]]);
 const c=vm.createContext({_cloudAuthInitialized:ready,_authUser:{id:'test'},URLSearchParams,location:{search:'?imageImport=1',pathname:'/',hash:''},document:{readyState:'complete',getElementById:()=>({style:{}})},sessionStorage:{getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},W:1000,H:600,zoom:1,panX:0,panY:0,CONNECTION_STYLES:[],cleared:false,showStatus(){},saveBeforeMapChange:async()=>true,validateMapSnapshot(){},_executeReset(){c.cleared=true},restoreSnap(s){c.draft=JSON.parse(s)},saveState(){},markUnsaved(){},fitAll(){},window:{addEventListener(n,fn){callbacks[n]=fn},history:{replaceState(){}}}});
 vm.runInContext(fs.readFileSync('image-to-map-bridge.js','utf8'),c);return {c,callbacks,storage};
}
test('malformed photo import preserves the current map and pending payload',async()=>{const {c,callbacks,storage}=bridge({...graph(),nodes:[{id:'n1',x:NaN,y:0,width:20,height:20}]});await callbacks.load();assert.equal(c.cleared,false);assert.equal(storage.has('puddl_image_import'),true)});
test('photo import preserves image aspect ratio and direction',async()=>{const g=graph();g.nodes.push({...g.nodes[0],id:'n2',x:110,y:110});g.edges=[{source:'n1',target:'n2',direction:'target_to_source'}];const {c,callbacks}=bridge({...g,imageWidth:2000,imageHeight:1000});await new Promise(r=>setImmediate(r));assert.equal(c.cleared,true);assert.equal(c.draft.edges[0].from,2);assert.equal(c.draft.edges[0].to,1);const [a,b]=c.draft.nodes;assert.equal((b.x-a.x)/(b.y-a.y),2)});
const configSource=fs.readFileSync('api/client-config.js','utf8').replace('export default ','');
function clientConfig(env){const c=vm.createContext({process:{env},Buffer,URL});vm.runInContext(configSource,c);let output;const res={setHeader(){},end(body){output={status:this.statusCode,body}}};c.handler({},res);return output;}
test('runtime config exposes only publishable keys and rejects a service-role key',()=>{
 const publicResult=clientConfig({SUPABASE_URL:'https://staging.supabase.co',SUPABASE_ANON_KEY:'sb_publishable_test',OPENAI_API_KEY:'private-openai'});
 assert.equal(publicResult.status,200);assert.ok(!publicResult.body.includes('private-openai'));
 const service='x.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.x';
 const denied=clientConfig({SUPABASE_URL:'https://staging.supabase.co',SUPABASE_ANON_KEY:service});assert.equal(denied.status,503);assert.ok(!denied.body.includes(service));
});
test('incomplete preview config fails closed instead of using the production project',()=>{
 assert.equal(clientConfig({}).status,503);
 const source=fs.readFileSync('index.html','utf8');
 assert.ok(source.includes("location.hostname==='puddl.vercel.app'?"));
});

test('photo import waits until account and team initialization finish',async()=>{const {c,callbacks}=bridge(graph(),false);await callbacks.load();assert.equal(c.cleared,false);c._cloudAuthInitialized=true;await callbacks['puddl-auth-ready']();assert.equal(c.cleared,true)});

test('dense photo imports leave room for standard node sizes',async()=>{
 const g=graph();g.nodes.push({...g.nodes[0],id:'n2',x:65});
 const {c}=bridge({...g,imageWidth:800,imageHeight:600});await new Promise(r=>setImmediate(r));
 assert.ok(c.draft.nodes[1].x-c.draft.nodes[0].x>=120);
});
test('150-node photo-shaped payload imports without dropping nodes or connections',async()=>{
 const nodes=Array.from({length:150},(_,i)=>({id:'n'+i,label:'TEST '+i,shape:'circle',x:30+(i%15)*62,y:30+Math.floor(i/15)*92,width:20,height:20}));
 const edges=nodes.map((n,i)=>({source:n.id,target:nodes[(i+1)%150].id,direction:'source_to_target'}));
 const {c}=bridge({nodes,edges,imageWidth:1400,imageHeight:2000});await new Promise(r=>setImmediate(r));
 assert.equal(c.draft.nodes.length,150);assert.equal(c.draft.edges.length,150);
 for(let i=0;i<150;i++)for(let j=i+1;j<150;j++)assert.ok(Math.abs(c.draft.nodes[i].x-c.draft.nodes[j].x)>=96||Math.abs(c.draft.nodes[i].y-c.draft.nodes[j].y)>=112);
});
