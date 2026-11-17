(function(){
 'use strict';const $=id=>document.getElementById(id),L=window.PuddleLens;let client,userId='',offset=0,loading=false,shown=new Set(),urls=[];
 function error(text){$('error').textContent=text||'';$('error').hidden=!text;}
 function reset(){for(const url of urls)URL.revokeObjectURL(url);urls=[];shown.clear();$('photos').replaceChildren();offset=0;}
 async function load(more=false,quiet=false){
  if(loading)return;loading=true;$('refresh').disabled=$('more').disabled=true;error('');
  try{
   const s=await L.session(client);if(userId&&s.user.id!==userId)reset();userId=s.user.id;
   if(!quiet&&!more)reset();
   const {data,error:e}=await client.storage.from(L.BUCKET).list(userId,{limit:24,offset:more?offset:0,sortBy:{column:'name',order:'desc'}});if(e)throw e;
   // Do not display a response belonging to an account that has since signed out.
   const current=await L.session(client);if(current.user.id!==userId){reset();return;}
   if(!quiet)offset=(more?offset:0)+data.length;$('more').hidden=data.length<24;
   const fragment=document.createDocumentFragment();
   for(const file of data){if(!file.id||!L.validFilename(file.name)||shown.has(file.name))continue;shown.add(file.name);
    const card=document.createElement('article');card.className='card inbox-item';const img=document.createElement('img');img.className='photo';img.alt='Photo: '+L.titleFromFilename(file.name);img.loading='lazy';
    const title=document.createElement('h2');title.textContent=L.titleFromFilename(file.name);const time=document.createElement('time');time.dateTime=file.created_at;time.textContent=new Date(file.created_at).toLocaleString();
    const link=document.createElement('a');link.className='button review-link';link.href='/image-to-map-prototype.html?lensPhoto='+encodeURIComponent(file.name);link.textContent='Review photo';const remove=document.createElement('button');remove.className='secondary';remove.textContent='Remove photo';remove.onclick=async()=>{if(!confirm('Remove this uploaded photo? Any maps already created from it will be kept.'))return;remove.disabled=true;try{const current=await L.session(client);if(current.user.id!==s.user.id)throw Error('Your account changed. Refresh the inbox.');const {error:e}=await client.storage.from(L.BUCKET).remove([s.user.id+'/'+file.name]);if(e)throw e;card.remove();shown.delete(file.name);$('status').textContent='Photo removed.';}catch(e){error(L.friendly(e));remove.disabled=false;}};const desktopNote=document.createElement('p');desktopNote.className='note desktop-note';desktopNote.textContent='Ready to review on your computer.';card.append(img,title,time,link,desktopNote,remove);fragment.appendChild(card);
    L.download(client,file.name).then(photo=>{if(userId!==s.user.id||!card.isConnected)return;const url=URL.createObjectURL(photo);urls.push(url);img.src=url;}).catch(()=>{img.alt='Preview unavailable. Open Review photo to retry.';});
   }
   if(quiet)$('photos').prepend(fragment);else $('photos').append(fragment);
   $('status').textContent=shown.size?shown.size+' photo'+(shown.size===1?'':'s')+' ready. Choose one to review.':'No photos yet. Send one from Puddle Lens on your phone.';
  }catch(e){if(/Sign in/.test(e.message)){reset();$('status').textContent='';const a=document.createElement('a');a.href='/lens/';a.textContent='Sign in to Puddle Lens';$('status').append(a);}else error(L.friendly(e));}
  finally{loading=false;$('refresh').disabled=$('more').disabled=false;}
 }
 $('refresh').onclick=()=>load();$('more').onclick=()=>load(true);$('phone-link').textContent=location.origin+'/lens/';
 try{client=L.createClient();client.auth.onAuthStateChange((_event,s)=>{if(userId&&s?.user.id!==userId){userId='';reset();load();}});load();setInterval(()=>{if(!document.hidden)load(false,true);},15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load(false,true);});}catch(e){$('status').textContent='';error(L.friendly(e));}
})();
