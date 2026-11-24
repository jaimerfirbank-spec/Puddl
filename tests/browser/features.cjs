// Browser checks for the features built on 24 November. Each test states what it expects from the Carrfield demo map
// (130 invented organisations); several figures were checked against an independent calculation in Python.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {open,loadMap,ROOT,CARRFIELD,YORKSHIRE,SYSTEMS}=require('./harness.cjs');
const tests=[];const test=(name,fn)=>tests.push({name,fn});

test('side panel: opens at 30%, four tabs, pop out and dock, fold away',async({page})=>{
  await loadMap(page,CARRFIELD);
  await page.click('#btn-search-toggle');await page.waitForTimeout(400);
  const w=await page.evaluate(()=>Math.round(document.getElementById('side-dock').getBoundingClientRect().width/innerWidth*100));
  assert.equal(w,30);
  for(const t of ['ask','filter','report','glance']){await page.click('#dock-tab-'+t);assert.ok(await page.evaluate(t=>document.getElementById('dock-pane-'+t).classList.contains('on'),t));}
  await page.click('#dock-tab-ask');await page.click('#dock-popout');
  assert.ok(await page.evaluate(()=>document.getElementById('ask-puddl-widget').classList.contains('open')));
  await page.evaluate(()=>dockBringBackAsk());
  assert.ok(await page.evaluate(()=>!!document.querySelector('#dock-pane-ask #ask-puddl-body')));
  await page.evaluate(()=>dockFold());
  assert.equal(await page.evaluate(()=>document.getElementById('side-dock').getBoundingClientRect().width),0);
});
test('focus: 22, 73 and 100 of 130 at one, two and three steps; hidden items cannot be hit; Escape leaves',async({page})=>{
  await loadMap(page,CARRFIELD);await page.evaluate(()=>rearrangeLayout());await page.waitForTimeout(3000);
  const id=await page.evaluate(()=>nodes.find(n=>n.label==='Carrfield Academy').id);
  const shown=d=>page.evaluate(([i,d])=>{focusOnNode(i,d);return FOCUS_VIEW.shown;},[id,d]);
  assert.equal(await shown(1),22);assert.equal(await shown(2),73);assert.equal(await shown(3),100);
  await shown(1);
  assert.equal(await page.evaluate(()=>{const h=nodes.find(n=>_focusHidden.has(n.id)),r=nodeAt(h.x*zoom+panX,h.y*zoom+panY);return !!(r&&r.id===h.id);}),false);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>FOCUS_VIEW),null);
});
test('names: about 35 kept at the full view, the biggest named, no two overlap, all show with thinning off',async({page})=>{
  await loadMap(page,CARRFIELD);await page.evaluate(()=>{rearrangeLayout();});await page.waitForTimeout(3000);
  const r=await page.evaluate(()=>{fitAll();const top=_labelPriority().slice(0,3).every(n=>_labelSet.has(n.id));const bx=[..._labelSet].map(i=>nodes.find(n=>n.id===i)).filter(n=>!insideLabel(n)).map(n=>labelBelowBox(n,_lblScale(n)));let o=0;for(let i=0;i<bx.length;i++)for(let j=i+1;j<bx.length;j++){const a=bx[i],c=bx[j];if(a.x0<c.x1&&a.x1>c.x0&&a.y0<c.y1&&a.y1>c.y0)o++;}return {n:_labelSet.size,top,o};});
  assert.ok(r.n>=20&&r.n<=60,'names '+r.n);assert.ok(r.top);assert.equal(r.o,0);
  assert.equal(await page.evaluate(()=>{setLabelThin(false);return _labelSet;}),null);
});
test('communities: nine on Carrfield covering all 130, one colour each, five on South Yorkshire',async({page})=>{
  await loadMap(page,CARRFIELD);
  const c=await page.evaluate(()=>{setColourBy('community');const C=_communityRefresh();let bad=0;C.list.forEach(g=>g.ids.forEach(i=>{if(nodeFill(nodes.find(n=>n.id===i))!==g.colour)bad++;}));return {k:C.list.length,total:C.list.reduce((a,g)=>a+g.size,0)+C.lone.length,bad};});
  assert.equal(c.k,9);assert.equal(c.total,130);assert.equal(c.bad,0);
  await loadMap(page,YORKSHIRE);
  assert.equal(await page.evaluate(()=>_communityRefresh().list.length),5);
});
test('arrow size and gradient: saved with the map and reset',async({page})=>{
  await loadMap(page,SYSTEMS,'systems');
  const r=await page.evaluate(()=>{ARROW_SIZE=1.8;EDGE_GRADIENT=true;const s=snap();ARROW_SIZE=1;EDGE_GRADIENT=false;restoreSnap(s);const a={arrow:ARROW_SIZE,grad:EDGE_GRADIENT};resetEdgeLook();return {a,b:{arrow:ARROW_SIZE,grad:EDGE_GRADIENT}};});
  assert.deepEqual(r.a,{arrow:1.8,grad:true});assert.deepEqual(r.b,{arrow:1,grad:false});
});
test('refresh: two changes and one missing; applying marks it; refreshing from the original brings it back',async({page})=>{
  await loadMap(page,CARRFIELD);
  const run=async(file)=>{await page.evaluate(()=>startSheetRefresh());await page.waitForTimeout(400);await page.setInputFiles('#import-file-input',path.join(ROOT,file));await page.waitForTimeout(2200);return page.evaluate(()=>document.getElementById('import-summary-body').innerText);};
  const t=await run('tests/fixtures/carrfield-edited.csv');
  assert.match(t,/2 existing nodes changed/);assert.match(t,/Carrfield Fishing Club/);assert.match(t,/127 unchanged/);
  await page.evaluate(()=>confirmImport());await page.waitForTimeout(800);
  assert.deepEqual(await page.evaluate(()=>nodes.filter(n=>n.missingSince).map(n=>n.label)),['Carrfield Fishing Club']);
  const t2=await run(CARRFIELD);assert.match(t2,/back in the spreadsheet/);
  await page.evaluate(()=>confirmImport());await page.waitForTimeout(800);
  assert.equal(await page.evaluate(()=>nodes.filter(n=>n.missingSince).length),0);
});
test('google sheet link: refuses a bad or private link, reads a shared one, then refreshes without a file',async({page})=>{
  const csv=fs.readFileSync(path.join(ROOT,CARRFIELD),'utf8').replace(/^﻿/,''),edited=fs.readFileSync(path.join(ROOT,'tests/fixtures/carrfield-edited.csv'),'utf8');
  let mode='good';
  await page.route('https://docs.google.com/**',r=>mode==='private'?r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html>sign in accounts.google.com</html>'}):r.fulfill({status:200,contentType:'text/csv',headers:{'access-control-allow-origin':'*'},body:mode==='edited'?edited:csv}));
  await page.evaluate(()=>{['auth-modal','who-modal-bg'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});document.getElementById('canvas-area').style.display='block';nodes.length=0;edges.length=0;idCtr=0;window.showOpenFilePicker=undefined;openImportModal();});
  await page.fill('#import-gsheet-url','https://example.com/x');await page.evaluate(()=>loadGoogleSheet());
  assert.match(await page.evaluate(()=>document.getElementById('import-status-text').textContent),/does not look like a Google Sheet/);
  mode='private';await page.fill('#import-gsheet-url','https://docs.google.com/spreadsheets/d/AbC123xyzAbC123xyz/edit#gid=0');await page.evaluate(()=>loadGoogleSheet());
  assert.match(await page.evaluate(()=>document.getElementById('import-status-text').textContent),/would not share/);
  mode='good';await page.evaluate(()=>loadGoogleSheet());await page.waitForTimeout(1000);
  await page.evaluate(()=>runImportMapper());await page.waitForTimeout(400);await page.evaluate(()=>confirmImport());await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(()=>nodes.length),130);
  mode='edited';await page.evaluate(()=>startSheetRefresh());await page.waitForTimeout(2500);
  assert.match(await page.evaluate(()=>document.getElementById('import-summary-body').innerText),/Carrfield Fishing Club/);
  const snapped=await page.evaluate(()=>JSON.parse(snap()).linkedSheet.url);assert.match(snapped,/docs\.google\.com/);
});
test('saving: rename then save, storage full, copies dropped on switch (against a stand-in database)',async({page})=>{
  await loadMap(page,CARRFIELD);
  const r=await page.evaluate(async()=>{
    window.__rows=[];let clock=1;const tick=()=>'2026-11-24T10:00:'+String(clock++).padStart(2,'0')+'.000000+00:00';
    supabaseClient={auth:{signOut:async()=>({error:null})},from(){const st={op:null,payload:null,filters:[]};const run=()=>{const rows=__rows.filter(r=>st.filters.every(([k,v])=>r[k]===v));if(st.op==='insert'){const row={id:'m'+(__rows.length+1),updated_at:tick(),...st.payload};__rows.push(row);return {data:row,error:null};}if(st.op==='update'){if(!rows.length)return {data:null,error:null};Object.assign(rows[0],st.payload,{updated_at:tick()});return {data:rows[0],error:null};}return {data:rows[0]||null,error:null};};const q={insert(p){st.op='insert';st.payload=p;return q},update(p){st.op='update';st.payload=p;return q},delete(){st.op='delete';return q},eq(k,v){st.filters.push([k,v]);return q},select(){if(!st.op)st.op='select';return q},single(){return Promise.resolve(run())},maybeSingle(){return Promise.resolve(run())},then(a,b){return Promise.resolve(run()).then(a,b)}};return q;}};
    _authUser={id:'u1'};_cloudTeam={team_id:'t1',maps_per_user:25};_cloudReady=true;
    markUnsaved();const first=await cloudSaveCurrent();
    await cloudRenameMap(_cloudMapId,'Renamed');nodes[1].label='After rename';saveState();markUnsaved();const afterRename=await cloudSaveCurrent();
    const orig=Storage.prototype.setItem;Storage.prototype.setItem=function(){const e=new Error('full');e.name='QuotaExceededError';throw e;};
    nodes[2].label='Edit while full';saveState();markUnsaved();autoSave();await new Promise(r=>setTimeout(r,400));const savedWhileFull=__rows[0].data.nodes[2].label;
    const switched=await saveBeforeMapChange();Storage.prototype.setItem=orig;
    markUnsaved();autoSave();await new Promise(r=>setTimeout(r,400));const kept=Object.keys(localStorage).filter(k=>k.startsWith('puddl_recovery_')).length;
    await saveBeforeMapChange();const dropped=Object.keys(localStorage).filter(k=>k.startsWith('puddl_recovery_')).length;
    return {first,afterRename,savedWhileFull,switched,kept,dropped};
  });
  assert.equal(r.first,true);assert.equal(r.afterRename,true);assert.equal(r.savedWhileFull,'Edit while full');assert.equal(r.switched,true);assert.equal(r.kept,1);assert.equal(r.dropped,0);
});
test('ask: new questions give the checked figures on Carrfield',async({page})=>{
  await loadMap(page,CARRFIELD);
  const a=await page.evaluate(()=>{const g=id=>_askAnswerFor(id,'','').answer;const byName=(id,t)=>{const d=_askDecide(t);return _askAnswerFor(d.id,'','',d.args).answer;};return {lose3:g('lose3'),singles:g('singles'),comm:g('communities'),reach:g('reach'),conn:byName('x','how many connections does the Academy have'),leave:byName('x','what happens if the Volunteer Centre leaves'),path:byName('x','how is the Fishing Club connected to the Family Hub')};});
  assert.match(a.lose3,/49 more organisations would be cut off.*3 separate parts/);assert.match(a.singles,/^46 /);assert.match(a.comm,/^9 communities/);
  assert.match(a.reach,/Carrfield Academy reaches everyone fastest: on average 2\.71 steps/);
  assert.match(a.conn,/Carrfield Academy has 21 connections/);assert.match(a.leave,/30 organisations would be cut off/);assert.match(a.path,/3 steps/);
});
test('report: choosing questions shows only those, and the full report switch works',async({page})=>{
  await loadMap(page,CARRFIELD);
  const r=await page.evaluate(async()=>{openAskMap();for(const q of ['Who is isolated?','Who holds this map together?']){document.getElementById('ask-map-input').value=q;runAskMap();}openReport();const heads=()=>[...document.querySelectorAll('#report-body h4, #report-body summary')].map(h=>h.textContent.trim());const a=heads();setReportMode(false);const b=heads();return {a,b};});
  assert.ok(r.a.some(h=>/Your selected questions/.test(h)));assert.ok(!r.a.some(h=>/Key charts/.test(h)));assert.ok(r.b.some(h=>/Key charts/.test(h)));
});
test('shared maps list: badges, who sees Share, Make private and Delete, and a friendly message if the database update is missing',async({page})=>{
  await loadMap(page,CARRFIELD);
  const r=await page.evaluate(async()=>{
    const rows=[{id:'m1',title:'My private',kind:'general',updated_at:'2026-11-24T10:00:00Z',scope:'personal',owner_id:'me'},
                {id:'m2',title:'I shared this',kind:'general',updated_at:'2026-11-24T10:00:00Z',scope:'team',owner_id:'me'},
                {id:'m3',title:'A colleague shared this',kind:'general',updated_at:'2026-11-24T10:00:00Z',scope:'team',owner_id:'ben'}];
    const calls=[];let missing=false;
    supabaseClient={from(){return {select(){return this},order(){return Promise.resolve({data:rows,error:null})},eq(){return this},maybeSingle(){return Promise.resolve({data:{updated_at:'2026-11-24T11:00:00Z'},error:null})}};},
      rpc(name,args){calls.push([name,args.p_map]);return Promise.resolve(missing?{error:{message:'Could not find the function public.share_map',code:'PGRST202'}}:{error:null});}};
    _authUser={id:'me'};_cloudReady=true;window.confirm=()=>true;
    const buttonsFor=async role=>{_cloudTeam={team_id:'t',name:'Team One',role,maps_per_user:25};await openMyMaps();return [...document.querySelectorAll('#cloud-maps-list > div')].filter(d=>d.querySelector('button')).map(d=>({title:d.querySelectorAll('div')[1].textContent,sub:d.querySelectorAll('div')[2].textContent,buttons:[...d.querySelectorAll('button')].map(b=>b.textContent)}));};
    const asMember=await buttonsFor('member'), asOwner=await buttonsFor('owner');
    const ok=await cloudShareMap('m1',true);const ok2=await cloudShareMap('m2',false);
    missing=true;const bad=await cloudShareMap('m1',true);const status=(document.getElementById('status-text')||{}).textContent||'';
    return {asMember,asOwner,ok,ok2,bad,calls,count:document.getElementById('cloud-maps-count').textContent};
  });
  const by=(list,t)=>list.find(x=>x.title===t);
  assert.deepEqual(by(r.asMember,'My private').buttons.filter(b=>b!=='Open'&&b!=='Rename'),['Share','Delete']);
  assert.deepEqual(by(r.asMember,'I shared this').buttons.filter(b=>b!=='Open'&&b!=='Rename'),['Make private']);
  assert.deepEqual(by(r.asMember,'A colleague shared this').buttons.filter(b=>b!=='Open'&&b!=='Rename'),[]);
  assert.match(by(r.asMember,'I shared this').sub,/Shared with your team \(you made it\)/);
  assert.deepEqual(by(r.asOwner,'A colleague shared this').buttons.filter(b=>b!=='Open'&&b!=='Rename'),['Make private','Delete']);
  assert.equal(r.ok,true);assert.equal(r.ok2,true);assert.equal(r.bad,false);
  assert.deepEqual(r.calls.slice(0,2),[['share_map','m1'],['unshare_map','m2']]);
  assert.match(r.count,/1 of 25 private, plus shared/);
});

