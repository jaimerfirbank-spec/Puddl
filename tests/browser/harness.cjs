// Shared set-up for the browser checks: a headless Chrome with the sign-in service stubbed, the demo maps importable,
// and helpers. Run through tests/run-browser.cjs. Environment: PUDDLE_PLAYWRIGHT_PATH (optional), PUDDLE_D3_PATH and
// PUDDLE_XLSX_PATH (optional, to run without internet).
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..','..');
async function open(opts={}){
  const {chromium}=require(process.env.PUDDLE_PLAYWRIGHT_PATH||'playwright');
  const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1500,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const local=(env,pat)=>{ if(process.env[env]){ const body=fs.readFileSync(process.env[env],'utf8'); return page.route(pat,r=>r.fulfill({status:200,contentType:'application/javascript',body})); } };
  await local('PUDDLE_D3_PATH','**/d3*.js');
  if(process.env.PUDDLE_XLSX_PATH) await local('PUDDLE_XLSX_PATH','**/xlsx*'); else if(opts.noXlsx!==false&&!opts.realXlsx) await page.route('**/xlsx*',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('**/supabase-js*',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),signOut:async()=>({error:null})}})};'}));
  await page.goto('file://'+path.join(ROOT,'index.html'));await page.waitForTimeout(1800);
  return {browser,page,errors};
}
// Import a demo file as a fresh map (replace mode), skipping the duplicate review.
async function loadMap(page,file,type){
  await page.evaluate(()=>{['auth-modal','who-modal-bg'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});document.getElementById('canvas-area').style.display='block';nodes.length=0;edges.length=0;idCtr=0;COLOUR_BY='';window.showOpenFilePicker=undefined;openImportModal();});
  await page.evaluate(t=>{MAP_TYPE=t||'general';},type);
  await page.setInputFiles('#import-file-input',path.join(ROOT,file));await page.waitForTimeout(1500);
  await page.evaluate(()=>runImportMapper());await page.waitForTimeout(400);
  await page.evaluate(()=>{try{skipAllDupes();}catch(e){}confirmImport();});await page.waitForTimeout(1800);
}
const CARRFIELD='demo/carrfield-neighbourhood.csv',YORKSHIRE='demo/south-yorkshire-partnerships.csv',SYSTEMS='demo/systems-service-demand.csv';
module.exports={ROOT,open,loadMap,CARRFIELD,YORKSHIRE,SYSTEMS};
