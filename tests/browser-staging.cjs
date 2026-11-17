const {chromium}=require(process.env.PUDDLE_PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const a=JSON.parse(fs.readFileSync(process.env.PUDDLE_STAGING_AUTH||'../staging-auth.json','utf8'));
assert.ok(process.env.PUDDLE_STAGING_REF&&process.env.PUDDLE_STAGING_REF!=='amjkbkbmqpaifqurzozg');assert.equal(a.url,`https://${process.env.PUDDLE_STAGING_REF}.supabase.co`);
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/amjkbkbmqpaifqurzozg.supabase.co/**',()=>{throw Error('Production access attempted');});
 await page.goto('http://127.0.0.1:7894');
 await page.locator('#auth-email').fill(a.email_a);await page.locator('#auth-password').fill(a.password);
 await page.locator('#auth-form button[type="submit"]').click();
 await page.waitForFunction(()=>_cloudReady===true);
 assert.equal(await page.evaluate(()=>SUPABASE_URL),a.url);console.log('PASS: browser signs in to staging, not production');
 const mapId=await page.evaluate(async()=>{
  await cloudNewMap();mapTitle='Live staging browser check';nodes.push({id:1,x:0,y:0,label:'Before edit',type:'process',pinned:true});idCtr=1;saveState();markUnsaved();autoSave();
  if(!await cloudSaveCurrent())throw Error('Initial cloud save failed');
  const id=_cloudMapId;nodes[0].label='After edit';saveState();markUnsaved();autoSave();if(!await cloudSaveCurrent())throw Error('Edit save failed');
  undo();autoSave();if(!await cloudSaveCurrent())throw Error('Undo save failed');return id;
 });
 await page.reload();await page.waitForFunction(()=>_cloudReady===true);
 const reopened=await page.evaluate(async id=>{if(!await cloudOpenMap(id))throw Error('Reopen failed');return nodes[0].label},mapId);
 assert.equal(reopened,'Before edit');console.log('PASS: real cloud save, edit, undo, reload and reopen retain the undone map');
 assert.equal(await page.evaluate(id=>cloudDeleteMap(id),mapId),true);console.log('PASS: disposable staging map cleaned up');
 assert.deepEqual(errors,[]);console.log('PASS: no browser JavaScript errors');
}finally{await browser.close()}})().catch(e=>{console.error('FAIL:',e.message);process.exit(1)});
