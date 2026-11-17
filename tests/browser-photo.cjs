const {chromium}=require(process.env.PUDDLE_PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/npm/@supabase/supabase-js@2',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'test'}}}),getUser:async()=>({data:{user:null}}),onAuthStateChange(){}}})};`}));
 await page.route('**/api/client-config',route=>route.fulfill({contentType:'application/javascript',body:'window.PUDDLE_CONFIG={supabaseUrl:"https://staging.supabase.co",supabaseKey:"sb_publishable_test"};'}));
 let requests=0;
 const graph={nodes:[{id:'n1',label:'First',shape:'circle',x:50,y:50,width:80,height:80,confidence:90,notes:''},{id:'n2',label:'Second',shape:'rectangle',x:550,y:550,width:80,height:80,confidence:90,notes:''}],edges:[{source:'n1',target:'n2',direction:'source_to_target',confidence:90,notes:''}],warnings:[],image_summary:'test'};
 await page.route('**/api/image-to-map',async route=>{requests++;if(requests===1)await new Promise(r=>setTimeout(r,700));try{await route.fulfill({json:{result:graph}})}catch{}});
 await page.goto('http://127.0.0.1:7894/image-to-map-prototype.html');
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=400;return c.toDataURL('image/png').split(',')[1]});
 const file={name:'drawing.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')};
 await page.locator('#file').setInputFiles(file);await page.locator('#read').click();
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('AI is reading'));
 await page.locator('#clear').click();await page.waitForTimeout(900);
 assert.equal(await page.locator('#result').isVisible(),false);assert.equal(await page.locator('#status').textContent(),'Choose a photo.');
 console.log('PASS: clearing a read ignores its late response');
 await page.locator('#file').setInputFiles(file);await page.locator('#read').click();
 await page.getByRole('button',{name:'Create a new Puddle map'}).waitFor();
 await page.getByRole('button',{name:'Create a new Puddle map'}).click();
 await page.waitForURL('**/?imageImport=1');await page.waitForFunction(()=>typeof restoreSnap==='function'&&typeof d3!=='undefined');
 await page.waitForTimeout(300);
 const result=await page.evaluate(async()=>{
  _authUser={id:'test'};window.dispatchEvent(new Event('puddl-auth-ready'));
  await new Promise(r=>setTimeout(r,200));
  return {title:mapTitle,nodes:nodes.length,edges:edges.length,pending:sessionStorage.getItem('puddl_image_import'),cloudId:_cloudMapId};
 });
 assert.deepEqual(result,{title:'drawing',nodes:2,edges:1,pending:null,cloudId:null});
 assert.deepEqual(errors,[]);console.log('PASS: reviewed photo creates a separate editable map; no browser JavaScript errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
