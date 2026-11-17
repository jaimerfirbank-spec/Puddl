(function(){
 'use strict';
 const $=id=>document.getElementById(id),L=window.PuddleLens;
 let client,user=null,image=null,rotation=0,blob=null,previewUrl='',uploadName='',busy=false,selection=0;
 function status(text){$('status').textContent=text;}
 function error(text){$('error').textContent=text||'';$('error').hidden=!text;}
 function step(name){for(const key of ['photo','check','send']){const el=$('step-'+key);if(key===name)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');}}
 function lock(value){busy=value;for(const id of ['send','rotate','retake','signout','take','choose'])$(id).disabled=value;$('progress').hidden=!value;}
 function clearPhoto(){selection++;image=null;blob=null;uploadName='';rotation=0;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';$('preview').removeAttribute('src');$('camera').value='';$('gallery').value='';$('title').value='';$('check').hidden=true;$('sent').hidden=true;$('pick').hidden=false;step('photo');}
 function showUser(next){if(busy)return;const previous=user?.id;user=next;$('signin').hidden=!!user;$('capture').hidden=!user;$('signout').hidden=!user;$('account').textContent=user?'Signed in as '+user.email:'';if(previous!==user?.id)clearPhoto();status('');}
 async function prepare(){
  const source=image;if(!source)return;const canvas=document.createElement('canvas'),turned=rotation%180!==0;
  const scale=Math.min(1,2000/Math.max(source.naturalWidth,source.naturalHeight));
  const w=Math.max(1,Math.round(source.naturalWidth*scale)),h=Math.max(1,Math.round(source.naturalHeight*scale));
  canvas.width=turned?h:w;canvas.height=turned?w:h;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(source,-w/2,-h/2,w,h);
  const result=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));if(!result||result.size>L.MAX_BYTES)throw Error('This photo is too large to send. Try a smaller photo.');return result;
 }
 async function refreshPreview(){const n=selection,result=await prepare();if(n!==selection)return;blob=result;uploadName='';if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(blob);$('preview').src=previewUrl;}
 async function choose(file){
  if(!file||busy)return;const n=++selection;error('');status('Preparing photo…');$('take').disabled=$('choose').disabled=true;
  try{
   if(file.size>25*1024*1024)throw Error('Choose a photo smaller than 25 MB.');
   if(!file.type.startsWith('image/'))throw Error('Choose a photo, rather than a document.');
   const url=URL.createObjectURL(file),next=new Image();try{next.src=url;await next.decode();}catch{throw Error('This photo format cannot be opened here. Try a JPG, PNG or WebP photo.');}finally{URL.revokeObjectURL(url);}
   if(n!==selection)return;image=next;rotation=0;await refreshPreview();if(n!==selection)return;
   $('title').value=L.photoName(file.name.replace(/\.[^.]+$/,'')==='image'?'Photo map':file.name.replace(/\.[^.]+$/,''));
   $('pick').hidden=true;$('sent').hidden=true;$('check').hidden=false;step('check');status('');
  }catch(e){if(n===selection){error(L.friendly(e));status('');}}finally{$('take').disabled=$('choose').disabled=false;}
 }
 $('take').onclick=()=>$('camera').click();$('choose').onclick=()=>$('gallery').click();
 for(const id of ['camera','gallery'])$(id).addEventListener('change',()=>choose($(id).files?.[0]));
 $('rotate').onclick=async()=>{if(busy)return;lock(true);try{rotation=(rotation+90)%360;await refreshPreview();error('');}catch(e){error(L.friendly(e));}finally{lock(false);}};
 $('retake').onclick=$('another').onclick=()=>{if(busy)return;clearPhoto();status('');error('');};
 $('title').addEventListener('input',()=>{uploadName='';});
 $('login').addEventListener('submit',async event=>{event.preventDefault();error('');$('login-button').disabled=true;try{const {data,error:e}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(e)throw e;$('password').value='';showUser(data.user);}catch(e){error(L.friendly(e));}finally{$('login-button').disabled=false;}});
 $('signout').onclick=async()=>{if(busy)return;try{const {error:e}=await client.auth.signOut({scope:'local'});if(e)throw e;showUser(null);error('');}catch(e){error(L.friendly(e));}};
 $('send').onclick=async()=>{
  if(busy||!blob)return;lock(true);$('title').disabled=true;error('');status('Sending photo…');step('send');
  try{
   const s=await L.session(client);if(s.user.id!==user?.id)throw Error('Your account changed. Sign in again before sending this photo.');
   if(!uploadName)uploadName=L.filename($('title').value);const path=s.user.id+'/'+uploadName;
   const {error:e}=await client.storage.from(L.BUCKET).upload(path,blob,{contentType:'image/jpeg',cacheControl:'0',upsert:false});
   // A retry after a lost response may find the first upload already completed.
   if(e){if(String(e.statusCode)==='409'||/already exists|duplicate/i.test(e.message)){const existing=await L.download(client,uploadName);if(existing.size!==blob.size)throw Error('Please choose the photo again before retrying.');}else throw e;}
   $('check').hidden=true;$('sent').hidden=false;status('Photo sent.');
  }catch(e){error(L.friendly(e));status('Photo not confirmed as sent. You can retry.');step('check');}
  finally{lock(false);$('title').disabled=false;}
 };
 window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
 window.addEventListener('offline',()=>{if(!busy)status('You are offline. Reconnect before sending.');});
 window.addEventListener('online',()=>{if(!busy)status('Back online.');});
 (async()=>{try{client=L.createClient();const {data,error:e}=await client.auth.getSession();if(e)throw e;showUser(data.session?.user||null);client.auth.onAuthStateChange((_event,s)=>showUser(s?.user||null));}catch(e){status('');error(L.friendly(e));}})();
})();
