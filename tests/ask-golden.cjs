// Ask Puddle golden record: every question's answer, meaning and highlight on the three demo maps, plus how
// 40 typed phrasings are matched. Run after changing anything in the Ask question list.
//   PUDDLE_PLAYWRIGHT_PATH=/path/to/playwright PUDDLE_D3_PATH=/path/to/d3.min.js node tests/ask-golden.cjs
//   add --write to regenerate tests/fixtures/ask-golden.json after you meant to change an answer
// Existing answers and meanings must not change. New questions may appear. A changed match for a typed
// phrasing is reported, because adding a question can legitimately take a phrase; pass --strict to fail on it.
const {chromium}=require(process.env.PUDDLE_PLAYWRIGHT_PATH||'playwright'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),FIX=path.join(__dirname,'fixtures','ask-golden.json');
const WRITE=process.argv.includes('--write'),STRICT=process.argv.includes('--strict');
const PHRASES=['Who holds this map together?','most amount of connections','highest number of connections','disconnected','who do we rely on','connections','banana','Who is isolated?','weak links','where are the strong ones','what changed','largest group','how dense is it','who is the biggest go-between','bottleneck','feedback loops','root cause','end result','reinforcing','balancing','missing signs','who has most arrows coming in','who drives the most','tell me about this map','summary','islands','clusters','who is alone','least connected','fewest links','what if we lost the centre','how connected is it overall','','xyz qwerty','sign','source of the problem','vicious circle','self-correcting','who is popular','key organisation'];
const MAPS=[['carrfield','demo/carrfield-neighbourhood.csv',null,['2026-03-01','2026-10-01']],['yorkshire','demo/south-yorkshire-partnerships.csv',null,['','']],['systems','demo/systems-service-demand.csv','systems',['','']]];
(async()=>{
  const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(process.env.PUDDLE_D3_PATH){const d3=fs.readFileSync(process.env.PUDDLE_D3_PATH,'utf8');await page.route('**/d3*.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:d3}));}
  await page.route('**/supabase-js*',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}})}})};'}));
  await page.route('**/xlsx*',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.goto('file://'+path.join(ROOT,'index.html'));await page.waitForTimeout(1800);
  const got={};
  for(const [label,file,type,dates] of MAPS){
    await page.evaluate(()=>{['auth-modal','who-modal-bg'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});document.getElementById('canvas-area').style.display='block';nodes.length=0;edges.length=0;idCtr=0;openImportModal();});
    await page.evaluate(t=>{MAP_TYPE=t||'general';},type);
    await page.setInputFiles('#import-file-input',path.join(ROOT,file));await page.waitForTimeout(1500);
    await page.evaluate(()=>runImportMapper());await page.waitForTimeout(400);
    await page.evaluate(()=>{try{skipAllDupes();}catch(e){}confirmImport();});await page.waitForTimeout(1800);
    got[label]=await page.evaluate(({dates,PHRASES})=>{
      const norm=r=>({answer:r.answer,evidence:r.evidence,focus:r.focus?{label:r.focus.label,ids:[...r.focus.ids].sort((a,b)=>a-b),pairs:[...r.focus.pairs].map(String).sort(),sec:[...(r.focus.sec||[])].sort((a,b)=>a-b)}:null});
      const res={questions:_askQuestions().map(q=>[q.id,q.cat,q.q]),answers:{},meanings:{},decide:{},rank:{}};
      _askQuestions().forEach(q=>{res.answers[q.id]=norm(_askAnswerFor(q.id,dates[0],dates[1]));res.meanings[q.id]=_askMeaning(q.id);});
      res.answers.unknown=norm(_askAnswerFor('unknown','',''));res.meanings.unknown=_askMeaning('unknown');
      PHRASES.forEach(p=>{res.decide[p]=_askDecide(p);res.rank[p]=_askRank(p);});
      return res;
    },{dates,PHRASES});
  }
  await browser.close();
  if(errors.length){console.error('page errors:',errors);process.exit(1);}
  if(WRITE){fs.writeFileSync(FIX,JSON.stringify(got,null,1));console.log('wrote',FIX);return;}
  const want=JSON.parse(fs.readFileSync(FIX,'utf8')),bad=[],soft=[],added=[];
  for(const m of Object.keys(want)){
    for(const part of ['answers','meanings']) for(const k of Object.keys(want[m][part])) if(JSON.stringify(want[m][part][k])!==JSON.stringify(got[m][part][k])) bad.push(m+' '+part+' '+k);
    for(const part of ['decide','rank']) for(const k of Object.keys(want[m][part])) if(JSON.stringify(want[m][part][k])!==JSON.stringify(got[m][part][k])) soft.push(m+' '+part+' "'+k+'"');
    const had=new Set(want[m].questions.map(q=>q[0]));got[m].questions.forEach(q=>{if(!had.has(q[0]))added.push(m+': '+q[0]);});
  }
  if(added.length)console.log('new questions (not in the golden record yet):',added.join(', '));
  if(soft.length)console.log('typed-question matching changed for:',soft.join('; '));
  if(bad.length||(STRICT&&soft.length)){console.error('FAIL: changed',bad.join('; '));process.exit(1);}
  console.log('PASS: every existing answer and meaning is unchanged on the three demo maps');
})().catch(e=>{console.error(e);process.exit(1)});
