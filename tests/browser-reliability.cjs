const {chromium}=require(process.env.PUDDLE_PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/auth/v1/**',route=>route.abort());
 await page.goto('http://127.0.0.1:7894');await page.waitForFunction(()=>typeof restoreSnap==='function'&&typeof d3!=='undefined');
 await page.waitForTimeout(1000);
 const result=await page.evaluate(async()=>{
  const fixture={nodes:[{id:1,x:0,y:0,label:'Test <node>',type:'process',pinned:true}],edges:[],mapTitle:'Reliability check'};
  restoreSnap(JSON.stringify(fixture));saveState();markUnsaved();autoSave();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
  const background=canvas.toDataURL('image/png');restoreBackground(background);
  await new Promise(r=>setTimeout(r,50));
  window.prompt=()=> 'Before';
  saveNamedVersion(); saveNamedVersion();
  if(namedVersions.some(v=>JSON.parse(v.snap).namedVersions.length)) throw Error('Recursive versions');
  namedVersions=namedVersions.slice(0,1);
  const exported=snap();restoreSnap(JSON.stringify(fixture));restoreSnap(exported);
  await new Promise(r=>setTimeout(r,50));
  const persistence={versions:namedVersions.length,background:bgImg!==null,backgroundData:JSON.parse(snap()).bgImageData===background};
  history=[];histIdx=-1;saveState();nodes[0].label='Changed';saveState();markSaved();undo();
  const undoResult={label:nodes[0].label,dirty:hasUnsavedChanges};redo();
  const redoResult={label:nodes[0].label,dirty:hasUnsavedChanges};
  saveRecovery();
  const recoveries=listRecoveryCopies();
  if(!recoveries.length||recoveries[0].data.mapTitle!=='Reliability check') throw Error('Missing recovery copy');
  presentationStops=[{nodeId:1}];savedPresentations=[{name:'old',stops:[]}];
  _executeReset();
  const reset={nodes:nodes.length,stops:presentationStops.length,presentations:savedPresentations.length,versions:namedVersions.length,index:histIdx,background:bgImg};
  return {persistence,undoResult,redoResult,reset,exported};
 });
 assert.deepEqual(result.persistence,{versions:1,background:true,backgroundData:true});
 assert.deepEqual(result.undoResult,{label:'Test <node>',dirty:true});
 assert.deepEqual(result.redoResult,{label:'Changed',dirty:true});
 assert.deepEqual(result.reset,{nodes:0,stops:0,presentations:0,versions:0,index:-1,background:null});
 console.log('PASS: browser snapshot/background/version round trip, undo/redo, new-map reset');
 const viewer=await browser.newPage();viewer.on('pageerror',e=>errors.push('viewer: '+e.message));
 await viewer.route('**/viewer.html',async route=>{
  let html=fs.readFileSync('viewer.html','utf8');
  const data=result.exported.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  html=html.replace('<div id="puddl-viewer-data" style="display:none;"></div>','<div id="puddl-viewer-data" style="display:none;">'+data+'</div>');
  await route.fulfill({contentType:'text/html',body:html});
 });
 await viewer.goto('http://127.0.0.1:7894/viewer.html');await viewer.waitForTimeout(1500);
 const title=await viewer.locator('#viewer-title').textContent();
 assert.equal(title,'Reliability check');
 console.log('PASS: generated viewer loads exported snapshot');
 assert.deepEqual(errors,[]);console.log('PASS: no browser JavaScript errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
