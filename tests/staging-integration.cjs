// Uses synthetic credentials in an untracked file; never target production.
const fs=require('node:fs'),assert=require('node:assert/strict');
const a=JSON.parse(fs.readFileSync(process.env.PUDDLE_STAGING_AUTH||'../staging-auth.json','utf8'));
const ref=process.env.PUDDLE_STAGING_REF;
assert.ok(ref&&ref!=='amjkbkbmqpaifqurzozg','An explicit non-production staging ref is required');
assert.equal(a.url,`https://${ref}.supabase.co`);
async function call(path,token,method='GET',body,extra={}){
 const response=await fetch(a.url+path,{method,headers:{apikey:a.key,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})});
 const text=await response.text();let data;try{data=JSON.parse(text)}catch{data=text}
 return {status:response.status,ok:response.ok,data};
}
async function signIn(email){const r=await call('/auth/v1/token?grant_type=password',null,'POST',{email,password:a.password});assert.equal(r.status,200,'Synthetic staging sign-in must succeed');return r.data.access_token}
(async()=>{
 const ta=await signIn(a.email_a),tb=await signIn(a.email_b);console.log('PASS: two real staging accounts sign in');
 const ma=await call('/rest/v1/maps?select=id,title,scope,updated_at',ta),mb=await call('/rest/v1/maps?select=id,title,scope,updated_at',tb);
 assert.ok(ma.data.some(m=>m.title==='Staging private A'));assert.ok(!ma.data.some(m=>m.title==='Staging private B'));
 assert.ok(mb.data.some(m=>m.title==='Staging private B'));assert.ok(!mb.data.some(m=>m.title==='Staging private A'));
 console.log('PASS: database row policies isolate private maps');
 const shared=ma.data.find(m=>m.scope==='team');
 const takeover=await call('/rest/v1/maps?id=eq.'+shared.id,tb,'PATCH',{owner_id:a.user_b});assert.equal(takeover.status,403);
 console.log('PASS: shared map ownership takeover is rejected');
 const own=ma.data.find(m=>m.title==='Staging private A');
 const path='/rest/v1/maps?id=eq.'+own.id+'&updated_at=eq.'+encodeURIComponent(own.updated_at);
 const first=await call(path,ta,'PATCH',{title:own.title},{Prefer:'return=representation'});assert.equal(first.data.length,1);
 const stale=await call(path,ta,'PATCH',{title:'Stale overwrite'},{Prefer:'return=representation'});assert.equal(stale.data.length,0);
 console.log('PASS: timestamp-guarded stale writes are rejected');
 const inserted=await Promise.all(Array.from({length:5},(_,i)=>call('/rest/v1/maps',ta,'POST',{team_id:a.team_a,owner_id:a.user_a,scope:'personal',title:'Concurrent staging '+i,data:{nodes:[],edges:[]}},{Prefer:'return=representation'})));
 assert.equal(inserted.filter(r=>r.ok).length,2,'Exactly two remaining map slots must be filled');
 for(const r of inserted.filter(r=>r.ok))assert.ok((await call('/rest/v1/maps?id=eq.'+r.data[0].id,ta,'DELETE')).ok);
 console.log('PASS: concurrent inserts respect the map limit');
 if(a.member_candidates){
  const admissions=await Promise.all(a.member_candidates.map(user_id=>call('/rest/v1/team_members',tb,'POST',{team_id:a.team_b,user_id,role:'member'},{Prefer:'return=representation'})));
  assert.equal(admissions.filter(r=>r.ok).length,1,'Exactly one remaining seat must be filled');
  for(const r of admissions.filter(r=>r.ok))assert.ok((await call('/rest/v1/team_members?team_id=eq.'+a.team_b+'&user_id=eq.'+r.data[0].user_id,tb,'DELETE')).ok);
  console.log('PASS: concurrent admissions respect the seat limit');
 }
 const allowance=await Promise.all(Array.from({length:11},()=>call('/rest/v1/rpc/consume_photo_read',ta,'POST',{})));
 assert.ok(allowance.every(r=>r.status===200));assert.equal(allowance.filter(r=>r.data===true).length,10);assert.equal(allowance.filter(r=>r.data===false).length,1);
 console.log('PASS: concurrent photo allowance is capped at ten across requests');
 const anonymous=await call('/rest/v1/rpc/consume_photo_read',null,'POST',{});assert.ok([401,403].includes(anonymous.status));
 console.log('PASS: anonymous callers cannot obtain a photo allowance');
})().catch(e=>{console.error('FAIL:',e.message);process.exit(1)});
