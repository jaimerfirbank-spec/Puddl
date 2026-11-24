// Runs the browser checks one at a time, each in a fresh page, and reports each by name.
//   PUDDLE_PLAYWRIGHT_PATH=... [PUDDLE_D3_PATH=... PUDDLE_XLSX_PATH=...] node tests/run-browser.cjs [name fragment]
const {open}=require('./browser/harness.cjs'),{tests}=require('./browser/features.cjs');
(async()=>{
  const only=process.argv[2];let failed=0;
  for(const t of tests){
    if(only&&!t.name.includes(only)) continue;
    const {browser,page,errors}=await open();
    try{await t.fn({page});const bad=errors.filter(e=>!/getUser is not a function/.test(e));if(bad.length)throw new Error('page errors: '+bad.join('; '));console.log('PASS  '+t.name);}
    catch(e){failed++;console.log('FAIL  '+t.name+'\n      '+String(e.message).split('\n').slice(0,6).join(' | '));}
    await browser.close();
  }
  console.log(failed?failed+' failed':'all passed');process.exit(failed?1:0);
})();
