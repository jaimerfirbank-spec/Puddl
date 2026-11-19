(function(){
 'use strict';
 const $=id=>document.getElementById(id),L=window.PuddleLens,R=window.PuddleLensReviews;
 let client,userId='',offset=0,loading=false,shown=new Set(),urls=[],selected=new Set();
 function error(text){$('error').textContent=text||'';$('error').hidden=!text;}
 function reset(){for(const url of urls)URL.revokeObjectURL(url);urls=[];shown.clear();selected.clear();$('photos').replaceChildren();offset=0;updateCombine();}
 function updateCombine(){const count=selected.size;$('combine').disabled=!count;$('selection-status').textContent=count?count+' approved map'+(count===1?'':'s')+' selected.':'Select approved maps to combine.';}
 function approvalRow(card,file,approval){
  if(!approval)return null;card.classList.add('approved');const badge=document.createElement('span');badge.className='approved-badge';badge.textContent='Approved ✓';
  const row=document.createElement('div');row.className='approval-row';const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.setAttribute('aria-label','Select '+approval.title+' for combined map');
  check.onchange=()=>{if(check.checked)selected.add(file.name);else selected.delete(file.name);updateCombine();};label.append(check,document.createTextNode('Select for combined map'));row.append(label);card.append(badge);return row;
 }
 async function load(more=false,quiet=false){
  if(loading)return;loading=true;$('refresh').disabled=$('more').disabled=true;error('');
  try{
   const s=await L.session(client);if(userId&&s.user.id!==userId)reset();userId=s.user.id;if(!quiet&&!more)reset();
   const {data,error:e}=await client.storage.from(L.BUCKET).list(userId,{limit:24,offset:more?offset:0,sortBy:{column:'name',order:'desc'}});if(e)throw e;
   const current=await L.session(client);if(current.user.id!==userId){reset();return;}if(!quiet)offset=(more?offset:0)+data.length;$('more').hidden=data.length<24;
   const fragment=document.createDocumentFragment();
   for(const file of data){
    if(!file.id||!L.validFilename(file.name)||shown.has(file.name))continue;shown.add(file.name);const approval=R.get(userId,file.name);
    const card=document.createElement('article');card.className='card inbox-item';const img=document.createElement('img');img.className='photo';img.alt='Photo: '+L.titleFromFilename(file.name);img.loading='lazy';
    const title=document.createElement('h2');title.textContent=L.titleFromFilename(file.name);const time=document.createElement('time');time.dateTime=file.created_at;time.textContent=new Date(file.created_at).toLocaleString();
    const link=document.createElement('a');link.className='button review-link';link.href='/image-to-map-prototype.html?lensPhoto='+encodeURIComponent(file.name);link.textContent=approval?'Review or update':'Review photo';
    const remove=document.createElement('button');remove.className='secondary';remove.textContent='Remove photo';remove.onclick=async()=>{if(!confirm('Remove this uploaded photo? Any maps already created from it will be kept.'))return;remove.disabled=true;try{const active=await L.session(client);if(active.user.id!==s.user.id)throw Error('Your account changed. Refresh the inbox.');const {error:removeError}=await client.storage.from(L.BUCKET).remove([s.user.id+'/'+file.name]);if(removeError)throw removeError;R.remove(userId,file.name);selected.delete(file.name);card.remove();shown.delete(file.name);updateCombine();$('status').textContent='Photo removed.';}catch(removeError){error(L.friendly(removeError));remove.disabled=false;}};
    const desktopNote=document.createElement('p');desktopNote.className='note desktop-note';desktopNote.textContent=approval?'Approved and ready to combine.':'Ready to review on your computer.';
    card.append(img,title,time,link);const row=approvalRow(card,file,approval);if(row)card.append(row);card.append(desktopNote,remove);fragment.appendChild(card);
    L.download(client,file.name).then(photo=>{if(userId!==s.user.id||!card.isConnected)return;const url=URL.createObjectURL(photo);urls.push(url);img.src=url;}).catch(()=>{img.alt='Preview unavailable. Open Review photo to retry.';});
   }
   if(quiet)$('photos').prepend(fragment);else $('photos').append(fragment);const totalApproved=[...shown].filter(name=>R.get(userId,name)).length;$('combine-bar').hidden=!totalApproved;
   $('status').textContent=shown.size?shown.size+' photo'+(shown.size===1?'':'s')+' ready. '+(totalApproved?totalApproved+' approved.':'Choose one to review.'):'No photos yet. Send one from Puddle Lens on your phone.';
  }catch(loadError){if(/Sign in/.test(loadError.message)){reset();$('status').textContent='';const a=document.createElement('a');a.href='/lens/';a.textContent='Sign in to Puddle Lens';$('status').append(a);}else error(L.friendly(loadError));}
  finally{loading=false;$('refresh').disabled=$('more').disabled=false;}
 }
 $('combine').onclick=()=>{try{const approvals=[...selected].map(name=>R.get(userId,name)).filter(Boolean),title=approvals.length===1?approvals[0].title:'Combined workshop map';const payload=R.combine(approvals,title);sessionStorage.setItem('puddl_image_import',JSON.stringify(payload));location.href='/?imageImport=1';}catch(combineError){error(combineError.message||'Could not prepare the combined map.');}};
 $('refresh').onclick=()=>load();$('more').onclick=()=>load(true);$('phone-link').textContent=location.origin+'/lens/';
 try{client=L.createClient();client.auth.onAuthStateChange((_event,s)=>{if(userId&&s?.user.id!==userId){userId='';reset();load();}});load();setInterval(()=>{if(!document.hidden)load(false,true);},15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load(false,true);});}catch(startError){$('status').textContent='';error(L.friendly(startError));}
})();
