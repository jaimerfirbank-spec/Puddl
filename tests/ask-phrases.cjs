// How well does Ask match typed wording to the right question? Each phrasing in tests/fixtures/ask-phrases.json
// has the question it should reach. Reports three rates, and fails if a phrasing is answered with the WRONG question
// without saying so (a "guess" or "exact" that is wrong), which is the one failure that matters most.
//   PUDDLE_PLAYWRIGHT_PATH=/path/to/playwright node tests/ask-phrases.cjs [--verbose]
const {chromium}=require(process.env.PUDDLE_PLAYWRIGHT_PATH||'playwright'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),VERBOSE=process.argv.includes('--verbose');
const sets=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','ask-phrases.json'),'utf8'));
(async()=>{
  const browser=await chromium.launch(),page=await browser.newPage();
  if(process.env.PUDDLE_D3_PATH){const d3=fs.readFileSync(process.env.PUDDLE_D3_PATH,'utf8');await page.route('**/d3*.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:d3}));}
  await page.route('**/supabase-js*',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}})}})};'}));
  await page.route('**/xlsx*',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.goto('file://'+path.join(ROOT,'index.html'));await page.waitForTimeout(1500);
  let total=0,first=0,offered=0,silentWrong=[],missed=[];
  for(const [mapType,list] of Object.entries(sets)){
    const sys=mapType==='systems';
    const res=await page.evaluate(({list,sys})=>{MAP_TYPE=sys?'systems':'general';return list.map(([p,exp])=>{const d=_askDecide(p);return {p,exp,id:d.id,how:d.how,options:d.options};});},{list,sys});
    for(const r of res){
      total++;
      const direct=(r.how==='exact'||r.how==='guess')&&r.id===r.exp, shown=direct||(r.options||[]).includes(r.exp);
      if(direct) first++;
      if(shown) offered++; else missed.push(r);
      if((r.how==='exact'||r.how==='guess')&&r.id!==r.exp) silentWrong.push(r);
      if(VERBOSE&&!direct) console.log((shown?'offered ':'MISSED  ')+JSON.stringify(r.p)+' -> '+r.id+' ('+r.how+') options '+(r.options||[]).join(','));
    }
  }
  await browser.close();
  const pc=n=>Math.round(100*n/total)+'%';
  console.log(`phrasings: ${total} | answered directly and correctly: ${first} (${pc(first)}) | right question at least offered: ${offered} (${pc(offered)}) | answered with the wrong question: ${silentWrong.length}`);
  silentWrong.forEach(r=>console.log('  WRONG: '+JSON.stringify(r.p)+' expected '+r.exp+' got '+r.id+' ('+r.how+')'));
  if(!VERBOSE&&missed.length)console.log('  not found at all (run with --verbose): '+missed.map(r=>JSON.stringify(r.p)).slice(0,8).join(', ')+(missed.length>8?', ...':''));
  if(silentWrong.length)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});
