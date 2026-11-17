/* Lens uses the existing origin's Supabase session; no tokens are placed in links. */
(function(){
 'use strict';
 const BUCKET='puddle-lens',MAX_BYTES=2900000;
 function createClient(){
  const config=window.PUDDLE_CONFIG;
  if(!config?.supabaseUrl||!config?.supabaseKey)throw Error('Puddle Lens is not configured on this site yet.');
  if(!window.supabase)throw Error('The sign-in service could not load. Check your connection and reload.');
  return window.supabase.createClient(config.supabaseUrl,config.supabaseKey);
 }
 function photoName(title){return String(title||'Photo map').trim().replace(/[^\p{L}\p{N} _-]/gu,'').replace(/\s+/g,' ').slice(0,60)||'Photo map';}
 function filename(title){return Date.now()+'_'+crypto.randomUUID()+'__'+btoa(String.fromCharCode(...new TextEncoder().encode(photoName(title)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')+'.jpg';}
 function validFilename(name){return typeof name==='string'&&/^\d{13}_[a-f0-9-]{36}__[A-Za-z0-9_-]+\.jpg$/.test(name)&&name.length<650;}
 function titleFromFilename(name){try{return new TextDecoder().decode(Uint8Array.from(atob(name.split('__').slice(1).join('__').replace(/\.jpg$/,'').replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))||'Photo map';}catch{return 'Photo map';}}
 async function session(client){const {data,error}=await client.auth.getSession();if(error)throw error;if(!data.session)throw Error('Sign in to Puddle Lens with your Puddle account first.');return data.session;}
 async function download(client,name){if(!validFilename(name))throw Error('This photo link is invalid. Open it again from your photo inbox.');const s=await session(client);const {data,error}=await client.storage.from(BUCKET).download(s.user.id+'/'+name);if(error)throw Error('This photo could not be loaded. Check your connection and account, then try again.');return data;}
 function friendly(error){const message=error?.message||'Something went wrong. Please try again.';if(/row.level|policy|unauthorized|permission|403/i.test(message))return 'Your account cannot upload here. Check your Puddle membership or sign in again.';if(/bucket.*not found/i.test(message))return 'Photo uploads are not enabled on this site yet.';if(/fetch|network|timeout/i.test(message))return 'Connection interrupted. Your selected photo is still here. Try again when you are online.';return message;}
 window.PuddleLens={BUCKET,MAX_BYTES,createClient,photoName,filename,validFilename,titleFromFilename,session,download,friendly};
})();
