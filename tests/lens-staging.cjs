// Uses synthetic accounts only, with a strict non-production project guard.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const ref=process.env.PUDDLE_STAGING_REF;assert.equal(ref,'bzzmmnwfwfcqbhgdmutx');const a=JSON.parse(fs.readFileSync(process.env.PUDDLE_STAGING_AUTH,'utf8'));assert.equal(a.url,`https://${ref}.supabase.co`);
 async function login(email){const r=await fetch(a.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:a.key,'Content-Type':'application/json'},body:JSON.stringify({email,password:a.password})});assert.ok(r.ok,'staging login');return r.json();}
 const [A,B]=await Promise.all([login(a.email_a),login(a.email_b)]),name=Date.now()+'_'+crypto.randomUUID()+'__VGVzdA.jpg',key=A.user.id+'/'+name;
 async function req(route,token,method='GET',body,type){return fetch(a.url+'/storage/v1/'+route,{method,headers:{apikey:a.key,Authorization:'Bearer '+(token||a.key),...(type?{'Content-Type':type}:{})},body});}
 const photo=fs.readFileSync('../large-map-check/30-node-prepared-photo.jpg');
 assert.ok((await req('object/puddle-lens/'+key,A.access_token,'POST',photo,'image/jpeg')).ok,'owner uploads');
 try{
  const own=await req('object/authenticated/puddle-lens/'+key,A.access_token);assert.ok(own.ok,'owner downloads');assert.equal(Buffer.from(await own.arrayBuffer()).compare(photo),0);
  assert.ok(!(await req('object/authenticated/puddle-lens/'+key,B.access_token)).ok,'other account cannot read');
  assert.ok(!(await req('object/public/puddle-lens/'+key,null)).ok,'public cannot read');
  assert.ok(!(await req('object/puddle-lens/'+A.user.id+'/'+crypto.randomUUID()+'.jpg',B.access_token,'POST',photo,'image/jpeg')).ok,'other account cannot upload into owner folder');
  assert.ok(!(await req('object/puddle-lens/'+key,A.access_token,'PUT',photo,'image/jpeg')).ok,'existing photos cannot be overwritten');
  assert.ok(!(await req('object/puddle-lens/'+A.user.id+'/'+crypto.randomUUID()+'.txt',A.access_token,'POST',Buffer.from('not a photo'),'text/plain')).ok,'non-images rejected');
  assert.ok(!(await req('object/puddle-lens/'+A.user.id+'/'+crypto.randomUUID()+'.jpg',A.access_token,'POST',Buffer.alloc(2900001),'image/jpeg')).ok,'oversized photos rejected');
  const r=await req('object/list/puddle-lens',B.access_token,'POST',JSON.stringify({prefix:A.user.id,limit:100}),'application/json');assert.ok(r.ok);assert.equal((await r.json()).length,0,'other account cannot list owner photos');
  console.log('PASS: real staging upload/download bytes, account isolation, private access, overwrite protection, MIME and size bounds');
 }finally{const r=await req('object/puddle-lens',A.access_token,'DELETE',JSON.stringify({prefixes:[key]}),'application/json');assert.ok(r.ok,'synthetic test photo cleaned up');}
})().catch(e=>{console.error(e.message);process.exit(1)});