test('view-only member: no editing buttons, nothing saved, and a plain notice; the team list works for owner and member',async({page})=>{
  await loadMap(page,CARRFIELD);
  const r=await page.evaluate(async()=>{
    const rows=[{id:'m3',title:'Shared by Ann',kind:'general',updated_at:'2026-11-24T10:00:00Z',scope:'team',owner_id:'ann'}];
    const calls=[];let writes=0;
    const roster=[{user_id:'ann',email:'ann@x',role:'owner'},{user_id:'me',email:'me@x',role:'viewer'},{user_id:'ben',email:'ben@x',role:'member'}];
    supabaseClient={from(){writes++;return {select(){return this},order(){return Promise.resolve({data:rows,error:null})},upsert(){writes++;return Promise.resolve({})},update(){writes++;return this},insert(){writes++;return this}};},
      rpc(name,args){calls.push([name,args.p_user||'',args.p_role||'']);return Promise.resolve(name==='team_roster'?{data:roster,error:null}:{error:null});}};
    _authUser={id:'me'};_cloudReady=true;window.confirm=()=>true;
    _cloudTeam={team_id:'t',name:'Team One',role:'viewer',seats:5,maps_per_user:25};cloudShowViewOnly();
    await openMyMaps();
    const buttons=[...document.querySelectorAll('#cloud-maps-list button')].map(b=>b.textContent);
    const newBtnHidden=document.getElementById('cloud-newmap-btn').style.display==='none';
    const pill=(document.getElementById('viewonly-pill')||{}).textContent||'';
    hasUnsavedChanges=false; const before=writes; markUnsaved(); const saved=await cloudSaveCurrent(); const unsaved=hasUnsavedChanges; const wrote=writes-before;
    await openTeamPanel(); await new Promise(r=>setTimeout(r,50));
    const viewerRows=[...document.querySelectorAll('#team-list > div')].map(d=>({text:d.textContent,select:!!d.querySelector('select'),remove:!!d.querySelector('button')}));
    const viewerSeats=document.getElementById('team-seats').textContent;
    _cloudTeam.role='owner'; cloudShowViewOnly(); const pillGone=!document.getElementById('viewonly-pill');
    await openTeamPanel(); await new Promise(r=>setTimeout(r,50));
    const ownerRows=[...document.querySelectorAll('#team-list > div')].map(d=>({text:d.textContent,select:!!d.querySelector('select'),remove:!!d.querySelector('button')}));
    const benRow=[...document.querySelectorAll('#team-list > div')].find(d=>d.textContent.includes('ben@x'));
    benRow.querySelector('select').value='viewer'; benRow.querySelector('select').onchange(); await new Promise(r=>setTimeout(r,50));
    const benRow2=[...document.querySelectorAll('#team-list > div')].find(d=>d.textContent.includes('ben@x'));
    benRow2.querySelector('button').onclick(); await new Promise(r=>setTimeout(r,50));
    return {buttons,newBtnHidden,pill,saved,unsaved,wrote,viewerRows,viewerSeats,pillGone,ownerRows,calls};
  });
  assert.deepEqual(r.buttons,['Open']);
  assert.ok(r.newBtnHidden);
  assert.match(r.pill,/View only/);
  assert.equal(r.saved,true);assert.equal(r.unsaved,false);assert.equal(r.wrote,0);
  assert.ok(r.viewerRows.every(x=>!x.select&&!x.remove));
  assert.match(r.viewerRows.find(x=>x.text.includes('me@x')).text,/\(you\).*View only/);
  assert.match(r.viewerSeats,/3 of 5 places used/);
  assert.ok(r.pillGone);
  assert.deepEqual(r.ownerRows.map(x=>[x.select,x.remove]),[[false,false],[true,true],[true,true]]);
  assert.deepEqual(r.calls.filter(c=>c[0]!=='team_roster'),[['set_member_role','ben','viewer'],['remove_team_member','ben','']]);
});

