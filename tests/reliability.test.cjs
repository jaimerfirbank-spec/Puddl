const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('index.html','utf8');
function fn(name){
  const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));
  assert.notEqual(start,-1,name);
  return source.slice(start).split(/\n(?=(?:async )?function |(?:let|const|var) )/)[0];
}
function ctx(values,names){const c=vm.createContext(values);for(const n of names)vm.runInContext(fn(n),c);return c;}
const valid=()=>({nodes:[{id:1,x:0,y:0,label:'A'}],edges:[]});
test('all inline scripts parse, editor and generated viewer',()=>{
 for(const file of ['index.html','viewer.html'])for(const m of fs.readFileSync(file,'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(!/src=|application\/json/.test(m[1])&&m[2].trim())new vm.Script(m[2],{filename:file});
 }
});
test('invalid snapshots are rejected before changing live map or history guard',()=>{
 const nodes=[{id:99}],c=ctx({nodes,skipSave:false},['validateMapSnapshot','restoreSnap']);
 for(const d of [{}, {...valid(),nodes:[{id:1,x:Infinity,y:0}]},{...valid(),edges:[{from:1,to:7}]},{...valid(),loops:{}}]){
  assert.throws(()=>c.restoreSnap(JSON.stringify(d)));
  assert.equal(c.skipSave,false);assert.equal(c.nodes,nodes);
 }
});
test('restore exceptions always release the history guard',()=>{
 const c=ctx({skipSave:false},['validateMapSnapshot','restoreSnap']);
 assert.throws(()=>c.restoreSnap(JSON.stringify(valid()))); // missing app dependencies simulate a later failure
 assert.equal(c.skipSave,false);
});
test('undo and redo notify autosave',()=>{
 const c=ctx({histIdx:1,history:['A','B'],document:{getElementById:()=>null},restoreSnap(){},updateHistBtns(){},showStatus(){},dirty:0,markUnsaved(){this.dirty++;}},['undo','redo']);
 // Functions called in a VM do not bind this to c's proxy consistently; count via closure instead.
 let dirty=0;c.markUnsaved=()=>dirty++;
 c.undo();c.redo();assert.equal(dirty,2);
});
function cloud(overrides={}){
 const writes=[],statuses=[];
 const c=ctx({Blob,_cloudSavePromise:null,_cloudSaving:false,_cloudReady:true,_cloudGeneration:0,_cloudUpdatedAt:null,_cloudMapId:null,_cloudTeam:{team_id:'team'},_authUser:{id:'user'},_editRevision:1,_cloudNeedsSave:true,IS_SHARE_VIEW:false,inDemoMode:false,CLOUD_MAX_BYTES:5e6,MAP_TYPE:'general',mapTitle:'A',snap:()=>JSON.stringify(valid()),saveRecovery(){},showStatus:x=>statuses.push(x),...overrides},['cloudSaveCurrent']);
 c.supabaseClient={from(){const op={};const q={insert(p){op.insert=p;return q},update(p){op.update=p;return q},eq(k,v){(op.filters??=[]).push([k,v]);return q},select(){return q},single(){writes.push(op);return c.respond(op)},maybeSingle(){writes.push(op);return c.respond(op)}};return q}};
 c.respond=async()=>({data:{id:'map-a',updated_at:'v1'},error:null});
 return {c,writes,statuses};
}
test('concurrent callers share a first insert and save edits made during it',async()=>{
 const {c,writes}=cloud();let finish;
 c.respond=()=>new Promise(r=>finish=r);
 const first=c.cloudSaveCurrent();
 c._editRevision++;c._cloudNeedsSave=true;
 const second=c.cloudSaveCurrent();
 assert.equal(writes.length,1);
 c.respond=async()=>({data:{id:'map-a',updated_at:'v2'},error:null});
 finish({data:{id:'map-a',updated_at:'v1'},error:null});
 assert.deepEqual(await Promise.all([first,second]),[true,true]);
 assert.equal(writes.filter(x=>x.insert).length,1);
 assert.equal(writes.filter(x=>x.update).length,1);
 assert.equal(c._cloudNeedsSave,false);
 assert.deepEqual(writes[1].filters,[['id','map-a'],['updated_at','v1']]);
});
test('late insert cannot attach itself to another map or account',async()=>{
 const {c}=cloud();let finish;c.respond=()=>new Promise(r=>finish=r);
 const saving=c.cloudSaveCurrent();c._cloudGeneration++;c._cloudMapId='other';
 finish({data:{id:'old',updated_at:'v1'},error:null});
 assert.equal(await saving,false);assert.equal(c._cloudMapId,'other');
});
test('failed or conflicting cloud save remains pending and allows a retry',async()=>{
 const {c}=cloud({_cloudMapId:'map-a',_cloudUpdatedAt:'v1'});
 c.respond=async()=>({data:null,error:null});
 assert.equal(await c.cloudSaveCurrent(),false);assert.equal(c._cloudNeedsSave,true);
 c.respond=async()=>({data:{id:'map-a',updated_at:'v2'},error:null});
 assert.equal(await c.cloudSaveCurrent(),true);
});
test('map changes stop on cloud failure or recovery storage failure',async()=>{
 let c=ctx({clearTimeout(){},autoSaveTimer:null,saveRecovery(){},_cloudReady:true,_cloudSaving:false,_cloudNeedsSave:true,hasUnsavedChanges:false,cloudSaveCurrent:async()=>false,showStatus(){}},['saveBeforeMapChange']);
 assert.equal(await c.saveBeforeMapChange(),false);
 c.saveRecovery=()=>{throw Error('quota')};assert.equal(await c.saveBeforeMapChange(),false);
});
test('imported labels, contacts and notes remain text in hover HTML',()=>{
 const target={textContent:'',innerHTML:'',parentElement:{insertBefore(){}}};
 const c=ctx({document:{getElementById:id=>id==='hp-cat-dot'?null:target},FIELD_DEFS:[],currentMapMode:'team',edges:[],nodes:[],isNodeStale:()=>false},['escHtml','safeMapColour','renderHoverPanel']);
 c.renderHoverPanel({id:1,type:'process',label:'A',notes:'<img src=x onerror=alert(1)>',contacts:[{name:'<svg onload=alert(1)>'}]});
 assert.ok(!target.innerHTML.includes('<img'));assert.ok(!target.innerHTML.includes('<svg'));
 assert.ok(target.innerHTML.includes('&lt;img'));
});

test('imported settings cannot inject handlers through IDs or colours',()=>{
 const c=ctx({},['validateMapSnapshot']);
 for(const d of [{...valid(),categories:[{id:"x');alert(1);//"}]},{...valid(),nodes:[{id:1,x:0,y:0,colour:'red" onmouseover="x'}]},{...valid(),connectionStyles:[{id:'moderate',colour:'red; background:url(x)'}]}])assert.throws(()=>c.validateMapSnapshot(d));
 assert.doesNotThrow(()=>c.validateMapSnapshot({...valid(),connectionStyles:[{id:'moderate',colour:'rgba(0,0,0,0.5)'}]}));
});