test('last saved by: shown on shared maps, and a clash says who saved first and asks once',async({page})=>{
  await loadMap(page,CARRFIELD);
  const r=await page.evaluate(async()=>{
    const rows=[{id:'m1',title:'Mine',kind:'general',updated_at:'2026-11-24T10:00:00Z',scope:'personal',owner_id:'me',updated_by:'me'},
                {id:'m2',title:'Shared by Ann',kind:'general',updated_at:'2026-11-24T10:00:00Z',scope:'team',owner_id:'ann',updated_by:'ben'},
                {id:'m3',title:'Old shared',kind:'general',updated_at:'2026-11-24T10:00:00Z',scope:'team',owner_id:'ann',updated_by:'gone'},
                {id:'m4',title:'Shared, nobody recorded',kind:'general',updated_at:'2026-11-24T10:00:00Z',scope:'team',owner_id:'ann',updated_by:null}];
    let oldDb=false,clash=true;
    const roster=[{user_id:'ann',email:'ann@x',role:'owner'},{user_id:'me',email:'me@x',role:'member'},{user_id:'ben',email:'ben@x',role:'member'}];
    supabaseClient={from(){const q={select(c){q.cols=c;return q},order(){return Promise.resolve(oldDb&&/updated_by/.test(q.cols)?{data:null,error:{message:'column maps.updated_by does not exist'}}:{data:oldDb?rows.map(({updated_by,...r})=>r):rows,error:null})},
        update(){q.upd=true;return q},eq(){return q},maybeSingle(){return Promise.resolve(q.upd?{data:clash?null:{id:'m2',updated_at:'v2'},error:null}:{data:{updated_at:'2026-11-24T14:32:00Z',updated_by:'ben'},error:null})}};return q;},
      rpc(name){return Promise.resolve(name==='team_roster'?{data:roster,error:null}:{error:null});}};
    _authUser={id:'me'};_cloudReady=true;_cloudTeam={team_id:'t',name:'T',role:'member',maps_per_user:25};
    await openMyMaps();
    const subs=[...document.querySelectorAll('#cloud-maps-list > div')].map(d=>d.querySelectorAll('div')[2]&&d.querySelectorAll('div')[2].textContent).filter(Boolean);
    oldDb=true; await openMyMaps(); const subsOld=[...document.querySelectorAll('#cloud-maps-list > div')].map(d=>d.querySelectorAll('div')[2]&&d.querySelectorAll('div')[2].textContent).filter(Boolean);
    // a clash on a shared map
    let asked=[],saved=0; window.confirm=m=>{asked.push(m);return true;}; window.saveFile=()=>{saved++;};
    _cloudMapId='m2';_cloudUpdatedAt='v1';_editRevision++;
    const ok1=await cloudSaveCurrent(); await new Promise(r=>setTimeout(r,80));
    _editRevision++; const ok2=await cloudSaveCurrent(); await new Promise(r=>setTimeout(r,80));
    return {subs,subsOld,ok1,ok2,asked,saved};
  });
  assert.match(r.subs.find(x=>x.includes('Shared with your team')),/last saved .* by ben@x$/);
  assert.ok(r.subs.some(x=>/by someone no longer in the team$/.test(x)));
  assert.ok(r.subs.some(x=>/Shared with your team \(you made it\)/.test(x))===false);
  assert.ok(r.subs.some(x=>/last saved [^b]*$/.test(x)&&x.includes('Shared with your team')),'no name when none was recorded');
  assert.ok(r.subsOld.length===4&&r.subsOld.every(x=>!/ by /.test(x)),'still lists maps when the database update is missing');
  assert.equal(r.ok1,false);assert.equal(r.ok2,false);
  assert.equal(r.asked.length,1,'asks once, not on every retry');
  assert.match(r.asked[0],/ben@x saved changes to this map at \d\d:\d\d, after you opened it/);
  assert.equal(r.saved,1);
});
module.exports={tests};
